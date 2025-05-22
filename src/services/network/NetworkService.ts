/**
 * NetworkService handles network-related operations
 * Centralizes DNS resolution and IP address handling
 */
import { IService } from '../types';
import { resolveDomain } from '../../utils/dns';
import { isPrivateIP } from '../../utils/ip';
import { dnsCache } from '../../utils/caching';
import { isValid } from 'ipaddr.js';

/**
 * Service for network operations
 */
export class NetworkService implements IService {
  /**
   * Initialize the network service
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    return Promise.resolve();
  }
  
  /**
   * Check if a hostname resolves to a private IP address
   * @param hostname - Hostname to check
   * @returns Promise resolving to true if hostname resolves to a private IP
   */
  async isPrivateHost(hostname: string): Promise<boolean> {
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
      dnsCache.delete(hostname); // Clear the cache to ensure fresh resolution
      const ip = await resolveDomain(hostname);
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
  async resolveDomain(domain: string, useCache: boolean = true): Promise<string | null> {
    if (!useCache) {
      dnsCache.delete(domain);
    }
    
    return resolveDomain(domain);
  }
}
