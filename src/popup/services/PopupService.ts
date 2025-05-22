/**
 * PopupService provides a bridge between the popup UI and the background services
 * It simplifies access to the service architecture from the popup
 */

import { Settings, RuleSet } from '../../services/types';
import type { LRUCache } from 'lru-cache';

/**
 * Service for popup UI operations
 * Interfaces with the background services
 */
export class PopupService {
  /**
   * Singleton instance
   */
  private static instance: PopupService;
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): PopupService {
    if (!PopupService.instance) {
      PopupService.instance = new PopupService();
    }
    return PopupService.instance;
  }
  
  /**
   * Get settings from storage
   * @returns Promise resolving to current settings
   */
  async getSettings(): Promise<Settings> {
    const response = await browser.runtime.sendMessage({ type: 'getSettings' });
    return response as Settings;
  }
  
  /**
   * Save settings to storage
   * @param settings Settings to save
   * @returns Promise resolving to success status
   */
  async saveSettings(settings: Settings): Promise<{ success: boolean }> {
    return browser.runtime.sendMessage({
      type: 'saveSettings',
      settings: settings
    });
  }
  
  /**
   * Get rules from storage
   * @returns Promise resolving to current rules
   */
  async getRules(): Promise<RuleSet> {
    const response = await browser.runtime.sendMessage({ type: 'getRules' });
    return response as RuleSet;
  }
  
  /**
   * Save rules to storage
   * @param rules Rules to save
   * @returns Promise resolving to success status
   */
  async saveRules(rules: RuleSet): Promise<{ success: boolean }> {
    return browser.runtime.sendMessage({
      type: 'saveRules',
      rules: rules
    });
  }
  
  /**
   * Export rules as text
   * @param ruleType Type of rules to export
   * @param includeComments Whether to include comments in output
   * @returns Promise resolving to rules text
   */
  async exportRules(ruleType: string, includeComments: boolean = false): Promise<string> {
    const response = await browser.runtime.sendMessage({
      type: 'exportRules',
      ruleType: ruleType,
      includeComments: includeComments
    });
    return response as string;
  }
  
  /**
   * Clear all caches
   * @returns Promise resolving to success status
   */
  async clearCache(): Promise<{ success: boolean }> {
    return browser.runtime.sendMessage({ type: 'clearCache' });
  }
  
  /**
   * Get the country lookup cache
   * @returns Promise resolving to the country lookup cache
   */
  async getCountryLookupCache(): Promise<Record<string, Record<string, Record<string, string>> | Record<string, string>>> {
    const response = await browser.runtime.sendMessage({ type: 'getCountryLookupCache' });
    return response || {};
  }
  
  /**
   * Set a value in the country lookup cache
   * @param key Cache key
   * @param value Value to cache
   * @returns Promise resolving to success status
   */
  async setCountryLookupCache(key: string, value: Record<string, Record<string, string>> | Record<string, string>): Promise<{ success: boolean }> {
    return browser.runtime.sendMessage({
      type: 'setCountryLookupCache',
      key,
      value
    });
  }
}
