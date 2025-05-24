/**
 * Message type definitions for extension communication
 */

import type { Settings } from './settingsTypes';
import type { RuleSet } from './ruleTypes';

/**
 * Base message interface
 */
export interface MessageBase {
  /** Message type */
  type: string;
}

/**
 * Message to get settings
 */
export interface MsgGetSettings extends MessageBase {
  type: 'getSettings';
}

/**
 * Message to save settings
 */
export interface MsgSaveSettings extends MessageBase {
  type: 'saveSettings';
  /** Settings to save */
  settings: Settings;
}

/**
 * Message to get rules
 */
export interface MsgGetRules extends MessageBase {
  type: 'getRules';
}

/**
 * Message to save rules
 */
export interface MsgSaveRules extends MessageBase {
  type: 'saveRules';
  /** Rules to save */
  rules: RuleSet;
}

/**
 * Message to export rules
 */
export interface MsgExportRules extends MessageBase {
  type: 'exportRules';
  /** Type of rules to export */
  ruleType: string;
  /** Whether to include comments in export */
  includeComments?: boolean;
}

/**
 * Message to clear cache
 */
export interface MsgClearCache extends MessageBase {
  type: 'clearCache';
}

/**
 * Message to get country lookup cache
 */
export interface MsgGetCountryLookupCache extends MessageBase {
  type: 'getCountryLookupCache';
}

/**
 * Message to set country lookup cache
 */
export interface MsgSetCountryLookupCache extends MessageBase {
  type: 'setCountryLookupCache';
  /** Cache key */
  key: string;
  /** Cache value */
  value: Record<string, Record<string, string>> | Record<string, string>;
}

/**
 * Message to get rule limit
 */
export interface MsgGetRuleLimit extends MessageBase {
  type: 'getRuleLimit';
}

/**
 * Message to parse rules
 */
export interface MsgParseRules extends MessageBase {
  type: 'parseRules';
  /** Type of rule to parse */
  ruleType: string;
  /** Text content of rules */
  rulesText: string;
  /** Action for the rules */
  actionType: string;
  /** Whether rules are terminating */
  isTerminating: boolean;
}

/**
 * Union of all extension message types
 */
export type ExtensionMsg =
  | MsgGetSettings
  | MsgSaveSettings
  | MsgGetRules
  | MsgSaveRules
  | MsgExportRules
  | MsgClearCache
  | MsgGetCountryLookupCache
  | MsgSetCountryLookupCache
  | MsgGetRuleLimit
  | MsgParseRules;

/**
 * Response type for extension messages
 */
export type MsgResponse<T extends ExtensionMsg> = T extends MsgGetSettings
  ? Settings
  : T extends MsgSaveSettings
    ? { success: boolean }
    : T extends MsgGetRules
      ? RuleSet
      : T extends MsgSaveRules
        ? { success: boolean }
        : T extends MsgExportRules
          ? string
          : T extends MsgClearCache
            ? { success: boolean }
            : T extends MsgGetCountryLookupCache
              ? Record<string, Record<string, Record<string, string>> | Record<string, string>>
              : T extends MsgSetCountryLookupCache
                ? { success: boolean }
                : T extends MsgGetRuleLimit
                  ? number
                  : T extends MsgParseRules
                    ? import('./ruleTypes').Rule[]
                    : never;
