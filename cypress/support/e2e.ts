// Cypress support file with TypeScript and Firefox-specific configuration
require('./commands');
require('cypress-real-events');

// Firefox-specific configurations for extension testing
Cypress.on('before:browser:launch', (browser, launchOptions) => {
  if (browser.family === 'firefox') {
    // Configure Firefox for extension testing
    launchOptions.preferences = {
      ...launchOptions.preferences,
      'devtools.chrome.enabled': true,
      'devtools.debugger.remote-enabled': true,
      'extensions.webextensions.remote-debugging.enabled': true,
      'security.csp.enable': false,
      'dom.security.https_only_mode': false,
      'xpinstall.signatures.required': false, // Allow unsigned extensions for testing
      'security.tls.insecure_fallback_hosts': 'addons.mozilla.org',
      'network.cookie.cookieBehavior': 0,
      'privacy.trackingprotection.enabled': false,
    };
    
    cy.task('log', 'Firefox configured for extension testing');
  }
  return launchOptions;
});

// Global configuration optimized for Firefox
Cypress.config('defaultCommandTimeout', 15000);
Cypress.config('requestTimeout', 15000);
Cypress.config('responseTimeout', 15000);
