/**
 * Processor for GeoIP-based rules
 */
import { BaseRuleProcessor, CacheCallback } from './BaseRuleProcessor';
import { RuleSet } from '../../types';
import { ServiceFactory } from '../../ServiceFactory';

/**
 * Handles processing of GeoIP-based rules
 */
export class GeoIpRuleProcessor extends BaseRuleProcessor {
  /**
   * MaxMind service for country lookups
   * @private
   */
  private maxmindService;
  
  /**
   * Network service for domain resolution
   * @private
   */
  private networkService;

  /**
   * Creates a new GeoIP rule processor
   * @param rules - Rules to process
   * @param cacheCallback - Function to update the rule match cache
   */
  constructor(rules: RuleSet, cacheCallback: CacheCallback) {
    super(rules, cacheCallback);
    const serviceFactory = ServiceFactory.getInstance();
    this.maxmindService = serviceFactory.getMaxMindService();
    this.networkService = serviceFactory.getNetworkService();
  }
  
  /**
   * Process GeoIP rules for a URL
   * @param url - URL to process rules for
   * @param cacheKey - Cache key for this request
   * @param details - Optional web request details
   * @returns Promise resolving to blocking response or null if no match
   */
  async process(
    url: URL,
    cacheKey: string,
    details?: browser.webRequest._OnBeforeRequestDetails
  ): Promise<{ cancel: boolean } | null> {
    if (Object.keys(this.rules.blockedCountries).length === 0) {
      return null;
    }

    const ip = await this.networkService.resolveDomain(url.hostname);
    if (!ip) {
      console.log(`Could not resolve IP for ${url.hostname}`);
      return null;
    }

    console.log(`Checking GeoIP rules for ${url.hostname} (IP: ${ip})`);
    const country = await this.maxmindService.getCountryByIp(ip);
    console.log(`Country lookup result for ${ip}: ${country}`);

    if (!country) {
      console.log(`Could not determine country for ${ip}`);
      return null;
    }

    const isBlocked = this.rules.blockedCountries[country];
    if (isBlocked) {
      console.log(`Request blocked by GeoIP rule: ${url.hostname} (Country: ${country})`);
      this.cacheCallback(cacheKey, true);

      if (details) {
        this.logBlock(details, ip, 'geoip', { location: country });
      }

      return { cancel: true };
    } else {
      console.log(`Country ${country} is not in the block list, request allowed`);
    }

    return null;
  }
}
