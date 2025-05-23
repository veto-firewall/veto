/**
 * Base class for rule processors that handle different rule types
 * Provides common functionality for rule processing
 */
import type { RuleSet } from '../../types';
import { ServiceFactory } from '../../ServiceFactory';
import type { LoggingService, BlockReason } from '../../logging/LoggingService';

/**
 * Type for the cache callback function
 */
export type CacheCallback = (_key: string, _value: boolean) => void;

/**
 * Base class for all rule processors
 */
export abstract class BaseRuleProcessor {
  /**
   * Rules to process
   */
  protected rules: RuleSet;

  /**
   * Logging service for logging blocked requests
   */
  protected loggingService: LoggingService;

  /**
   * Callback function to update cache
   */
  protected cacheCallback: CacheCallback;

  /**
   * Creates a new rule processor
   * @param rules - Rules to process
   * @param cacheCallback - Function to update the rule match cache
   */
  constructor(rules: RuleSet, cacheCallback: CacheCallback) {
    this.rules = rules;
    this.cacheCallback = cacheCallback;
    this.loggingService = ServiceFactory.getInstance().getLoggingService();
  }

  /**
   * Process rules for a URL
   * @param url - URL to process rules for
   * @param cacheKey - Cache key for this request
   * @param details - Optional web request details
   * @returns Promise resolving to blocking response or null if no match
   */
  abstract process(
    _url: URL,
    _cacheKey: string,
    _details?: browser.webRequest._OnBeforeRequestDetails,
  ): Promise<{ cancel: boolean } | null>;

  /**
   * Log a blocked request
   * @param details - Web request details
   * @param ip - Optional IP address of the request
   * @param blockReason - Reason for blocking
   * @param extraInfo - Optional additional information
   */
  protected logBlock(
    details: browser.webRequest._OnBeforeRequestDetails,
    ip?: string,
    blockReason: BlockReason = 'ip',
    extraInfo: Record<string, unknown> = {},
  ): void {
    const url = new URL(details.url);

    this.loggingService.logBlockedRequest({
      url: details.url,
      domain: url.hostname,
      ip: ip,
      resourceType: details.type || 'unknown',
      blockReason,
      ...extraInfo,
    });
  }
}
