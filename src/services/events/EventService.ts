/**
 * EventService handles browser event management
 * Centralizes message handling and web request interception
 */
import type {
  IService,
  ExtensionMsg,
  MsgSaveSettings,
  MsgSaveRules,
  MsgExportRules,
  MsgParseRules,
} from '../types';
import type { Settings, RuleSet, Rule } from '../types';
import { ServiceFactory } from '../ServiceFactory';

// Type-only imports for better tree-shaking
import type { StorageService } from '../storage/StorageService';
import type { RuleService } from '../rule/RuleService';
import type { NetworkService } from '../network/NetworkService';
import type { MaxMindService } from '../maxmind/MaxMindService';
import type { CacheService } from '../cache/CacheService';
import type { LoggingService } from '../logging/LoggingService';

/**
 * Service for managing browser events and messages
 */
export class EventService implements IService {
  private storageService: StorageService;
  private ruleService: RuleService;
  private networkService: NetworkService;
  private maxmindService: MaxMindService;
  private cacheService: CacheService;
  private loggingService: LoggingService;

  /**
   * Current settings
   */
  private settings: Settings = {} as Settings;

  /**
   * Current rules
   */
  private rules: RuleSet = {} as RuleSet;

  /**
   * Creates a new event service and initializes all dependencies via ServiceFactory
   */
  constructor() {
    const factory = ServiceFactory.getInstance();
    this.storageService = factory.getStorageService();
    this.ruleService = factory.getRuleService();
    this.networkService = factory.getNetworkService();
    this.maxmindService = factory.getMaxMindService();
    this.cacheService = factory.getCacheService();
    this.loggingService = factory.getLoggingService();
  }

  /**
   * Initialize the event service
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    // Load settings and rules
    this.settings = await this.storageService.getSettings();
    this.rules = await this.ruleService.getRules();

    // Set up event listeners
    this.setupMessageListener();
    this.setupWebRequestListeners();
    this.setupBrowserShutdownListener();
    this.setupAndroidSupport();

    return Promise.resolve();
  }

  /**
   * Setup Android support - open popup as full page when clicked on mobile
   */
  private setupAndroidSupport(): void {
    browser.action.onClicked.addListener(() => {
      void browser.tabs.create({
        url: browser.runtime.getURL('popup.html'),
      });
    });
  }

  /**
   * Set up the message listener for extension communication
   */
  private setupMessageListener(): void {
    browser.runtime.onMessage.addListener((message, sender) => {
      // Apply type guard to handle potential 'any' message data
      if (message && typeof message === 'object' && 'type' in message) {
        return this.handleMessage(message as ExtensionMsg, sender);
      }

      // Handle invalid messages
      console.warn('Received invalid message format:', message);
      return Promise.resolve({ success: false, error: 'Invalid message format' });
    });
  }

  /**
   * Set up web request listeners for request interception
   */
  private setupWebRequestListeners(): void {
    try {
      browser.webRequest.onBeforeRequest.addListener(
        details => this.handleBeforeRequest(details),
        { urls: ['<all_urls>'] },
        ['blocking'],
      );
    } catch (e) {
      console.error('Failed to register web request listener:', e);
    }
  }

  /**
   * Set up browser shutdown listener to create suspension rule on browser exit
   */
  private setupBrowserShutdownListener(): void {
    browser.runtime.onSuspend.addListener(async () => {
      try {
        // Check current settings
        if (this.settings.suspendUntilFiltersLoad) {
          // Create suspend rule that will be in place on next browser startup
          const declarativeRuleService = ServiceFactory.getInstance().getDeclarativeRuleService();
          await declarativeRuleService.updateSuspendSetting(true);
        }
      } catch (error) {
        console.error('Failed to add startup blocking rule:', error);
      }
    });
  }

