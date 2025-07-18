import { test as base, Page, BrowserContext } from '@playwright/test';
import path from 'path';

// Extend the base test to include extension setup
export const test = base.extend<{
  extensionPage: Page;
  extensionId: string;
}>({
  extensionPage: async ({ context }, use) => {
    // Load the VETO extension
    const extensionPath = path.join(__dirname, '../../../dist');
    
    // Create a new page for extension testing
    const page = await context.newPage();
    
    // Navigate to about:debugging and load the extension
    await page.goto('about:debugging#/runtime/this-firefox');
    
    // Click "Load Temporary Add-on"
    await page.click('text=Load Temporary Add-on');
    
    // We can't actually select files through Playwright in this manner
    // So we'll provide instructions for manual setup
    console.log('🔧 Manual setup required:');
    console.log('   1. In the opened Firefox, go to about:debugging');
    console.log('   2. Click "This Firefox"');
    console.log('   3. Click "Load Temporary Add-on"');
    console.log(`   4. Select manifest.json from: ${extensionPath}`);
    console.log('   5. Note the extension ID from the URL');
    
    await use(page);
  },

  extensionId: async ({ }, use) => {
    // This will need to be set manually after loading the extension
    // For now, provide a placeholder
    const id = process.env.VETO_EXTENSION_ID || 'UPDATE_WITH_YOUR_EXTENSION_ID';
    console.log(`🎯 Using extension ID: ${id}`);
    await use(id);
  },
});

export { expect } from '@playwright/test';
