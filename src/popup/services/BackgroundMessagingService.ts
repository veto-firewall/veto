/**
 * Background Messaging Service
 * Centralizes all popup ↔ background communication with proper typing
 */
import type { Settings, RuleSet, ExtensionMsg } from '../../services/types';

/**
 * Send a typed message to the background script
 * @param message - The message to send
 * @returns Promise resolving to the response
 */
export const sendBackgroundMessage = async <T>(message: ExtensionMsg): Promise<T> => {
  return browser.runtime.sendMessage(message) as Promise<T>;
};

/**
 * Get settings from background
 * @returns Promise resolving to current settings
 */
export const getSettings = async (): Promise<Settings> => {
  return sendBackgroundMessage<Settings>({ type: 'getSettings' });
};

/**
 * Save settings to background
 * @param settings - Settings to save
 * @returns Promise resolving to success status
 */
export const saveSettings = async (settings: Settings): Promise<{ success: boolean }> => {
  return sendBackgroundMessage<{ success: boolean }>({
    type: 'saveSettings',
    settings,
  });
};

/**
 * Get rules from background
 * @returns Promise resolving to current rules
 */
export const getRules = async (): Promise<RuleSet> => {
  return sendBackgroundMessage<RuleSet>({ type: 'getRules' });
};

/**
 * Save rules to background
 * @param rules - Rules to save
 * @returns Promise resolving to success status
 */
export const saveRules = async (rules: RuleSet): Promise<{ success: boolean }> => {
  return sendBackgroundMessage<{ success: boolean }>({
    type: 'saveRules',
    rules,
  });
};

/**
 * Export rules as text
 * @param ruleType - Type of rules to export
 * @param includeComments - Whether to include comments in output
 * @returns Promise resolving to rules text
 */
export const exportRules = async (
  ruleType: string,
  includeComments: boolean = false,
): Promise<string> => {
  return sendBackgroundMessage<string>({
    type: 'exportRules',
    ruleType,
    includeComments,
  });
};

/**
 * Clear all caches
 * @returns Promise resolving to success status
 */
export const clearCache = async (): Promise<{ success: boolean }> => {
  return sendBackgroundMessage<{ success: boolean }>({ type: 'clearCache' });
};

/**
 * Get country lookup cache
 * @returns Promise resolving to the country lookup cache
 */
export const getCountryLookupCache = async (): Promise<
  Record<string, Record<string, Record<string, string>> | Record<string, string>>
> => {
  const response = await sendBackgroundMessage<
    Record<string, Record<string, Record<string, string>> | Record<string, string>>
  >({ type: 'getCountryLookupCache' });
  return response || {};
};

/**
 * Set country lookup cache
 * @param key - Cache key
 * @param value - Value to cache
 * @returns Promise resolving to success status
 */
export const setCountryLookupCache = async (
  key: string,
  value: Record<string, Record<string, string>> | Record<string, string>,
): Promise<{ success: boolean }> => {
  return sendBackgroundMessage<{ success: boolean }>({
    type: 'setCountryLookupCache',
    key,
    value,
  });
};

/**
 * Get rule limit from background
 * @returns Promise resolving to rule limit
 */
export const getRuleLimit = async (): Promise<number> => {
  return sendBackgroundMessage<number>({ type: 'getRuleLimit' });
};

/**
 * Parse rules text into rule objects
 * @param ruleType - Type of rules to parse
 * @param rulesText - Raw rules text
 * @param actionType - Action type for rules
 * @param isTerminating - Whether rules are terminating
 * @returns Promise resolving to parsed rules
 */
export const parseRules = async (
  ruleType: 'domain' | 'url' | 'regex' | 'ip' | 'asn' | 'tracking',
  rulesText: string,
  actionType: 'allow' | 'block' | 'redirect',
  isTerminating: boolean,
): Promise<unknown> => {
  return sendBackgroundMessage({
    type: 'parseRules',
    ruleType,
    rulesText,
    actionType,
    isTerminating,
  });
};