  /**
   * Handle incoming messages from the extension
   * This is a dispatcher that routes to specialized handlers based on message type
   *
   * @param message - Message received
   * @param _sender - Message sender (unused)
   * @returns Promise resolving to response data
   */
  private async handleMessage(
    message: ExtensionMsg,
    _sender: browser.runtime.MessageSender,
  ): Promise<unknown> {
    // Type guard to ensure message is valid
    if (!message || typeof message !== 'object') {
      return { success: false, error: 'Invalid message format' };
    }

    // Route messages to appropriate handlers to reduce method complexity
    switch (message.type) {
      case 'getSettings':
      case 'getRules':
        return this.handleGetMessages(message);

      case 'saveSettings':
      case 'saveRules':
        return this.handleSaveMessages(message);

      case 'getCountryLookupCache':
      case 'setCountryLookupCache':
      case 'clearCache':
        return this.handleCacheMessages(message);

      case 'exportRules':
        return this.handleExportMessages(message);

      case 'getRuleLimit':
        return this.handleGetRuleLimit();

      case 'parseRules':
        return this.handleParseRules(message);

      default: {
        // The message is of type 'never' at this point due to exhaustive type checking
        interface UnknownMsg {
          type?: string;
        }

        const unknownMsg = message as UnknownMsg;
        console.warn(`Unknown message type: ${unknownMsg.type || 'undefined'}`);
        return { success: false, error: 'Unknown message type' };
      }
    }
  }

  /**
   * Handle get-type messages like getSettings and getRules
   * @param message - Message to handle
   * @returns Promise resolving to settings or rules
   */
  private async handleGetMessages(message: ExtensionMsg): Promise<Settings | RuleSet> {
    switch (message.type) {
      case 'getSettings':
        return this.storageService.getSettings();
      case 'getRules':
        return this.ruleService.getRules();
      default:
        throw new Error(`Invalid get message type: ${message.type}`);
    }
  }

  /**
   * Handle save-type messages like saveSettings and saveRules
   * @param message - Message to handle
   * @returns Promise resolving to success response
   */
  private async handleSaveMessages(message: ExtensionMsg): Promise<{ success: boolean }> {
    switch (message.type) {
      case 'saveSettings': {
        const msgSaveSettings = message as MsgSaveSettings;

        // Check if suspendUntilFiltersLoad setting changed
        const suspendSettingChanged =
          this.settings.suspendUntilFiltersLoad !==
          msgSaveSettings.settings.suspendUntilFiltersLoad;
        const newSuspendSetting = msgSaveSettings.settings.suspendUntilFiltersLoad;

        // Check if MaxMind license key changed
        const maxMindLicenseKeyChanged =
          this.settings.maxmind.licenseKey !== msgSaveSettings.settings.maxmind.licenseKey;

        // Update settings
        this.settings = msgSaveSettings.settings;
        await this.storageService.saveSettings(this.settings);
        this.clearAllCaches();

        // Handle suspend setting change
        if (suspendSettingChanged) {
          const declarativeRuleService = ServiceFactory.getInstance().getDeclarativeRuleService();
          // Update the suspend rule for the next browser startup
          await declarativeRuleService.updateSuspendSetting(newSuspendSetting);
        }

        // Handle MaxMind license key change
        if (maxMindLicenseKeyChanged) {
          try {
            // Update MaxMind service configuration
            const maxMindService = ServiceFactory.getInstance().getMaxMindService();
            await maxMindService.updateConfig({
              licenseKey: msgSaveSettings.settings.maxmind.licenseKey,
              lastDownload: this.settings.maxmind.lastDownload,
            });

            // Refresh MaxMind service and related components
            const _refreshSuccess = await maxMindService.refreshService();
          } catch (error) {
            console.error('Error refreshing MaxMind services:', error);
          }
        }

        // Set up rules with new settings
        const declarativeRuleService = ServiceFactory.getInstance().getDeclarativeRuleService();
        await declarativeRuleService.setupRules(this.settings, this.rules);
        return { success: true };
      }
      case 'saveRules': {
        const msgSaveRules = message as MsgSaveRules;

        this.rules = msgSaveRules.rules;
        await this.ruleService.saveRules(this.rules);

        // Clear all caches when rules are updated
        this.clearAllCaches();

        const declarativeRuleService = ServiceFactory.getInstance().getDeclarativeRuleService();
        await declarativeRuleService.setupRules(this.settings, this.rules);
        return { success: true };
      }
      default:
        throw new Error(`Invalid save message type: ${message.type}`);
    }
  }

