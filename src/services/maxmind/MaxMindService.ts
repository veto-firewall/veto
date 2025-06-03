/**
 * MaxMindService handles GeoIP and ASN lookups
 * Clean implementation with static imports
 */
import { getSettings, saveSettings, getValue, setValue } from '../storage/StorageService';
import { getGeoIpCache, getAsnCache } from '../cache/CacheService';
import { isValid as _isValid } from 'ipaddr.js';
// Static imports instead of dynamic imports
import { Reader } from 'mmdb-lib';
import type { CountryResponse, AsnResponse } from 'mmdb-lib/lib/reader/response';
import * as tarStream from 'tar-stream';
import type { Readable } from 'stream';

/**
 * Settings interface with MaxMind configuration
 */
export interface MaxMindServiceSettings {
  maxmind: MaxMindConfig;
  [key: string]: unknown;
}

/**
 * MaxMind credentials configuration
 */
export interface MaxMindConfig {
  licenseKey: string;
  lastDownload?: number;
}

/**
 * MaxMind database file information
 */
interface MMDBFile {
  name: string;
  data: Uint8Array;
}

/**
 * Reader instance for MaxMind databases
 */
interface ReaderInstance<T> {
  get(_ip: string): T | null;
}

/**
 * Service for MaxMind GeoIP operations
 */
export class MaxMindService {
  /**
   * GeoIP database reader
   */
  private geoIpReader: ReaderInstance<CountryResponse> | null = null;

  /**
   * ASN database reader
   */
  private asnReader: ReaderInstance<AsnResponse> | null = null;

  /**
   * MaxMind configuration
   */
  private config: MaxMindConfig | null = null;

  /**
   * Creates a new MaxMind service
   */
  constructor() {}

  /**
   * Initialize the MaxMind service
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    // Get MaxMind configuration from settings
    const settings = await getSettings<MaxMindServiceSettings>();

    if (settings && settings.maxmind) {
      this.config = settings.maxmind;

      // Load databases if license key is available
      if (this.config && this.config.licenseKey) {
        const now = Date.now();
        const lastDownload = this.config.lastDownload || 0;
        const oneMonth = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

        if (now - lastDownload > oneMonth) {
          await this.downloadDatabases();

          // Update the last download timestamp
          await this.updateLastDownloadTimestamp(now, settings);
        } else {
          await Promise.all([this.loadGeoIpDatabase(), this.loadAsnDatabase()]);
        }
      }
    }
  }

  /**
   * Get the MaxMind configuration
   * @returns The current MaxMind configuration
   */
  getConfig(): MaxMindConfig | null {
    return this.config;
  }

  /**
   * Update the MaxMind configuration
   * @param config - New configuration
   */
  async updateConfig(config: MaxMindConfig): Promise<boolean> {
    this.config = config;

    // Update settings
    const settings = await getSettings<MaxMindServiceSettings>();
    if (settings) {
      settings.maxmind = config;
      return saveSettings<MaxMindServiceSettings>(settings);
    }

    // If no settings exist yet, create them
    const newSettings: MaxMindServiceSettings = {
      maxmind: config,
    };
    return saveSettings<MaxMindServiceSettings>(newSettings);
  }

  /**
   * Load the GeoIP database from storage into memory
   * @returns Promise resolving to true if successful
   */
  async loadGeoIpDatabase(): Promise<boolean> {
    try {
      // Check if reader already exists
      if (this.geoIpReader) {
        return true;
      }

      // Get from storage
      const geoipDatabase = await getValue<ArrayBuffer>('geoipDatabase');

      if (!geoipDatabase) {
        return false;
      }

      // Use the Buffer polyfill to handle ArrayBuffer
      const buffer = Buffer.from(geoipDatabase);

      // Use static import - Reader is already imported
      this.geoIpReader = new Reader<CountryResponse>(buffer as Buffer<ArrayBufferLike>);

      return true;
    } catch (error) {
      console.error('Failed to load GeoIP database:', error);
      this.geoIpReader = null;
      return false;
    }
  }

  /**
   * Load the ASN database from storage into memory
   * @returns Promise resolving to true if successful
   */
  async loadAsnDatabase(): Promise<boolean> {
    try {
      // Check if reader already exists
      if (this.asnReader) {
        return true;
      }

      // Get from storage
      const asnDatabase = await getValue<ArrayBuffer>('asnDatabase');

      if (!asnDatabase) {
        return false;
      }

      // Convert ArrayBuffer to Buffer for mmdb-lib
      const buffer = Buffer.from(asnDatabase);

      // Use static import - Reader is already imported
      this.asnReader = new Reader<AsnResponse>(buffer as Buffer<ArrayBufferLike>);

      return true;
    } catch (error) {
      console.error('Failed to load ASN database:', error);
      this.asnReader = null;
      return false;
    }
  }

