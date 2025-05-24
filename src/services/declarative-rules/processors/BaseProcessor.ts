/**
 * Base class for declarative rule processors
 */
import type { DeclarativeRuleService } from '../DeclarativeRuleService';
import { ServiceFactory } from '../../ServiceFactory';

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
   * Reference to the parent service
   */
  protected service: DeclarativeRuleService;

  /**
   * Creates a new processor
   */
  constructor() {
    this.service = ServiceFactory.getInstance().getDeclarativeRuleService();
  }
}
