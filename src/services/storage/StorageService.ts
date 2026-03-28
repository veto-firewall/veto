/**
 * Storage functions for browser storage operations
 * Provides a simple interface for getting and setting data in browser storage
 */
import type { RuleSet } from '../types';
import type { Settings } from '../types';

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
const DEFAULT_SETTINGS: Settings = {
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

const RULE_TYPES = new Set(['domain', 'url', 'regex', 'ip', 'asn', 'geoip', 'tracking']);
const RULE_ACTIONS = new Set(['allow', 'block', 'redirect']);
const HTTP_HANDLING = new Set(['allow', 'redirect', 'block']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isRule(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.value === 'string' &&
    typeof value.isTerminating === 'boolean' &&
    typeof value.enabled === 'boolean' &&
    typeof value.type === 'string' &&
    RULE_TYPES.has(value.type) &&
    typeof value.action === 'string' &&
    RULE_ACTIONS.has(value.action)
  );
}

function asRulesArray(value: unknown): RuleSet['allowedDomains'] {
  return Array.isArray(value) ? value.filter(isRule) : [];
}

function asBlockedCountries(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) return {};
  const result: Record<string, boolean> = {};
  for (const [key, countryValue] of Object.entries(value)) {
    if (typeof countryValue === 'boolean') {
      result[key] = countryValue;
    }
  }
  return result;
}

function normalizeRuleSet(value: unknown): RuleSet {
  if (!isRecord(value)) return DEFAULT_RULESET;
  return {
    allowedDomains: asRulesArray(value.allowedDomains),
    blockedDomains: asRulesArray(value.blockedDomains),
    allowedUrls: asRulesArray(value.allowedUrls),
    blockedUrls: asRulesArray(value.blockedUrls),
    allowedRegex: asRulesArray(value.allowedRegex),
    blockedRegex: asRulesArray(value.blockedRegex),
    trackingParams: asRulesArray(value.trackingParams),
    allowedIps: asRulesArray(value.allowedIps),
    blockedIps: asRulesArray(value.blockedIps),
    allowedAsns: asRulesArray(value.allowedAsns),
    blockedAsns: asRulesArray(value.blockedAsns),
    blockedCountries: asBlockedCountries(value.blockedCountries),
  };
}

function normalizeSettings(value: unknown): Settings {
  if (!isRecord(value)) return DEFAULT_SETTINGS;

  const maxmindRaw = isRecord(value.maxmind) ? value.maxmind : {};
  const sectionStatesRaw = isRecord(value.sectionStates) ? value.sectionStates : {};
  const sectionStates: Record<string, boolean> = { ...DEFAULT_SETTINGS.sectionStates };
  for (const [key, sectionValue] of Object.entries(sectionStatesRaw)) {
    if (typeof sectionValue === 'boolean') sectionStates[key] = sectionValue;
  }

  return {
    suspendUntilFiltersLoad:
      typeof value.suspendUntilFiltersLoad === 'boolean'
        ? value.suspendUntilFiltersLoad
        : DEFAULT_SETTINGS.suspendUntilFiltersLoad,
    maxmind: {
      licenseKey:
        typeof maxmindRaw.licenseKey === 'string'
          ? maxmindRaw.licenseKey
          : DEFAULT_SETTINGS.maxmind.licenseKey,
      ...(typeof maxmindRaw.lastDownload === 'number'
        ? { lastDownload: maxmindRaw.lastDownload }
        : {}),
    },
    httpHandling:
      typeof value.httpHandling === 'string' && HTTP_HANDLING.has(value.httpHandling)
        ? (value.httpHandling as Settings['httpHandling'])
        : DEFAULT_SETTINGS.httpHandling,
    blockRemoteFonts:
      typeof value.blockRemoteFonts === 'boolean'
        ? value.blockRemoteFonts
        : DEFAULT_SETTINGS.blockRemoteFonts,
    blockImages:
      typeof value.blockImages === 'boolean' ? value.blockImages : DEFAULT_SETTINGS.blockImages,
    blockMedia:
      typeof value.blockMedia === 'boolean' ? value.blockMedia : DEFAULT_SETTINGS.blockMedia,
    blockPrivateIPs:
      typeof value.blockPrivateIPs === 'boolean'
        ? value.blockPrivateIPs
        : DEFAULT_SETTINGS.blockPrivateIPs,
    sectionStates,
  };
}

/**
 * Get a value from browser storage
 * @param key - Storage key to retrieve
 * @returns Promise resolving to the stored value or null if not found
 */
export const getValue = async <T>(key: string): Promise<T | null> => {
  try {
    const result = await browser.storage.local.get(key);
    return key in result ? (result[key] as T) : null;
  } catch (error) {
    console.error(`Failed to retrieve ${key} from storage:`, error);
    return null;
  }
};

/**
 * Save a value to browser storage
 * @param key - Storage key to save under
 * @param value - Value to store
 * @returns Promise resolving to true if successful
 */
export const setValue = async <T>(key: string, value: T): Promise<boolean> => {
  try {
    const data = { [key]: value };
    await browser.storage.local.set(data);
    return true;
  } catch (error) {
    console.error(`Failed to save ${key} to storage:`, error);
    return false;
  }
};

/**
 * Get rules from browser storage
 * @returns Promise resolving to the current ruleset
 */
export const getRules = async (): Promise<RuleSet> => {
  try {
    const rawRules = await getValue<unknown>('rules');
    return normalizeRuleSet(rawRules);
  } catch (error) {
    console.error('Failed to retrieve rules from storage:', error);
    return DEFAULT_RULESET;
  }
};

/**
 * Save rules to browser storage
 * @param rules - The ruleset to save
 * @returns Promise resolving to true if successful
 */
export const saveRules = async (rules: RuleSet): Promise<boolean> => {
  return setValue('rules', rules);
};

/**
 * Get settings from browser storage
 * @returns Promise resolving to the current settings or default settings if none found
 */
export const getSettings = async <T>(): Promise<T> => {
  try {
    const rawSettings = await getValue<unknown>('settings');
    return normalizeSettings(rawSettings) as T;
  } catch (error) {
    console.error('Failed to retrieve settings from storage:', error);
    return DEFAULT_SETTINGS as Settings as T;
  }
};

/**
 * Save settings to browser storage
 * @param settings - The settings to save
 * @returns Promise resolving to true if successful
 */
export const saveSettings = async <T>(settings: T): Promise<boolean> => {
  return setValue('settings', settings);
};
