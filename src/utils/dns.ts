import { dnsCache } from './caching';
import { isValid } from 'ipaddr.js';

export async function resolveDomain(domain: string): Promise<string | null> {
  // If domain is already an IP address, return it directly
  try {
    if (isValid(domain)) {
      return domain;
    }
  } catch (error) {
    void error;
  }

  if (dnsCache.has(domain)) {
    const cachedIp = dnsCache.get(domain) as string;
    return cachedIp;
  }

  try {
    const result = await browser.dns.resolve(domain);
    if (result && result.addresses && result.addresses.length > 0) {
      const ip = result.addresses[0];
      dnsCache.set(domain, ip);
      return ip;
    } else {
      void console.warn(`DNS resolution for ${domain} returned no addresses`);
    }
  } catch (e) {
    void console.error(`DNS resolution failed for ${domain}:`, e);
  }

  return null;
}
