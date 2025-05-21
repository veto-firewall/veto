import { Settings, RuleSet, type Rule as _Rule } from './types';
import { loadGeoIpDatabase, loadAsnDatabase } from './geoip';
import type * as tarStream from 'tar-stream';
import type { Readable } from 'stream';

// Define file structure interface for MMDB files
interface MMDBFile {
  name: string;
  data: Uint8Array;
}

const DEFAULT_SETTINGS: Settings = {
  suspendUntilFiltersLoad: false,
  maxmind: {
    licenseKey: '',
  },
  httpHandling: 'redirect',
  blockRemoteFonts: false,
  blockImages: false,
  blockMedia: false,
  blockPrivateIPs: false,
  sectionStates: {
    'settings-section': false, // Settings closed by default
    'basic-rules-section': true, // Others open by default
    'dnr-rules-section': true,
    'ip-rules-section': true,
    'asn-rules-section': true,
    'geoip-section': true,
  },
};

const DEFAULT_RULESET: RuleSet = {
  allowedDomains: [],
  blockedDomains: [],
  allowedUrls: [],
  blockedUrls: [],
  allowedRegex: [],
  blockedRegex: [],
  trackingParams: [],
  allowedIps: [],
  blockedIps: [],
  allowedAsns: [],
  blockedAsns: [],
  blockedCountries: {},
};

export async function getSettings(): Promise<Settings> {
  try {
    const result = await browser.storage.local.get('settings');
    return result.settings || DEFAULT_SETTINGS;
  } catch (error) {
    void error;
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<boolean> {
  try {
    await browser.storage.local.set({ settings });

    if (settings.maxmind.licenseKey) {
      const now = Date.now();
      const lastDownload = settings.maxmind.lastDownload || 0;
      const oneMonth = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

      if (now - lastDownload > oneMonth) {
        await downloadMaxMindDatabases(settings.maxmind);
      } else {
        await loadGeoIpDatabase();
        await loadAsnDatabase();
      }
    }
    return true;
  } catch (error) {
    void error;
    return false;
  }
}

export async function getRules(): Promise<RuleSet> {
  try {
    const result = await browser.storage.local.get('rules');
    const rules = (result.rules as RuleSet) || DEFAULT_RULESET;
    return rules;
  } catch (_e) {
    void console.error('Failed to retrieve rules from storage:', _e);
    return DEFAULT_RULESET;
  }
}

export async function saveRules(rules: RuleSet): Promise<boolean> {
  try {
    await browser.storage.local.set({ rules });
    return true;
  } catch (e) {
    console.error('Failed to save rules to storage:', e);
    return false;
  }
}

async function downloadMaxMindDatabases(credentials: { licenseKey: string }): Promise<boolean> {
  try {
    const licenseKey = credentials.licenseKey;
    if (!licenseKey) {
      console.error('License key is required for MaxMind downloads');
      return false;
    }

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

    // Set a flag to identify which database type we're extracting
    console.log(
      'Downloaded Country database archive size:',
      countryArrayBuffer.byteLength,
      'bytes',
    );
    console.log('Downloaded ASN database archive size:', asnArrayBuffer.byteLength, 'bytes');

    console.log('Extracting Country database from tar.gz archive...');
    const countryData = await extractMMDBFromTarGz(countryArrayBuffer, 'Country');
    if (!countryData) {
      console.error('Failed to extract Country database - extraction returned null');
    }

    console.log('Extracting ASN database from tar.gz archive...');
    const asnData = await extractMMDBFromTarGz(asnArrayBuffer, 'ASN');
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
      browser.storage.local.set({ geoipDatabase: countryData }),
      browser.storage.local.set({ asnDatabase: asnData }),
    ]);

    console.log('Successfully saved databases to local storage');

    // Update the last download timestamp
    const settings = await getSettings();
    settings.maxmind.lastDownload = Date.now();
    await saveSettings(settings);

    // Load the databases into memory
    await loadGeoIpDatabase();
    await loadAsnDatabase();

    return true;
  } catch (e) {
    console.error('Error downloading MaxMind databases:', e);
    return false;
  }
}

/**
 * Extracts MMDB file from a tar.gz archive using native DecompressionStream and tar-stream
 *
 * This function handles:
 * 1. Decompressing the gzip stream using DecompressionStream
 * 2. Parsing the tar file and extracting MMDB files
 * 3. Selecting the appropriate file based on database type
 *
 * @param arrayBuffer - The compressed tar.gz archive as ArrayBuffer
 * @param databaseType - Optional database type to extract (Country or ASN)
 * @returns Promise resolving to ArrayBuffer containing MMDB data or null if extraction failed
 */
async function extractMMDBFromTarGz(
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
    const mmdbFiles = await extractTarFiles(tar, decompressedStream);

    if (mmdbFiles.length === 0) {
      console.error('No MMDB files found in archive');
      return null;
    }

    // Step 3: Select the appropriate file based on database type
    const selectedFile = selectMMDBFile(mmdbFiles, databaseType);
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
 * Extracts files from a tar archive stream
 *
 * @param tar - The tar-stream library module
 * @param stream - Decompressed readable stream
 * @returns Promise resolving to array of extracted files
 */
async function extractTarFiles(
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
 * Selects the appropriate MMDB file based on database type
 *
 * @param files - Array of extracted files
 * @param databaseType - Optional type specification (Country or ASN)
 * @returns The selected file
 */
function selectMMDBFile(files: Array<MMDBFile>, databaseType?: string): MMDBFile {
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
