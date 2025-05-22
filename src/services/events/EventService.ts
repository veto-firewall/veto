/**
 * EventService handles browser event management
 * Centralizes message handling and web request interception
 */
import { IService } from '../types';
import { ExtensionMsg, MsgSaveSettings, MsgSaveRules, MsgExportRules } from '../../utils/types';
import { StorageService } from '../storage/StorageService';
import { RuleService } from '../rule/RuleService';
import { ruleMatchCache, dnsCache, ipClassificationCache, geoIpCache, asnCache } from '../../utils/caching';
import { setupDeclarativeRules } from '../../utils/rulesDNR';
import { NetworkService } from '../network/NetworkService';
import { MaxMindService } from '../maxmind/MaxMindService';
import { logBlockedRequest } from '../../utils/logger';

/**
 * Service for managing browser events and messages
 */
export class EventService implements IService {
  private storageService: StorageService;
  private ruleService: RuleService;
  private networkService: NetworkService;
  private maxmindService: MaxMindService;
  
  /**
   * Current settings
   */
  private settings: any;
  
  /**
   * Current rules
   */
  private rules: any;
  
  /**
   * Creates a new event service
   * @param storageService - Storage service for persistent data
   * @param ruleService - Rule service for rule processing
   * @param networkService - Network service for DNS and IP operations
   * @param maxmindService - MaxMind service for GeoIP and ASN lookups
   */
  constructor(
    storageService: StorageService,
    ruleService: RuleService,
    networkService: NetworkService,
    maxmindService: MaxMindService
  ) {
    this.storageService = storageService;
    this.ruleService = ruleService;
    this.networkService = networkService;
    this.maxmindService = maxmindService;
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
    
    return Promise.resolve();
  }
  
  /**
   * Set up the message listener for extension communication
   */
  private setupMessageListener(): void {
    browser.runtime.onMessage.addListener((message, sender) => 
      this.handleMessage(message, sender)
    );
  }
  
  /**
   * Set up web request listeners for request interception
   */
  private setupWebRequestListeners(): void {
    console.log('Setting up web request listeners for ASN and GeoIP blocking...');

    try {
      browser.webRequest.onBeforeRequest.addListener(
        details => this.handleBeforeRequest(details),
        { urls: ['<all_urls>'] },
        ['blocking']
      );
      console.log('Web request listener registered successfully');
    } catch (e) {
      console.error('Failed to register web request listener:', e);
    }
  }
  
  /**
   * Handle incoming messages from the extension
   * @param message - Message received
   * @param sender - Message sender
   * @returns Promise resolving to response data
   */
  private async handleMessage(
    message: ExtensionMsg,
    _sender: browser.runtime.MessageSender
  ): Promise<unknown> {
    switch (message.type) {
      case 'getSettings':
        return this.storageService.getSettings();

      case 'saveSettings': {
        const msgSaveSettings = message as MsgSaveSettings;
        this.settings = msgSaveSettings.settings;
        await this.storageService.saveSettings(this.settings);
        this.clearAllCaches();
        await setupDeclarativeRules(this.settings, this.rules);
        return { success: true };
      }

      case 'getRules':
        return this.ruleService.getRules();

      case 'saveRules': {
        const msgSaveRules = message as MsgSaveRules;
        console.log('Saving updated rules:', {
          allowedDomains: msgSaveRules.rules.allowedDomains?.length,
          blockedDomains: msgSaveRules.rules.blockedDomains?.length,
          allowedIps: msgSaveRules.rules.allowedIps?.length,
          blockedIps: msgSaveRules.rules.blockedIps?.length,
          allowedAsns: msgSaveRules.rules.allowedAsns?.length,
          blockedAsns: msgSaveRules.rules.blockedAsns?.length,
          blockedCountries: Object.keys(msgSaveRules.rules.blockedCountries || {}).length,
        });

        this.rules = msgSaveRules.rules;
        await this.ruleService.saveRules(this.rules);

        // Clear all caches when rules are updated
        this.clearAllCaches();
        console.log('Caches cleared after rule update');

        await setupDeclarativeRules(this.settings, this.rules);
        return { success: true };
      }

      case 'exportRules': {
        const msgExportRules = message as MsgExportRules;

        // Normalize any hyphenated rule type to camelCase
        let ruleType = msgExportRules.ruleType;
        if (typeof ruleType === 'string' && ruleType.includes('-')) {
          ruleType = ruleType.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
        }

        return await this.ruleService.exportRules(ruleType, msgExportRules.includeComments || false);
      }

      case 'clearCache':
        this.clearAllCaches();
        return { success: true };
        
      default:
        // The message is of type 'never' at this point due to exhaustive type checking
        // Cast to any to access the type property for logging
        const unknownMsg = message as any;
        console.warn(`Unknown message type: ${unknownMsg.type || 'undefined'}`);
        return { success: false, error: 'Unknown message type' };
    }
  }
  
  /**
   * Handle web request interception
   * @param details - Web request details
   * @returns Promise resolving to blocking response
   */
  private async handleBeforeRequest(
    details: browser.webRequest._OnBeforeRequestDetails
  ): Promise<browser.webRequest.BlockingResponse> {
    try {
      // Ensure rules and settings are loaded
      if (!this.rules) {
        console.log('Rules not initialized, loading from storage...');
        this.rules = await this.ruleService.getRules();
      }

      if (!this.settings) {
        console.log('Settings not initialized, loading from storage...');
        this.settings = await this.storageService.getSettings();
      }

      const url = new URL(details.url);
      const cacheKey = `req:${details.url}`;

      // Check cache first
      if (ruleMatchCache.has(cacheKey)) {
        const shouldBlock = ruleMatchCache.get(cacheKey) as boolean;
        if (shouldBlock) {
          // Check if this is a resource-type based block (content blocking)
          // For declarative rules like images, fonts, media
          if (
            (details.type === 'image' && this.settings.blockImages) ||
            (details.type === 'font' && this.settings.blockRemoteFonts) ||
            (details.type === 'media' && this.settings.blockMedia)
          ) {
            // Log blocked content
            logBlockedRequest({
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

      // Check for private IP blocking
      if (this.settings.blockPrivateIPs) {
        if (await this.networkService.isPrivateHost(url.hostname)) {
          ruleMatchCache.set(cacheKey, true);

          // Log the blocked request
          const ip = await this.networkService.resolveDomain(url.hostname);
          logBlockedRequest({
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
        (key: string, value: boolean) => ruleMatchCache.set(key, value),
        details
      );
      
      if (ruleResult) {
        return ruleResult;
      }

      // No block rules matched
      ruleMatchCache.set(cacheKey, false);
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
    ruleMatchCache.clear();
    dnsCache.clear();
    ipClassificationCache.clear();
    geoIpCache.clear();
    asnCache.clear();
  }
}
