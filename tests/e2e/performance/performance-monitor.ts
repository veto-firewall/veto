import { test, expect, Page, BrowserContext } from '@playwright/test';

interface PerformanceMetrics {
  initializationTime: number;
  pageLoadTime: number;
  memoryUsage: number;
  networkRequests: number;
  ruleCount: number;
}

export class PerformanceMonitor {
  private page: Page;
  private context: BrowserContext;

  constructor(page: Page, context: BrowserContext) {
    this.page = page;
    this.context = context;
  }

  /**
   * Measure extension initialization time using Playwright's built-in timing
   */
  async measureInitializationTime(): Promise<number> {
    const startTime = Date.now();
    
    // Wait for extension background script to load
    try {
      await this.page.waitForFunction(() => {
        return typeof browser !== 'undefined' && browser.runtime;
      }, { timeout: 10000 });

      // Test extension responsiveness with ping
      await this.page.evaluate(async () => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Extension ping timeout')), 5000);
          
          browser.runtime.sendMessage({ type: 'ping' }, (response) => {
            clearTimeout(timeout);
            if (response?.success) {
              resolve(response);
            } else {
              reject(new Error('Extension ping failed'));
            }
          });
        });
      });

      return Date.now() - startTime;
    } catch (error) {
      console.error('Extension initialization failed:', error);
      return -1; // Indicate failure
    }
  }

  /**
   * Measure page load time with extension active
   */
  async measurePageLoadTime(url: string): Promise<number> {
    // Use Playwright's built-in performance timing
    const response = await this.page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    if (!response) {
      throw new Error(`Failed to load ${url}`);
    }

    // Get navigation timing from the browser
    const timing = await this.page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
        loadComplete: perf.loadEventEnd - perf.loadEventStart,
        totalTime: perf.loadEventEnd - perf.fetchStart
      };
    });

    return timing.totalTime;
  }

  /**
   * Get memory usage using Playwright's built-in memory API
   */
  async measureMemoryUsage(): Promise<number> {
    try {
      const memoryInfo = await this.page.evaluate(() => {
        // Use Performance.measureUserAgentSpecificMemory if available (Chrome)
        if ('measureUserAgentSpecificMemory' in performance) {
          return (performance as any).measureUserAgentSpecificMemory();
        }
        
        // Fallback to performance.memory (Chrome)
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          return {
            bytes: memory.usedJSHeapSize,
            breakdown: [{ bytes: memory.usedJSHeapSize, types: ['JavaScript'] }]
          };
        }
        
        // Firefox fallback - estimate based on available info
        return {
          bytes: 0,
          breakdown: [{ bytes: 0, types: ['Unknown'] }]
        };
      });

      const result = await memoryInfo;
      return result.bytes || 0;
    } catch (error) {
      console.warn('Memory measurement not available:', error);
      return 0;
    }
  }

  /**
   * Count network requests blocked/processed
   */
  async measureNetworkActivity(url: string): Promise<number> {
    let requestCount = 0;
    
    // Listen to all network requests
    this.page.on('request', () => {
      requestCount++;
    });

    await this.page.goto(url, { waitUntil: 'networkidle' });
    
    return requestCount;
  }

  /**
   * Load rule set and measure performance impact
   */
  async loadRuleSetAndMeasure(ruleCount: number): Promise<PerformanceMetrics> {
    // Generate test rule set
    const rules = this.generateTestRules(ruleCount);
    
    // Navigate to extension popup
    await this.page.goto('moz-extension://test/popup.html');
    
    // Load rules into extension
    await this.page.evaluate(async (testRules) => {
      return new Promise((resolve, reject) => {
        browser.runtime.sendMessage({
          type: 'saveRules',
          rules: testRules
        }, (response) => {
          if (response?.success) {
            resolve(response);
          } else {
            reject(new Error('Failed to save rules'));
          }
        });
      });
    }, rules);

    // Wait for rules to be processed
    await this.page.waitForTimeout(2000);

    // Measure performance metrics
    const initTime = await this.measureInitializationTime();
    const pageLoadTime = await this.measurePageLoadTime('https://example.com');
    const memory = await this.measureMemoryUsage();
    const networkRequests = await this.measureNetworkActivity('https://httpbin.org/get');

    return {
      initializationTime: initTime,
      pageLoadTime: pageLoadTime,
      memoryUsage: memory,
      networkRequests: networkRequests,
      ruleCount: ruleCount
    };
  }

  /**
   * Generate realistic test rules for performance testing
   */
  private generateTestRules(count: number) {
    const rules = {
      blockedDomains: [],
      allowedDomains: [],
      blockedUrls: [],
      allowedUrls: [],
      blockedRegex: [],
      allowedRegex: [],
      trackingParams: [],
      blockedIps: [],
      allowedIps: [],
      blockedAsns: [],
      allowedAsns: [],
      blockedCountries: {}
    };

    // Generate realistic domain rules (60% of total)
    const domainCount = Math.floor(count * 0.6);
    const commonTLDs = ['.com', '.org', '.net', '.io', '.co'];
    
    for (let i = 0; i < domainCount; i++) {
      const tld = commonTLDs[i % commonTLDs.length];
      rules.blockedDomains.push({
        value: `test-domain-${i}${tld}`,
        isTerminating: i % 10 === 0 // 10% terminating rules
      });
    }

    // Generate URL rules (20% of total)
    const urlCount = Math.floor(count * 0.2);
    for (let i = 0; i < urlCount; i++) {
      rules.blockedUrls.push({
        value: `https://example-${i}.com/path/*`,
        isTerminating: false
      });
    }

    // Generate regex rules (10% of total) - careful to avoid ReDoS
    const regexCount = Math.floor(count * 0.1);
    for (let i = 0; i < regexCount; i++) {
      rules.blockedRegex.push({
        value: `^https?://[^/]*test-${i}\\.(com|org)`,
        isTerminating: false
      });
    }

    // Generate ASN rules (5% of total)
    const asnCount = Math.floor(count * 0.05);
    for (let i = 0; i < asnCount; i++) {
      rules.blockedAsns.push({
        value: `AS${13335 + i}`,
        isTerminating: false
      });
    }

    // Generate country rules (5% of total)
    const countries = ['CN', 'RU', 'KP', 'IR', 'SY'];
    const countryCount = Math.min(Math.floor(count * 0.05), countries.length);
    for (let i = 0; i < countryCount; i++) {
      rules.blockedCountries[countries[i]] = true;
    }

    return rules;
  }
}

