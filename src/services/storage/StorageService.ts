/**
 * StorageService handles all browser storage operations
 * Provides a centralized interface for getting and setting data in browser storage
 */
import { IStorageService } from '../types';
import { RuleSet } from '../../utils/types';

/**
 * Default ruleset used when no rules are found in storage
 */
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

/**
 * Default settings used when no settings are found in storage
 */
const DEFAULT_SETTINGS = {
  suspendUntilFiltersLoad: false,
  maxmind: {
    licenseKey: '',
  },
  httpHandling: 'redirect',
  blockRemoteFonts: false,
  blockImages: false,
  blockMedia: false,
  blockPrivateIPs: false,
  sectionStates: {
    'settings-section': true,
    'basic-rules-section': false,
    'dnr-rules-section': false,
    'ip-rules-section': false,
    'asn-rules-section': false,
    'geoip-section': false,
  },
};

/**
 * Service for handling browser storage operations
 * Abstracts the browser.storage API for easier usage
 */
export class StorageService implements IStorageService {
  /**
   * Initialize the storage service
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    // No initialization needed yet
    return Promise.resolve();
  }

  /**
   * Get a value from browser storage
   * @param key - Storage key to retrieve
   * @returns Promise resolving to the stored value or null if not found
   */
  async getValue<T>(key: string): Promise<T | null> {
    try {
      const result = await browser.storage.local.get(key);
      return result[key] as T || null;
    } catch (error) {
      console.error(`Failed to retrieve ${key} from storage:`, error);
      return null;
    }
  }

  /**
   * Save a value to browser storage
   * @param key - Storage key to save under
   * @param value - Value to store
   * @returns Promise resolving to true if successful
   */
  async setValue<T>(key: string, value: T): Promise<boolean> {
    try {
      const data = { [key]: value };
      await browser.storage.local.set(data);
      return true;
    } catch (error) {
      console.error(`Failed to save ${key} to storage:`, error);
      return false;
    }
  }

  /**
   * Get rules from browser storage
   * @returns Promise resolving to the current ruleset
   */
  async getRules(): Promise<RuleSet> {
    try {
      const rules = await this.getValue<RuleSet>('rules');
      return rules || DEFAULT_RULESET;
    } catch (error) {
      console.error('Failed to retrieve rules from storage:', error);
      return DEFAULT_RULESET;
    }
  }

  /**
   * Save rules to browser storage
   * @param rules - The ruleset to save
   * @returns Promise resolving to true if successful
   */
  async saveRules(rules: RuleSet): Promise<boolean> {
    return this.setValue('rules', rules);
  }

  /**
   * Get settings from browser storage
   * @returns Promise resolving to the current settings or default settings if none found
   */
  async getSettings<T>(): Promise<T> {
    try {
      const settings = await this.getValue<T>('settings');
      return settings || DEFAULT_SETTINGS as unknown as T;
    } catch (error) {
      console.error('Failed to retrieve settings from storage:', error);
      return DEFAULT_SETTINGS as unknown as T;
    }
  }

  /**
   * Save settings to browser storage
   * @param settings - The settings to save
   * @returns Promise resolving to true if successful
   */
  async saveSettings<T>(settings: T): Promise<boolean> {
    return this.setValue('settings', settings);
  }
}
