import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Setup test to get the extension ID and verify basic functionality
 * Run this first to configure your testing environment
 */
test.describe('Extension Setup and Discovery', () => {
  
  test('load extension and get ID', async ({ page, context }) => {
    test.setTimeout(60000); // 1 minute timeout for setup
    
    // Note: This test is designed for manual extension loading
    // In Playwright's test environment, extensions need to be loaded manually
    
    console.log('🔧 Manual Extension Loading Instructions:');
    console.log('1. Open Firefox manually');
    console.log('2. Navigate to about:debugging');
    console.log('3. Click "This Firefox"');
    console.log('4. Click "Load Temporary Add-on"');
    console.log('5. Navigate to /workspaces/veto/dist/');
    console.log('6. Select manifest.json');
    console.log('7. Copy the extension ID from the URL');
    console.log('8. Update tests with the extension ID');
    
    // For automated testing, we'll verify the build instead
    const pathToExtension = path.join(process.cwd(), 'dist');
    console.log('📁 Extension build location:', pathToExtension);
    
    // Verify the extension files exist
    const manifestPath = path.join(pathToExtension, 'manifest.json');
    
    expect(fs.existsSync(manifestPath)).toBe(true);
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.name).toBe('VETO');
    expect(manifest.version).toBeDefined();
    
    console.log(`✅ Extension ready for manual loading: ${manifest.name} v${manifest.version}`);
  });

  test('verify extension popup loads', async ({ page, context }) => {
    // This test assumes you've manually noted the extension ID from the previous test
    // You'll need to update this URL with your actual extension ID
    
    console.log('📝 Note: Update this test with your actual extension ID from the previous test');
    console.log('   The URL should be: moz-extension://YOUR-EXTENSION-ID/popup.html');
    
    // Placeholder test - update with real extension ID
    // await page.goto('moz-extension://your-extension-id/popup.html');
    // await expect(page.locator('#extension-version')).toBeVisible();
  });
});
