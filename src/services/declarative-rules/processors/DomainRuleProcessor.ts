/**
 * Processor for domain and URL-based declarative rules - Function-based version
 */
import { BaseProcessor, ALL_RESOURCE_TYPES } from './BaseProcessor';
import type { Rule } from '../../types';
import { MAX_REGEX_LENGTH } from '../DeclarativeRuleService';

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
    this.maxRegexLength = MAX_REGEX_LENGTH;
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

      this.incrementRuleCount();
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

      this.incrementRuleCount();
    }

    return dnrRules;
  }

  /**
   * Create regex patterns from domain lists with optimizations
   * @param domains - List of domains
   * @returns Array of regex patterns
   */
  private createRegexPatterns(domains: string[]): string[] {
    const patterns: string[] = [];
    let currentPattern = '';

    for (const domain of domains) {
      // Escape special regex characters in the domain
      const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Check if adding this domain would exceed the regex length limit
      const newPattern = currentPattern ? `${currentPattern}|${escapedDomain}` : escapedDomain;

      if (newPattern.length > this.maxRegexLength) {
        // Save the current pattern and start a new one
        if (currentPattern) {
          patterns.push(currentPattern);
        }
        currentPattern = escapedDomain;
      } else {
        currentPattern = newPattern;
      }
    }

    // Add the final pattern if it exists
    if (currentPattern) {
      patterns.push(currentPattern);
    }

    return patterns;
  }
}
