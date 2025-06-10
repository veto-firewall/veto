/**
 * DeclarativeRuleService function-based implementation
 * Handles all browser declarativeNetRequest operations as standalone functions
 */
import type { RuleSet, Settings } from '../types';
import {
  BasicRuleProcessor,
  DomainRuleProcessor,
  TrackingParamProcessor,
  RegexRuleProcessor,
  ALL_RESOURCE_TYPES,
} from './processors';

/**
 * Special dynamic rule ID to use for the temporary suspend rule
 */
const SUSPEND_RULE_ID = 1;

/**
 * Rule ID range allocation for different rule types
 * Each rule type gets its own dedicated range to prevent ID conflicts
 */
const RULE_ID_RANGES = {
  basic: { multiplier: 0, offset: 2 }, // 2-4999 (offset 2 to avoid SUSPEND_RULE_ID)
  tracking: { multiplier: 1, offset: 0 }, // 5000-9999
  domain: { multiplier: 2, offset: 0 }, // 10000-14999
  url: { multiplier: 3, offset: 0 }, // 15000-19999
  regex: { multiplier: 4, offset: 0 }, // 20000-24999
} as const;

/**
 * The current count of active rules
 */
let totalRuleCount = 0;

/**
 * Firefox rule limit for declarativeNetRequest
 */
let ruleLimit: number = 5000; // Default fallback value

/**
 * Max length of regex pattern (Firefox limitation)
 */
export const MAX_REGEX_LENGTH = 1024;

/**
 * Mutex to prevent concurrent rule updates
 */
let ruleUpdateMutex: Promise<void> = Promise.resolve();

/**
 * Get the Firefox rule limit from the browser API
 * @returns The maximum number of rules allowed
 */
function getFirefoxRuleLimit(): number {
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
    return ruleLimit;
  } catch (error) {
    void error;
    // In case of any errors, return the default limit
    return ruleLimit;
  }
}

/**
 * Initialize the declarative rule service
 * @returns Promise that resolves when initialization is complete
 */
export async function initialize(): Promise<void> {
  // Initialize the Firefox rule limit
  ruleLimit = getFirefoxRuleLimit();
  // No additional initialization needed
}

/**
 * Get the maximum number of rules allowed by Firefox
 * @returns The rule limit
 */
export function getRuleLimit(): number {
  return ruleLimit;
}

/**
 * Get the current rule count
 * @returns The number of active rules
 */
export function getRuleCount(): number {
  return totalRuleCount;
}

/**
 * Reset the rule count
 * Called before regenerating all rules
 */
function resetRuleCount(): void {
  totalRuleCount = 0;
}

/**
 * Track a rule count increase
 * @param count - Number of rules to add (default: 1)
 */
export function incrementRuleCount(count: number = 1): void {
  totalRuleCount += count;
}

/**
 * Get the starting rule ID for a specific rule type based on range allocation
 * @param ruleType - The type of rule to get the range for
 * @returns The starting ID for this rule type
 */
function getRuleIdRange(ruleType: keyof typeof RULE_ID_RANGES): number {
  const range = RULE_ID_RANGES[ruleType];
  const rangeSize = getFirefoxRuleLimit();
  return range.multiplier * rangeSize + range.offset;
}

/**
 * Set up declarative network request rules in the browser
 * @param settings - The extension settings
 * @param rules - The ruleset containing filtering rules
 * @returns Promise that resolves when rules are set up
 */
export async function setupRules(settings: Settings, rules: RuleSet): Promise<void> {
  // Use mutex to prevent concurrent rule updates
  ruleUpdateMutex = ruleUpdateMutex.then(async () => {
    await setupRulesInternal(settings, rules);
  });

  return ruleUpdateMutex;
}

/**
 * Internal implementation of rule setup (protected by mutex)
 * @param settings - The extension settings
 * @param rules - The ruleset containing filtering rules
 * @returns Promise that resolves when rules are set up
 */
async function setupRulesInternal(settings: Settings, rules: RuleSet): Promise<void> {
  try {
    // Reset rule count before generating new rules
    resetRuleCount();

    // Get existing dynamic rules to check for suspend rule
    const existingDynamicRules = await browser.declarativeNetRequest.getDynamicRules();
    const suspendRuleExists = existingDynamicRules.some(rule => rule.id === SUSPEND_RULE_ID);

    // Clear all existing session rules
    await clearExistingSessionRules();

    // Create all rule types and combine them
    const sessionRules = await createAllRules(settings, rules);

    // Add all the rules to the browser using session rules
    await browser.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [], // Explicitly specify empty array for compatibility
      addRules: sessionRules,
    });

    // Save current rule count to storage for the popup to display
    await browser.storage.local.set({ ruleCount: getRuleCount() });

    // Remove the startup suspend rule if it exists and feature is enabled
    if (suspendRuleExists && settings.suspendUntilFiltersLoad) {
      await removeSuspendRule();
    }
  } catch (e) {
    console.error('Failed to update rules:', e);

    // Store error information for the popup
    const errorInfo = {
      message: e instanceof Error ? e.message : 'Unknown error',
      timestamp: Date.now(),
    };
    await browser.storage.local.set({ ruleUpdateError: errorInfo });

    // Don't remove the suspend rule if there was an error
    // This prevents requests from leaking through when rules fail to load
    // The suspend rule will be removed on the next successful attempt
  }
}

/**
 * Create all rule types using range-based ID allocation
 * @param settings - The extension settings
 * @param rules - The ruleset containing filtering rules
 * @returns Array of all created rules
 */
