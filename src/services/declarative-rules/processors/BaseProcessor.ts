/**
 * Base class for declarative rule processors
 */
import { DeclarativeRuleService } from '../DeclarativeRuleService';

/**
 * All available resource types to use for comprehensive rules
 * These match the types supported by Firefox's declarativeNetRequest API
 */
export const ALL_RESOURCE_TYPES = [
  'main_frame',
  'sub_frame',
  'stylesheet',
  'script',
  'image',
  'font',
  'object',
  'xmlhttprequest',
  'ping',
  'csp_report',
  'media',
  'websocket',
  'other',
] as browser.declarativeNetRequest.ResourceType[];

/**
 * Base processor for declarative network rules
 * Provides common functionality for rule processors
 */
export abstract class BaseProcessor {
  /**
   * Reference to the parent service
   */
  protected service: DeclarativeRuleService;

  /**
   * Creates a new processor
   * @param service - The parent declarative rule service
   */
  constructor(service: DeclarativeRuleService) {
    this.service = service;
  }
}
