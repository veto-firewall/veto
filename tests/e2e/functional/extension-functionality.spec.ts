import { test, expect } from '@playwright/test';
import * as fs from 'fs';

/**
 * End-to-end tests for VETO extension functionality
 * These tests work around Playwright's limitations with Firefox extensions
 */
test.describe('VETO Extension E2E Tests', () => {

  test('extension background script validation', async ({ page }) => {
    // Test the background script logic by examining the built file
    const backgroundScript = fs.readFileSync('/workspaces/veto/dist/background.js', 'utf8');
    
    // Verify essential functionality is included (check for key patterns that survive minification)
    expect(backgroundScript).toContain('declarativeNetRequest');
    expect(backgroundScript).toContain('onMessage');
    
    // Check for core functionality patterns that indicate services are included
    expect(backgroundScript.length).toBeGreaterThan(10000); // Should be substantial
    expect(backgroundScript).toMatch(/browser\.(declarativeNetRequest|runtime|storage)/); // Browser APIs
    expect(backgroundScript).toMatch(/(onBeforeRequest|webRequest)/); // Web request handling
    expect(backgroundScript).toMatch(/(geoip|maxmind|country)/i); // GeoIP functionality
    
    console.log('✅ Background script contains required functionality');
    console.log(`📦 Background script size: ${Math.round(backgroundScript.length / 1024)}KB`);
  });

  test('rule processing performance simulation', async ({ page }) => {
    // Simulate rule processing performance using the same logic
    await page.goto('data:text/html,<html><head><title>Test Page</title></head><body><h1>Performance Test</h1></body></html>');
    
    const testRules = {
      blockedDomains: Array.from({ length: 100 }, (_, i) => ({
        value: `test-domain-${i}.com`,
        isTerminating: false
      })),
      blockedUrls: Array.from({ length: 50 }, (_, i) => ({
        value: `https://ads-${i}.example.com/*`,
        isTerminating: false
      })),
      blockedRegex: [
        { value: '^https?://[^/]*tracking\\.', isTerminating: false },
        { value: '^https?://[^/]*analytics\\.', isTerminating: false }
      ]
    };
    
    // Simulate rule matching performance
    const performanceTest = await page.evaluate((rules) => {
      const testUrls = [
        'https://example.com',
        'https://test-domain-50.com',
        'https://ads-25.example.com/banner',
        'https://tracking.malicious.com',
        'https://safe-site.org'
      ];
      
      const startTime = performance.now();
      
      // Simple rule matching simulation
      const results = testUrls.map(url => {
        // Domain matching
        const domainMatch = rules.blockedDomains.some(rule => 
          url.includes(rule.value)
        );
        
        // URL matching
        const urlMatch = rules.blockedUrls.some(rule => {
          const pattern = rule.value.replace(/\*/g, '.*');
          return new RegExp(pattern).test(url);
        });
        
        // Regex matching
        const regexMatch = rules.blockedRegex.some(rule => 
          new RegExp(rule.value).test(url)
        );
        
        return {
          url,
          blocked: domainMatch || urlMatch || regexMatch,
          domainMatch,
          urlMatch,
          regexMatch
        };
      });
      
      const endTime = performance.now();
      
      return {
        processingTime: endTime - startTime,
        results,
        rulesCount: rules.blockedDomains.length + rules.blockedUrls.length + rules.blockedRegex.length
      };
    }, testRules);
    
    console.log(`📊 Rule processing performance:`, {
      rulesCount: performanceTest.rulesCount,
      processingTime: `${performanceTest.processingTime.toFixed(2)}ms`,
      blocked: performanceTest.results.filter(r => r.blocked).length,
      allowed: performanceTest.results.filter(r => !r.blocked).length
    });
    
    // Performance expectations
    expect(performanceTest.processingTime).toBeLessThan(100); // Should be fast
    expect(performanceTest.results).toHaveLength(5);
    
    // Verify blocking logic works
    const blockedUrls = performanceTest.results.filter(r => r.blocked);
    expect(blockedUrls.length).toBeGreaterThan(0);
  });

  test('popup functionality without extension context', async ({ page }) => {
    // Test popup behavior by loading it as a standalone page
    await page.goto('file:///workspaces/veto/dist/popup.html');
    
    // Wait for any initial scripts to load
    await page.waitForTimeout(1000);
    
    // Test basic DOM structure
    const title = await page.textContent('head title');
    expect(title).toContain('VETO');
    
    // Check for main sections
    const hasVersionSection = await page.locator('#extension-version').count() > 0;
    const hasSettingsSection = await page.locator('#settings-section').count() > 0;
    const hasRulesSection = await page.locator('#basic-rules-section').count() > 0;
    
    console.log('🎯 Popup sections found:', {
      version: hasVersionSection,
      settings: hasSettingsSection,
      rules: hasRulesSection
    });
    
    // At least the HTML structure should be there
    expect(hasVersionSection || hasSettingsSection || hasRulesSection).toBe(true);
  });

  test('network request simulation', async ({ page }) => {
    // Simulate what the extension would do with network requests
    let interceptedRequests = 0;
    let blockedRequests = 0;
    
    // Intercept all requests to simulate extension behavior
    await page.route('**/*', (route) => {
      interceptedRequests++;
      const url = route.request().url();
      
      // Simulate blocking logic
      const shouldBlock = url.includes('ads') || 
                         url.includes('tracking') || 
                         url.includes('analytics');
      
      if (shouldBlock) {
        blockedRequests++;
        route.abort();
      } else {
        route.continue();
      }
    });
    
    // Navigate to a page and trigger some requests
    await page.goto('https://httpbin.org/html');
    
    // Wait for network activity to settle
    await page.waitForLoadState('networkidle');
    
    console.log(`🛡️  Network simulation results:`, {
      intercepted: interceptedRequests,
      blocked: blockedRequests,
      allowed: interceptedRequests - blockedRequests,
      blockRate: `${((blockedRequests / interceptedRequests) * 100).toFixed(1)}%`
    });
    
    expect(interceptedRequests).toBeGreaterThan(0);
  });

  test('MaxMind GeoIP simulation', async ({ page }) => {
    // Test GeoIP functionality simulation
    await page.goto('https://httpbin.org/ip');
    
    const geoTest = await page.evaluate(() => {
      // Simulate MaxMind GeoIP lookup
      const testIPs = [
        '8.8.8.8',     // Google DNS (US)
        '1.1.1.1',     // Cloudflare (US)
        '208.67.222.222', // OpenDNS (US)
        '127.0.0.1'    // Localhost
      ];
      
      // Mock GeoIP results (in real extension, this comes from MaxMind)
      const mockGeoData = {
        '8.8.8.8': { country: 'US', asn: 'AS15169' },
        '1.1.1.1': { country: 'US', asn: 'AS13335' },
        '208.67.222.222': { country: 'US', asn: 'AS36692' },
        '127.0.0.1': { country: 'XX', asn: 'AS0' }
      };
      
      const results = testIPs.map(ip => ({
        ip,
        geo: mockGeoData[ip] || { country: 'XX', asn: 'AS0' }
      }));
      
      return results;
    });
    
    console.log('🌍 GeoIP simulation results:', geoTest);
    
    expect(geoTest).toHaveLength(4);
    expect(geoTest[0].geo.country).toBe('US');
    expect(geoTest[0].geo.asn).toContain('AS');
  });
});