async function createAllRules(
  settings: Settings,
  rules: RuleSet,
): Promise<browser.declarativeNetRequest.Rule[]> {
  // Create basic and tracking rules
  const basicRules = createBasicRules(settings);
  const trackingRules = createTrackingRules(rules);

  // Create domain and URL rules
  const domainAndUrlRules = createDomainAndUrlRules(rules);

  // Create regex rules
  const regexRules = createRegexRules(rules);

  // Combine all rule arrays
  return [...basicRules, ...trackingRules, ...domainAndUrlRules, ...regexRules];
}

/**
 * Create basic rules with range-based ID allocation
 * @param settings - The extension settings
 * @returns Array of basic rules
 */
function createBasicRules(settings: Settings): browser.declarativeNetRequest.Rule[] {
  const basicProcessor = new BasicRuleProcessor();
  const basicStartId = getRuleIdRange('basic');
  const basicRules = basicProcessor.createRules(settings, basicStartId);
  return basicRules;
}

/**
 * Create tracking rules with range-based ID allocation
 * @param rules - The ruleset containing filtering rules
 * @returns Array of tracking rules
 */
function createTrackingRules(rules: RuleSet): browser.declarativeNetRequest.Rule[] {
  const trackingProcessor = new TrackingParamProcessor();
  const trackingStartId = getRuleIdRange('tracking');
  const trackingRules = trackingProcessor.createRules(rules, trackingStartId);
  return trackingRules;
}

/**
 * Create domain and URL rules with range-based ID allocation
 * @param rules - The ruleset containing filtering rules
 * @returns Array of domain and URL rules
 */
function createDomainAndUrlRules(rules: RuleSet): browser.declarativeNetRequest.Rule[] {
  const domainProcessor = new DomainRuleProcessor();

  // Create domain rules with range-based ID allocation
  const domainStartId = getRuleIdRange('domain');
  let domainCurrentId = domainStartId;

  const allowedDomainRules = domainProcessor.createDomainRules(
    rules.allowedDomains,
    domainCurrentId,
    'allow',
  );
  domainCurrentId += allowedDomainRules.length;

  const blockedDomainRules = domainProcessor.createDomainRules(
    rules.blockedDomains,
    domainCurrentId,
    'block',
  );
  domainCurrentId += blockedDomainRules.length;

  // Create URL rules with range-based ID allocation
  const urlStartId = getRuleIdRange('url');
  let urlCurrentId = urlStartId;

  const allowedUrlRules = domainProcessor.createUrlRules(rules.allowedUrls, urlCurrentId, 'allow');
  urlCurrentId += allowedUrlRules.length;

  const blockedUrlRules = domainProcessor.createUrlRules(rules.blockedUrls, urlCurrentId, 'block');
  urlCurrentId += blockedUrlRules.length;

  return [
    ...allowedDomainRules,
    ...blockedDomainRules,
    ...allowedUrlRules,
    ...blockedUrlRules,
  ] as browser.declarativeNetRequest.Rule[];
}

/**
 * Create regex rules with range-based ID allocation
 * @param rules - The ruleset containing filtering rules
 * @returns Array of regex rules
 */
function createRegexRules(rules: RuleSet): browser.declarativeNetRequest.Rule[] {
  const regexProcessor = new RegexRuleProcessor();
  const regexStartId = getRuleIdRange('regex');
  let regexCurrentId = regexStartId;

  const allowedRegexRules = regexProcessor.createRules(rules.allowedRegex, regexCurrentId, 'allow');
  regexCurrentId += allowedRegexRules.length;

  const blockedRegexRules = regexProcessor.createRules(rules.blockedRegex, regexCurrentId, 'block');
  regexCurrentId += blockedRegexRules.length;

  return [...allowedRegexRules, ...blockedRegexRules] as browser.declarativeNetRequest.Rule[];
}

/**
 * Clear only existing session rules, leaving dynamic rules intact
 */
async function clearExistingSessionRules(): Promise<void> {
  // Get existing session rules
  const existingSessionRules = await browser.declarativeNetRequest.getSessionRules();
  const existingSessionRuleIds = existingSessionRules.map(r => r.id);

  // Remove all existing session rules
  if (existingSessionRuleIds.length > 0) {
    await browser.declarativeNetRequest.updateSessionRules({
      removeRuleIds: existingSessionRuleIds,
      addRules: [],
    });
  }
}

/**
 * Add a temporary rule that blocks all traffic while rules are being loaded
 */
async function addSuspendRule(): Promise<void> {
  try {
    // Add a temporary blocking rule with maximum priority
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [SUSPEND_RULE_ID], // Remove any existing suspend rule first
      addRules: [
        {
          id: SUSPEND_RULE_ID,
          priority: 1000000, // Maximum priority
          action: { type: 'block' },
          condition: {
            urlFilter: '*://*/*',
            resourceTypes: ALL_RESOURCE_TYPES,
          },
        },
      ],
    });
  } catch (error) {
    console.error('Failed to add suspend rule:', error);
  }
}

/**
 * Remove the temporary blocking rule
 */
async function removeSuspendRule(): Promise<void> {
  try {
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [SUSPEND_RULE_ID],
      addRules: [],
    });
  } catch (removeError) {
    console.error('Failed to remove blocking rule:', removeError);
  }
}

/**
 * Update the suspend until filters load setting
 * Creates or removes the suspend rule based on the setting
 * @param enabled - Whether the setting is enabled
 */
export async function updateSuspendSetting(enabled: boolean): Promise<void> {
  if (enabled) {
    // Setting enabled - create the suspend rule
    await addSuspendRule();
  } else {
    // Setting disabled - remove any suspend rule
    await removeSuspendRule();
  }
}