  /**
   * Look up a country by IP address
   * @param ip - IP address to look up
   * @returns Promise resolving to country code or null
   */
  async getCountryByIp(ip: string): Promise<string | null> {
    try {
      // Validate IP address
      if (!_isValid(ip)) {
        return null;
      }

      // Check cache first
      const geoIpCache = getGeoIpCache();
      if (geoIpCache.has(ip)) {
        return geoIpCache.get(ip) as string;
      }

      // Load database if needed
      if (!this.geoIpReader) {
        const loaded = await this.loadGeoIpDatabase();
        if (!loaded) {
          return null;
        }
      }

      // Perform lookup
      const result = this.geoIpReader!.get(ip);

      if (!result || !result.country) {
        return null;
      }

      const country = result.country.iso_code;

      // Cache the result
      geoIpCache.set(ip, country);

      return country;
    } catch (error) {
      console.error(`Failed to get country for IP ${ip}:`, error);
      return null;
    }
  }

  /**
   * Look up an ASN by IP address
   * @param ip - IP address to look up
   * @returns Promise resolving to ASN or null
   */
  async getAsnByIp(ip: string): Promise<number | null> {
    try {
      // Validate IP address
      if (!_isValid(ip)) {
        return null;
      }

      // Check cache first
      const asnCache = getAsnCache();
      if (asnCache.has(ip)) {
        return asnCache.get(ip) as number;
      }

      // Load database if needed
      if (!this.asnReader) {
        const loaded = await this.loadAsnDatabase();
        if (!loaded) {
          return null;
        }
      }

      // Perform lookup
      const result = this.asnReader!.get(ip);

      if (!result) {
        return null;
      }

      const asn = result.autonomous_system_number;

      // Cache the result
      asnCache.set(ip, asn);

      return asn;
    } catch (error) {
      console.error(`Failed to get ASN for IP ${ip}:`, error);
      return null;
    }
  }

  /**
   * Download MaxMind GeoLite2 databases
   * @returns Promise resolving to true if successful
   */
  async downloadDatabases(): Promise<boolean> {
    try {
      if (!this.config || !this.config.licenseKey) {
        console.error('License key is required for MaxMind downloads');
        return false;
      }

      const licenseKey = this.config.licenseKey;

      // MaxMind download URLs
      const baseUrl = 'https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2';
      const suffix = `&license_key=${licenseKey}&suffix=tar.gz`;
      const countryUrl = `${baseUrl}-Country${suffix}`;
      const asnUrl = `${baseUrl}-ASN${suffix}`;

      const [countryResponse, asnResponse] = await Promise.all([fetch(countryUrl), fetch(asnUrl)]);

      if (!countryResponse.ok || !asnResponse.ok) {
        console.error('Failed to download MaxMind databases', {
          countryStatus: countryResponse.status,
          countryStatusText: countryResponse.statusText,
          asnStatus: asnResponse.status,
          asnStatusText: asnResponse.statusText,
        });
        return false;
      }

      const countryArrayBuffer = await countryResponse.arrayBuffer();
      const asnArrayBuffer = await asnResponse.arrayBuffer();

      const countryData = await this.extractMMDBFromTarGz(countryArrayBuffer, 'Country');
      const asnData = await this.extractMMDBFromTarGz(asnArrayBuffer, 'ASN');

      if (!countryData || !asnData) {
        console.error('Failed to extract database files');
        return false;
      }

      // Save the extracted databases
      await Promise.all([
        setValue('geoipDatabase', countryData),
        setValue('asnDatabase', asnData),
      ]);

      // Load the databases into memory
      await this.loadGeoIpDatabase();
      await this.loadAsnDatabase();

      return true;
    } catch (e) {
      console.error('Error downloading MaxMind databases:', e);
      return false;
    }
  }

  /**
   * Extract MMDB file from a tar.gz archive
   * @param arrayBuffer - Compressed tar.gz archive
   * @param databaseType - Type of database to extract
   * @returns Promise resolving to extracted database or null
   */
  private async extractMMDBFromTarGz(
    arrayBuffer: ArrayBuffer,
    databaseType?: string,
  ): Promise<ArrayBuffer | null> {
    try {
      // Step 1: Decompress the gzip stream
      const ds = new DecompressionStream('gzip');
      const decompressedStream = new Response(arrayBuffer).body!.pipeThrough(ds);

      // Step 2: Extract and process files from the tar archive
      const mmdbFiles = await this.extractTarFiles(decompressedStream);

      if (mmdbFiles.length === 0) {
        console.error('No MMDB files found in archive');
        return null;
      }

      // Step 3: Select the appropriate file based on database type
      const selectedFile = this.selectMMDBFile(mmdbFiles, databaseType);

      // Return the data as an ArrayBuffer for consistency
      return selectedFile.data.buffer;
    } catch (e) {
      console.error('Error extracting MMDB from tar.gz:', e);
      return null;
    }
  }

