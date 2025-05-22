import { Rule, Settings, RuleSet } from './types';

// Define a type alias for browser's declarativeNetRequest resource type
type ResourceType = browser.declarativeNetRequest.ResourceType;

// All available resource types to use for comprehensive rules
// These match the types supported by Firefox's declarativeNetRequest API
export const ALL_RESOURCE_TYPES: ResourceType[] = [
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
];

// Special dynamic rule ID to use for the temporary suspend rule
// Using a very high ID to minimize chance of conflict with regular rules
export const SUSPEND_RULE_ID = 999999;

// Rule count tracking
let totalRuleCount = 0;

// Firefox limitation for declarativeNetRequest
export const FIREFOX_RULE_LIMIT = 5000; // Default fallback value
export const MAX_REGEX_LENGTH = 1024;

// Add a local type declaration to match Firefox's runtime API
interface ExtendedDNRApi {
  MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES?: number;
  MAX_NUMBER_OF_DYNAMIC_RULES?: number;
  MAX_NUMBER_OF_REGEX_RULES?: number;
}

// Get the current Firefox rule limit (may be updated in the future)
export function getFirefoxRuleLimit(): number {
  try {
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
    return FIREFOX_RULE_LIMIT;
  } catch (error) {
    void error;
    // In case of any errors, return the default limit
    return FIREFOX_RULE_LIMIT;
  }
}

// Get the current rule count
export function getRuleCount(): number {
  return totalRuleCount;
}

// Reset the rule count (call before regenerating all rules)
export function resetRuleCount(): void {
  totalRuleCount = 0;
}

// Create regex patterns from domain lists with optimizations
function createRegexPatterns(domains: string[]): string[] {
  if (domains.length === 0) return [];

  // Group domains by TLD for better compression
  const domainsByTLD: Record<string, string[]> = {};

  // Process and group domains
  for (const domain of domains) {
    const parts = domain.split('.');

    // Skip invalid domains
    if (parts.length < 2) continue;

    const tld = parts[parts.length - 1];
    if (!domainsByTLD[tld]) {
      domainsByTLD[tld] = [];
    }

    domainsByTLD[tld].push(domain);
  }

  const patterns: string[] = [];

  // Process each TLD group
  for (const tld in domainsByTLD) {
    // Sort domains by length for better grouping potential
    const domainGroup = domainsByTLD[tld].sort((a, b) => a.length - b.length);

    let currentPattern = '';

    for (const domain of domainGroup) {
      // Escape dots in domain name for regex
      const escapedDomain = domain.replace(/\./g, '\\.');

      // Check if adding this domain would exceed the regex length limit
      if (currentPattern.length + escapedDomain.length + 1 > MAX_REGEX_LENGTH) {
        // Add the current pattern to the list and start a new one
        patterns.push(currentPattern);
        currentPattern = escapedDomain;
      } else {
        // Add to current pattern with separator if needed
        currentPattern = currentPattern ? `${currentPattern}|${escapedDomain}` : escapedDomain;
      }
    }

    // Add the last pattern if it exists
    if (currentPattern) {
      patterns.push(currentPattern);
    }
  }

  return patterns;
}

