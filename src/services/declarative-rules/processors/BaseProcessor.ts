/**
 * Base class for declarative rule processors - Function-based version
 */
import { incrementRuleCount } from '../DeclarativeRuleService';

/**
 * All available resource types to use for comprehensive rules
 * These match the types supported by Firefox's declarativeNetRequest API
 */
export const ALL_RESOURCE_TYPES = [
  'main_frame',
  'sub_frame',
  'beacon',
  'csp_report',
  'font',
  'image',
  'imageset',
  'json',
  'media',
  'object_subrequest',
  'object',
  'ping',
  'script',
  'speculative',
  'stylesheet',
  'websocket',
  'xml_dtd',
  'xmlhttprequest',
  'xslt',
  'other',
] as browser.declarativeNetRequest.ResourceType[];

/**
 * Base processor for declarative network rules
 * Provides common functionality for rule processors
 */
export abstract class BaseProcessor {
  /**
   * Track a rule count increase
   * @param count - Number of rules to add (default: 1)
   */
  protected incrementRuleCount(count: number = 1): void {
    incrementRuleCount(count);
  }

  /**
   * Creates a new processor
   */
  constructor() {
    // No service dependency needed anymore
  }
}
