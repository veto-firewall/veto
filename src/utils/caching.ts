import { LRUCache } from 'lru-cache';

/**
 * Cache for DNS resolution results
 * Maps domain names to resolved IP addresses
 */
export const dnsCache = new LRUCache<string, string>({
  max: 1000,
  ttl: 1000 * 60 * 15, // 15 minutes
});

/**
 * Cache for IP classification results
 * Maps IP addresses to classification status (true/false)
 * Has shorter TTL for more frequent refreshes
 */
export const ipClassificationCache = new LRUCache<string, boolean>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes - shorter TTL for more frequent refreshes
});

/**
 * Cache for GeoIP lookup results
 * Maps IP addresses to country codes
 */
export const geoIpCache = new LRUCache<string, string>({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour
});

/**
 * Cache for ASN lookup results
 * Maps IP addresses to Autonomous System Numbers
 */
export const asnCache = new LRUCache<string, number>({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour
});

/**
 * Cache for rule matching results
 * Maps URL/domain patterns to match results (allow/block)
 */
export const ruleMatchCache = new LRUCache<string, boolean>({
  max: 2000,
  ttl: 1000 * 60 * 5, // 5 minutes
});

/**
 * Cache for MaxMind Database files
 * Maps database names to their ArrayBuffer contents
 * Keeps databases in memory to avoid frequent disk reads
 */
export const mmdbCache = new LRUCache<string, ArrayBuffer>({
  max: 2,
  ttl: 1000 * 60 * 60 * 24 * 30, // 30 days
});

/**
 * Cache for country lookup data
 * Contains static country information (codes, names, etc.)
 * Long TTL since this data rarely changes
 */
export const countryLookupCache = new LRUCache<
  string,
  Record<string, Record<string, string>> | Record<string, string>
>({
  max: 1,
  ttl: 1000 * 60 * 60 * 24 * 365, // 1 year - effectively permanent for static data
});
