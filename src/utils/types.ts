export type RuleType = 'domain' | 'url' | 'regex' | 'ip' | 'asn' | 'geoip' | 'tracking';

export type RuleAction = 'allow' | 'block' | 'redirect';

export interface Rule {
  id: string;
  type: RuleType;
  value: string;
  action: RuleAction;
  isTerminating: boolean;
  enabled: boolean;
}

export interface MaxMindSettings {
  licenseKey: string;
  lastDownload?: number;
}

export interface Settings {
  suspendUntilFiltersLoad: boolean;
  maxmind: MaxMindSettings;
  httpHandling: 'allow' | 'redirect' | 'block';
  blockRemoteFonts: boolean;
  blockImages: boolean;
  blockMedia: boolean;
  blockPrivateIPs: boolean;
  sectionStates: {
    [key: string]: boolean;
  };
}

export interface RuleSet {
  allowedDomains: Rule[];
  blockedDomains: Rule[];
  allowedUrls: Rule[];
  blockedUrls: Rule[];
  allowedRegex: Rule[];
  blockedRegex: Rule[];
  trackingParams: Rule[];
  allowedIps: Rule[];
  blockedIps: Rule[];
  allowedAsns: Rule[];
  blockedAsns: Rule[];
  blockedCountries: Record<string, boolean>;
}

export interface CountryRecord {
  name: string;
  continent: string;
  selected: boolean;
}

// Message types for extension communication
export interface MessageBase {
  type: string;
}

export interface MsgGetSettings extends MessageBase {
  type: 'getSettings';
}

export interface MsgSaveSettings extends MessageBase {
  type: 'saveSettings';
  settings: Settings;
}

export interface MsgGetRules extends MessageBase {
  type: 'getRules';
}

export interface MsgSaveRules extends MessageBase {
  type: 'saveRules';
  rules: RuleSet;
}

export interface MsgExportRules extends MessageBase {
  type: 'exportRules';
  ruleType: string;
  includeComments?: boolean;
}

export interface MsgClearCache extends MessageBase {
  type: 'clearCache';
}

export type ExtensionMsg =
  | MsgGetSettings
  | MsgSaveSettings
  | MsgGetRules
  | MsgSaveRules
  | MsgExportRules
  | MsgClearCache;

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
            : never;
