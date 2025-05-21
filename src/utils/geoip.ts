import { geoIpCache, asnCache } from './caching';
import { isValid as _isValid } from 'ipaddr.js';
// Import types only for TypeScript - Reader will be dynamically imported
import type { Reader as _Reader } from 'mmdb-lib';
import type { CountryResponse, AsnResponse } from 'mmdb-lib/lib/reader/response';

// Define a type for the reader to avoid using 'any'
interface ReaderInstance<T> {
  get(_ip: string): T | null;
}

// Database reader instances with proper typing
let geoIpReader: ReaderInstance<CountryResponse> | null = null;
let asnReader: ReaderInstance<AsnResponse> | null = null;

/**
 * Load the GeoIP database from storage into memory
 */
export async function loadGeoIpDatabase(): Promise<boolean> {
  try {
    // Check if reader already exists
    if (geoIpReader) {
      return true;
    }

    // Get from storage
    const result = await browser.storage.local.get('geoipDatabase');

    if (!result.geoipDatabase) {
      return false;
    }

    // Use the Buffer polyfill to handle ArrayBuffer
    const buffer = Buffer.from(result.geoipDatabase as ArrayBuffer);

    // Dynamically import the Reader class to reduce initial bundle size
    const { Reader } = await import('mmdb-lib');

    // Create reader with the buffer
    geoIpReader = new Reader<CountryResponse>(buffer as Buffer<ArrayBufferLike>);

    return true;
  } catch (error) {
    void error;
    geoIpReader = null;
    return false;
  }
}

/**
 * Load the ASN database from storage into memory
 */
export async function loadAsnDatabase(): Promise<boolean> {
  try {
    // Check if reader already exists
    if (asnReader) {
      return true;
    }

    // Get from storage
    const result = await browser.storage.local.get('asnDatabase');

    if (!result.asnDatabase) {
      return false;
    }

    // Convert ArrayBuffer to Buffer for mmdb-lib
    const buffer = Buffer.from(result.asnDatabase as ArrayBuffer);

    // Dynamically import the Reader class to reduce initial bundle size
    const { Reader } = await import('mmdb-lib');

    // Create reader
    asnReader = new Reader<AsnResponse>(buffer as Buffer<ArrayBufferLike>);

    return true;
  } catch (error) {
    void error;
    asnReader = null;
    return false;
  }
}

/**
 * Look up a country by IP address using the MaxMind GeoLite2 database
 */
export async function getCountryByIp(ip: string): Promise<string | null> {
  try {
    // Validate IP address
    if (!_isValid(ip)) {
      return null;
    }

    // Check cache first
    if (geoIpCache.has(ip)) {
      return geoIpCache.get(ip) as string;
    }

    // Load database if needed
    if (!geoIpReader) {
      const loaded = await loadGeoIpDatabase();
      if (!loaded) {
        return null;
      }
    }

    // Perform lookup
    const result = geoIpReader!.get(ip);

    if (!result || !result.country) {
      return null;
    }

    const country = result.country.iso_code;

    // Cache the result
    geoIpCache.set(ip, country);

    return country;
  } catch (error) {
    void error;
    return null;
  }
}

/**
 * Look up an ASN by IP address using the MaxMind GeoLite2 database
 */
export async function getAsnByIp(ip: string): Promise<number | null> {
  try {
    // Validate IP address
    if (!_isValid(ip)) {
      return null;
    }

    // Check cache first
    if (asnCache.has(ip)) {
      return asnCache.get(ip) as number;
    }

    // Load database if needed
    if (!asnReader) {
      const loaded = await loadAsnDatabase();
      if (!loaded) {
        return null;
      }
    }

    // Perform lookup
    const result = asnReader!.get(ip);

    if (!result) {
      return null;
    }

    const asn = result.autonomous_system_number;

    // Cache the result
    asnCache.set(ip, asn);

    return asn;
  } catch (error) {
    void error;
    return null;
  }
}
