/**
 * DeclarativeRuleService handles all browser declarativeNetRequest operations
 * Creates and manages declarative network request rules for content filtering
 */
import type { IDeclarativeRuleService, RuleSet, Settings } from '../types';
import { StorageService } from '../storage/StorageService';
import {
  BasicRuleProcessor,
  DomainRuleProcessor,
  TrackingParamProcessor,
  RegexRuleProcessor,
} from './processors';

/**
 * Special dynamic rule ID to use for the temporary suspend rule
 */
const SUSPEND_RULE_ID = 1;

/**
 * Service for managing browser declarative network request rules
 */
export class DeclarativeRuleService implements IDeclarativeRuleService {
  /**
   * Storage service for persistent data
   */
  private storageService: StorageService;

  /**
   * The current count of active rules
   */
  private totalRuleCount = 0;

  /**
   * Firefox rule limit for declarativeNetRequest
   */
  private ruleLimit: number = 5000; // Default fallback value

  /**
   * Max length of regex pattern (Firefox limitation)
   */
  private maxRegexLength = 1024;

  /**
   * Rule processors
   */
  private processors = {
    basic: BasicRuleProcessor,
    domain: DomainRuleProcessor,
    tracking: TrackingParamProcessor,
    regex: RegexRuleProcessor,
  };

