import { isFQDN, isURL, isIP, isInt } from 'validator';
import { Rule, RuleType, RuleAction, RuleSet } from './types';
import { getFirefoxRuleLimit } from './rulesDNR';
import { ipMatchesRange } from './ip';
import { resolveDomain } from './dns';
import { ServiceFactory } from '../services';
import { logBlockedRequest } from './logger';

const DEFAULT_RULESET: RuleSet = {
  allowedDomains: [],
  blockedDomains: [],
  allowedUrls: [],
  blockedUrls: [],
  allowedRegex: [],
  blockedRegex: [],
  trackingParams: [],
  allowedIps: [],
  blockedIps: [],
  allowedAsns: [],
  blockedAsns: [],
  blockedCountries: {},
};

let ruleId: number | null = null;

export function generateRuleId(): string {
  // Initialize the ID counter if not already done
  if (ruleId === null) {
    ruleId = getFirefoxRuleLimit() + 1;
  }
  return (ruleId++).toString();
}

/**
 * Creates a new rule object
 *
 * @param type - The type of rule
 * @param value - The rule value
 * @param action - The action to take for this rule
 * @param isTerminating - Whether this is a terminating rule
 * @returns A Rule object
 */
export function createRule(
  type: RuleType,
  value: string,
  action: RuleAction,
  isTerminating = true,
): Rule {
  return {
    id: generateRuleId(),
    type,
    value,
    action,
    isTerminating,
    enabled: true,
  };
}

/**
 * Parses a text input into an array of rules
 *
 * @param type - The type of rule to create
 * @param input - The input string to parse
 * @param action - The action to take for these rules
 * @param isTerminating - Whether these are terminating rules
 * @returns An array of Rule objects
 */
export function parseRules(
  type: RuleType,
  input: string,
  action: RuleAction,
  isTerminating = true,
): Rule[] {
  const rules: Rule[] = [];

  // Split by newlines first to properly handle comments
  input.split(/[\r\n]+/).forEach(line => {
    const value = line.trim();

    // Skip empty lines or comment lines (starting with #)
    if (!value || value.startsWith('#')) {
      return;
    }

    // For multi-value lines (space-separated), process each value
    value.split(/\s+/).forEach(val => {
      const trimmedVal = val.trim();
      if (trimmedVal && !trimmedVal.startsWith('#') && isValidRuleValue(type, trimmedVal)) {
        rules.push(createRule(type, trimmedVal, action, isTerminating));
      }
    });
  });

  return rules;
}

/**
 * Validates a rule value based on its type
 *
 * @param type - The type of rule
 * @param value - The rule value to validate
 * @returns Whether the value is valid for the given rule type
 */
export function isValidRuleValue(type: RuleType, value: string): boolean {
  switch (type) {
    case 'domain':
      return isFQDN(value);
    case 'url':
      return isURL(value, { require_protocol: true });
    case 'tracking':
      // For tracking parameters, accept any non-empty value without special characters
      return /^[a-zA-Z0-9_-]+$/.test(value);
    case 'regex':
      try {
        new RegExp(value);
        return true;
      } catch (error) {
        void error;
        return false;
      }
    case 'ip':
      try {
        if (value.includes('/') || value.includes('-')) {
          // For CIDR and ranges, basic validation
          const parts = value.includes('/') ? value.split('/') : value.split('-');

          return (
            parts.length === 2 &&
            isIP(parts[0].trim()) &&
            (value.includes('/') ? !isNaN(parseInt(parts[1].trim())) : isIP(parts[1].trim()))
          );
        }
        return isIP(value);
      } catch (error) {
        void error;
        return false;
      }
    case 'asn': {
      const result = isInt(value);
      return result;
    }
    case 'geoip':
      return value.length === 2;
    default:
      return false;
  }
}

/**
 * Find a matching ASN allow rule
 *
 * @param asn - The ASN to check
 * @param rules - The rule set to check against
 * @returns A matching rule or undefined if no match
 */
export function findAsnAllowRule(asn: number, rules: RuleSet): Rule | undefined {
  return rules.allowedAsns.find(rule => {
    const ruleAsn = parseInt(rule.value);
    const matches = rule.enabled && ruleAsn === asn;
    if (matches) {
      void console.log(`ASN ${asn} matches allowed ASN rule: ${rule.value}`);
    }
    return matches;
  });
}

/**
 * Find a matching ASN block rule
 *
 * @param asn - The ASN to check
 * @param rules - The rule set to check against
 * @returns A matching rule or undefined if no match
 */
export function findAsnBlockRule(asn: number, rules: RuleSet): Rule | undefined {
  return rules.blockedAsns.find(rule => {
    const ruleAsn = parseInt(rule.value);
    const matches = rule.enabled && ruleAsn === asn;
    if (matches) {
      void console.log(`ASN ${asn} matches blocked ASN rule: ${rule.value}`);
    }
    return matches;
  });
}

/**
 * Process IP-based rules
 *
 * @param url - URL object for the request
 * @param cacheKey - Cache key for the request
 * @param rules - The rule set to check against
 * @param cacheCallback - Function to update the cache
 * @param details - Optional web request details
 * @returns Result with cancel flag or null if no matching rules
 */
export async function processIpRules(
  url: URL,
  cacheKey: string,
  rules: RuleSet,
  cacheCallback: (_key: string, _value: boolean) => void,
  details?: browser.webRequest._OnBeforeRequestDetails,
): Promise<{ cancel: boolean } | null> {
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
    cacheCallback(cacheKey, false);
    return { cancel: false };
  }

  // Then check for blocked IPs - block rules always override non-terminating allow rules
  const blockedRule = rules.blockedIps.find(rule => rule.enabled && ipMatchesRange(ip, rule.value));
  if (blockedRule) {
    void console.log(`IP ${ip} matched block rule: ${blockedRule.value}`);
    cacheCallback(cacheKey, true);

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
    cacheCallback(cacheKey, false);
    return { cancel: false };
  }

  return null;
}

