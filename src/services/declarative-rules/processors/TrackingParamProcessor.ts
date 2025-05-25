/**
 * Processor for tracking parameter removal rules
 */
import { BaseProcessor, ALL_RESOURCE_TYPES } from './BaseProcessor';
import type { RuleSet } from '../../types';

/**
 * Handles creation of tracking parameter removal rules
 */
export class TrackingParamProcessor extends BaseProcessor {
  /**
   * Creates rules for tracking parameter removal
   *
   * @param rules - The rule set containing tracking parameters
   * @param startId - Starting rule ID
   * @returns Array of declarative network request rules
   */
  createRules(rules: RuleSet, startId: number): browser.declarativeNetRequest.Rule[] {
    if (rules.trackingParams.length === 0) return [];

    // Filter enabled rules
    const enabledRules = rules.trackingParams.filter(rule => rule.enabled);
    if (enabledRules.length === 0) return [];

    const paramValues = enabledRules.map(rule => rule.value);

    // Create regex patterns (multiple if needed to stay under length limit)
    const patterns = this.createRegexPatterns(paramValues);

    const dnrRules: browser.declarativeNetRequest.Rule[] = [];
    let id = startId;

    // Create rules from patterns
    for (const pattern of patterns) {
      dnrRules.push({
        id: id++,
        priority: 60, // Higher than allow rules (50) to ensure tracking params are always removed
        action: {
          type: 'redirect',
          redirect: { transform: { queryTransform: { removeParams: [pattern] } } },
        },
        condition: {
          regexFilter: `[?&](${pattern})=`,
          resourceTypes: ALL_RESOURCE_TYPES,
        },
      });

      this.service.incrementRuleCount();
    }

    return dnrRules;
  }

  /**
   * Create regex patterns from tracking parameter lists
   * @param params - List of tracking parameters
   * @returns Array of regex patterns
   */
  private createRegexPatterns(params: string[]): string[] {
    if (params.length === 0) return [];

    // Simply return the parameters since they're typically shorter
    // and don't require the same level of optimization as domains
    return params;
  }
}
