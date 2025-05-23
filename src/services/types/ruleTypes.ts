/**
 * Rule type definitions
 */

/**
 * Rule type definition
 * Defines the possible types of rules in the VETO extension
 */
export type RuleType = 'domain' | 'url' | 'regex' | 'ip' | 'asn' | 'geoip' | 'tracking';

/**
 * Rule action definition
 * Defines the possible actions that can be taken for a rule
 */
export type RuleAction = 'allow' | 'block' | 'redirect';

/**
 * Rule interface
 * Defines the structure of a rule in the VETO extension
 */
export interface Rule {
  /** Unique identifier for the rule */
  id: string;
  /** Type of the rule */
  type: RuleType;
  /** Value of the rule (e.g., domain name, URL pattern, etc.) */
  value: string;
  /** Action to take when the rule is applied */
  action: RuleAction;
  /** Whether the rule terminates rule processing */
  isTerminating: boolean;
  /** Whether the rule is enabled */
  enabled: boolean;
}

/**
 * Rule set containing all rule categories
 */
export interface RuleSet {
  /** List of allowed domains */
  allowedDomains: Rule[];
  /** List of blocked domains */
  blockedDomains: Rule[];
  /** List of allowed URLs */
  allowedUrls: Rule[];
  /** List of blocked URLs */
  blockedUrls: Rule[];
  /** List of allowed regex patterns */
  allowedRegex: Rule[];
  /** List of blocked regex patterns */
  blockedRegex: Rule[];
  /** List of tracking parameters to remove */
  trackingParams: Rule[];
  /** List of allowed IP addresses */
  allowedIps: Rule[];
  /** List of blocked IP addresses */
  blockedIps: Rule[];
  /** List of allowed ASNs */
  allowedAsns: Rule[];
  /** List of blocked ASNs */
  blockedAsns: Rule[];
  /** Map of blocked countries */
  blockedCountries: Record<string, boolean>;
}

/**
 * Country record for GeoIP blocking
 */
export interface CountryRecord {
  /** Country name */
  name: string;
  /** Continent name */
  continent: string;
  /** Whether the country is selected for blocking */
  selected: boolean;
}
