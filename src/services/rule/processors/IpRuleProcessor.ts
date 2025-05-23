/**
 * Processor for IP-based rules
 */
import { BaseRuleProcessor, CacheCallback } from './BaseRuleProcessor';
import type { RuleSet } from '../../types';
import { ServiceFactory } from '../../ServiceFactory';

/**
 * Handles processing of IP-based rules
 */
export class IpRuleProcessor extends BaseRuleProcessor {
  /**
   * Network service for IP address operations
   * @private
   */
  private networkService;

  /**
   * Creates a new IP rule processor
   * @param rules - Rules to process
   * @param cacheCallback - Function to update the rule match cache
   */
  constructor(rules: RuleSet, cacheCallback: CacheCallback) {
    super(rules, cacheCallback);
    this.networkService = ServiceFactory.getInstance().getNetworkService();
  }

  /**
   * Process IP rules for a URL
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
    if (this.rules.blockedIps.length === 0 && this.rules.allowedIps.length === 0) {
      return null;
    }

    const ip = await this.networkService.resolveDomain(url.hostname);
    if (!ip) {
      return null;
    }

    // First, find any matching allowed IP rule
    const allowedRule = this.rules.allowedIps.find(
      rule => rule.enabled && this.networkService.ipMatchesRange(ip, rule.value),
    );

    // Check if there's a terminating allow rule - these take highest precedence
    if (allowedRule && allowedRule.isTerminating) {
      console.log(`IP ${ip} matched terminating allow rule: ${allowedRule.value}`);
      this.cacheCallback(cacheKey, false);
      return { cancel: false };
    }

    // Then check for blocked IPs - block rules always override non-terminating allow rules
    const blockedRule = this.rules.blockedIps.find(
      rule => rule.enabled && this.networkService.ipMatchesRange(ip, rule.value),
    );

    if (blockedRule) {
      console.log(`IP ${ip} matched block rule: ${blockedRule.value}`);
      this.cacheCallback(cacheKey, true);

      if (details) {
        this.logBlock(details, ip, 'ip');
      }

      return { cancel: true };
    }

    // If we have a non-terminating allow rule and no block rule matched, allow the request
    if (allowedRule) {
      console.log(`IP ${ip} matched non-terminating allow rule: ${allowedRule.value}`);
      this.cacheCallback(cacheKey, false);
      return { cancel: false };
    }

    return null;
  }
}