  /**
   * Creates a new declarative rule service
   * @param storageService - Storage service for persistent data
   */
  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }

  /**
   * Initialize the declarative rule service
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    // Initialize the Firefox rule limit
    this.ruleLimit = this.getFirefoxRuleLimit();

    // No additional initialization needed
    void console.log('DeclarativeRuleService initialized');
  }

  /**
   * Get the maximum number of rules allowed by Firefox
   * @returns The rule limit
   */
  getRuleLimit(): number {
    return this.ruleLimit;
  }

  /**
   * Get the current rule count
   * @returns The number of active rules
   */
  getRuleCount(): number {
    return this.totalRuleCount;
  }

  /**
   * Reset the rule count
   * Called before regenerating all rules
   */
  private resetRuleCount(): void {
    this.totalRuleCount = 0;
  }

  /**
   * Track a rule count increase
   * @param count - Number of rules to add (default: 1)
   */
  incrementRuleCount(count: number = 1): void {
    this.totalRuleCount += count;
  }

  /**
   * Get the Firefox rule limit from the browser API
   * @returns The maximum number of rules allowed
   */
  private getFirefoxRuleLimit(): number {
    try {
      // Add a local type declaration to match Firefox's runtime API
      interface ExtendedDNRApi {
        MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES?: number;
        MAX_NUMBER_OF_DYNAMIC_RULES?: number;
        MAX_NUMBER_OF_REGEX_RULES?: number;
      }

      // Cast to our extended interface for better type safety
      const api = browser.declarativeNetRequest as ExtendedDNRApi;

      // Try to get the session rules limit first (what we're actually using)
      if (typeof api.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES === 'number') {
        return api.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES;
      }

      // Fall back to dynamic rules limit
      if (typeof api.MAX_NUMBER_OF_DYNAMIC_RULES === 'number') {
        return api.MAX_NUMBER_OF_DYNAMIC_RULES;
      }

      // Other possible property names
      if (typeof api.MAX_NUMBER_OF_REGEX_RULES === 'number') {
        return api.MAX_NUMBER_OF_REGEX_RULES;
      }

      // Last resort fallback
      return this.ruleLimit;
    } catch (error) {
      void error;
      // In case of any errors, return the default limit
      return this.ruleLimit;
    }
  }

  /**
   * Set up declarative network request rules in the browser
   * @param settings - The extension settings
   * @param rules - The ruleset containing filtering rules
   * @returns Promise that resolves when rules are set up
   */
  async setupRules(settings: Settings, rules: RuleSet): Promise<void> {
    try {
      // Reset rule count before generating new rules
      this.resetRuleCount();

      // Clear all existing rules (both session and dynamic)
      await this.clearExistingRules();

      // Handle "suspend until filters load" setting - uses dynamic rules
      // This rule has priority over all others and blocks everything while rules are loading
      if (settings.suspendUntilFiltersLoad) {
        await this.addTemporarySuspendRule();
      }

      // Use a sequential ID counter for all rules
      let nextRuleId = 1;

      // Create and collect all rule types
      const basicProcessor = new this.processors.basic();
      const basicRules = basicProcessor.createRules(settings, nextRuleId);
      nextRuleId += basicRules.length || 1;

      const trackingProcessor = new this.processors.tracking();
      const trackingRules = trackingProcessor.createRules(rules, nextRuleId);
      nextRuleId += trackingRules.length || 1;

      const domainProcessor = new this.processors.domain();

      // Create domain rules
      const allowedDomainRules = domainProcessor.createDomainRules(
        rules.allowedDomains,
        nextRuleId,
        'allow',
      );
      nextRuleId += allowedDomainRules.length || 1;

      const blockedDomainRules = domainProcessor.createDomainRules(
        rules.blockedDomains,
        nextRuleId,
        'block',
      );
      nextRuleId += blockedDomainRules.length || 1;

      // Create URL rules
      const allowedUrlRules = domainProcessor.createUrlRules(
        rules.allowedUrls,
        nextRuleId,
        'allow',
      );
      nextRuleId += allowedUrlRules.length || 1;

      const blockedUrlRules = domainProcessor.createUrlRules(
        rules.blockedUrls,
        nextRuleId,
        'block',
      );
      nextRuleId += blockedUrlRules.length || 1;

      // Create regex rules
      const regexProcessor = new this.processors.regex();
      const allowedRegexRules = regexProcessor.createRules(rules.allowedRegex, nextRuleId, 'allow');
      nextRuleId += allowedRegexRules.length || 1;

      const blockedRegexRules = regexProcessor.createRules(rules.blockedRegex, nextRuleId, 'block');
      nextRuleId += blockedRegexRules.length || 1;

      // Combine all rules into a single array
      const domainAndUrlRules = [
        ...allowedDomainRules,
        ...blockedDomainRules,
        ...allowedUrlRules,
        ...blockedUrlRules,
        ...allowedRegexRules,
        ...blockedRegexRules,
      ] as browser.declarativeNetRequest.Rule[];

      // Combine all rule arrays
      const sessionRules = [...basicRules, ...trackingRules, ...domainAndUrlRules];

      // Add all the rules to the browser using session rules
      await browser.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [], // Explicitly specify empty array for compatibility
        addRules: sessionRules,
      });

      // Save current rule count to storage for the popup to display
      await browser.storage.local.set({ ruleCount: this.getRuleCount() });

      // Remove the temporary blocking rule if it was added
      if (settings.suspendUntilFiltersLoad) {
        await this.removeTemporarySuspendRule();
        console.log('Removed temporary blocking rule after filters loaded successfully');
      }

      console.log(
        `Session rules updated successfully: ${this.getRuleCount()}/${this.getRuleLimit()} rules used`,
      );
    } catch (e) {
      console.error('Failed to update rules:', e);

      // Store error information for the popup
      const errorInfo = {
        message: e instanceof Error ? e.message : 'Unknown error',
        timestamp: Date.now(),
      };
      await browser.storage.local.set({ ruleUpdateError: errorInfo });

      // Make sure to remove the blocking rule if there was an error
      if (settings.suspendUntilFiltersLoad) {
        await this.removeTemporarySuspendRule();
      }
    }
  }

  /**
   * Clear all existing declarative network request rules
   */
  private async clearExistingRules(): Promise<void> {
    // Get existing session rules
    const existingSessionRules = await browser.declarativeNetRequest.getSessionRules();
    const existingSessionRuleIds = existingSessionRules.map(r => r.id);

    // Get existing dynamic rules
    const existingDynamicRules = await browser.declarativeNetRequest.getDynamicRules();
    const existingDynamicRuleIds = existingDynamicRules.map(r => r.id);

    // Remove all existing session rules
    if (existingSessionRuleIds.length > 0) {
      await browser.declarativeNetRequest.updateSessionRules({
        removeRuleIds: existingSessionRuleIds,
        addRules: [],
      });
    }

    // Remove all existing dynamic rules
    if (existingDynamicRuleIds.length > 0) {
      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingDynamicRuleIds,
        addRules: [],
      });
    }
  }

  /**
   * Add a temporary rule that blocks all traffic while rules are being loaded
   */
  private async addTemporarySuspendRule(): Promise<void> {
    try {
      // Add a temporary blocking rule with maximum priority
      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [SUSPEND_RULE_ID], // Remove any existing suspend rule first
        addRules: [
          {
            id: SUSPEND_RULE_ID,
            priority: 100, // Maximum priority
            action: { type: 'block' },
            condition: {
              urlFilter: '*://*/*',
              resourceTypes: [
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
              ],
            },
          },
        ],
      });

      console.log('Added temporary blocking rule while filters load');
    } catch (error) {
      console.error('Failed to add temporary suspend rule:', error);
    }
  }

  /**
   * Remove the temporary blocking rule
   */
  private async removeTemporarySuspendRule(): Promise<void> {
    try {
      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [SUSPEND_RULE_ID],
        addRules: [],
      });
    } catch (removeError) {
      console.error('Failed to remove blocking rule:', removeError);
    }
  }
}
