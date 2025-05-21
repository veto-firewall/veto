import { getSettings, saveSettings, getRules, saveRules } from '../utils/storage';
import {
  createDeclarativeNetRequestRules,
  resetRuleCount,
  getRuleCount,
  getFirefoxRuleLimit,
} from '../utils/rules';
import { isPrivateIP, ipMatchesRange } from '../utils/ip';
import { resolveDomain } from '../utils/dns';
import { getCountryByIp, getAsnByIp, loadGeoIpDatabase, loadAsnDatabase } from '../utils/geoip';
import {
  ExtensionMsg,
  MsgSaveSettings,
  MsgSaveRules,
  MsgExportRules,
  Rule,
  RuleSet,
} from '../utils/types';
import {
  ruleMatchCache,
  dnsCache,
  ipClassificationCache,
  geoIpCache,
  asnCache,
} from '../utils/caching';
import { logBlockedRequest } from '../utils/logger';
import { isValid } from 'ipaddr.js';

let settings: Awaited<ReturnType<typeof getSettings>>;
let rules: Awaited<ReturnType<typeof getRules>>;

// Special dynamic rule ID to use for the temporary suspend rule
// Using a very high ID to minimize chance of conflict with regular rules
const SUSPEND_RULE_ID = 999999;

async function initExtension(): Promise<void> {
  void console.log('Initializing extension...');

  settings = await getSettings();
  rules = await getRules();

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

  await setupDeclarativeRules();
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

async function setupDeclarativeRules(): Promise<void> {
  try {
    // Load the GeoIP and ASN databases if needed
    await loadGeoIpDatabase();
    await loadAsnDatabase();

    // Reset rule count before generating new rules
    resetRuleCount();

    // Clear all existing rules (both session and dynamic)
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

    // Handle "suspend until filters load" setting - uses dynamic rules
    // This rule has priority over all others and blocks everything while rules are loading
    if (settings.suspendUntilFiltersLoad) {
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

      void console.log('Added temporary blocking rule while filters load');
    }    // Use a sequential ID counter for all rules
    let nextRuleId = 1;
    
    // Create the content filtering rules
    const basicRules = createBasicRules(nextRuleId);
    nextRuleId += basicRules.length || 1;
    
    // Create tracking parameter rules
    const trackingRules = createTrackingParamRules(nextRuleId);
    nextRuleId += trackingRules.length || 1;
    
    // Create domain rules
    const allowedDomainRules = createDeclarativeNetRequestRules(rules.allowedDomains, nextRuleId);
    nextRuleId += allowedDomainRules.length || 1;
    
    const blockedDomainRules = createDeclarativeNetRequestRules(rules.blockedDomains, nextRuleId);
    nextRuleId += blockedDomainRules.length || 1;
    
    // Create URL rules
    const allowedUrlRules = createDeclarativeNetRequestRules(rules.allowedUrls, nextRuleId);
    nextRuleId += allowedUrlRules.length || 1;
    
    const blockedUrlRules = createDeclarativeNetRequestRules(rules.blockedUrls, nextRuleId);
    nextRuleId += blockedUrlRules.length || 1;
    
    // Create regex rules
    const allowedRegexRules = createDeclarativeNetRequestRules(rules.allowedRegex, nextRuleId);
    nextRuleId += allowedRegexRules.length || 1;
    
    const blockedRegexRules = createDeclarativeNetRequestRules(rules.blockedRegex, nextRuleId);
    nextRuleId += blockedRegexRules.length || 1;
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
    // We already cleared all existing rules at the beginning of this function
    // So we can safely add our new rules without worrying about duplicates
    await browser.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [], // Explicitly specify empty array for compatibility
      addRules: sessionRules,
    });

    // Save current rule count to storage for the popup to display
    await browser.storage.local.set({ ruleCount: getRuleCount() });

    // Remove the temporary blocking rule if it was added
    if (settings.suspendUntilFiltersLoad) {
      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [SUSPEND_RULE_ID],
        addRules: [],
      });
      void console.log('Removed temporary blocking rule after filters loaded successfully');
    }

    void console.log(
      `Session rules updated successfully: ${getRuleCount()}/${getFirefoxRuleLimit()} rules used`,
    );
  } catch (e) {
    void console.error('Failed to update rules:', e);

    // Store error information for the popup
    const errorInfo = {
      message: e instanceof Error ? e.message : 'Unknown error',
      timestamp: Date.now(),
    };
    await browser.storage.local.set({ ruleUpdateError: errorInfo });

    // Make sure to remove the blocking rule if there was an error
    if (settings.suspendUntilFiltersLoad) {
      try {
        await browser.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [SUSPEND_RULE_ID],
          addRules: [],
        });
      } catch (removeError) {
        void console.error('Failed to remove blocking rule:', removeError);
      }
    }
  }
}

