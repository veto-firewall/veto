/**
 * Settings type definitions
 */

/**
 * MaxMind service settings
 */
export interface MaxMindSettings {
  /** MaxMind license key */
  licenseKey: string;
  /** Timestamp of last database download */
  lastDownload?: number;
}

/**
 * Extension settings
 */
export interface Settings {
  /** Whether to suspend until filters are loaded */
  suspendUntilFiltersLoad: boolean;
  /** MaxMind service settings */
  maxmind: MaxMindSettings;
  /** HTTP handling method */
  httpHandling: 'allow' | 'redirect' | 'block';
  /** Whether to block remote fonts */
  blockRemoteFonts: boolean;
  /** Whether to block images */
  blockImages: boolean;
  /** Whether to block media */
  blockMedia: boolean;
  /** Whether to block private IP addresses */
  blockPrivateIPs: boolean;
  /** UI section states */
  sectionStates: {
    [key: string]: boolean;
  };
}