export function createDeclarativeNetRequestRules(
  rules: Rule[],
  startId: number = 1,
): browser.declarativeNetRequest.Rule[] {
  const dnrRules: browser.declarativeNetRequest.Rule[] = [];
  let id = startId;

  // Filter enabled rules
  const enabledRules = rules.filter(rule => rule.enabled);
  if (enabledRules.length === 0) return dnrRules;

  // For domain rules, try to optimize with regex
  if (enabledRules.length > 0 && enabledRules[0].type === 'domain') {
    const domainValues = enabledRules.map(rule => rule.value);
    const action = enabledRules[0].action;

    // Create regex patterns (multiple if needed to stay under length limit)
    const patterns = createRegexPatterns(domainValues);

    // Create rules from patterns
    for (const pattern of patterns) {
      const ruleAction: browser.declarativeNetRequest._RuleAction =
        action === 'block' ? { type: 'block' } : { type: 'allow' };

      dnrRules.push({
        id: id++,
        priority: 1,
        action: ruleAction,
        condition: {
          regexFilter: `.*://(.*\\.)?${pattern}/.*`,
        },
      });

      totalRuleCount++;
    }

    return dnrRules;
  }

  // For tracking parameters, optimize if possible
  if (enabledRules.length > 0 && enabledRules[0].type === 'tracking') {
    const paramValues = enabledRules.map(rule => rule.value);

    // Create regex patterns (multiple if needed to stay under length limit)
    const patterns = createRegexPatterns(paramValues);

    // Create rules from patterns
    for (const pattern of patterns) {
      dnrRules.push({
        id: id++,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: { transform: { queryTransform: { removeParams: [pattern] } } },
        },
        condition: {
          regexFilter: `[?&](${pattern})=`,
          resourceTypes: ALL_RESOURCE_TYPES,
        },
      });

      totalRuleCount++;
    }

    return dnrRules;
  }

  // For other rule types or when optimization isn't applicable
  for (const rule of enabledRules) {
    const action: browser.declarativeNetRequest._RuleAction =
      rule.action === 'block'
        ? { type: 'block' }
        : rule.action === 'redirect' && rule.type === 'url'
          ? { type: 'redirect', redirect: { url: rule.value } }
          : { type: 'allow' };

    const condition: Partial<browser.declarativeNetRequest._RuleCondition> = {};

    switch (rule.type) {
      case 'domain':
        condition.urlFilter = `||${rule.value}^`;
        break;
      case 'url':
        condition.urlFilter = rule.value;
        break;
      case 'regex':
        condition.regexFilter = rule.value;
        break;
    }

    if (Object.keys(condition).length > 0) {
      condition.resourceTypes = ALL_RESOURCE_TYPES;

      dnrRules.push({
        id: id++,
        priority: 1,
        action,
        condition: condition as browser.declarativeNetRequest._RuleCondition,
      });

      totalRuleCount++;
    }
  }

  return dnrRules;
}

/**
 * Creates basic rules for HTTP handling and resource blocking
 *
 * @param settings - The extension settings
 * @param startId - The starting ID for rule generation (default: 10)
 * @returns Array of declarative network request rules
 */
export function createBasicRules(
  settings: Settings,
  startId: number = 10,
): browser.declarativeNetRequest.Rule[] {
  const basicRules: browser.declarativeNetRequest.Rule[] = [];
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
        resourceTypes: ALL_RESOURCE_TYPES,
      },
    });
  } else if (settings.httpHandling === 'block') {
    basicRules.push({
      id: ruleId++,
      priority: 100,
      action: { type: 'block' },
      condition: {
        urlFilter: 'http://*',
        resourceTypes: ALL_RESOURCE_TYPES,
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

/**
 * Creates rules for tracking parameter removal
 *
 * @param rules - The rule set containing tracking parameters
 * @param startId - The starting ID for rule generation (default: 50)
 * @returns Array of declarative network request rules
 */
export function createTrackingParamRules(
  rules: RuleSet,
  startId: number = 50,
): browser.declarativeNetRequest.Rule[] {
  // Simply wrap the rules with createDeclarativeNetRequestRules
  // This will handle combining them into optimized regex patterns
  return rules.trackingParams.length > 0
    ? createDeclarativeNetRequestRules(rules.trackingParams, startId)
    : [];
}

/**
 * Sets up declarative network request rules in the browser
 *
 * @param settings - The extension settings
 * @param rules - The rule set containing filtering rules
 * @returns Promise that resolves when rules are set up
 */
export async function setupDeclarativeRules(settings: Settings, rules: RuleSet): Promise<void> {
  try {
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
              resourceTypes: ALL_RESOURCE_TYPES,
            },
          },
        ],
      });

      console.log('Added temporary blocking rule while filters load');
    } // Use a sequential ID counter for all rules
    let nextRuleId = 1;

    // Create the content filtering rules
    const basicRules = createBasicRules(settings, nextRuleId);
    nextRuleId += basicRules.length || 1;

    // Create tracking parameter rules
    const trackingRules = createTrackingParamRules(rules, nextRuleId);
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
      console.log('Removed temporary blocking rule after filters loaded successfully');
    }

    console.log(
      `Session rules updated successfully: ${getRuleCount()}/${getFirefoxRuleLimit()} rules used`,
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
}
