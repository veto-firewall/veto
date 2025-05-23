import '../popup/popup.css';
import type { Settings, RuleSet } from '../services/types';
import { setupUIEvents } from './services/UIEventHandler';
import { PopupService } from './services/PopupService';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { Toast } from './components/Toast';
import {
  populateRuleTextarea,
  parseRulesForType,
  updateRulesInStore,
} from './services/RuleOperations';
import { exportRules } from './services/FileOperations';
import { ServiceFactory } from '../services/ServiceFactory';

// Import countries data types for typechecking
import type {
  ICountry as _ICountry,
  TCountries,
  TContinents as _TContinents,
} from 'countries-list';

let settings: Settings;
let rules: RuleSet;
const toast = new Toast();

// Initialize the popup
/**
 * Update the rule count display in the UI
 */
async function updateRuleCount(): Promise<void> {
  const result = await browser.storage.local.get('ruleCount');
  const ruleCount = (result as { ruleCount?: number }).ruleCount || 0;
  const ruleLimit = ServiceFactory.getInstance().getDeclarativeRuleService().getRuleLimit();

  // Update rule count element
  const ruleCountElement = document.getElementById('rule-count');
  if (ruleCountElement) {
    ruleCountElement.textContent = String(ruleCount);

    // Add warning class if approaching limit
    if (ruleCount > Math.floor(ruleLimit * 0.9)) {
      // 90% of limit = danger
      ruleCountElement.classList.add('danger');
    } else if (ruleCount > Math.floor(ruleLimit * 0.8)) {
      // 80% of limit = warning
      ruleCountElement.classList.add('warning');
    } else {
      ruleCountElement.classList.remove('warning', 'danger');
    }
  }

  // Update rule limit element
  const ruleLimitElement = document.getElementById('rule-limit');
  if (ruleLimitElement) {
    ruleLimitElement.textContent = String(ruleLimit);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Show loading state
  document.body.classList.add('loading');

  try {
    await loadSettings();
    initSectionExpansion();
    await loadRules();
    await setupCountryList();
    initThemeSwitcher();
    initExtensionInfo();
    await updateRuleCount();

    // Initialize UI event handlers
    setupUIEvents(settings, rules, saveSettingsToBackground, saveRulesToBackground);
    setupEventListeners();

    document.body.classList.remove('loading');
  } catch (error) {
    document.body.classList.remove('loading');
    void error;
    toast.show('Failed to initialize', 'error');
  }
});

/**
 * Initialize extension version info in the UI
 */
function initExtensionInfo(): void {
  const versionElement = document.getElementById('extension-version');
  if (versionElement) {
    const manifest = browser.runtime.getManifest();
    versionElement.textContent = `v${manifest.version}`;
  }
}

/**
 * Initialize the expansion state of sections based on saved user preferences
 */
function initSectionExpansion(): void {
  // Get all details elements
  const allSections = document.querySelectorAll('details');

  // Ensure sectionStates exists in settings (for backward compatibility with older settings)
  if (!settings.sectionStates) {
    settings.sectionStates = {
      'settings-section': false,
      'basic-rules-section': true,
      'dnr-rules-section': true,
      'ip-rules-section': true,
      'asn-rules-section': true,
      'geoip-section': true,
    };
  }

  // Apply the saved state from settings
  allSections.forEach(section => {
    const sectionId = section.id;
    if (sectionId) {
      if (settings.sectionStates[sectionId] !== undefined) {
        if (settings.sectionStates[sectionId]) {
          section.setAttribute('open', '');
        } else {
          section.removeAttribute('open');
        }
      } else {
        // Initialize missing section state with current state
        settings.sectionStates[sectionId] = section.hasAttribute('open');
      }

      // Add change listeners to save state when toggled
      section.addEventListener('toggle', () => {
        const isExpanded = section.hasAttribute('open');
        settings.sectionStates[sectionId] = isExpanded;
        void saveSettingsToBackground();
      });
    }
  });
}

