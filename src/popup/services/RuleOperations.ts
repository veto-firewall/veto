import type { Rule, RuleSet } from '../../services/types';

/**
 * Parses rules based on their type
 *
 * @param ruleType - Type of rule to parse
 * @param rulesText - Text content of rules
 * @param actionType - Action for the rules
 * @param isTerminating - Whether rules are terminating
 * @returns Array of parsed rules
 */
export async function parseRulesForType(
  ruleType: string,
  rulesText: string,
  actionType: string,
  isTerminating: boolean,
): Promise<Rule[]> {
  if (['domain', 'url', 'regex', 'ip', 'asn', 'tracking'].includes(ruleType)) {
    // Use background script to parse rules instead of accessing ServiceFactory directly
    const rules = (await browser.runtime.sendMessage({
      type: 'parseRules',
      ruleType: ruleType,
      rulesText: rulesText,
      actionType: actionType,
      isTerminating: isTerminating,
    })) as Rule[];
    return rules;
  }
  return [];
}

/**
 * Updates the rules in the rule store
 *
 * @param baseId - ID of the rule element
 * @param newRules - New rules to store
 * @param rules - The rule set to update
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
 * Populate a textarea with rules
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
    checkbox.checked = ruleList[0].isTerminating;
  }
  // If there are no rules, try to load content from filter files
  else {
    let fileContent = '';

    // Map textarea IDs to filter file names
    const fileMap: Record<string, string> = {
      'allowed-asns': 'ASNs',
      'blocked-asns': 'ASNs',
      'allowed-domains': 'DomainNames',
      'blocked-domains': 'DomainNames',
      'allowed-ips': 'IPs',
      'blocked-ips': 'IPs',
      'allowed-regex': 'Regex',
      'blocked-regex': 'Regex',
      'tracking-params': 'Trackers',
    };

    // If this textarea has a matching filter file
    if (fileMap[textareaId]) {
      try {
        // Try to fetch the file content
        const response = await fetch(`/filters/${fileMap[textareaId]}.txt`);
        if (response.ok) {
          fileContent = await response.text();
          textarea.value = fileContent;
        }
      } catch (error) {
        console.error(`Error loading filter file for ${textareaId}:`, error);
      }
    }
  }
}
