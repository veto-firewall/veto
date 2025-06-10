/**
 * NetworkService handles network-related operations
 * Centralizes DNS resolution and IP address handling
 */
import { getDnsCache, getIpClassificationCache } from '../cache/CacheService';
import { parse, parseCIDR, isValid } from 'ipaddr.js';

/**
 * Check if an IP address is in a private range
 * Private ranges include loopback, link-local, private, and reserved addresses
 *
 * @param ip - IP address to check
 * @returns True if the IP is in a private range, false otherwise
 */
export function isPrivateIP(ip: string): boolean {
  const cache = getIpClassificationCache();

  if (cache.has(ip)) {
    return cache.get(ip) as boolean;
  }

  try {
    const addr = parse(ip);
    let isPrivate = false;

    if (addr.kind() === 'ipv4') {
      isPrivate = addr.range() !== 'unicast';
    } else {
      // For IPv6, check if it's unicast range
      isPrivate = addr.range() !== 'unicast';

      // Also check for loopback - ::1/128
      const ipString = addr.toString();
      if (ipString === '::1') {
        isPrivate = true;
      }
    }

    cache.set(ip, isPrivate);
    return isPrivate;
  } catch (error) {
    console.error(`Error checking if ${ip} is private:`, error);
    return false;
  }
}

/**
 * Check if an IP matches a specific range (CIDR notation or start-end range)
 *
 * @param ip - IP address to check
 * @param range - IP range in CIDR notation (e.g., "192.168.1.0/24") or start-end format (e.g., "192.168.1.1-192.168.1.100")
 * @returns True if IP is in the specified range, false otherwise
 */
export function ipMatchesRange(ip: string, range: string): boolean {
  try {
    if (range.includes('/')) {
      // CIDR notation (e.g., "192.168.1.0/24")
      const parsedRange = parseCIDR(range);
      const addr = parse(ip);
      return addr.match(parsedRange);
    } else if (range.includes('-')) {
      // Start-end range (e.g., "192.168.1.1-192.168.1.100")
      const [start, end] = range.split('-').map(part => parse(part.trim()));
      const addr = parse(ip);

      if (start.kind() !== end.kind() || addr.kind() !== start.kind()) {
        return false;
      }

      const startBigInt = BigInt(
        '0x' +
          start
            .toByteArray()
            .map((b: number) => b.toString(16).padStart(2, '0'))
            .join(''),
      );
      const endBigInt = BigInt(
        '0x' +
          end
            .toByteArray()
            .map((b: number) => b.toString(16).padStart(2, '0'))
            .join(''),
      );
      const addrBigInt = BigInt(
        '0x' +
          addr
            .toByteArray()
            .map((b: number) => b.toString(16).padStart(2, '0'))
            .join(''),
      );

      return addrBigInt >= startBigInt && addrBigInt <= endBigInt;
    } else {
      // Exact match
      return ip === range;
    }
  } catch (error) {
    console.error(`Error checking if ${ip} matches range ${range}:`, error);
    return false;
  }
}

/**
 * Check if a hostname resolves to a private IP address
 * @param hostname - Hostname to check
 * @returns Promise resolving to true if hostname resolves to a private IP
 */
export async function isPrivateHost(hostname: string): Promise<boolean> {
  // If hostname is a direct IP address
  try {
    if (isValid(hostname)) {
      return isPrivateIP(hostname);
    }
  } catch (error) {
    console.error(`Error checking if ${hostname} is a valid IP:`, error);
  }

  // For domain names, resolve to IP first
  try {
    // Use resolveDomain with useCache=false to ensure fresh resolution
    const ip = await resolveDomain(hostname, false);
    if (ip) {
      return isPrivateIP(ip);
    }
  } catch (error) {
    console.error(`Error resolving hostname ${hostname}:`, error);
  }

  return false;
}

/**
 * Resolve a domain name to its IP address
 * @param domain - Domain name to resolve
 * @param useCache - Whether to use the DNS cache
 * @returns Promise resolving to IP address or null
 */
export async function resolveDomain(
  domain: string,
  useCache: boolean = true,
): Promise<string | null> {
  // If domain is already an IP address, return it directly
  try {
    if (isValid(domain)) {
      return domain;
    }
  } catch (error) {
    console.error(`Error checking if ${domain} is a valid IP:`, error);
  }

  const cache = getDnsCache();

  // Check DNS cache if we're using it
  if (useCache && cache.has(domain)) {
    const cachedIp = cache.get(domain) as string;
    return cachedIp;
  }

  // Clear cache if we're explicitly not using it
  if (!useCache) {
    cache.delete(domain);
  }

  try {
    const result = await browser.dns.resolve(domain);
    if (result && result.addresses && result.addresses.length > 0) {
      const ip = result.addresses[0];
      cache.set(domain, ip);
      return ip;
    } else {
      console.warn(`DNS resolution for ${domain} returned no addresses`);
    }
  } catch (e) {
    console.error(`DNS resolution failed for ${domain}:`, e);
  }

  return null;
}