// Load settings from background
async function loadSettings(): Promise<void> {
  settings = (await browser.runtime.sendMessage({ type: 'getSettings' })) as Settings;

  // Populate settings UI
  const licenseKeyInput = document.getElementById('license-key') as HTMLInputElement;
  const suspendUntilLoadCheckbox = document.getElementById(
    'suspend-until-load',
  ) as HTMLInputElement;
  const httpHandlingSelect = document.getElementById('http-handling') as HTMLSelectElement;
  const blockFontsCheckbox = document.getElementById('block-fonts') as HTMLInputElement;
  const blockImagesCheckbox = document.getElementById('block-images') as HTMLInputElement;
  const blockMediaCheckbox = document.getElementById('block-media') as HTMLInputElement;
  const blockPrivateIPsCheckbox = document.getElementById('block-private-ips') as HTMLInputElement;

  licenseKeyInput.value = settings.maxmind.licenseKey;
  suspendUntilLoadCheckbox.checked = settings.suspendUntilFiltersLoad;
  httpHandlingSelect.value = settings.httpHandling;
  blockFontsCheckbox.checked = settings.blockRemoteFonts;
  blockImagesCheckbox.checked = settings.blockImages;
  blockMediaCheckbox.checked = settings.blockMedia;
  blockPrivateIPsCheckbox.checked = settings.blockPrivateIPs;

  // Add event listener to save 'Block Private IPs' setting immediately when toggled
  blockPrivateIPsCheckbox.addEventListener('change', () => {
    settings.blockPrivateIPs = blockPrivateIPsCheckbox.checked;
    void saveSettingsToBackground();
  });

  // Add event listeners to other content filtering checkboxes
  blockFontsCheckbox.addEventListener('change', () => {
    settings.blockRemoteFonts = blockFontsCheckbox.checked;
    void saveSettingsToBackground();
  });

  blockImagesCheckbox.addEventListener('change', () => {
    settings.blockImages = blockImagesCheckbox.checked;
    void saveSettingsToBackground();
  });

  blockMediaCheckbox.addEventListener('change', () => {
    settings.blockMedia = blockMediaCheckbox.checked;
    void saveSettingsToBackground();
  });

  // Add event listener for suspend until filters load checkbox
  suspendUntilLoadCheckbox.addEventListener('change', () => {
    settings.suspendUntilFiltersLoad = suspendUntilLoadCheckbox.checked;
    void saveSettingsToBackground();
  });

  // Add event listener for HTTP handling dropdown
  httpHandlingSelect.addEventListener('change', () => {
    settings.httpHandling = httpHandlingSelect.value as 'allow' | 'redirect' | 'block';
    void saveSettingsToBackground();
  });
}

// Load rules from background
async function loadRules(): Promise<void> {
  rules = (await browser.runtime.sendMessage({ type: 'getRules' })) as RuleSet;

  // Populate rules UI (using await since the function is now async)
  await populateRuleTextarea('allowed-domains', rules.allowedDomains);
  await populateRuleTextarea('blocked-domains', rules.blockedDomains);
  await populateRuleTextarea('allowed-urls', rules.allowedUrls);
  await populateRuleTextarea('blocked-urls', rules.blockedUrls);
  await populateRuleTextarea('allowed-regex', rules.allowedRegex);
  await populateRuleTextarea('blocked-regex', rules.blockedRegex);
  await populateRuleTextarea('tracking-params', rules.trackingParams);
  await populateRuleTextarea('allowed-ips', rules.allowedIps);
  await populateRuleTextarea('blocked-ips', rules.blockedIps);
  await populateRuleTextarea('allowed-asns', rules.allowedAsns);
  await populateRuleTextarea('blocked-asns', rules.blockedAsns);
}

/**
 * Creates the country checkboxes for a specific continent
 */
