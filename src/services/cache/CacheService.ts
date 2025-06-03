/**
 * CacheService provides centralized cache management for the application
 * Manages various LRU caches for different types of data
 */
import { LRUCache } from 'lru-cache';

/**
 * Cache for DNS resolution results
 * Maps domain names to resolved IP addresses
 */
const dnsCache = new LRUCache<string, string>({
  max: 1000,
  ttl: 1000 * 60 * 15, // 15 minutes
});

/**
 * Cache for IP classification results
 * Maps IP addresses to classification status (true/false)
 */
const ipClassificationCache = new LRUCache<string, boolean>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes - shorter TTL for more frequent refreshes
});

/**
 * Cache for GeoIP lookup results
 * Maps IP addresses to country codes
 */
const geoIpCache = new LRUCache<string, string>({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour
});

/**
 * Cache for ASN lookup results
 * Maps IP addresses to Autonomous System Numbers
 */
const asnCache = new LRUCache<string, number>({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour
});

/**
 * Cache for rule matching results
 * Maps URL/domain patterns to match results (allow/block)
 */
const ruleMatchCache = new LRUCache<string, boolean>({
  max: 2000,
  ttl: 1000 * 60 * 5, // 5 minutes
});

/**
 * Cache for MaxMind Database files
 * Maps database names to their ArrayBuffer contents
 */
const mmdbCache = new LRUCache<string, ArrayBuffer>({
  max: 2,
  ttl: 1000 * 60 * 60 * 24 * 30, // 30 days
});

/**
 * Cache for country lookup data
 * Contains static country information (codes, names, etc.)
 */
const countryLookupCache = new LRUCache<
  string,
  Record<string, Record<string, string>> | Record<string, string>
>({
  max: 1,
  ttl: 1000 * 60 * 60 * 24 * 365, // 1 year - effectively permanent for static data
});

/**
 * Get the DNS cache
 * @returns The DNS cache instance
 */
export function getDnsCache(): LRUCache<string, string> {
  return dnsCache;
}

/**
 * Get the IP classification cache
 * @returns The IP classification cache instance
 */
export function getIpClassificationCache(): LRUCache<string, boolean> {
  return ipClassificationCache;
}

/**
 * Get the GeoIP cache
 * @returns The GeoIP cache instance
 */
export function getGeoIpCache(): LRUCache<string, string> {
  return geoIpCache;
}

/**
 * Get the ASN cache
 * @returns The ASN cache instance
 */
export function getAsnCache(): LRUCache<string, number> {
  return asnCache;
}

/**
 * Get the rule match cache
 * @returns The rule match cache instance
 */
export function getRuleMatchCache(): LRUCache<string, boolean> {
  return ruleMatchCache;
}

/**
 * Get the MaxMind database cache
 * @returns The MMDB cache instance
 */
export function getMmdbCache(): LRUCache<string, ArrayBuffer> {
  return mmdbCache;
}

/**
 * Get the country lookup cache
 * @returns The country lookup cache instance
 */
export function getCountryLookupCache(): LRUCache<
  string,
  Record<string, Record<string, string>> | Record<string, string>
> {
  return countryLookupCache;
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  dnsCache.clear();
  ipClassificationCache.clear();
  geoIpCache.clear();
  asnCache.clear();
  ruleMatchCache.clear();
  mmdbCache.clear();
  countryLookupCache.clear();
}
