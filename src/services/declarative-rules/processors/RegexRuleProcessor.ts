/**
 * Processor for regex-based declarative rules - Function-based version
 */
import { BaseProcessor, ALL_RESOURCE_TYPES } from './BaseProcessor';
import type { Rule } from '../../types';

/**
 * Handles creation of regex-based declarative network rules
 */
export class RegexRuleProcessor extends BaseProcessor {
  /**
   * Creates rules for regex patterns
   *
   * @param rules - The rules to process
   * @param startId - Starting rule ID
   * @param action - Action to take (block or allow)
   * @returns Array of declarative network request rules
   */
  createRules(
    rules: Rule[],
    startId: number,
    action: 'block' | 'allow',
  ): browser.declarativeNetRequest.Rule[] {
    const dnrRules: browser.declarativeNetRequest.Rule[] = [];
    let id = startId;

    // Filter enabled rules
    const enabledRules = rules.filter(rule => rule.enabled);
    if (enabledRules.length === 0) return dnrRules;

    // Process each regex rule
    for (const rule of enabledRules) {
      // Use higher priority for allow rules to short-circuit processing
      const priority = action === 'allow' ? 50 : 10;

      const ruleAction: browser.declarativeNetRequest._RuleAction =
        action === 'block' ? { type: 'block' } : { type: 'allow' };

      dnrRules.push({
        id: id++,
        priority: priority,
        action: ruleAction,
        condition: {
          regexFilter: rule.value,
          resourceTypes: ALL_RESOURCE_TYPES,
        },
      });

      this.incrementRuleCount();
    }

    return dnrRules;
  }
}
