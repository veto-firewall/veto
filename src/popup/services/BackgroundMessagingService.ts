/**
 * Background Messaging Service
 * Handles popup ↔ background communication for operations requiring background context
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
 * Save settings to background (triggers rule updates and service refresh)
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
 * Save rules to background (triggers rule updates)
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
 * Clear all caches in background
 * @returns Promise resolving to success status
 */
export const clearCache = async (): Promise<{ success: boolean }> => {
  return sendBackgroundMessage<{ success: boolean }>({ type: 'clearCache' });
};

/**
 * Get country lookup cache from background
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
 * Set country lookup cache in background
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
