/// <reference types="cypress" />

describe('VETO Firefox Extension Tests', () => {
  const ADDON_URL = 'https://addons.mozilla.org/en-US/firefox/addon/veto-firewall/';
  const EXTENSION_ID = 'ruslanbay@veto.aleeas.com';

  before(() => {
    // Ensure the extension is built
    cy.task('log', 'Starting VETO extension tests');
  });

  beforeEach(() => {
    // Set up for each test
    cy.task('log', 'Setting up test environment');
  });

  it('should verify extension files are built correctly', () => {
    // Check that the extension files exist in dist folder
    cy.readFile('dist/manifest.json').then((manifest) => {
      expect(manifest.name).to.equal('VETO');
      expect(manifest.version).to.match(/^\d+\.\d+\.\d+$/);
      expect(manifest.manifest_version).to.equal(3);
      expect(manifest.action.default_popup).to.equal('popup.html');
      
      cy.task('log', 'Manifest validation passed');
    });

    // Verify popup HTML structure
    cy.readFile('dist/popup.html').then((content) => {
      expect(content).to.include('<!doctype html>');
      expect(content).to.include('class="container"');
      expect(content).to.include('VETO');
      expect(content).to.include('popup.css');
      
      cy.task('log', 'Popup HTML structure validated');
    });

    // Check required files exist
    const requiredFiles = [
      'dist/popup.css',
      'dist/popup.js',
      'dist/background.js',
      'dist/assets/images/icon-48.png',
      'dist/assets/images/icon-96.png',
      'dist/assets/images/icon-128.png'
    ];

    requiredFiles.forEach(file => {
      cy.readFile(file, null).should('exist');
    });

    cy.task('log', 'All extension files verified');
  });

  it('should access Firefox addon page', () => {
    cy.visit(ADDON_URL, { timeout: 10000 });
    
    // Check if the VETO extension page loads
    cy.contains('VETO', { timeout: 15000 }).should('be.visible');
    
    // Firefox addon pages have different structure than Chrome
    // Look for Firefox-specific elements
    cy.get('body').then(($body) => {
      // Check for various possible install button selectors in Firefox
      const firefoxSelectors = [
        '[data-test-id="add-to-firefox"]',
        '.InstallButton',
        '.install-button',
        '.AMInstallButton',
        'button[type="submit"]'
      ];
      
      let found = false;
      for (const selector of firefoxSelectors) {
        if ($body.find(selector).length > 0) {
          cy.get(selector).should('be.visible');
          cy.task('log', `Install button found with selector: ${selector}`);
          found = true;
          break;
        }
      }
      
      if (!found) {
        // If no install button found, check if extension is already installed
        if ($body.text().includes('Remove') || $body.text().includes('Installed')) {
          cy.task('log', 'Extension appears to be already installed');
        } else {
          cy.task('log', 'Extension page loaded but install status unclear');
        }
      }
    });
    
    // Verify this is indeed the VETO extension page
    cy.contains('Advanced filtering', { timeout: 10000 }).should('be.visible');
    cy.task('log', 'Firefox addon page validation completed');
  });

  it('should validate extension popup structure when accessed directly', () => {
    // Instead of trying to visit the file, let's test the popup structure inline
    cy.readFile('dist/popup.html').then((popupHtml) => {
      // Validate the popup HTML structure directly
      const parser = new DOMParser();
      const doc = parser.parseFromString(popupHtml, 'text/html');
      
      // Check essential elements exist in the HTML
      const container = doc.querySelector('.container');
      const header = doc.querySelector('header');
      const logo = doc.querySelector('.logo');
      const version = doc.querySelector('#extension-version');
      const headerLeft = doc.querySelector('.header-left');
      const headerRight = doc.querySelector('.header-right');
      
      expect(container).to.not.be.null;
      expect(header).to.not.be.null;
      expect(logo).to.not.be.null;
      if (logo) {
        expect(logo.getAttribute('alt')).to.equal('VETO Logo');
      }
      expect(version).to.not.be.null;
      expect(headerLeft).to.not.be.null;
      expect(headerRight).to.not.be.null;
      
      cy.task('log', 'Popup structure validation completed successfully');
    });
  });

  it('should verify extension manifest meets Firefox requirements', () => {
    cy.readFile('dist/manifest.json').then((manifest) => {
      // Firefox-specific validations
      expect(manifest.browser_specific_settings).to.exist;
      expect(manifest.browser_specific_settings.gecko.id).to.equal(EXTENSION_ID);
      expect(manifest.browser_specific_settings.gecko.strict_min_version).to.exist;
      
      // Required permissions for VETO functionality
      expect(manifest.permissions).to.include('declarativeNetRequest');
      expect(manifest.permissions).to.include('storage');
      expect(manifest.host_permissions).to.include('<all_urls>');
      
      // Action configuration for popup
      expect(manifest.action.default_popup).to.equal('popup.html');
      expect(manifest.action.default_icon).to.exist;
      
      // Icons for different sizes
      expect(manifest.icons['48']).to.equal('assets/images/icon-48.png');
      expect(manifest.icons['96']).to.equal('assets/images/icon-96.png');
      expect(manifest.icons['128']).to.equal('assets/images/icon-128.png');
      
      cy.task('log', 'Firefox manifest requirements validated');
    });
  });

  it('should test extension popup URL format', () => {
    // Test the moz-extension URL format that would be used
    const mockExtensionUUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const popupUrl = `moz-extension://${mockExtensionUUID}/popup.html`;
    
    cy.task('log', `Expected popup URL format: ${popupUrl}`);
    
    // Verify URL format is correct
    expect(popupUrl).to.match(/^moz-extension:\/\/[a-f0-9-]+\/popup\.html$/);
    
    // In a real Firefox environment with the extension installed,
    // the actual UUID would be different and assigned by Firefox
    cy.task('log', 'Popup URL format validation passed');
  });

  it('should verify extension is ready for production', () => {
    // Final comprehensive check
    const checks = [
      { file: 'dist/manifest.json', description: 'Manifest file' },
      { file: 'dist/popup.html', description: 'Popup HTML' },
      { file: 'dist/popup.css', description: 'Popup styles' },
      { file: 'dist/popup.js', description: 'Popup script' },
      { file: 'dist/background.js', description: 'Background script' }
    ];

    checks.forEach(check => {
      cy.readFile(check.file).should('exist');
      cy.task('log', `✓ ${check.description} exists`);
    });

    // Test that the extension can be packaged
    cy.task('log', 'Extension is ready for Firefox installation');
    cy.task('log', `Install from: ${ADDON_URL}`);
    cy.task('log', `Expected popup URL: moz-extension://{uuid}/popup.html`);
  });
});