  /**
   * Handle cache-related messages
   * @param message - Message to handle
   * @returns Promise resolving to cache data or success response
   */
  private async handleCacheMessages(message: ExtensionMsg): Promise<unknown> {
    switch (message.type) {
      case 'getCountryLookupCache': {
        // Create an object with all key-value pairs from the cache
        const cacheData: Record<
          string,
          Record<string, Record<string, string>> | Record<string, string>
        > = {};

        for (const [key, value] of this.cacheService.countryLookupCache.entries()) {
          cacheData[key] = value;
        }

        return cacheData;
      }
      case 'setCountryLookupCache': {
        // Define a proper type for the cache message
        type MsgSetCache = {
          type: 'setCountryLookupCache';
          key: string;
          value: Record<string, Record<string, string>> | Record<string, string>;
        };

        // Type-safe casting with validation
        const msgCache = message as MsgSetCache;
        if (
          typeof msgCache.key === 'string' &&
          msgCache.value &&
          typeof msgCache.value === 'object'
        ) {
          this.cacheService.countryLookupCache.set(msgCache.key, msgCache.value);
          return { success: true };
        }
        return { success: false, error: 'Invalid cache parameters' };
      }
      case 'clearCache':
        this.clearAllCaches();
        return { success: true };
      default:
        throw new Error(`Invalid cache message type: ${message.type}`);
    }
  }

  /**
   * Handle export-related messages
   * @param message - Message to handle
   * @returns Promise resolving to exported rules as text
   */
  private async handleExportMessages(message: ExtensionMsg): Promise<string> {
    if (message.type !== 'exportRules') {
      throw new Error(`Invalid export message type: ${message.type}`);
    }

    const msgExportRules = message as MsgExportRules;

    // Normalize any hyphenated rule type to camelCase
    let ruleType = msgExportRules.ruleType;
    if (typeof ruleType === 'string' && ruleType.includes('-')) {
      ruleType = ruleType.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
    }

    return await this.ruleService.exportRules(ruleType, msgExportRules.includeComments || false);
  }

  /**
   * Handle getRuleLimit message
   * @returns The maximum number of rules allowed by the browser
   */
  private handleGetRuleLimit(): number {
    const declarativeRuleService = ServiceFactory.getInstance().getDeclarativeRuleService();
    return declarativeRuleService.getRuleLimit();
  }

  /**
   * Handle parseRules message
   * @param message - Message to handle
   * @returns Promise resolving to parsed rules
   */
  private handleParseRules(message: ExtensionMsg): Rule[] {
    if (message.type !== 'parseRules') {
      throw new Error(`Invalid parse rules message type: ${message.type}`);
    }

    const msgParseRules = message as MsgParseRules;

    if (['domain', 'url', 'regex', 'ip', 'asn', 'tracking'].includes(msgParseRules.ruleType)) {
      return this.ruleService.parseRules(
        msgParseRules.ruleType as 'domain' | 'url' | 'regex' | 'ip' | 'asn' | 'tracking',
        msgParseRules.rulesText,
        msgParseRules.actionType as 'allow' | 'block' | 'redirect',
        msgParseRules.isTerminating,
      );
    }
    return [];
  }

