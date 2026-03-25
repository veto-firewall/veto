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
  cacheType: string;
  /** Cache value */
  data: Record<string, Record<string, string>> | Record<string, string>;
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
 * Ping message for health check
 */
export interface MsgPing extends MessageBase {
  type: 'ping';
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
  | MsgParseRules
  | MsgPing;

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Response type for extension messages
 */
export type MsgResponse<T extends ExtensionMsg> = T extends MsgGetSettings
  ? Settings
  : T extends MsgSaveSettings
    ? ApiResponse<null>
    : T extends MsgGetRules
      ? RuleSet
      : T extends MsgSaveRules
        ? ApiResponse<null>
        : T extends MsgExportRules
          ? string
          : T extends MsgClearCache
            ? ApiResponse<null>
            : T extends MsgGetCountryLookupCache
              ? ApiResponse<Record<string, Record<string, string>>>
              : T extends MsgSetCountryLookupCache
                ? ApiResponse<null>
                : T extends MsgGetRuleLimit
                  ? ApiResponse<{ ruleLimit: number }>
                  : T extends MsgParseRules
                    ? { rules: import('./ruleTypes').Rule[]; errors: string[] }
                    : T extends MsgPing
                      ? ApiResponse<{ timestamp: number; validated?: boolean }>
                      : never;