  /**
   * Extract files from a tar archive stream
   * @param stream - Decompressed stream
   * @returns Promise resolving to array of extracted files
   */
  private async extractTarFiles(stream: ReadableStream<Uint8Array>): Promise<Array<MMDBFile>> {
    // Create extractor - use static import
    const extractor = tarStream.extract();
    const mmdbFiles: Array<MMDBFile> = [];

    // Set up promise for extraction completion
    const extractionPromise = new Promise<Array<MMDBFile>>((resolve, reject) => {
      // Handle file entries in the tar
      extractor.on('entry', (header: tarStream.Headers, stream: Readable, next: () => void) => {
        // Only process files with .mmdb extension
        if (header.type !== 'file' || !header.name.toLowerCase().endsWith('.mmdb')) {
          stream.resume(); // Skip this file
          next();
          return;
        }

        const chunks: Uint8Array[] = [];

        stream.on('data', (chunk: Buffer | Uint8Array) => chunks.push(new Uint8Array(chunk)));

        stream.on('end', () => {
          // Concatenate chunks into a single Uint8Array
          const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
          const data = new Uint8Array(totalLength);

          let offset = 0;
          for (const chunk of chunks) {
            data.set(chunk, offset);
            offset += chunk.length;
          }

          mmdbFiles.push({ name: header.name, data });
          next();
        });

        stream.on('error', (_err: Error) => {
          next();
        });
      });

      extractor.on('finish', () => resolve(mmdbFiles));
      extractor.on('error', (err: Error) => reject(err));
    });

    // Pump data from the readable stream to the extractor
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          extractor.end();
          break;
        }
        extractor.write(value);
      }
    } catch (err) {
      console.error('Error reading stream:', err);
      extractor.destroy(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }

    return extractionPromise;
  }

  /**
   * Select the appropriate MMDB file based on database type
   * @param files - Array of extracted files
   * @param databaseType - Type of database to select
   * @returns Selected file
   */
  private selectMMDBFile(files: Array<MMDBFile>, databaseType?: string): MMDBFile {
    // Default to the first file if no database type specified
    let selectedFile = files[0];

    if (databaseType) {
      const matchingFile = files.find(f =>
        f.name.toLowerCase().includes(databaseType.toLowerCase()),
      );

      if (matchingFile) {
        selectedFile = matchingFile;
      }
    }

    return selectedFile;
  }

  /**
   * Refresh MaxMind service and related components after configuration changes
   * @returns Promise resolving to true if refresh was successful
   */
  async refreshService(): Promise<boolean> {
    try {
      // Clear existing readers to force reload
      this.geoIpReader = null;
      this.asnReader = null;

      // Clear MaxMind-related caches
      const geoIpCache = getGeoIpCache();
      const asnCache = getAsnCache();
      geoIpCache.clear();
      asnCache.clear();

      if (!this.config || !this.config.licenseKey) {
        return false;
      }

      // First try to load existing databases from storage
      const [geoLoaded, asnLoaded] = await Promise.all([
        this.loadGeoIpDatabase(),
        this.loadAsnDatabase(),
      ]);

      if (geoLoaded && asnLoaded) {
        return true;
      }

      // If databases not in storage or failed to load, download fresh ones
      return await this.downloadDatabases();
    } catch (error) {
      console.error('Error during MaxMind service refresh:', error);
      return false;
    }
  }

  /**
   * Update the last download timestamp in the settings
   * @param timestamp - The timestamp to set
   * @param settings - The current settings object
   */
  private async updateLastDownloadTimestamp(
    timestamp: number,
    settings: MaxMindServiceSettings | null,
  ): Promise<void> {
    if (!this.config) {
      return;
    }

    this.config.lastDownload = timestamp;

    if (!settings) {
      return;
    }

    settings.maxmind = this.config;
    await saveSettings<MaxMindServiceSettings>(settings);
  }
}

// Standalone function exports for use with converted services
let maxMindServiceInstance: MaxMindService | null = null;

/**
 * Get MaxMind service instance (temporary compatibility)
 */
function getMaxMindInstance(): MaxMindService {
  if (!maxMindServiceInstance) {
    // Temporarily use ServiceFactory for initialization
    const { ServiceFactory } = require('../ServiceFactory');
    maxMindServiceInstance = ServiceFactory.getInstance().getMaxMindService();
  }
  return maxMindServiceInstance!;
}

/**
 * Look up a country by IP address
 * @param ip - IP address to look up
 * @returns Promise resolving to country code or null
 */
export async function getCountryByIp(ip: string): Promise<string | null> {
  const instance = getMaxMindInstance();
  return instance.getCountryByIp(ip);
}

/**
 * Look up an ASN by IP address
 * @param ip - IP address to look up
 * @returns Promise resolving to ASN or null
 */
export async function getAsnByIp(ip: string): Promise<number | null> {
  const instance = getMaxMindInstance();
  return instance.getAsnByIp(ip);
}