function createBasicRules(startId: number = 10): browser.declarativeNetRequest.Rule[] {
  const basicRules: browser.declarativeNetRequest.Rule[] = [];
  // Use the provided start ID or default to 10
  let ruleId = startId;

  // HTTP handling
  if (settings.httpHandling === 'redirect') {
    basicRules.push({
      id: ruleId++,
      priority: 100,
      action: {
        type: 'redirect',
        redirect: { transform: { scheme: 'https' } },
      },
      condition: {
        urlFilter: 'http://*',
        resourceTypes: ['main_frame', 'sub_frame'],
      },
    });
  } else if (settings.httpHandling === 'block') {
    basicRules.push({
      id: ruleId++,
      priority: 100,
      action: { type: 'block' },
      condition: {
        urlFilter: 'http://*',
        resourceTypes: ['main_frame', 'sub_frame'],
      },
    });
  }

  // Block resources by type
  if (settings.blockRemoteFonts) {
    basicRules.push({
      id: ruleId++,
      priority: 100,
      action: { type: 'block' },
      condition: {
        resourceTypes: ['font'],
      },
    });
  }

  if (settings.blockImages) {
    basicRules.push({
      id: ruleId++,
      priority: 100,
      action: { type: 'block' },
      condition: {
        resourceTypes: ['image'],
      },
    });
  }

  if (settings.blockMedia) {
    basicRules.push({
      id: ruleId++,
      priority: 100,
      action: { type: 'block' },
      condition: {
        resourceTypes: ['media'],
      },
    });
  }

  return basicRules;
}

function createTrackingParamRules(startId: number = 50): browser.declarativeNetRequest.Rule[] {
  // Simply wrap our rules with createDeclarativeNetRequestRules
  // This will handle combining them into optimized regex patterns
  return rules.trackingParams.length > 0
    ? createDeclarativeNetRequestRules(rules.trackingParams, startId)
    : [];
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
  if (rules.blockedIps.length === 0 && rules.allowedIps.length === 0) {
    return null;
  }

  const ip = await resolveDomain(url.hostname);
  if (!ip) {
    return null;
  }

  // First, find any matching allowed IP rule
  const allowedRule = rules.allowedIps.find(rule => rule.enabled && ipMatchesRange(ip, rule.value));

  // Check if there's a terminating allow rule - these take highest precedence
  if (allowedRule && allowedRule.isTerminating) {
    void console.log(`IP ${ip} matched terminating allow rule: ${allowedRule.value}`);
    ruleMatchCache.set(cacheKey, false);
    return { cancel: false };
  }

  // Then check for blocked IPs - block rules always override non-terminating allow rules
  const blockedRule = rules.blockedIps.find(rule => rule.enabled && ipMatchesRange(ip, rule.value));
  if (blockedRule) {
    void console.log(`IP ${ip} matched block rule: ${blockedRule.value}`);
    ruleMatchCache.set(cacheKey, true);

    if (details) {
      logBlockedRequest({
        url: details.url,
        domain: url.hostname,
        ip: ip,
        resourceType: details.type || 'unknown',
        blockReason: 'ip',
      });
    }

    return { cancel: true };
  }

  // If we have a non-terminating allow rule and no block rule matched, allow the request
  if (allowedRule) {
    void console.log(`IP ${ip} matched non-terminating allow rule: ${allowedRule.value}`);
    ruleMatchCache.set(cacheKey, false);
    return { cancel: false };
  }

  return null;
}

// Find a matching ASN allow rule
function findAsnAllowRule(asn: number): Rule | undefined {
  return rules.allowedAsns.find(rule => {
    const ruleAsn = parseInt(rule.value);
    const matches = rule.enabled && ruleAsn === asn;
    if (matches) {
      void console.log(`ASN ${asn} matches allowed ASN rule: ${rule.value}`);
    }
    return matches;
  });
}

// Find a matching ASN block rule
function findAsnBlockRule(asn: number): Rule | undefined {
  return rules.blockedAsns.find(rule => {
    const ruleAsn = parseInt(rule.value);
    const matches = rule.enabled && ruleAsn === asn;
    if (matches) {
      void console.log(`ASN ${asn} matches blocked ASN rule: ${rule.value}`);
    }
    return matches;
  });
}

// Process ASN-based rules
async function processAsnRules(
  url: URL,
  cacheKey: string,
  details?: browser.webRequest._OnBeforeRequestDetails,
): Promise<browser.webRequest.BlockingResponse | null> {
  if (rules.blockedAsns.length === 0 && rules.allowedAsns.length === 0) {
    return null;
  }

  const ip = await resolveDomain(url.hostname);
  if (!ip) {
    void console.log(`Could not resolve IP for ${url.hostname}`);
    return null;
  }

  void console.log(`Checking ASN rules for ${url.hostname} (IP: ${ip})`);
  const asn = await getAsnByIp(ip);
  void console.log(`ASN lookup result for ${ip}: ${asn}`);

  if (asn === null) {
    void console.log(`Could not determine ASN for ${ip}`);
    return null;
  }

  // Find a matching allow rule
  const allowRule = findAsnAllowRule(asn);

  // Check if there's a terminating allow rule - these take highest precedence
  if (allowRule && allowRule.isTerminating) {
    void console.log(`Request allowed by terminating ASN rule: ${url.hostname} (ASN: ${asn})`);
    ruleMatchCache.set(cacheKey, false);
    return { cancel: false };
  }

  // Check for block rules - these override non-terminating allow rules
  const blockRule = findAsnBlockRule(asn);
  if (blockRule) {
    void console.log(`Request blocked by ASN rule: ${url.hostname} (ASN: ${asn})`);
    ruleMatchCache.set(cacheKey, true);

    if (details) {
      logBlockedRequest({
        url: details.url,
        domain: url.hostname,
        ip: ip,
        asn: asn,
        resourceType: details.type || 'unknown',
        blockReason: 'asn',
      });
    }

    return { cancel: true };
  }

  // If we have a non-terminating allow rule and no block rule matched, allow the request
  if (allowRule) {
    void console.log(`Request allowed by non-terminating ASN rule: ${url.hostname} (ASN: ${asn})`);
    ruleMatchCache.set(cacheKey, false);
    return { cancel: false };
  }

  return null;
}

