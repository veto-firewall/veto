/**
 * CacheService provides centralized cache management for the application
 * Manages various LRU caches for different types of data
 */
import type { IService } from '../types';
import { LRUCache } from 'lru-cache';

/**
 * Service for managing different types of caches
 */
export class CacheService implements IService {
  /**
   * Cache for DNS resolution results
   * Maps domain names to resolved IP addresses
   * @private
   */
  private _dnsCache: LRUCache<string, string>;
  
  /**
   * Cache for IP classification results
   * Maps IP addresses to classification status (true/false)
   * @private
   */
  private _ipClassificationCache: LRUCache<string, boolean>;
  
  /**
   * Cache for GeoIP lookup results
   * Maps IP addresses to country codes
   * @private
   */
  private _geoIpCache: LRUCache<string, string>;
  
  /**
   * Cache for ASN lookup results
   * Maps IP addresses to Autonomous System Numbers
   * @private
   */
  private _asnCache: LRUCache<string, number>;
  
  /**
   * Cache for rule matching results
   * Maps URL/domain patterns to match results (allow/block)
   * @private
   */
  private _ruleMatchCache: LRUCache<string, boolean>;
  
  /**
   * Cache for MaxMind Database files
   * Maps database names to their ArrayBuffer contents
   * @private
   */
  private _mmdbCache: LRUCache<string, ArrayBuffer>;
  
  /**
   * Cache for country lookup data
   * Contains static country information (codes, names, etc.)
   * @private
   */
  private _countryLookupCache: LRUCache<string, Record<string, Record<string, string>> | Record<string, string>>;
  
  /**
   * Creates a new cache service with initialized caches
   */
  constructor() {
    this._dnsCache = new LRUCache<string, string>({
      max: 1000,
      ttl: 1000 * 60 * 15, // 15 minutes
    });
    
    this._ipClassificationCache = new LRUCache<string, boolean>({
      max: 1000,
      ttl: 1000 * 60 * 5, // 5 minutes - shorter TTL for more frequent refreshes
    });
    
    this._geoIpCache = new LRUCache<string, string>({
      max: 1000,
      ttl: 1000 * 60 * 60, // 1 hour
    });
    
    this._asnCache = new LRUCache<string, number>({
      max: 1000,
      ttl: 1000 * 60 * 60, // 1 hour
    });
    
    this._ruleMatchCache = new LRUCache<string, boolean>({
      max: 2000,
      ttl: 1000 * 60 * 5, // 5 minutes
    });
    
    this._mmdbCache = new LRUCache<string, ArrayBuffer>({
      max: 2,
      ttl: 1000 * 60 * 60 * 24 * 30, // 30 days
    });
    
    this._countryLookupCache = new LRUCache<
      string,
      Record<string, Record<string, string>> | Record<string, string>
    >({
      max: 1,
      ttl: 1000 * 60 * 60 * 24 * 365, // 1 year - effectively permanent for static data
    });
  }
  
  /**
   * Initialize the cache service
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    // No initialization required at this time
    return Promise.resolve();
  }
  
  /**
   * Get the DNS cache
   * @returns The DNS cache instance
   */
  get dnsCache(): LRUCache<string, string> {
    return this._dnsCache;
  }
  
  /**
   * Get the IP classification cache
   * @returns The IP classification cache instance
   */
  get ipClassificationCache(): LRUCache<string, boolean> {
    return this._ipClassificationCache;
  }
  
  /**
   * Get the GeoIP cache
   * @returns The GeoIP cache instance
   */
  get geoIpCache(): LRUCache<string, string> {
    return this._geoIpCache;
  }
  
  /**
   * Get the ASN cache
   * @returns The ASN cache instance
   */
  get asnCache(): LRUCache<string, number> {
    return this._asnCache;
  }
  
  /**
   * Get the rule match cache
   * @returns The rule match cache instance
   */
  get ruleMatchCache(): LRUCache<string, boolean> {
    return this._ruleMatchCache;
  }
  
  /**
   * Get the MaxMind database cache
   * @returns The MMDB cache instance
   */
  get mmdbCache(): LRUCache<string, ArrayBuffer> {
    return this._mmdbCache;
  }
  
  /**
   * Get the country lookup cache
   * @returns The country lookup cache instance
   */
  get countryLookupCache(): LRUCache<
    string,
    Record<string, Record<string, string>> | Record<string, string>
  > {
    return this._countryLookupCache;
  }
  
  /**
   * Clear all caches
   */
  clearAll(): void {
    this._dnsCache.clear();
    this._ipClassificationCache.clear();
    this._geoIpCache.clear();
    this._asnCache.clear();
    this._ruleMatchCache.clear();
    this._mmdbCache.clear();
    this._countryLookupCache.clear();
  }
}
