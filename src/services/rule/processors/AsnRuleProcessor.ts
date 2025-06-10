/**
 * Processor for ASN-based rules
 */
import { BaseRuleProcessor, CacheCallback } from './BaseRuleProcessor';
import type { RuleSet, Rule } from '../../types';
import { resolveDomain } from '../../network/NetworkService';
import { getAsnByIp } from '../../maxmind/MaxMindService';

/**
 * Handles processing of ASN-based rules
 */
export class AsnRuleProcessor extends BaseRuleProcessor {
  /**
   * Creates a new ASN rule processor
   * @param rules - Rules to process
   * @param cacheCallback - Function to update the rule match cache
   */
  constructor(rules: RuleSet, cacheCallback: CacheCallback) {
    super(rules, cacheCallback);
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

    const ip = await resolveDomain(url.hostname);
    if (!ip) {
      return null;
    }

    const asn = await getAsnByIp(ip);

    if (asn === null) {
      return null;
    }

    // Find a matching allow rule
    const allowRule = this.findAsnAllowRule(asn);

    // Check if there's a terminating allow rule - these take highest precedence
    if (allowRule && allowRule.isTerminating) {
      this.cacheCallback(cacheKey, false);
      return { cancel: false };
    }

    // Check for block rules - these override non-terminating allow rules
    const blockRule = this.findAsnBlockRule(asn);
    if (blockRule) {
      this.cacheCallback(cacheKey, true);

      if (details) {
        this.logBlock(details, ip, 'asn', { asn });
      }

      return { cancel: true };
    }

    // If we have a non-terminating allow rule and no block rule matched, allow the request
    if (allowRule) {
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
      return matches;
    });
  }
}
