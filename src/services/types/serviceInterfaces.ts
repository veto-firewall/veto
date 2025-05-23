/**
 * Service interface definitions
 */
export interface IService {
  /**
   * Initialize the service
   * @returns Promise that resolves when initialization is complete
   */
  initialize(): Promise<void>;
}

/**
 * Interface for handling rule storage operations
 */
export interface IRuleService extends IService {
  /**
   * Get rules from storage
   * @returns Promise resolving to the current ruleset
   */
  getRules(): Promise<RuleSet>;

  /**
   * Save rules to storage
   * @param _rules - The ruleset to save
   * @returns Promise resolving to true if successful
   */
  saveRules(_rules: RuleSet): Promise<boolean>;

  /**
   * Export rules as text
   * @param _ruleType - The type of rules to export
   * @param _includeComments - Whether to include comments in the output
   * @returns Promise resolving to rules as a string
   */
  exportRules(_ruleType: string, _includeComments?: boolean): Promise<string>;
}

/**
 * Interface for storage operations
 */
export interface IStorageService extends IService {
  /**
   * Get a value from storage
   * @param _key - The key to retrieve
   * @returns Promise resolving to the stored value or null
   */
  getValue<T>(_key: string): Promise<T | null>;

  /**
   * Save a value to storage
   * @param _key - The key to store under
   * @param _value - The value to store
   * @returns Promise resolving to true if successful
   */
  setValue<T>(_key: string, _value: T): Promise<boolean>;
}

// Import dependency types
import type { RuleSet } from './ruleTypes';
import type { Settings } from './settingsTypes';

/**
 * Interface for declarative network request rule operations
 */
export interface IDeclarativeRuleService extends IService {
  /**
   * Set up declarative network request rules in the browser
   * @param _settings - The extension settings
   * @param _rules - The ruleset containing filtering rules
   * @returns Promise that resolves when rules are set up
   */
  setupRules(_settings: Settings, _rules: RuleSet): Promise<void>;

  /**
   * Get the current rule count
   * @returns The number of active rules
   */
  getRuleCount(): number;

  /**
   * Get the maximum number of rules allowed by Firefox
   * @returns The rule limit
   */
  getRuleLimit(): number;
}
