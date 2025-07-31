/**
 * EventService handles browser event management
 * Centralizes message handling and web request interception
 */
import type { ExtensionMsg, MsgSaveSettings, MsgSaveRules } from '../types';
import type { Settings, RuleSet } from '../types';

// Function imports from converted services
import { getRules, saveRules, processRules } from '../rule/RuleService';

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

// Direct import of MaxMind service
import { MaxMindService } from '../maxmind/MaxMindService';

/**
 * Module-level MaxMind service instance
 */
const maxMindService = new MaxMindService();

/**
 * Track if event listeners have been set up to prevent duplicates
 */
let listenersSetup = false;

/**
 * Current settings
 */
let settings: Settings = {} as Settings;

/**
 * Current rules
 */
let rules: RuleSet = {} as RuleSet;

/**
 * CRITICAL: Register event listeners immediately and synchronously
 * This function must be called synchronously when the background script loads
 * to ensure event listeners are registered before any async operations
 */
export function registerEventListeners(): void {
  if (listenersSetup) {
    console.log('EventService: Event listeners already registered, skipping...');
    return;
  }

  console.log('EventService: Registering event listeners synchronously...');

  // Set up event listeners immediately
  setupMessageListener();
  setupWebRequestListeners();
  setupBrowserShutdownListener();
  setupAndroidSupport();

  listenersSetup = true;
  console.log('EventService: Event listeners registered successfully');
}

/**
 * Initialize the event service
 * @returns Promise that resolves when initialization is complete
 */
export async function initialize(): Promise<void> {
  try {
    console.log('EventService: Starting initialization...');

    // Ensure event listeners are registered (defensive programming)
    if (!listenersSetup) {
      registerEventListeners();
    }

    // Load settings and rules
    console.log('EventService: Loading settings and rules...');
    settings = await getSettings();
    rules = await getRules();
    console.log('EventService: Settings and rules loaded successfully');

    // Set up declarative rules during initialization
    console.log('EventService: Setting up declarative rules...');
    await setupRules(settings, rules);
    console.log('EventService: Declarative rules set up successfully');

    // Initialize MaxMind service in background (non-blocking)
    maxMindService.initialize().catch(error => {
      console.warn('EventService: MaxMind service initialization failed (non-critical):', error);
    });

    console.log('EventService: Initialization completed successfully');
  } catch (error) {
    console.error('EventService: Critical error during initialization:', error);

    // Ensure event listeners are still registered even if other parts fail
    if (!listenersSetup) {
      registerEventListeners();
    }

    // Try to set up rules even if other initialization failed
    try {
      if (settings && rules) {
        console.log('EventService: Attempting fallback rule setup...');
        await setupRules(settings, rules);
        console.log('EventService: Fallback rule setup successful');
      }
    } catch (ruleError) {
      console.error('EventService: Fallback rule setup also failed:', ruleError);
    }

    throw error;
  }
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
async function handleMessage(
  message: ExtensionMsg,
  _sender: browser.runtime.MessageSender,
): Promise<unknown> {
  // Type guard to ensure message is valid
  if (!message || typeof message !== 'object') {
    return Promise.resolve({ success: false, error: 'Invalid message format' });
  }

  // Ensure settings and rules are loaded (critical for MV3)
  // This handles the case where the background script wakes up from idle
  if (!settings || Object.keys(settings).length === 0) {
    console.log('EventService: Settings not loaded, loading now...');
    try {
      settings = await getSettings();
    } catch (error) {
      console.error('EventService: Failed to load settings:', error);
      return { success: false, error: 'Failed to load settings' };
    }
  }

  if (!rules || Object.keys(rules).length === 0) {
    console.log('EventService: Rules not loaded, loading now...');
    try {
      rules = await getRules();
    } catch (error) {
      console.error('EventService: Failed to load rules:', error);
      return { success: false, error: 'Failed to load rules' };
    }
  }

  // Route messages to appropriate handlers to reduce method complexity
  switch (message.type) {
    case 'saveSettings':
    case 'saveRules':
      return handleSaveMessages(message);

    case 'getCountryLookupCache':
    case 'setCountryLookupCache':
    case 'clearCache':
      return handleCacheMessages(message);

    case 'getRuleLimit':
      return Promise.resolve(handleGetRuleLimit());

    case 'ping':
      return handlePingMessage();

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
          // Direct MaxMind service access
          await maxMindService.updateConfig({
            licenseKey: msgSaveSettings.settings.maxmind.licenseKey,
            lastDownload: settings.maxmind.lastDownload,
          });

          // Refresh MaxMind service
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
 * Handle ping messages with state validation
 * @returns Promise resolving to ping response with validation status
 */
async function handlePingMessage(): Promise<{
  success: boolean;
  timestamp: number;
  validated?: boolean;
}> {
  const timestamp = Date.now();

  try {
    // Check if declarative rules need to be re-setup
    // This is critical for when the background script wakes up from idle
    if (settings && rules && Object.keys(settings).length > 0 && Object.keys(rules).length > 0) {
      // Validate that declarative rules are still active by attempting to setup again
      await setupRules(settings, rules);
      return { success: true, timestamp, validated: true };
    } else {
      // State not properly loaded
      return { success: true, timestamp, validated: false };
    }
  } catch (error) {
    console.error('EventService: Error during ping validation:', error);
    return { success: true, timestamp, validated: false };
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
 * Handle getRuleLimit message
 * @returns The maximum number of rules allowed by the browser
 */
function handleGetRuleLimit(): number {
  return getRuleLimit();
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
