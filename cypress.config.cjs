const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: null,
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    setupNodeEvents(on, config) {
      // Custom tasks for extension testing
      on('task', {
        log(message) {
          console.log(message);
          return null;
        }
      });

      // Firefox-specific configuration
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.family === 'firefox') {
          // Enable extension debugging and disable security restrictions
          launchOptions.preferences = {
            ...launchOptions.preferences,
            'devtools.chrome.enabled': true,
            'devtools.debugger.remote-enabled': true,
            'extensions.webextensions.remote-debugging.enabled': true,
            'security.csp.enable': false,
            'dom.security.https_only_mode': false,
            'xpinstall.signatures.required': false,
            'security.tls.insecure_fallback_hosts': 'addons.mozilla.org',
            'network.cookie.cookieBehavior': 0,
            'privacy.trackingprotection.enabled': false,
          };
        }
        return launchOptions;
      });

      return config;
    },
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 10000,
    experimentalMemoryManagement: true,
    env: {
      EXTENSION_PATH: './dist',
    },
  },
});
