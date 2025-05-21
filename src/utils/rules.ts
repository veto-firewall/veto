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

export function createDeclarativeNetRequestRules(
  rules: Rule[],
  startId: number = 10,
): browser.declarativeNetRequest.Rule[] {
  const dnrRules: browser.declarativeNetRequest.Rule[] = [];
  // Use the provided startId parameter, defaulting to 10 if not specified
  // This allows different ranges for different rule types:
  // - 1-2: Tracking param rules - 2 rules
  // - 3-9: Basic system rules - 7 rules
  // - 10-999: Allowed domains - 990 rules
  // - 1000-2499: Blocked domains - 1,500 rules
  // - 2500-2999: Allowed URLs - 500 rules
  // - 3000-4299: Blocked URLs - 1,300 rules
  // - 4300-4499: Allowed regex rules - 200 rules
  // - 4500-5000: Blocked regex rules - 501 rules
  // Firefox has a limit of 5,000 declarative rules total
  let id = startId;

  for (const rule of rules) {
    if (!rule.enabled) continue;

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
    }
  }

  return dnrRules;
}
