/**
 * Rule operations for handling textarea content and filter file loading
 * Uses direct service imports for better performance and simplicity
 */
import type { Rule, RuleSet } from '../../services/types';
import { parseRules, getFilterFileContent } from '../../services/rule/RuleService';

/**
 * Parse rules for a specific rule type
 *
 * @param ruleType - The type of rule to parse
 * @param input - The input string to parse
 * @param actionType - The action type for the rules
 * @param isTerminating - Whether the rules are terminating
 * @returns Promise resolving to an array of rules
 */
export async function parseRulesForType(
  ruleType: string,
  input: string,
  actionType: string,
  isTerminating: boolean,
): Promise<Rule[]> {
  try {
    const response = await parseRules(
      ruleType as 'domain' | 'url' | 'regex' | 'ip' | 'asn' | 'tracking',
      input,
      actionType as 'allow' | 'block' | 'redirect',
      isTerminating,
    );

    // Validate response is an array before returning
    if (Array.isArray(response)) {
      return response as Rule[];
    }

    console.warn('Invalid response from parseRules:', response);
    return [];
  } catch (error) {
    console.error('Error parsing rules:', error);
    return [];
  }
}

/**
 * Update rules in the store based on the rule type
 *
 * @param baseId - The base ID of the rule element
 * @param newRules - The new rules to store
 * @param rules - The rules object to update
 */
export function updateRulesInStore(baseId: string, newRules: Rule[], rules: RuleSet): void {
  switch (baseId) {
    case 'allowed-domains':
      rules.allowedDomains = newRules;
      break;
    case 'blocked-domains':
      rules.blockedDomains = newRules;
      break;
    case 'allowed-urls':
      rules.allowedUrls = newRules;
      break;
    case 'blocked-urls':
      rules.blockedUrls = newRules;
      break;
    case 'allowed-regex':
      rules.allowedRegex = newRules;
      break;
    case 'blocked-regex':
      rules.blockedRegex = newRules;
      break;
    case 'tracking-params':
      rules.trackingParams = newRules;
      break;
    case 'allowed-ips':
      rules.allowedIps = newRules;
      break;
    case 'blocked-ips':
      rules.blockedIps = newRules;
      break;
    case 'allowed-asns':
      rules.allowedAsns = newRules;
      break;
    case 'blocked-asns':
      rules.blockedAsns = newRules;
      break;
  }
}

/**
 * Populate a textarea with rules or filter file content
 * Uses direct service import for filter file loading
 *
 * @param textareaId - ID of the textarea element
 * @param ruleList - List of rules to display
 */
export async function populateRuleTextarea(textareaId: string, ruleList: Rule[]): Promise<void> {
  const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;

  // If there are rules already, display them
  if (ruleList.length > 0) {
    textarea.value = ruleList.map(rule => rule.value).join('\n');

    // Set the terminating checkbox
    const checkboxId = `${textareaId}-terminating`;
    const checkbox = document.getElementById(checkboxId) as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = ruleList[0].isTerminating;
    }
  }
  // If there are no rules, try to load content from filter files
  else {
    // Map textarea IDs to filter file names
    const fileMap: Record<string, string> = {
      'allowed-asns': 'ASNs.txt',
      'blocked-asns': 'ASNs.txt',
      'allowed-domains': 'DomainNames.txt',
      'blocked-domains': 'DomainNames.txt',
      'allowed-ips': 'IPs.txt',
      'blocked-ips': 'IPs.txt',
      'allowed-regex': 'Regex.txt',
      'blocked-regex': 'Regex.txt',
      'tracking-params': 'Trackers.txt',
      'allowed-urls': 'URLs.txt',
      'blocked-urls': 'URLs.txt',
    };

    // If this textarea has a matching filter file
    if (fileMap[textareaId]) {
      try {
        const fileContent = await getFilterFileContent(fileMap[textareaId]);
        textarea.value = fileContent;
      } catch (error) {
        console.error(`Error loading filter file for ${textareaId}:`, error);
      }
    }
  }
}
