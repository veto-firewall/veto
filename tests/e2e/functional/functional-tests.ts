import { test, expect, Page } from '@playwright/test';

/**
 * Core functional test suite for VETO extension E2E testing
 * Focuses on real browser behavior and user interactions
 */
test.describe('VETO Extension Functional Tests', () => {
  
  test.beforeEach(async ({ page, context }) => {
    // Set up extension context - this will need to be configured
    // for your specific extension ID once installed
    await page.goto('about:debugging');
  });

  test('extension loads and popup opens', async ({ page }) => {
    // Navigate to extension popup
    // Note: Replace with actual extension URL once installed
    await page.goto('moz-extension://test/popup.html');
    
    // Verify popup elements are present
    await expect(page.locator('#extension-version')).toBeVisible();
    await expect(page.locator('#settings-section')).toBeVisible();
    await expect(page.locator('#basic-rules-section')).toBeVisible();
  });

  test('domain blocking rules work end-to-end', async ({ page, context }) => {
    // 1. Open extension popup
    await page.goto('moz-extension://test/popup.html');
    
    // 2. Add a blocked domain
    await page.fill('#blocked-domains', 'example-blocked.com');
    await page.click('button[data-action="save-rules"]');
    
    // 3. Wait for rules to be saved
    await page.waitForTimeout(2000);
    
    // 4. Try to navigate to blocked domain
    const blockedPage = await context.newPage();
    const response = await blockedPage.goto('https://example-blocked.com', { 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    });
    
    // 5. Verify the request was blocked
    // This depends on your extension's blocking behavior
    expect(response?.status()).toBe(404); // or whatever your extension returns
  });

  test('settings persistence across browser restart', async ({ page }) => {
    // 1. Open extension popup
    await page.goto('moz-extension://test/popup.html');
    
    // 2. Change a setting
    await page.check('#block-fonts');
    await page.fill('#license-key', 'test-license-key-123');
    
    // 3. Save settings
    await page.click('button[data-action="save-settings"]');
    await page.waitForTimeout(1000);
    
    // 4. Reload the popup (simulates restart)
    await page.reload();
    
    // 5. Verify settings persisted
    await expect(page.locator('#block-fonts')).toBeChecked();
    await expect(page.locator('#license-key')).toHaveValue('test-license-key-123');
  });

  test('rule count display updates correctly', async ({ page }) => {
    await page.goto('moz-extension://test/popup.html');
    
    // Add multiple rules
    const testRules = [
      'test1.com',
      'test2.com',
      'test3.com'
    ].join('\n');
    
    await page.fill('#blocked-domains', testRules);
    await page.click('button[data-action="save-rules"]');
    
    // Wait and check rule count
    await page.waitForTimeout(2000);
    const ruleCount = await page.textContent('#rule-count');
    
    // Should show at least 3 rules
    expect(ruleCount).toMatch(/\d+/);
    const count = parseInt(ruleCount?.match(/\d+/)?.[0] || '0');
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('theme switching works', async ({ page }) => {
    await page.goto('moz-extension://test/popup.html');
    
    // Get initial theme
    const initialTheme = await page.getAttribute('html', 'data-theme');
    
    // Click theme switch button
    await page.click('.theme-switcher button');
    
    // Verify theme changed
    const newTheme = await page.getAttribute('html', 'data-theme');
    expect(newTheme).not.toBe(initialTheme);
  });

  test('input validation prevents invalid domains', async ({ page }) => {
    await page.goto('moz-extension://test/popup.html');
    
    // Try to enter invalid domain
    const invalidDomains = [
      'not-a-domain',
      '..invalid..',
      'http://already-has-protocol.com',
      'a'.repeat(300) + '.com' // Too long
    ];
    
    for (const invalidDomain of invalidDomains) {
      await page.fill('#blocked-domains', invalidDomain);
      await page.click('button[data-action="save-rules"]');
      
      // Should show error or reject the input
      // This depends on your validation implementation
      await expect(page.locator('.error, .toast-error')).toBeVisible({ timeout: 3000 });
    }
  });

  test('extension handles network failures gracefully', async ({ page, context }) => {
    // Simulate offline condition
    await context.setOffline(true);
    
    await page.goto('moz-extension://test/popup.html');
    
    // Extension should still work offline for basic operations
    await page.fill('#blocked-domains', 'offline-test.com');
    await page.click('button[data-action="save-rules"]');
    
    // Should not crash or show errors for local operations
    await expect(page.locator('body')).toBeVisible();
  });

  test('large rule sets load without crashing', async ({ page }) => {
    await page.goto('moz-extension://test/popup.html');
    
    // Generate a large rule set
    const largeRuleSet = Array.from({ length: 1000 }, (_, i) => `test${i}.com`).join('\n');
    
    await page.fill('#blocked-domains', largeRuleSet);
    await page.click('button[data-action="save-rules"]');
    
    // Should handle large rule sets without crashing
    await page.waitForTimeout(5000); // Give it time to process
    await expect(page.locator('body')).toBeVisible();
    
    // Rule count should update
    const ruleCount = await page.textContent('#rule-count');
    expect(ruleCount).toMatch(/\d+/);
  });

  test('extension popup responsive design', async ({ page }) => {
    await page.goto('moz-extension://test/popup.html');
    
    // Test different viewport sizes
    const viewports = [
      { width: 400, height: 600 }, // Standard popup
      { width: 300, height: 500 }, // Narrow
      { width: 500, height: 700 }  // Wide
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      
      // Verify essential elements are still visible
      await expect(page.locator('#settings-section')).toBeVisible();
      await expect(page.locator('#basic-rules-section')).toBeVisible();
      
      // No horizontal scrollbar should appear
      const hasScrollbar = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasScrollbar).toBe(false);
    }
  });
});

/**
 * Performance-aware functional tests
 * These test functionality while monitoring performance
 */
test.describe('Performance-Aware Functional Tests', () => {
  
  test('rule processing performance', async ({ page }) => {
    await page.goto('moz-extension://test/popup.html');
    
    const startTime = Date.now();
    
    // Add rules and measure processing time
    const rules = Array.from({ length: 500 }, (_, i) => `perf-test-${i}.com`).join('\n');
    await page.fill('#blocked-domains', rules);
    await page.click('button[data-action="save-rules"]');
    
    // Wait for processing to complete
    await page.waitForTimeout(3000);
    
    const processingTime = Date.now() - startTime;
    
    // Should process 500 rules in reasonable time
    expect(processingTime).toBeLessThan(10000); // 10 seconds max
    
    console.log(`📊 Processed 500 rules in ${processingTime}ms`);
  });

  test('memory usage stays reasonable', async ({ page }) => {
    await page.goto('moz-extension://test/popup.html');
    
    // Get baseline memory
    const baselineMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    // Load large rule set
    const largeRules = Array.from({ length: 2000 }, (_, i) => `memory-test-${i}.com`).join('\n');
    await page.fill('#blocked-domains', largeRules);
    await page.click('button[data-action="save-rules"]');
    await page.waitForTimeout(5000);
    
    // Check memory after loading rules
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    const memoryIncrease = finalMemory - baselineMemory;
    const memoryIncreaseMB = memoryIncrease / 1024 / 1024;
    
    // Memory increase should be reasonable
    expect(memoryIncreaseMB).toBeLessThan(50); // Less than 50MB increase
    
    console.log(`🧠 Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
  });
});
