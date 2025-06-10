/**
 * EventService handles browser event management
 * Centralizes message handling and web request interception
 */
import type {
  ExtensionMsg,
  MsgSaveSettings,
  MsgSaveRules,
  MsgExportRules,
  MsgParseRules,
} from '../types';
import type { Settings, RuleSet, Rule } from '../types';

// Function imports from converted services
import { getRules, saveRules, exportRules, parseRules, processRules } from '../rule/RuleService';

// Service imports - these may still be class-based or function-based
import { getSettings, saveSettings } from '../storage/StorageService';
import { isPrivateHost, resolveDomain } from '../network/NetworkService';
import { getRuleMatchCache, clearAllCaches, getCountryLookupCache } from '../cache/CacheService';

// Import function-based declarative rule service
import {
  setupRules,
  updateSuspendSetting,
  getRuleLimit,
} from '../declarative-rules/DeclarativeRuleService';

// Import function-based logging service
import { logBlockedRequest } from '../logging/LoggingService';

// Still need ServiceFactory for services that haven't been converted
import { ServiceFactory } from '../ServiceFactory';

/**
 * Current settings
 */
let settings: Settings = {} as Settings;

/**
 * Current rules
 */
let rules: RuleSet = {} as RuleSet;

/**
 * Initialize the event service
 * @returns Promise that resolves when initialization is complete
 */
export async function initialize(): Promise<void> {
  // Load settings and rules
  settings = await getSettings();
  rules = await getRules();

  // Set up event listeners
  setupMessageListener();
  setupWebRequestListeners();
  setupBrowserShutdownListener();
  setupAndroidSupport();

  return Promise.resolve();
}

/**
 * Setup Android support - open popup as full page when clicked on mobile
 */
function setupAndroidSupport(): void {
  browser.action.onClicked.addListener(() => {
    void browser.tabs.create({
      url: browser.runtime.getURL('popup.html'),
    });
  });
}

/**
 * Set up the message listener for extension communication
 */
function setupMessageListener(): void {
  browser.runtime.onMessage.addListener((message, sender) => {
    // Apply type guard to handle potential 'any' message data
    if (message && typeof message === 'object' && 'type' in message) {
      return handleMessage(message as ExtensionMsg, sender);
    }

    // Handle invalid messages
    console.warn('Received invalid message format:', message);
    return Promise.resolve({ success: false, error: 'Invalid message format' });
  });
}

/**
 * Set up web request listeners for request interception
 */
