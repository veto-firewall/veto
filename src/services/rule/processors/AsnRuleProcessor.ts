/**
 * Processor for ASN-based rules
 */
import { BaseRuleProcessor, CacheCallback } from './BaseRuleProcessor';
import type { RuleSet, Rule } from '../../types';
import { ServiceFactory } from '../../ServiceFactory';

/**
 * Handles processing of ASN-based rules
 */
export class AsnRuleProcessor extends BaseRuleProcessor {
  /**
   * MaxMind service for ASN lookups
   * @private
   */
  private maxmindService;

  /**
   * Network service for domain resolution
   * @private
   */
  private networkService;

  /**
   * Creates a new ASN rule processor
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
   * Process ASN rules for a URL
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
    if (this.rules.blockedAsns.length === 0 && this.rules.allowedAsns.length === 0) {
      return null;
    }

    const ip = await this.networkService.resolveDomain(url.hostname);
    if (!ip) {
      console.log(`Could not resolve IP for ${url.hostname}`);
      return null;
    }

    console.log(`Checking ASN rules for ${url.hostname} (IP: ${ip})`);
    const asn = await this.maxmindService.getAsnByIp(ip);
    console.log(`ASN lookup result for ${ip}: ${asn}`);

    if (asn === null) {
      console.log(`Could not determine ASN for ${ip}`);
      return null;
    }

    // Find a matching allow rule
    const allowRule = this.findAsnAllowRule(asn);

    // Check if there's a terminating allow rule - these take highest precedence
    if (allowRule && allowRule.isTerminating) {
      console.log(`Request allowed by terminating ASN rule: ${url.hostname} (ASN: ${asn})`);
      this.cacheCallback(cacheKey, false);
      return { cancel: false };
    }

    // Check for block rules - these override non-terminating allow rules
    const blockRule = this.findAsnBlockRule(asn);
    if (blockRule) {
      console.log(`Request blocked by ASN rule: ${url.hostname} (ASN: ${asn})`);
      this.cacheCallback(cacheKey, true);

      if (details) {
        this.logBlock(details, ip, 'asn', { asn });
      }

      return { cancel: true };
    }

    // If we have a non-terminating allow rule and no block rule matched, allow the request
    if (allowRule) {
      console.log(`Request allowed by non-terminating ASN rule: ${url.hostname} (ASN: ${asn})`);
      this.cacheCallback(cacheKey, false);
      return { cancel: false };
    }

    return null;
  }

  /**
   * Find a matching ASN allow rule
   * @param asn - The ASN to check
   * @returns A matching rule or undefined if no match
   */
  private findAsnAllowRule(asn: number): Rule | undefined {
    return this.rules.allowedAsns.find(rule => {
      const ruleAsn = parseInt(rule.value);
      const matches = rule.enabled && ruleAsn === asn;
      if (matches) {
        console.log(`ASN ${asn} matches allowed ASN rule: ${rule.value}`);
      }
      return matches;
    });
  }

  /**
   * Find a matching ASN block rule
   * @param asn - The ASN to check
   * @returns A matching rule or undefined if no match
   */
  private findAsnBlockRule(asn: number): Rule | undefined {
    return this.rules.blockedAsns.find(rule => {
      const ruleAsn = parseInt(rule.value);
      const matches = rule.enabled && ruleAsn === asn;
      if (matches) {
        console.log(`ASN ${asn} matches blocked ASN rule: ${rule.value}`);
      }
      return matches;
    });
  }
}