// Process GeoIP-based rules
async function processGeoIpRules(
  url: URL,
  cacheKey: string,
  details?: browser.webRequest._OnBeforeRequestDetails,
): Promise<browser.webRequest.BlockingResponse | null> {
  if (Object.keys(rules.blockedCountries).length === 0) {
    return null;
  }

  const ip = await resolveDomain(url.hostname);
  if (!ip) {
    void console.log(`Could not resolve IP for ${url.hostname}`);
    return null;
  }

  void console.log(`Checking GeoIP rules for ${url.hostname} (IP: ${ip})`);
  const country = await getCountryByIp(ip);
  void console.log(`Country lookup result for ${ip}: ${country}`);

  if (!country) {
    void console.log(`Could not determine country for ${ip}`);
    return null;
  }

  const isBlocked = rules.blockedCountries[country];
  if (isBlocked) {
    void console.log(`Request blocked by GeoIP rule: ${url.hostname} (Country: ${country})`);
    ruleMatchCache.set(cacheKey, true);

    if (details) {
      logBlockedRequest({
        url: details.url,
        domain: url.hostname,
        ip: ip,
        location: country,
        resourceType: details.type || 'unknown',
        blockReason: 'geoip',
      });
    }

    return { cancel: true };
  } else {
    void console.log(`Country ${country} is not in the block list, request allowed`);
  }

  return null;
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
      await setupDeclarativeRules();
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

      await setupDeclarativeRules();
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

// Helper function to load a filter file's content
async function getFilterFileContent(fileName: string): Promise<string> {
  try {
    const response = await fetch(`/filters/${fileName}.txt`);
    if (response.ok) {
      return await response.text();
    }
  } catch (error) {
    void error;
  }
  return '';
}

// Helper function to get rules text based on rule type and whether to include comments
async function getRulesText(
  ruleType: string,
  allRules: RuleSet,
  includeComments: boolean,
): Promise<string> {
  // Handle domain rules
  if (ruleType === 'allowedDomains' || ruleType === 'blockedDomains') {
    if (includeComments) {
      return await getFilterFileContent('DomainNames');
    }
    return (ruleType === 'allowedDomains' ? allRules.allowedDomains : allRules.blockedDomains)
      .map((r: Rule) => r.value)
      .join('\n');
  }

  // Handle URL rules
  if (ruleType === 'allowedUrls' || ruleType === 'blockedUrls') {
    return (ruleType === 'allowedUrls' ? allRules.allowedUrls : allRules.blockedUrls)
      .map((r: Rule) => r.value)
      .join('\n');
  }

  // Handle regex rules
  if (ruleType === 'allowedRegex' || ruleType === 'blockedRegex') {
    if (includeComments) {
      return await getFilterFileContent('Regex');
    }
    return (ruleType === 'allowedRegex' ? allRules.allowedRegex : allRules.blockedRegex)
      .map((r: Rule) => r.value)
      .join('\n');
  }

  // Handle tracking parameters
  if (ruleType === 'trackingParams') {
    return allRules.trackingParams.map((r: Rule) => r.value).join('\n');
  }

  // Handle IP rules
  if (ruleType === 'allowedIps' || ruleType === 'blockedIps') {
    if (includeComments) {
      return await getFilterFileContent('IPs');
    }
    return (ruleType === 'allowedIps' ? allRules.allowedIps : allRules.blockedIps)
      .map((r: Rule) => r.value)
      .join('\n');
  }

  // Handle ASN rules
  if (ruleType === 'allowedAsns' || ruleType === 'blockedAsns') {
    if (includeComments) {
      return await getFilterFileContent('ASNs');
    }
    return (ruleType === 'allowedAsns' ? allRules.allowedAsns : allRules.blockedAsns)
      .map((r: Rule) => r.value)
      .join('\n');
  }

  return '';
}

async function exportRules(ruleType: string, includeComments: boolean = false): Promise<string> {
  try {
    const allRules = await getRules();
    return await getRulesText(ruleType, allRules, includeComments);
  } catch (error) {
    void error;
    return '';
  }
}

void initExtension();
