/**
 * Processor for domain and URL-based declarative rules
 */
import { BaseProcessor, ALL_RESOURCE_TYPES } from './BaseProcessor';
import type { Rule } from '../../types';

/**
 * Handles creation of domain and URL-based declarative network rules
 */
export class DomainRuleProcessor extends BaseProcessor {
  /**
   * Maximum length of a regex pattern
   */
  private maxRegexLength: number;

  /**
   * Creates a new domain rule processor
   */
  constructor() {
    super();
    // Set a default max regex length (Firefox limitation)
    this.maxRegexLength = 1024;
  }

  /**
   * Create domain rules with regex optimization
   * @param rules - Domain rules to process
   * @param startId - Starting rule ID
   * @param action - Action to take (block or allow)
   * @returns Array of declarative network request rules
   */
  createDomainRules(
    rules: Rule[],
    startId: number,
    action: 'block' | 'allow',
  ): browser.declarativeNetRequest.Rule[] {
    // Filter enabled rules
    const enabledRules = rules.filter(rule => rule.enabled);
    if (enabledRules.length === 0) return [];

    const domainValues = enabledRules.map(rule => rule.value);

    // Create regex patterns (multiple if needed to stay under length limit)
    const patterns = this.createRegexPatterns(domainValues);

    // Create rules from patterns
    return this.createRulesFromPatterns(patterns, startId, action);
  }

  /**
   * Create URL rules
   * @param rules - URL rules to process
   * @param startId - Starting rule ID
   * @param action - Action to take (block or allow)
   * @returns Array of declarative network request rules
   */
  createUrlRules(
    rules: Rule[],
    startId: number,
    action: 'block' | 'allow',
  ): browser.declarativeNetRequest.Rule[] {
    const dnrRules: browser.declarativeNetRequest.Rule[] = [];
    let id = startId;

    // Filter enabled rules
    const enabledRules = rules.filter(rule => rule.enabled);
    if (enabledRules.length === 0) return dnrRules;

    // Process each URL rule individually
    for (const rule of enabledRules) {
      const ruleAction: browser.declarativeNetRequest._RuleAction =
        action === 'block'
          ? { type: 'block' }
          : rule.action === 'redirect'
            ? { type: 'redirect', redirect: { url: rule.value } }
            : { type: 'allow' };

      // Use higher priority for allow rules to short-circuit processing
      const priority = action === 'allow' ? 50 : 10;

      dnrRules.push({
        id: id++,
        priority: priority,
        action: ruleAction,
        condition: {
          urlFilter: rule.value,
          resourceTypes: ALL_RESOURCE_TYPES,
        },
      });

      this.service.incrementRuleCount();
    }

    return dnrRules;
  }

  /**
   * Create rules from regex patterns
   * @param patterns - Regex patterns
   * @param startId - Starting rule ID
   * @param action - Action to take (block or allow)
   * @returns Array of declarative network request rules
   */
  private createRulesFromPatterns(
    patterns: string[],
    startId: number,
    action: 'block' | 'allow',
  ): browser.declarativeNetRequest.Rule[] {
    const dnrRules: browser.declarativeNetRequest.Rule[] = [];
    let id = startId;

    // Create rules from patterns
    for (const pattern of patterns) {
      const ruleAction: browser.declarativeNetRequest._RuleAction =
        action === 'block' ? { type: 'block' } : { type: 'allow' };

      // Use higher priority for allow rules to short-circuit processing
      const priority = action === 'allow' ? 50 : 10;

      dnrRules.push({
        id: id++,
        priority: priority,
        action: ruleAction,
        condition: {
          regexFilter: `.*://(.*\\.)?${pattern}/.*`,
          resourceTypes: ALL_RESOURCE_TYPES,
        },
      });

      this.service.incrementRuleCount();
    }

    return dnrRules;
  }

  /**
   * Create regex patterns from domain lists with optimizations
   * @param domains - List of domains
   * @returns Array of regex patterns
   */
  private createRegexPatterns(domains: string[]): string[] {
    if (domains.length === 0) return [];

    // Group domains by TLD for better compression
    const domainsByTLD: Record<string, string[]> = {};

    // Process and group domains
    for (const domain of domains) {
      const parts = domain.split('.');

      // Skip invalid domains
      if (parts.length < 2) continue;

      const tld = parts[parts.length - 1];
      if (!domainsByTLD[tld]) {
        domainsByTLD[tld] = [];
      }

      domainsByTLD[tld].push(domain);
    }

    const patterns: string[] = [];

    // Process each TLD group
    for (const tld in domainsByTLD) {
      // Sort domains by length for better grouping potential
      const domainGroup = domainsByTLD[tld].sort((a, b) => a.length - b.length);

      let currentPattern = '';

      for (const domain of domainGroup) {
        // Escape dots in domain name for regex
        const escapedDomain = domain.replace(/([\\\.])/g, '\\$1');

        // Check if adding this domain would exceed the regex length limit
        if (currentPattern.length + escapedDomain.length + 1 > this.maxRegexLength) {
          // Add the current pattern to the list and start a new one
          patterns.push(currentPattern);
          currentPattern = escapedDomain;
        } else {
          // Add to current pattern with separator if needed
          currentPattern = currentPattern ? `${currentPattern}|${escapedDomain}` : escapedDomain;
        }
      }

      // Add the last pattern if it exists
      if (currentPattern) {
        patterns.push(currentPattern);
      }
    }

    return patterns;
  }
}