function setupWebRequestListeners(): void {
  try {
    browser.webRequest.onBeforeRequest.addListener(
      details => handleBeforeRequest(details),
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
function setupBrowserShutdownListener(): void {
  browser.runtime.onSuspend.addListener(async () => {
    try {
      // Check current settings
      if (settings.suspendUntilFiltersLoad) {
        // Create suspend rule that will be in place on next browser startup
        await updateSuspendSetting(true);
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
function handleMessage(
  message: ExtensionMsg,
  _sender: browser.runtime.MessageSender,
): Promise<unknown> {
  // Type guard to ensure message is valid
  if (!message || typeof message !== 'object') {
    return Promise.resolve({ success: false, error: 'Invalid message format' });
  }

  // Route messages to appropriate handlers to reduce method complexity
  switch (message.type) {
    case 'getSettings':
    case 'getRules':
      return handleGetMessages(message);

    case 'saveSettings':
    case 'saveRules':
      return handleSaveMessages(message);

    case 'getCountryLookupCache':
    case 'setCountryLookupCache':
    case 'clearCache':
      return handleCacheMessages(message);

    case 'exportRules':
      return handleExportMessages(message);

    case 'getRuleLimit':
      return Promise.resolve(handleGetRuleLimit());

    case 'parseRules':
      return Promise.resolve(handleParseRules(message));

    default: {
      // The message is of type 'never' at this point due to exhaustive type checking
      interface UnknownMsg {
        type?: string;
      }

      const unknownMsg = message as UnknownMsg;
      console.warn(`Unknown message type: ${unknownMsg.type || 'undefined'}`);
      return Promise.resolve({ success: false, error: 'Unknown message type' });
    }
  }
}

/**
 * Handle get-type messages like getSettings and getRules
 * @param message - Message to handle
 * @returns Promise resolving to settings or rules
 */
async function handleGetMessages(message: ExtensionMsg): Promise<Settings | RuleSet> {
  switch (message.type) {
    case 'getSettings':
      return getSettings();
    case 'getRules':
      return getRules();
    default:
      throw new Error(`Invalid get message type: ${message.type}`);
  }
}

/**
 * Handle save-type messages like saveSettings and saveRules
 * @param message - Message to handle
 * @returns Promise resolving to success response
 */
async function handleSaveMessages(message: ExtensionMsg): Promise<{ success: boolean }> {
  switch (message.type) {
    case 'saveSettings': {
      const msgSaveSettings = message as MsgSaveSettings;

      // Check if suspendUntilFiltersLoad setting changed
      const suspendSettingChanged =
        settings.suspendUntilFiltersLoad !== msgSaveSettings.settings.suspendUntilFiltersLoad;
      const newSuspendSetting = msgSaveSettings.settings.suspendUntilFiltersLoad;

      // Check if MaxMind license key changed
      const maxMindLicenseKeyChanged =
        settings.maxmind.licenseKey !== msgSaveSettings.settings.maxmind.licenseKey;

      // Update settings
      settings = msgSaveSettings.settings;
      await saveSettings(settings);
      clearAllCaches();

      // Handle suspend setting change
      if (suspendSettingChanged) {
        // Update the suspend rule for the next browser startup
        await updateSuspendSetting(newSuspendSetting);
      }

      // Handle MaxMind license key change
      if (maxMindLicenseKeyChanged) {
        try {
          // For now, we'll handle MaxMind updates through the service factory
          // until MaxMindService is fully converted to functions
          const maxMindService = ServiceFactory.getInstance().getMaxMindService();
          await maxMindService.updateConfig({
            licenseKey: msgSaveSettings.settings.maxmind.licenseKey,
            lastDownload: settings.maxmind.lastDownload,
          });

          // Refresh MaxMind service and related components
          const _refreshSuccess = await maxMindService.refreshService();
        } catch (error) {
          console.error('Error refreshing MaxMind services:', error);
        }
      }

      // Set up rules with new settings
      await setupRules(settings, rules);
      return { success: true };
    }
    case 'saveRules': {
      const msgSaveRules = message as MsgSaveRules;

      rules = msgSaveRules.rules;
      await saveRules(rules);

      // Clear all caches when rules are updated
      clearAllCaches();

      await setupRules(settings, rules);
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
async function handleCacheMessages(message: ExtensionMsg): Promise<unknown> {
  switch (message.type) {
    case 'getCountryLookupCache': {
      return getCountryLookupCache();
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
        const countryLookupCache = getCountryLookupCache();
        countryLookupCache.set(msgCache.key, msgCache.value);
        return { success: true };
      }
      return { success: false, error: 'Invalid cache parameters' };
    }
    case 'clearCache':
      clearAllCaches();
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
async function handleExportMessages(message: ExtensionMsg): Promise<string> {
  if (message.type !== 'exportRules') {
    throw new Error(`Invalid export message type: ${message.type}`);
  }

  const msgExportRules = message as MsgExportRules;

  // Normalize any hyphenated rule type to camelCase
  let ruleType = msgExportRules.ruleType;
  if (typeof ruleType === 'string' && ruleType.includes('-')) {
    ruleType = ruleType.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
  }

  return await exportRules(ruleType, msgExportRules.includeComments || false);
}

/**
 * Handle getRuleLimit message
 * @returns The maximum number of rules allowed by the browser
 */
function handleGetRuleLimit(): number {
  return getRuleLimit();
}

/**
 * Handle parseRules message
 * @param message - Message to handle
 * @returns Promise resolving to parsed rules
 */
function handleParseRules(message: ExtensionMsg): Rule[] {
  if (message.type !== 'parseRules') {
    throw new Error(`Invalid parse rules message type: ${message.type}`);
  }

  const msgParseRules = message as MsgParseRules;

  if (['domain', 'url', 'regex', 'ip', 'asn', 'tracking'].includes(msgParseRules.ruleType)) {
    return parseRules(
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
function isDomainAllowedByTerminatingRule(hostname: string): boolean {
  // Check allowed domains
  const domainMatch = rules.allowedDomains.find(rule => {
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
  const urlMatch = rules.allowedUrls.find(rule => {
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
  const regexMatch = rules.allowedRegex.find(rule => {
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
async function handleBeforeRequest(
  details: browser.webRequest._OnBeforeRequestDetails,
): Promise<browser.webRequest.BlockingResponse> {
  try {
    // Ensure rules and settings are loaded
    if (!rules) {
      rules = await getRules();
    }

    if (!settings) {
      settings = await getSettings();
    }

    const url = new URL(details.url);
    const cacheKey = `req:${details.url}`;

    // Check cache first
    const ruleMatchCache = getRuleMatchCache();
    const cachedResult = ruleMatchCache.get(cacheKey);
    if (cachedResult !== undefined) {
      const shouldBlock = cachedResult as boolean;
      if (shouldBlock) {
        // Check if this is a resource-type based block (content blocking)
        // For declarative rules like images, fonts, media
        if (
          (details.type === 'image' && settings.blockImages) ||
          (details.type === 'font' && settings.blockRemoteFonts) ||
          (details.type === 'media' && settings.blockMedia)
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

    // Check if domain is allowed by a terminating DNR rule
    // This prevents IP/ASN/GeoIP rules from overriding DNR allow rules
    if (isDomainAllowedByTerminatingRule(url.hostname)) {
      ruleMatchCache.set(cacheKey, false);
      return { cancel: false };
    }

    // Check for private IP blocking
    if (settings.blockPrivateIPs) {
      if (await isPrivateHost(url.hostname)) {
        ruleMatchCache.set(cacheKey, true);

        // Log the blocked request
        const ip = await resolveDomain(url.hostname);
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
    const ruleResult = await processRules(
      url,
      cacheKey,
      rules,
      (key: string, value: boolean) => ruleMatchCache.set(key, value),
      details,
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