function createCountryCheckboxes(
  countriesInContinent: Record<string, string>,
  continentCode: string,
): HTMLDivElement {
  const countriesDiv = document.createElement('div');
  countriesDiv.className = 'countries-list';
  countriesDiv.setAttribute('aria-hidden', 'true');

  // Add countries
  Object.entries(countriesInContinent).forEach(([countryCode, countryName]) => {
    const countryItem = document.createElement('div');
    countryItem.className = 'country-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `country-${countryCode}`;
    checkbox.dataset.country = countryCode;
    checkbox.dataset.continent = continentCode;

    // Set checked state based on blocked countries
    if (rules.blockedCountries[countryCode]) {
      checkbox.checked = true;
    }

    const label = document.createElement('label');
    label.htmlFor = `country-${countryCode}`;
    label.textContent = countryName;

    countryItem.appendChild(checkbox);
    countryItem.appendChild(label);
    countriesDiv.appendChild(countryItem);
  });

  return countriesDiv;
}

/**
 * Creates the continent header with checkbox and event listeners
 */
function createContinentHeader(continentCode: string, continentName: string): HTMLDivElement {
  const continentHeader = document.createElement('div');
  continentHeader.className = 'continent-title';
  continentHeader.setAttribute('role', 'button');
  continentHeader.setAttribute('aria-expanded', 'false');
  continentHeader.setAttribute('tabindex', '0');

  const continentCheckbox = document.createElement('input');
  continentCheckbox.type = 'checkbox';
  continentCheckbox.id = `continent-${continentCode}`;
  continentCheckbox.dataset.continent = continentCode;

  // Stop propagation to prevent toggling when clicking the checkbox
  continentCheckbox.addEventListener('click', function (e) {
    e.stopPropagation();
  });

  const continentLabel = document.createElement('label');
  continentLabel.htmlFor = `continent-${continentCode}`;
  continentLabel.textContent = continentName;

  // Stop propagation to prevent toggling when clicking the label
  continentLabel.addEventListener('click', function (e) {
    e.stopPropagation();
  });

  continentHeader.appendChild(continentCheckbox);
  continentHeader.appendChild(continentLabel);

  return continentHeader;
}

/**
 * Set up country list for GeoIP blocking
 */
async function setupCountryList(): Promise<void> {
  const geoipContinentsDiv = document.getElementById('geoip-continents');
  if (!geoipContinentsDiv) return;

  // Dynamically import countries data
  const { countries, continents } = await import('countries-list');

  // Process countries data and organize by continent
  const countriesByContinent = processCountriesData(countries);
  const popupService = PopupService.getInstance();
  await popupService.setCountryLookupCache('byContinent', countriesByContinent);

  // Create continent groups
  Object.entries(continents).forEach(([continentCode, continentName]) => {
    const countriesInContinent = countriesByContinent[continentCode];
    if (!countriesInContinent) return;

    // Create continent container
    const continentDiv = document.createElement('div');
    continentDiv.className = 'continent-group collapsed';
    continentDiv.dataset.continentCode = continentCode;

    // Create continent header with checkbox
    const continentHeader = createContinentHeader(continentCode, continentName);
    continentDiv.appendChild(continentHeader);

    // Create countries list
    const countriesDiv = createCountryCheckboxes(countriesInContinent, continentCode);
    continentDiv.appendChild(countriesDiv);

    // Add to main container
    geoipContinentsDiv.appendChild(continentDiv);

    // Add click event to continent header to toggle expansion
    setupContinentToggleEvents(continentHeader, continentDiv, countriesDiv);

    // Check if all countries in this continent are blocked
    const continentCheckbox = document.getElementById(
      `continent-${continentCode}`,
    ) as HTMLInputElement;
    if (continentCheckbox) {
      const allCountriesBlocked = Object.keys(countriesInContinent).every(
        countryCode => rules.blockedCountries[countryCode],
      );
      continentCheckbox.checked = allCountriesBlocked;
    }
  });
}

/**
 * Process countries data and organize by continent
 */
