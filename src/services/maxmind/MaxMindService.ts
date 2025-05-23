/**
 * MaxMindService handles all operations related to MaxMind GeoIP databases
 * Manages downloading, loading, and querying MaxMind GeoLite2 databases
 */
import { IService } from '../types';
import { StorageService } from '../storage/StorageService';
import { ServiceFactory } from '../ServiceFactory';
import { isValid as _isValid } from 'ipaddr.js';
// Import types only for TypeScript - Reader will be dynamically imported
import type { Reader as _Reader } from 'mmdb-lib';
import type { CountryResponse, AsnResponse } from 'mmdb-lib/lib/reader/response';
import type * as tarStream from 'tar-stream';
import type { Readable } from 'stream';

/**
 * Settings interface with MaxMind configuration
 */
export interface MaxMindServiceSettings {
  maxmind: MaxMindConfig;
  [key: string]: any;
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
export class MaxMindService implements IService {
  /**
   * Storage service for persistent data
   */
  private storageService: StorageService;
  
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
   * Cache service for data caching
   */
  private cacheService = ServiceFactory.getInstance().getCacheService();
  
  /**
   * Creates a new MaxMind service
   * @param storageService - Storage service for persistent data
   */
  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }
  
  /**
   * Initialize the MaxMind service
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    // Get MaxMind configuration from settings
    const settings = await this.storageService.getSettings<MaxMindServiceSettings>();
    
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
          if (this.config) {
            this.config.lastDownload = now;
            if (settings) {
              settings.maxmind = this.config;
              await this.storageService.saveSettings<MaxMindServiceSettings>(settings);
            }
          }
        } else {
          await Promise.all([
            this.loadGeoIpDatabase(),
            this.loadAsnDatabase()
          ]);
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
    const settings = await this.storageService.getSettings<MaxMindServiceSettings>();
    if (settings) {
      settings.maxmind = config;
      return this.storageService.saveSettings<MaxMindServiceSettings>(settings);
    }
    
    // If no settings exist yet, create them
    const newSettings: MaxMindServiceSettings = {
      maxmind: config
    };
    return this.storageService.saveSettings<MaxMindServiceSettings>(newSettings);
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
      const geoipDatabase = await this.storageService.getValue<ArrayBuffer>('geoipDatabase');

      if (!geoipDatabase) {
        return false;
      }

      // Use the Buffer polyfill to handle ArrayBuffer
      const buffer = Buffer.from(geoipDatabase);

      // Dynamically import the Reader class to reduce initial bundle size
      const { Reader } = await import('mmdb-lib');

      // Create reader with the buffer
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
      const asnDatabase = await this.storageService.getValue<ArrayBuffer>('asnDatabase');

      if (!asnDatabase) {
        return false;
      }

      // Convert ArrayBuffer to Buffer for mmdb-lib
      const buffer = Buffer.from(asnDatabase);

      // Dynamically import the Reader class to reduce initial bundle size
      const { Reader } = await import('mmdb-lib');

      // Create reader
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
      if (this.cacheService.geoIpCache.has(ip)) {
        return this.cacheService.geoIpCache.get(ip) as string;
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
      this.cacheService.geoIpCache.set(ip, country);

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
      if (this.cacheService.asnCache.has(ip)) {
        return this.cacheService.asnCache.get(ip) as number;
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
      this.cacheService.asnCache.set(ip, asn);

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

      console.log('Downloading MaxMind databases... (URLs masked for privacy)');
      console.log(
        'Country DB URL format: https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-Country&license_key=[YOUR_KEY]&suffix=tar.gz',
      );
      console.log(
        'ASN DB URL format: https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-ASN&license_key=[YOUR_KEY]&suffix=tar.gz',
      );

      const [countryResponse, asnResponse] = await Promise.all([fetch(countryUrl), fetch(asnUrl)]);

      if (!countryResponse.ok || !asnResponse.ok) {
        console.error('Failed to download MaxMind databases', {
          countryStatus: countryResponse.status,
          countryStatusText: countryResponse.statusText,
          asnStatus: asnResponse.status,
          asnStatusText: asnResponse.statusText,
        });

        // Try to get more error information
        try {
          const errorTexts = await Promise.all([
            countryResponse.text().catch(() => 'Unable to get error details'),
            asnResponse.text().catch(() => 'Unable to get error details'),
          ]);
          console.error('Error details:', {
            countryResponseText: errorTexts[0],
            asnResponseText: errorTexts[1],
          });
        } catch (err) {
          console.error('Could not retrieve error details:', err);
        }
        return false;
      }

      const countryArrayBuffer = await countryResponse.arrayBuffer();
      const asnArrayBuffer = await asnResponse.arrayBuffer();

      console.log(
        'Downloaded Country database archive size:',
        countryArrayBuffer.byteLength,
        'bytes',
      );
      console.log('Downloaded ASN database archive size:', asnArrayBuffer.byteLength, 'bytes');

      console.log('Extracting Country database from tar.gz archive...');
      const countryData = await this.extractMMDBFromTarGz(countryArrayBuffer, 'Country');
      if (!countryData) {
        console.error('Failed to extract Country database - extraction returned null');
      }

      console.log('Extracting ASN database from tar.gz archive...');
      const asnData = await this.extractMMDBFromTarGz(asnArrayBuffer, 'ASN');
      if (!asnData) {
        console.error('Failed to extract ASN database - extraction returned null');
      }

      if (!countryData || !asnData) {
        console.error('One or both database extractions failed');
        return false;
      }

      // Log database sizes for debugging
      console.log('Extracted Country database size:', countryData.byteLength, 'bytes');
      console.log('Extracted ASN database size:', asnData.byteLength, 'bytes');

      // Save the extracted databases
      await Promise.all([
        this.storageService.setValue('geoipDatabase', countryData),
        this.storageService.setValue('asnDatabase', asnData),
      ]);

      console.log('Successfully saved databases to local storage');

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
      // Import the tar-stream library
      const tar = await import('tar-stream');

      // Step 1: Decompress the gzip stream
      const ds = new DecompressionStream('gzip');
      const decompressedStream = new Response(arrayBuffer).body!.pipeThrough(ds);

      // Step 2: Extract and process files from the tar archive
      const mmdbFiles = await this.extractTarFiles(tar, decompressedStream);

      if (mmdbFiles.length === 0) {
        console.error('No MMDB files found in archive');
        return null;
      }

      // Step 3: Select the appropriate file based on database type
      const selectedFile = this.selectMMDBFile(mmdbFiles, databaseType);
      console.log(
        `Extracted MMDB file: ${selectedFile.name} with size ${selectedFile.data.byteLength} bytes`,
      );

      // Return the data as an ArrayBuffer for consistency
      return selectedFile.data.buffer;
    } catch (e) {
      console.error('Error extracting MMDB from tar.gz:', e);
      console.error(e instanceof Error ? e.stack : String(e));
      return null;
    }
  }
  
  /**
   * Extract files from a tar archive stream
   * @param tar - Tar stream library
   * @param stream - Decompressed stream
   * @returns Promise resolving to array of extracted files
   */
  private async extractTarFiles(
    tar: typeof import('tar-stream'),
    stream: ReadableStream<Uint8Array>,
  ): Promise<Array<MMDBFile>> {
    // Create extractor
    const extractor = tar.extract();
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

        stream.on('error', (err: Error) => {
          console.error('Stream error:', err);
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
      const matchingFile = files.find(f => f.name.toLowerCase().includes(databaseType.toLowerCase()));

      if (matchingFile) {
        selectedFile = matchingFile;
      }
    }

    return selectedFile;
  }
}