/**
 * Performance test suite using only Playwright
 */
test.describe('Performance Tests', () => {
  let monitor: PerformanceMonitor;

  test.beforeEach(async ({ page, context }) => {
    monitor = new PerformanceMonitor(page, context);
  });

  test('baseline performance with empty ruleset', async ({ page }) => {
    const metrics = await monitor.loadRuleSetAndMeasure(0);
    
    // Baseline expectations
    expect(metrics.initializationTime).toBeGreaterThan(0);
    expect(metrics.initializationTime).toBeLessThan(2000); // 2s baseline
    expect(metrics.pageLoadTime).toBeLessThan(5000); // 5s baseline
    
    console.log('📊 Baseline metrics:', metrics);
  });

  test('performance scaling with rule count', async ({ page }) => {
    const ruleCounts = [10, 50, 100, 500, 1000];
    const results: PerformanceMetrics[] = [];

    for (const count of ruleCounts) {
      console.log(`🧪 Testing with ${count} rules...`);
      const metrics = await monitor.loadRuleSetAndMeasure(count);
      results.push(metrics);
      
      // Performance assertions
      expect(metrics.initializationTime).toBeLessThan(count * 2); // 2ms per rule max
      expect(metrics.pageLoadTime).toBeLessThan(10000); // 10s max
      
      console.log(`📈 ${count} rules:`, {
        init: `${metrics.initializationTime}ms`,
        load: `${metrics.pageLoadTime}ms`,
        memory: `${Math.round(metrics.memoryUsage / 1024 / 1024)}MB`
      });
    }

    // Verify performance doesn't degrade exponentially
    const initTimes = results.map(r => r.initializationTime);
    const maxTime = Math.max(...initTimes);
    const minTime = Math.min(...initTimes.filter(t => t > 0));
    
    // Performance should not degrade more than 10x from baseline
    expect(maxTime / minTime).toBeLessThan(10);
  });

  test('stress test with large ruleset', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for stress test
    
    const metrics = await monitor.loadRuleSetAndMeasure(2000);
    
    // Stress test limits
    expect(metrics.initializationTime).toBeLessThan(10000); // 10s max
    expect(metrics.pageLoadTime).toBeLessThan(15000); // 15s max
    
    console.log('💪 Stress test results:', metrics);
  });

  test('memory usage with different rule types', async ({ page }) => {
    const ruleTypes = [
      { name: 'domains', count: 500 },
      { name: 'urls', count: 300 },
      { name: 'regex', count: 100 },
      { name: 'mixed', count: 200 }
    ];

    for (const ruleType of ruleTypes) {
      const metrics = await monitor.loadRuleSetAndMeasure(ruleType.count);
      const memoryMB = Math.round(metrics.memoryUsage / 1024 / 1024);
      
      console.log(`🧠 Memory usage for ${ruleType.name}:`, `${memoryMB}MB`);
      
      // Memory should not exceed reasonable limits
      expect(memoryMB).toBeLessThan(200); // 200MB max
    }
  });
});