/**
 * Process ASN-based rules
 *
 * @param url - URL object for the request
 * @param cacheKey - Cache key for the request
 * @param rules - The rule set to check against
 * @param cacheCallback - Function to update the cache
 * @param details - Optional web request details
 * @returns Result with cancel flag or null if no matching rules
 */
export async function processAsnRules(
  url: URL,
  cacheKey: string,
  rules: RuleSet,
  cacheCallback: (_key: string, _value: boolean) => void,
  details?: browser.webRequest._OnBeforeRequestDetails,
): Promise<{ cancel: boolean } | null> {
  if (rules.blockedAsns.length === 0 && rules.allowedAsns.length === 0) {
    return null;
  }

  const ip = await resolveDomain(url.hostname);
  if (!ip) {
    void console.log(`Could not resolve IP for ${url.hostname}`);
    return null;
  }

  void console.log(`Checking ASN rules for ${url.hostname} (IP: ${ip})`);
  const maxmindService = ServiceFactory.getInstance().getMaxMindService();
  const asn = await maxmindService.getAsnByIp(ip);
  void console.log(`ASN lookup result for ${ip}: ${asn}`);

  if (asn === null) {
    void console.log(`Could not determine ASN for ${ip}`);
    return null;
  }

  // Find a matching allow rule
  const allowRule = findAsnAllowRule(asn, rules);

  // Check if there's a terminating allow rule - these take highest precedence
  if (allowRule && allowRule.isTerminating) {
    void console.log(`Request allowed by terminating ASN rule: ${url.hostname} (ASN: ${asn})`);
    cacheCallback(cacheKey, false);
    return { cancel: false };
  }

  // Check for block rules - these override non-terminating allow rules
  const blockRule = findAsnBlockRule(asn, rules);
  if (blockRule) {
    void console.log(`Request blocked by ASN rule: ${url.hostname} (ASN: ${asn})`);
    cacheCallback(cacheKey, true);

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
    cacheCallback(cacheKey, false);
    return { cancel: false };
  }

  return null;
}

/**
 * Process GeoIP-based rules
 *
 * @param url - URL object for the request
 * @param cacheKey - Cache key for the request
 * @param rules - The rule set to check against
 * @param cacheCallback - Function to update the cache
 * @param details - Optional web request details
 * @returns Result with cancel flag or null if no matching rules
 */
export async function processGeoIpRules(
  url: URL,
  cacheKey: string,
  rules: RuleSet,
  cacheCallback: (_key: string, _value: boolean) => void,
  details?: browser.webRequest._OnBeforeRequestDetails,
): Promise<{ cancel: boolean } | null> {
  if (Object.keys(rules.blockedCountries).length === 0) {
    return null;
  }

  const ip = await resolveDomain(url.hostname);
  if (!ip) {
    void console.log(`Could not resolve IP for ${url.hostname}`);
    return null;
  }

  void console.log(`Checking GeoIP rules for ${url.hostname} (IP: ${ip})`);
  const maxmindService = ServiceFactory.getInstance().getMaxMindService();
  const country = await maxmindService.getCountryByIp(ip);
  void console.log(`Country lookup result for ${ip}: ${country}`);

  if (!country) {
    void console.log(`Could not determine country for ${ip}`);
    return null;
  }

  const isBlocked = rules.blockedCountries[country];
  if (isBlocked) {
    void console.log(`Request blocked by GeoIP rule: ${url.hostname} (Country: ${country})`);
    cacheCallback(cacheKey, true);

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

/**
 * Helper function to load a filter file's content
 *
 * @param fileName - The name of the filter file to load
 * @returns The content of the filter file
 */
export async function getFilterFileContent(fileName: string): Promise<string> {
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

/**
 * Get rules text based on rule type and whether to include comments
 *
 * @param ruleType - The type of rules to get
 * @param allRules - The rule set to get rules from
 * @param includeComments - Whether to include comments in the output
 * @returns The rules as a string
 */
export async function getRulesText(
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

/**
 * Export rules as text
 *
 * @param ruleType - The type of rules to export
 * @param includeComments - Whether to include comments in the output
 * @param getRulesFn - Function to get rules
 * @returns The rules as a string
 */
export async function exportRules(
  ruleType: string,
  includeComments: boolean = false,
  getRulesFn: () => Promise<RuleSet>,
): Promise<string> {
  try {
    const allRules = await getRulesFn();
    return await getRulesText(ruleType, allRules, includeComments);
  } catch (error) {
    void error;
    return '';
  }
}

/**
 * Get rules from browser storage
 *
 * @returns Promise resolving to the current ruleset
 */
export async function getRules(): Promise<RuleSet> {
  try {
    const result = await browser.storage.local.get('rules');
    const rules = (result.rules as RuleSet) || DEFAULT_RULESET;
    return rules;
  } catch (_e) {
    void console.error('Failed to retrieve rules from storage:', _e);
    return DEFAULT_RULESET;
  }
}

/**
 * Save rules to browser storage
 *
 * @param rules - The ruleset to save
 * @returns Promise resolving to true if successful
 */
export async function saveRules(rules: RuleSet): Promise<boolean> {
  try {
    await browser.storage.local.set({ rules });
    return true;
  } catch (e) {
    console.error('Failed to save rules to storage:', e);
    return false;
  }
}
