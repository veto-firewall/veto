import { getSettings, saveSettings } from '../utils/settings';
import { getRules, saveRules } from '../utils/rules';
import { setupDeclarativeRules } from '../utils/rulesDNR';
import { isPrivateIP } from '../utils/ip';
import { resolveDomain } from '../utils/dns';
import { loadGeoIpDatabase, loadAsnDatabase, downloadMaxMindDatabases } from '../utils/maxmind';
import { ExtensionMsg, MsgSaveSettings, MsgSaveRules, MsgExportRules, Rule } from '../utils/types';
import {
  ruleMatchCache,
  dnsCache,
  ipClassificationCache,
  geoIpCache,
  asnCache,
} from '../utils/caching';
import { logBlockedRequest } from '../utils/logger';
import { isValid } from 'ipaddr.js';
import {
  processIpRules as processIpRulesUtil,
  processAsnRules as processAsnRulesUtil,
  processGeoIpRules as processGeoIpRulesUtil,
  exportRules as exportRulesUtil,
  getRulesText as _getRulesTextUtil,
  getFilterFileContent as _getFilterFileContentUtil,
  findAsnAllowRule as findAsnAllowRuleUtil,
  findAsnBlockRule as findAsnBlockRuleUtil,
} from '../utils/rules';

let settings: Awaited<ReturnType<typeof getSettings>>;
let rules: Awaited<ReturnType<typeof getRules>>;

async function initExtension(): Promise<void> {
  void console.log('Initializing extension...');

  settings = await getSettings();
  rules = await getRules();

  // Initialize MaxMind database if license key is provided
  if (settings.maxmind.licenseKey) {
    const now = Date.now();
    const lastDownload = settings.maxmind.lastDownload || 0;
    const oneMonth = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

    if (now - lastDownload > oneMonth) {
      await downloadMaxMindDatabases(settings.maxmind);

      // Update the last download timestamp
      settings.maxmind.lastDownload = Date.now();
      await saveSettings(settings);
    } else {
      await loadGeoIpDatabase();
      await loadAsnDatabase();
    }
  }

  void console.log('Settings loaded:', {
    httpHandling: settings.httpHandling,
    blockPrivateIPs: settings.blockPrivateIPs,
    maxmind: {
      licenseKey: settings.maxmind.licenseKey ? '(set)' : '(not set)',
      lastDownload: settings.maxmind.lastDownload || 'never',
    },
  });

  void console.log('Rules loaded:', {
    allowedDomains: rules.allowedDomains.length,
    blockedDomains: rules.blockedDomains.length,
    allowedIps: rules.allowedIps.length,
    blockedIps: rules.blockedIps.length,
    allowedAsns: rules.allowedAsns.length,
    blockedAsns: rules.blockedAsns.length,
    blockedCountries: Object.keys(rules.blockedCountries).length,
  });

  await setupDeclarativeRules(settings, rules);
  setupWebRequestListeners();

  // Load databases if credentials are set
  if (settings.maxmind.licenseKey) {
    void console.log('MaxMind license key found, loading GeoIP and ASN databases...');
    await loadGeoIpDatabase();
    await loadAsnDatabase();
  } else {
    void console.warn('MaxMind license key not set, GeoIP and ASN databases will not be loaded');
  }

  browser.runtime.onMessage.addListener(handleMessage);

  void console.log('extension initialized');
}

// Function to clear all caches
function clearAllCaches(): void {
  ruleMatchCache.clear();
  dnsCache.clear();
  ipClassificationCache.clear();
  geoIpCache.clear();
  asnCache.clear();
}

// Check if a hostname should be blocked due to private IP restrictions
async function shouldBlockPrivateIP(hostname: string): Promise<boolean> {
  // If hostname is a direct IP address
  try {
    if (isValid(hostname)) {
      return isPrivateIP(hostname);
    }
  } catch (error) {
    void error;
  }

  // For domain names, resolve to IP first
  try {
    dnsCache.delete(hostname);
    const ip = await resolveDomain(hostname);
    if (ip) {
      return isPrivateIP(ip);
    }
  } catch (error) {
    void error;
  }

  return false;
}

function setupWebRequestListeners(): void {
  void console.log('Setting up web request listeners for ASN and GeoIP blocking...');

  try {
    browser.webRequest.onBeforeRequest.addListener(handleBeforeRequest, { urls: ['<all_urls>'] }, [
      'blocking',
    ]);
    void console.log('Web request listener registered successfully');
  } catch (e) {
    void console.error('Failed to register web request listener:', e);
  }
}

