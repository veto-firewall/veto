/**
 * RuleService handles all rule-related operations
 * Centralizes rule processing, validation, and management
 */
import { IRuleService, RuleSet, Rule, RuleType, RuleAction } from '../types';
import { StorageService } from '../storage/StorageService';
import { isFQDN, isURL, isIP, isInt } from 'validator';
import { getFirefoxRuleLimit } from '../../utils/rulesDNR';
import { BaseRuleProcessor } from './processors/BaseRuleProcessor';
import { IpRuleProcessor } from './processors/IpRuleProcessor';
import { AsnRuleProcessor } from './processors/AsnRuleProcessor';
import { GeoIpRuleProcessor } from './processors/GeoIpRuleProcessor';
import { CacheCallback } from './processors/BaseRuleProcessor';

/**
 * Service for managing and processing rules
 */
export class RuleService implements IRuleService {
  /**
   * Storage service for persistent data
   */
  private storageService: StorageService;
  
  /**
   * Current rule ID counter
   */
  private ruleId: number | null = null;
  
  /**
   * Rule processors for different rule types
   */
  private processors: Map<string, BaseRuleProcessor> = new Map();
  
  /**
   * Creates a new rule service
   * @param storageService - Storage service for persistent data
   */
  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }
  
  /**
   * Initialize the rule service
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    // Initialize rule ID counter
    if (this.ruleId === null) {
      this.ruleId = getFirefoxRuleLimit() + 1;
    }
    
    return Promise.resolve();
  }
  
  /**
   * Get rules from storage
   * @returns Promise resolving to the current ruleset
   */
  async getRules(): Promise<RuleSet> {
    return this.storageService.getRules();
  }
  
  /**
   * Save rules to storage
   * @param rules - The ruleset to save
   * @returns Promise resolving to true if successful
   */
  async saveRules(rules: RuleSet): Promise<boolean> {
    return this.storageService.saveRules(rules);
  }
  
  /**
   * Export rules as text
   * @param ruleType - The type of rules to export
   * @param includeComments - Whether to include comments in the output
   * @returns Promise resolving to rules as a string
   */
  async exportRules(ruleType: string, includeComments: boolean = false): Promise<string> {
    try {
      const allRules = await this.getRules();
      return await this.getRulesText(ruleType, allRules, includeComments);
    } catch (error) {
      console.error(`Failed to export rules of type ${ruleType}:`, error);
      return '';
    }
  }
  
  /**
   * Generate a unique rule ID
   * @returns A unique rule ID as a string
   */
  generateRuleId(): string {
    // Initialize the ID counter if not already done
    if (this.ruleId === null) {
      this.ruleId = getFirefoxRuleLimit() + 1;
    }
    return (this.ruleId++).toString();
  }
  
  /**
   * Create a new rule
   * @param type - The type of rule
   * @param value - The rule value
   * @param action - The action to take for this rule
   * @param isTerminating - Whether this is a terminating rule
   * @returns A Rule object
   */
  createRule(
    type: RuleType,
    value: string,
    action: RuleAction,
    isTerminating = true,
  ): Rule {
    return {
      id: this.generateRuleId(),
      type,
      value,
      action,
      isTerminating,
      enabled: true,
    };
  }
  
  /**
   * Parse a text input into an array of rules
   * @param type - The type of rule to create
   * @param input - The input string to parse
   * @param action - The action to take for these rules
   * @param isTerminating - Whether these are terminating rules
   * @returns An array of Rule objects
   */
  parseRules(
    type: RuleType,
    input: string,
    action: RuleAction,
    isTerminating = true,
  ): Rule[] {
    const rules: Rule[] = [];

    // Split by newlines first to properly handle comments
    input.split(/[\r\n]+/).forEach(line => {
      const value = line.trim();

      // Skip empty lines or comment lines (starting with #)
      if (!value || value.startsWith('#')) {
        return;
      }

      // For multi-value lines (space-separated), process each value
      value.split(/\s+/).forEach(val => {
        const trimmedVal = val.trim();
        if (trimmedVal && !trimmedVal.startsWith('#') && this.isValidRuleValue(type, trimmedVal)) {
          rules.push(this.createRule(type, trimmedVal, action, isTerminating));
        }
      });
    });

    return rules;
  }
  
  /**
   * Validate a rule value based on its type
   * @param type - The type of rule
   * @param value - The rule value to validate
   * @returns Whether the value is valid for the given rule type
   */
  isValidRuleValue(type: RuleType, value: string): boolean {
    switch (type) {
      case 'domain':
        return isFQDN(value);
      case 'url':
        return isURL(value, { require_protocol: true });
      case 'tracking':
        // For tracking parameters, accept any non-empty value without special characters
        return /^[a-zA-Z0-9_-]+$/.test(value);
      case 'regex':
        try {
          new RegExp(value);
          return true;
        } catch (error) {
          return false;
        }
      case 'ip':
        try {
          if (value.includes('/') || value.includes('-')) {
            // For CIDR and ranges, basic validation
            const parts = value.includes('/') ? value.split('/') : value.split('-');

            return (
              parts.length === 2 &&
              isIP(parts[0].trim()) &&
              (value.includes('/') ? !isNaN(parseInt(parts[1].trim())) : isIP(parts[1].trim()))
            );
          }
          return isIP(value);
        } catch (error) {
          return false;
        }
      case 'asn': {
        return isInt(value);
      }
      case 'geoip':
        return value.length === 2;
      default:
        return false;
    }
  }
  
  /**
   * Process rules for a URL
   * @param url - URL to process
   * @param cacheKey - Cache key for this request
   * @param rules - Rules to process
   * @param cacheCallback - Function to update the cache
   * @param details - Web request details
   * @returns Result with cancel flag or null if no match
   */
  async processRules(
    url: URL,
    cacheKey: string,
    rules: RuleSet,
    cacheCallback: CacheCallback,
    details?: browser.webRequest._OnBeforeRequestDetails
  ): Promise<{ cancel: boolean } | null> {
    // Process IP rules
    const ipProcessor = this.getProcessor('ip', rules, cacheCallback);
    const ipResult = await ipProcessor.process(url, cacheKey, details);
    if (ipResult) {
      return ipResult;
    }
    
    // Process ASN rules
    const asnProcessor = this.getProcessor('asn', rules, cacheCallback);
    const asnResult = await asnProcessor.process(url, cacheKey, details);
    if (asnResult) {
      return asnResult;
    }
    
    // Process GeoIP rules
    const geoIpProcessor = this.getProcessor('geoip', rules, cacheCallback);
    const geoIpResult = await geoIpProcessor.process(url, cacheKey, details);
    if (geoIpResult) {
      return geoIpResult;
    }
    
    return null;
  }
  
  /**
   * Get or create a rule processor for a specific type
   * @param type - Type of processor to get
   * @param rules - Rules to process
   * @param cacheCallback - Function to update the cache
   * @returns Appropriate rule processor
   */
  private getProcessor(
    type: string,
    rules: RuleSet,
    cacheCallback: CacheCallback
  ): BaseRuleProcessor {
    // Create a unique key for this processor instance
    const key = `${type}-${Date.now()}`;
    
    if (!this.processors.has(key)) {
      switch (type) {
        case 'ip':
          this.processors.set(key, new IpRuleProcessor(rules, cacheCallback));
          break;
        case 'asn':
          this.processors.set(key, new AsnRuleProcessor(rules, cacheCallback));
          break;
        case 'geoip':
          this.processors.set(key, new GeoIpRuleProcessor(rules, cacheCallback));
          break;
        default:
          throw new Error(`Unknown processor type: ${type}`);
      }
    }
    
    return this.processors.get(key)!;
  }
  
  /**
   * Get filter file content
   * @param fileName - Name of the filter file
   * @returns Promise resolving to file content
   */
  async getFilterFileContent(fileName: string): Promise<string> {
    try {
      const response = await fetch(`/filters/${fileName}.txt`);
      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      console.error(`Failed to load filter file ${fileName}:`, error);
    }
    return '';
  }
  
  /**
   * Get rules text based on rule type
   * @param ruleType - Type of rules to get
   * @param allRules - All rules
   * @param includeComments - Whether to include comments
   * @returns Promise resolving to rules text
   */
  async getRulesText(
    ruleType: string,
    allRules: RuleSet,
    includeComments: boolean,
  ): Promise<string> {
    // Handle domain rules
    if (ruleType === 'allowedDomains' || ruleType === 'blockedDomains') {
      if (includeComments) {
        return await this.getFilterFileContent('DomainNames');
      }
      return (ruleType === 'allowedDomains' ? allRules.allowedDomains : allRules.blockedDomains)
        .map((r: Rule) => r.value)
        .join('\n');
    }

    // Handle URL rules
    if (ruleType === 'allowedUrls' || ruleType === 'blockedUrls') {
      return (ruleType === 'allowedUrls' ? allRules.allowedUrls : allRules.blockedUrls)
        .map((r: Rule) => r.value)
        .join('\n');
    }

    // Handle regex rules
    if (ruleType === 'allowedRegex' || ruleType === 'blockedRegex') {
      if (includeComments) {
        return await this.getFilterFileContent('Regex');
      }
      return (ruleType === 'allowedRegex' ? allRules.allowedRegex : allRules.blockedRegex)
        .map((r: Rule) => r.value)
        .join('\n');
    }

    // Handle tracking parameters
    if (ruleType === 'trackingParams') {
      return allRules.trackingParams.map((r: Rule) => r.value).join('\n');
    }

    // Handle IP rules
    if (ruleType === 'allowedIps' || ruleType === 'blockedIps') {
      if (includeComments) {
        return await this.getFilterFileContent('IPs');
      }
      return (ruleType === 'allowedIps' ? allRules.allowedIps : allRules.blockedIps)
        .map((r: Rule) => r.value)
        .join('\n');
    }

    // Handle ASN rules
    if (ruleType === 'allowedAsns' || ruleType === 'blockedAsns') {
      if (includeComments) {
        return await this.getFilterFileContent('ASNs');
      }
      return (ruleType === 'allowedAsns' ? allRules.allowedAsns : allRules.blockedAsns)
        .map((r: Rule) => r.value)
        .join('\n');
    }

    return '';
  }
}
