import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for VETO Firefox extension testing
 * Focuses on E2E and performance testing without external dependencies
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Extensions can interfere with each other
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid extension conflicts
  reporter: [
    ['html'], 
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  
  use: {
    // Global test configuration
    headless: true, // Must be true in headless environments like Codespaces
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'firefox-extension',
      use: {
        ...devices['Desktop Firefox'],
        // Firefox-specific extension loading configuration
        launchOptions: {
          // Firefox-specific arguments
          firefoxUserPrefs: {
            // Allow unsigned extension installation for testing
            'xpinstall.signatures.required': false,
            'extensions.autoDisableScopes': 0,
            'extensions.enabledScopes': 15,
            // Performance and debugging settings
            'dom.ipc.processCount': 1,
            'browser.tabs.remote.autostart': false,
            'devtools.chrome.enabled': true,
            'devtools.debugger.remote-enabled': true,
            // Security settings for testing
            'security.csp.enable': false,
            'security.fileuri.strict_origin_policy': false,
          },
          // Add debugging port for better control
          args: [
            '--remote-debugging-port=9222',
            '--disable-web-security',
          ]
        }
      }
    }
  ],

  // Test timeout settings
  expect: {
    timeout: 10000 // 10 seconds for assertions
  },
  timeout: 60000, // 1 minute per test

  // Output directories
  outputDir: 'test-results/',
});