async function handleBeforeRequest(
  details: browser.webRequest._OnBeforeRequestDetails,
): Promise<browser.webRequest.BlockingResponse> {
  try {
    // Ensure rules and settings are loaded
    if (!rules) {
      void console.log('Rules not initialized, loading from storage...');
      rules = await getRules();
    }

    if (!settings) {
      void console.log('Settings not initialized, loading from storage...');
      settings = await getSettings();
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

    const resourceType = details.type || 'unknown';

    // Check for private IP blocking
    if (settings.blockPrivateIPs) {
      // Use our enhanced function that properly handles cache
      if (await shouldBlockPrivateIP(url.hostname)) {
        ruleMatchCache.set(cacheKey, true);

        // Log the blocked request
        const ip = await resolveDomain(url.hostname);
        logBlockedRequest({
          url: details.url,
          domain: url.hostname,
          ip: ip || 'Unknown',
          resourceType: resourceType,
          blockReason: 'private-ip',
        });

        return { cancel: true };
      }
    }

    // IP rules
    const ipRuleResult = await processIpRules(url, cacheKey, details);
    if (ipRuleResult) {
      return ipRuleResult;
    }

    // ASN rules
    const asnRuleResult = await processAsnRules(url, cacheKey, details);
    if (asnRuleResult) {
      return asnRuleResult;
    }

    // GeoIP rules
    const geoIpRuleResult = await processGeoIpRules(url, cacheKey, details);
    if (geoIpRuleResult) {
      return geoIpRuleResult;
    }

    // No block rules matched
    ruleMatchCache.set(cacheKey, false);
    return { cancel: false };
  } catch (error) {
    void error;
    return { cancel: false };
  }
}

// Process IP-based rules
async function processIpRules(
  url: URL,
  cacheKey: string,
  details?: browser.webRequest._OnBeforeRequestDetails,
): Promise<browser.webRequest.BlockingResponse | null> {
  return processIpRulesUtil(
    url,
    cacheKey,
    rules,
    (key: string, value: boolean) => ruleMatchCache.set(key, value),
    details,
  );
}

// Find a matching ASN allow rule
function _findAsnAllowRule(asn: number): Rule | undefined {
  return findAsnAllowRuleUtil(asn, rules);
}

// Find a matching ASN block rule
function _findAsnBlockRule(asn: number): Rule | undefined {
  return findAsnBlockRuleUtil(asn, rules);
}

// Process ASN-based rules
async function processAsnRules(
  url: URL,
  cacheKey: string,
  details?: browser.webRequest._OnBeforeRequestDetails,
): Promise<browser.webRequest.BlockingResponse | null> {
  return processAsnRulesUtil(
    url,
    cacheKey,
    rules,
    (key: string, value: boolean) => ruleMatchCache.set(key, value),
    details,
  );
}

// Process GeoIP-based rules
async function processGeoIpRules(
  url: URL,
  cacheKey: string,
  details?: browser.webRequest._OnBeforeRequestDetails,
): Promise<browser.webRequest.BlockingResponse | null> {
  return processGeoIpRulesUtil(
    url,
    cacheKey,
    rules,
    (key: string, value: boolean) => ruleMatchCache.set(key, value),
    details,
  );
}

async function handleMessage(
  message: ExtensionMsg,
  _sender: browser.runtime.MessageSender,
): Promise<unknown> {
  switch (message.type) {
    case 'getSettings':
      return getSettings();

    case 'saveSettings': {
      const msgSaveSettings = message as MsgSaveSettings;
      settings = msgSaveSettings.settings;
      await saveSettings(settings);
      clearAllCaches();
      await setupDeclarativeRules(settings, rules);
      return { success: true };
    }

    case 'getRules':
      return getRules();

    case 'saveRules':
      {
        const msgSaveRules = message as MsgSaveRules;
        void console.log('Saving updated rules:', {
          allowedDomains: msgSaveRules.rules.allowedDomains?.length,
          blockedDomains: msgSaveRules.rules.blockedDomains?.length,
          allowedIps: msgSaveRules.rules.allowedIps?.length,
          blockedIps: msgSaveRules.rules.blockedIps?.length,
          allowedAsns: msgSaveRules.rules.allowedAsns?.length,
          blockedAsns: msgSaveRules.rules.blockedAsns?.length,
          blockedCountries: Object.keys(msgSaveRules.rules.blockedCountries || {}).length,
        });

        rules = msgSaveRules.rules;
        await saveRules(rules);
      }

      // Clear all caches when rules are updated
      clearAllCaches();
      void console.log('Caches cleared after rule update');

      await setupDeclarativeRules(settings, rules);
      return { success: true };

    case 'exportRules': {
      const msgExportRules = message as MsgExportRules;

      // Normalize any hyphenated rule type to camelCase
      let ruleType = msgExportRules.ruleType;
      if (typeof ruleType === 'string' && ruleType.includes('-')) {
        ruleType = ruleType.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
      }

      return await exportRules(ruleType, msgExportRules.includeComments || false);
    }

    case 'clearCache':
      clearAllCaches();
      return { success: true };
  }
}

async function exportRules(ruleType: string, includeComments: boolean = false): Promise<string> {
  return await exportRulesUtil(ruleType, includeComments, getRules);
}

void initExtension();