function processCountriesData(countries: TCountries): Record<string, Record<string, string>> {
  const countriesByContinent: Record<string, Record<string, string>> = {};

  Object.entries(countries).forEach(([code, country]) => {
    const continentCode = country.continent;
    if (!countriesByContinent[continentCode]) {
      countriesByContinent[continentCode] = {};
    }
    countriesByContinent[continentCode][code] = country.name;
  });

  return countriesByContinent;
}

/**
 * Setup toggle events for continent headers
 */
function setupContinentToggleEvents(
  continentHeader: HTMLDivElement,
  continentDiv: HTMLDivElement,
  countriesDiv: HTMLDivElement,
): void {
  // Add click event to continent header to toggle expansion
  continentHeader.addEventListener('click', function () {
    if (continentDiv.classList.contains('collapsed')) {
      continentDiv.classList.remove('collapsed');
      continentHeader.setAttribute('aria-expanded', 'true');
      countriesDiv.setAttribute('aria-hidden', 'false');
    } else {
      continentDiv.classList.add('collapsed');
      continentHeader.setAttribute('aria-expanded', 'false');
      countriesDiv.setAttribute('aria-hidden', 'true');
    }
  });

  // Add keyboard accessibility
  continentHeader.addEventListener('keydown', function (event) {
    if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
      event.preventDefault();
      continentHeader.click();
    }
  });
}

// Set up event listeners
function setupEventListeners(): void {
  // Settings
  document.getElementById('save-maxmind')?.addEventListener('click', saveMaxmindSettings);

  // DNR Rules
  setupRuleEventListeners('allowed-domains', 'domain', 'allow');
  setupRuleEventListeners('blocked-domains', 'domain', 'block');
  setupRuleEventListeners('allowed-urls', 'url', 'allow');
  setupRuleEventListeners('blocked-urls', 'url', 'block');
  setupRuleEventListeners('allowed-regex', 'regex', 'allow');
  setupRuleEventListeners('blocked-regex', 'regex', 'block');
  // Use 'tracking' type instead of 'url' for tracking parameters
  setupRuleEventListeners('tracking-params', 'tracking', 'redirect');

  // IP Rules
  setupRuleEventListeners('allowed-ips', 'ip', 'allow');
  setupRuleEventListeners('blocked-ips', 'ip', 'block');

  // ASN Rules
  setupRuleEventListeners('allowed-asns', 'asn', 'allow');
  setupRuleEventListeners('blocked-asns', 'asn', 'block');

  // GeoIP Rules
  setupGeoipEventListeners();
}

// Set up event listeners for rules
function setupRuleEventListeners(baseId: string, type: string, action: string): void {
  const saveBtn = document.getElementById(`save-${baseId}`);
  const exportBtn = document.getElementById(`export-${baseId}`);

  saveBtn?.addEventListener('click', () => saveRules(baseId, type, action));
  exportBtn?.addEventListener('click', () => exportRules(baseId));
}

// Setup GeoIP event listeners
function setupGeoipEventListeners(): void {
  // Continent checkboxes
  document.querySelectorAll('input[id^="continent-"]').forEach(checkbox => {
    checkbox.addEventListener('change', handleContinentChange);
  });

  // Country checkboxes
  document.querySelectorAll('input[id^="country-"]').forEach(checkbox => {
    checkbox.addEventListener('change', handleCountryChange);
  });
}

// Handle continent checkbox change
function handleContinentChange(event: Event): void {
  const checkbox = event.target as HTMLInputElement;
  const continentCode = checkbox.dataset.continent;
  const isChecked = checkbox.checked;

  if (!continentCode) return;

  // Update all countries in this continent
  document.querySelectorAll(`input[data-continent="${continentCode}"]`).forEach(countryCheckbox => {
    if (countryCheckbox.id.startsWith('country-')) {
      (countryCheckbox as HTMLInputElement).checked = isChecked;
      const countryCode = (countryCheckbox as HTMLInputElement).dataset.country;
      if (countryCode) {
        if (isChecked) {
          rules.blockedCountries[countryCode] = true;
        } else {
          delete rules.blockedCountries[countryCode];
        }
      }
    }
  });

  void saveRulesToBackground();
}

