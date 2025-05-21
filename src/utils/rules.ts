import { isFQDN, isURL, isIP, isInt } from 'validator';
import { Rule, RuleType, RuleAction } from './types';

export function generateRuleId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

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
          resourceTypes: ['main_frame', 'sub_frame'],
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
