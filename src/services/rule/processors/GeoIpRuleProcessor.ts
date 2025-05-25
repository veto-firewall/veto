/**
 * Processor for GeoIP-based rules
 */
import { BaseRuleProcessor, CacheCallback } from './BaseRuleProcessor';
import type { RuleSet } from '../../types';
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
    details?: browser.webRequest._OnBeforeRequestDetails,
  ): Promise<{ cancel: boolean } | null> {
    if (Object.keys(this.rules.blockedCountries).length === 0) {
      return null;
    }

    const ip = await this.networkService.resolveDomain(url.hostname);
    if (!ip) {
      return null;
    }

    const country = await this.maxmindService.getCountryByIp(ip);

    if (!country) {
      return null;
    }

    const isBlocked = this.rules.blockedCountries[country];
    if (isBlocked) {
      this.cacheCallback(cacheKey, true);

      if (details) {
        this.logBlock(details, ip, 'geoip', { location: country });
      }

      return { cancel: true };
    }

    return null;
  }
}