// Handle country checkbox change
async function handleCountryChange(event: Event): Promise<void> {
  const checkbox = event.target as HTMLInputElement;
  const countryCode = checkbox.dataset.country;
  const continentCode = checkbox.dataset.continent;
  const isChecked = checkbox.checked;

  if (!countryCode) return;

  // Update the country in rules
  if (isChecked) {
    rules.blockedCountries[countryCode] = true;
  } else {
    delete rules.blockedCountries[countryCode];
  }

  // Check if we need to update continent checkbox
  if (continentCode) {
    await updateContinentCheckbox(continentCode);
  }

  void saveRulesToBackground();
}

// Update continent checkbox based on country selections
async function updateContinentCheckbox(continentCode: string): Promise<void> {
  const continentCheckbox = document.getElementById(
    `continent-${continentCode}`,
  ) as HTMLInputElement;
  if (!continentCheckbox) return;

  const popupService = PopupService.getInstance();
  const cacheData = await popupService.getCountryLookupCache();
  const countriesByContinent = (cacheData?.byContinent || {}) as Record<
    string,
    Record<string, string>
  >;
  if (!countriesByContinent || !countriesByContinent[continentCode]) return;

  const allCountries = Object.keys(countriesByContinent[continentCode]);
  const allSelected = allCountries.every(countryCode => rules.blockedCountries[countryCode]);

  continentCheckbox.checked = allSelected;
}

// Save MaxMind settings
async function saveMaxmindSettings(): Promise<void> {
  const licenseKeyInput = document.getElementById('license-key') as HTMLInputElement;
  settings.maxmind.licenseKey = licenseKeyInput.value.trim();
  await saveSettingsToBackground();
}

/**
 * Parse and save rule changes
 *
 * @param baseId - The ID of the rule element
 * @param ruleType - The type of rule (domain, url, etc.)
 * @param actionType - The action for the rule (allow, block, etc.)
 * @returns Promise that resolves when rules are saved
 */
async function saveRules(baseId: string, ruleType: string, actionType: string): Promise<void> {
  const textarea = document.getElementById(baseId) as HTMLTextAreaElement;
  const terminatingCheckbox = document.getElementById(`${baseId}-terminating`) as HTMLInputElement;

  const isTerminating = terminatingCheckbox?.checked ?? true;
  const rulesText = textarea.value;

  // Parse rules
  const newRules = parseRulesForType(ruleType, rulesText, actionType, isTerminating);

  // Update rules in the rules object
  updateRulesInStore(baseId, newRules, rules);

  // Save changes
  await saveRulesToBackground();
}

// Save settings to background
async function saveSettingsToBackground(): Promise<void> {
  try {
    await browser.runtime.sendMessage({
      type: 'saveSettings',
      settings: settings,
    });
  } catch (error) {
    void error;
  }
}

// Save rules to background
async function saveRulesToBackground(): Promise<void> {
  try {
    await browser.runtime.sendMessage({
      type: 'saveRules',
      rules: rules,
    });

    // Update rule count after saving rules
    await updateRuleCount();

    // Check if we're approaching the limit and show a notification if needed
    const result = await browser.storage.local.get('ruleCount');
    const ruleCount = (result as { ruleCount?: number }).ruleCount || 0;

    if (ruleCount > 4500) {
      toast.show(`Warning: Using ${ruleCount}/${ServiceFactory.getInstance().getDeclarativeRuleService().getRuleLimit()} rules`, 'info');
    }
  } catch (error) {
    void error;
    toast.show('Error saving rules', 'error');
  }
}

/**
 * Initializes the theme switcher component
 */
function initThemeSwitcher(): void {
  const themeSwitcher = new ThemeSwitcher();
  const container = document.getElementById('theme-switcher');
  if (container) {
    container.appendChild(themeSwitcher.getElement());
  }
}