  /**
   * Check if a domain matches any terminating allow rules
   * This prevents web request handlers from overriding DNR allow rules
   * @param hostname - The hostname to check
   * @returns True if the domain has a terminating allow rule
   */
  private isDomainAllowedByTerminatingRule(hostname: string): boolean {
    // Check allowed domains
    const domainMatch = this.rules.allowedDomains.find(rule => {
      if (!rule.enabled || !rule.isTerminating) return false;

      // Check if hostname matches the domain rule
      // Support both exact match and subdomain match
      const ruleDomain = rule.value.toLowerCase();
      const checkHostname = hostname.toLowerCase();

      return checkHostname === ruleDomain || checkHostname.endsWith('.' + ruleDomain);
    });

    if (domainMatch) {
      return true;
    }

    // Check allowed URLs for hostname matches
    const urlMatch = this.rules.allowedUrls.find(rule => {
      if (!rule.enabled || !rule.isTerminating) return false;

      try {
        const ruleUrl = new URL(rule.value);
        const ruleHostname = ruleUrl.hostname.toLowerCase();
        const checkHostname = hostname.toLowerCase();

        return checkHostname === ruleHostname || checkHostname.endsWith('.' + ruleHostname);
      } catch {
        return false;
      }
    });

    if (urlMatch) {
      return true;
    }

    // Check allowed regex patterns
    const regexMatch = this.rules.allowedRegex.find(rule => {
      if (!rule.enabled || !rule.isTerminating) return false;

      try {
        const regex = new RegExp(rule.value, 'i');
        return regex.test(hostname);
      } catch {
        return false;
      }
    });

    if (regexMatch) {
      return true;
    }

    return false;
  }

  /**
   * Handle web request interception
   * @param details - Web request details
   * @returns Promise resolving to blocking response
   */
  private async handleBeforeRequest(
    details: browser.webRequest._OnBeforeRequestDetails,
  ): Promise<browser.webRequest.BlockingResponse> {
    try {
      // Ensure rules and settings are loaded
      if (!this.rules) {
        this.rules = await this.ruleService.getRules();
      }

      if (!this.settings) {
        this.settings = await this.storageService.getSettings();
      }

      const url = new URL(details.url);
      const cacheKey = `req:${details.url}`;

      // Check cache first
      if (this.cacheService.ruleMatchCache.has(cacheKey)) {
        const shouldBlock = this.cacheService.ruleMatchCache.get(cacheKey) as boolean;
        if (shouldBlock) {
          // Check if this is a resource-type based block (content blocking)
          // For declarative rules like images, fonts, media
          if (
            (details.type === 'image' && this.settings.blockImages) ||
            (details.type === 'font' && this.settings.blockRemoteFonts) ||
            (details.type === 'media' && this.settings.blockMedia)
          ) {
            // Log blocked content
            this.loggingService.logBlockedRequest({
              url: details.url,
              domain: url.hostname,
              resourceType: details.type,
              blockReason: 'content',
            });
          }
          return { cancel: true };
        }
        return { cancel: false };
      }

      // Check if domain is allowed by a terminating DNR rule
      // This prevents IP/ASN/GeoIP rules from overriding DNR allow rules
      if (this.isDomainAllowedByTerminatingRule(url.hostname)) {
        this.cacheService.ruleMatchCache.set(cacheKey, false);
        return { cancel: false };
      }

      // Check for private IP blocking
      if (this.settings.blockPrivateIPs) {
        if (await this.networkService.isPrivateHost(url.hostname)) {
          this.cacheService.ruleMatchCache.set(cacheKey, true);

          // Log the blocked request
          const ip = await this.networkService.resolveDomain(url.hostname);
          this.loggingService.logBlockedRequest({
            url: details.url,
            domain: url.hostname,
            ip: ip || 'Unknown',
            resourceType: details.type || 'unknown',
            blockReason: 'private-ip',
          });

          return { cancel: true };
        }
      }

      // Process rules
      const ruleResult = await this.ruleService.processRules(
        url,
        cacheKey,
        this.rules,
        (key: string, value: boolean) => this.cacheService.ruleMatchCache.set(key, value),
        details,
      );

      if (ruleResult) {
        return ruleResult;
      }

      // No block rules matched
      this.cacheService.ruleMatchCache.set(cacheKey, false);
      return { cancel: false };
    } catch (error) {
      console.error('Error in handleBeforeRequest:', error);
      return { cancel: false };
    }
  }

  /**
   * Clear all caches
   */
  private clearAllCaches(): void {
    this.cacheService.clearAll();
  }
}
