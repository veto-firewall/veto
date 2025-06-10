/**
 * Processor for basic declarative rules - Function-based version
 * Handles HTTP redirect/block and resource type blocking
 */
import { BaseProcessor, ALL_RESOURCE_TYPES } from './BaseProcessor';
import type { Settings } from '../../types';

/**
 * Handles creation of basic declarative network rules
 */
export class BasicRuleProcessor extends BaseProcessor {
  /**
   * Creates basic rules for HTTP handling and resource blocking
   *
   * @param settings - The extension settings
   * @param startId - The starting ID for rule generation
   * @returns Array of declarative network request rules
   */
  createRules(settings: Settings, startId: number): browser.declarativeNetRequest.Rule[] {
    const basicRules: browser.declarativeNetRequest.Rule[] = [];
    let ruleId = startId;

    // HTTP handling
    if (settings.httpHandling === 'redirect') {
      basicRules.push({
        id: ruleId++,
        priority: 100,
        action: {
          type: 'redirect',
          redirect: { transform: { scheme: 'https' } },
        },
        condition: {
          urlFilter: 'http://*',
          resourceTypes: ALL_RESOURCE_TYPES,
        },
      });
      this.incrementRuleCount();
    } else if (settings.httpHandling === 'block') {
      basicRules.push({
        id: ruleId++,
        priority: 100,
        action: { type: 'block' },
        condition: {
          urlFilter: 'http://*',
          resourceTypes: ALL_RESOURCE_TYPES,
        },
      });
      this.incrementRuleCount();
    }

    // Block resources by type
    if (settings.blockRemoteFonts) {
      basicRules.push({
        id: ruleId++,
        priority: 100,
        action: { type: 'block' },
        condition: {
          resourceTypes: ['font'],
        },
      });
      this.incrementRuleCount();
    }

    if (settings.blockImages) {
      basicRules.push({
        id: ruleId++,
        priority: 100,
        action: { type: 'block' },
        condition: {
          resourceTypes: ['image', 'imageset'],
        },
      });
      this.incrementRuleCount();
    }

    if (settings.blockMedia) {
      basicRules.push({
        id: ruleId++,
        priority: 100,
        action: { type: 'block' },
        condition: {
          resourceTypes: ['media'],
        },
      });
      this.incrementRuleCount();
    }

    return basicRules;
  }
}