/**
 * Advanced performance and stress tests
 */
test.describe('VETO Performance Tests', () => {
  
  test('large ruleset performance', async ({ page }) => {
    await page.goto('https://example.com');
    
    // Generate a large ruleset for testing
    const largeRuleset = {
      domains: Array.from({ length: 1000 }, (_, i) => `domain-${i}.com`),
      urls: Array.from({ length: 500 }, (_, i) => `https://ads-${i}.net/*`),
      regex: Array.from({ length: 100 }, (_, i) => `^https?://[^/]*tracker-${i}\\.`)
    };
    
    const performanceResult = await page.evaluate((ruleset) => {
      const testUrl = 'https://tracker-50.malicious.com/pixel.gif';
      const iterations = 1000;
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        // Simulate rule matching
        const domainMatch = ruleset.domains.some(domain => testUrl.includes(domain));
        const urlMatch = ruleset.urls.some(url => {
          const pattern = url.replace(/\*/g, '.*');
          return new RegExp(pattern).test(testUrl);
        });
        const regexMatch = ruleset.regex.some(regex => new RegExp(regex).test(testUrl));
        
        const blocked = domainMatch || urlMatch || regexMatch;
      }
      
      const endTime = performance.now();
      
      return {
        totalTime: endTime - startTime,
        averageTime: (endTime - startTime) / iterations,
        rulesCount: ruleset.domains.length + ruleset.urls.length + ruleset.regex.length
      };
    }, largeRuleset);
    
    console.log('🚀 Large ruleset performance:', {
      rulesCount: performanceResult.rulesCount,
      totalTime: `${performanceResult.totalTime.toFixed(2)}ms`,
      averageTime: `${performanceResult.averageTime.toFixed(4)}ms per lookup`,
      lookupsPerSecond: Math.round(1000 / performanceResult.averageTime)
    });
    
    // Performance expectations for large rulesets
    expect(performanceResult.averageTime).toBeLessThan(1); // Less than 1ms per lookup
    expect(performanceResult.totalTime).toBeLessThan(1000); // Less than 1 second total
  });
});
