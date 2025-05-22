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
   * @param rules - The ruleset to save
   * @returns Promise resolving to true if successful
   */
  saveRules(rules: RuleSet): Promise<boolean>;
  
  /**
   * Export rules as text
   * @param ruleType - The type of rules to export
   * @param includeComments - Whether to include comments in the output
   * @returns Promise resolving to rules as a string
   */
  exportRules(ruleType: string, includeComments?: boolean): Promise<string>;
}

/**
 * Interface for storage operations
 */
export interface IStorageService extends IService {
  /**
   * Get a value from storage
   * @param key - The key to retrieve
   * @returns Promise resolving to the stored value or null
   */
  getValue<T>(key: string): Promise<T | null>;
  
  /**
   * Save a value to storage
   * @param key - The key to store under
   * @param value - The value to store
   * @returns Promise resolving to true if successful
   */
  setValue<T>(key: string, value: T): Promise<boolean>;
}

// Import dependency types
import { RuleSet } from './ruleTypes';
