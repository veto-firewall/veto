import type { Settings, RuleSet } from '../../services/types';
import { Toast } from '../components/Toast';
import { isNetworkFilteringAvailable, isLocationFilteringAvailable } from '../../services/maxmind';

// Create toast instance for notifications
const toast = new Toast();

/**
 * Helper function to safely apply loading state to a button
 * @param button The button element to update
 * @param isLoading Whether to show loading state or restore original state
 * @param originalText Original button text to restore when loading is complete
 */
function setButtonLoadingState(
  button: HTMLElement,
  isLoading: boolean,
  originalText?: string,
): void {
  if (isLoading) {
    // Clear any existing content
    button.textContent = '';

    // Create spinner element
    const spinner = document.createElement('span');
    spinner.className = 'spinner';

    // Append spinner and then loading text
    button.appendChild(spinner);
    button.appendChild(document.createTextNode(' Saving...'));

    // Disable the button
    button.setAttribute('disabled', 'true');
  } else {
    // Restore original text and enable button
    button.textContent = originalText || 'Save';
    button.removeAttribute('disabled');
  }
}

/**
 * Sets up all UI event handlers for the popup
 *
 * @param settings - The extension settings object
 * @param rules - The extension rule set
 * @param saveSettings - Function to save settings
 * @param saveRules - Function to save rules
 */
export async function setupUIEvents(
  settings: Settings,
  rules: RuleSet,
  saveSettings: () => Promise<void>,
  saveRules: () => Promise<void>,
): Promise<void> {
  // Settings section events
  setupSettingsEvents(settings, saveSettings);

  // Rule saving events
  setupRuleSaveEvents(saveRules);

  // Export events
  setupExportEvents();

  // Check license and update UI accordingly
  await updateLicenseBasedUI();
}

/**
 * Sets up event handlers for the settings section
 *
 * @param settings - The extension settings object
 * @param saveSettings - Function to save settings
 */
function setupSettingsEvents(settings: Settings, saveSettings: () => Promise<void>): void {
  // MaxMind credentials save
  const saveMaxmindBtn = document.getElementById('save-maxmind') as HTMLElement;
  if (saveMaxmindBtn) {
    saveMaxmindBtn.addEventListener('click', async () => {
      const licenseKeyInput = document.getElementById('license-key') as HTMLInputElement;

      // Show loading state
      setButtonLoadingState(saveMaxmindBtn, true);

      // Update settings with the license key
      settings.maxmind.licenseKey = licenseKeyInput.value.trim();

      try {
        await saveSettings();
        toast.show('License key saved', 'success');

        // Update UI based on new license status
        await updateLicenseBasedUI();
      } catch (error) {
        toast.show('Failed to save license', 'error');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toast.show(`Save failed: ${errorMessage}`, 'error');
      } finally {
        // Reset button
        setButtonLoadingState(saveMaxmindBtn, false);
      }
    });
  }
}

/**
 * Sets up event handlers for rule save buttons
 *
 * @param saveRules - Function to save rules
 */
function setupRuleSaveEvents(saveRules: () => Promise<void>): void {
  // Find all save buttons for rules
  const ruleSaveButtons = document.querySelectorAll('button[id^="save-"]');

  ruleSaveButtons.forEach((button: Element) => {
    if (button.id === 'save-maxmind') {
      return; // Skip non-rule buttons
    }

    button.addEventListener('click', async () => {
      const originalText = button.textContent || 'Save';

      // Show loading state
      setButtonLoadingState(button as HTMLElement, true, originalText);

      try {
        await saveRules();
        toast.show('Rules saved', 'success');
      } catch (error) {
        toast.show('Failed to save', 'error');
        // Use a logger utility instead of console in production
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toast.show(`Save failed: ${errorMessage}`, 'error');
      } finally {
        // Reset button
        setButtonLoadingState(button as HTMLElement, false, originalText);
      }
    });
  });
}

/**
 * Sets up event handlers for export buttons
 */
function setupExportEvents(): void {
  const exportButtons = document.querySelectorAll('button[id^="export-"]');
  exportButtons.forEach((button: Element) => {
    button.addEventListener('click', () => {
      const ruleId = button.id.replace('export-', '');
      toast.show(`Exporting ${ruleId}...`, 'info');
    });
  });
}

/**
 * Updates UI elements based on license status
 * Sets up click handlers to prompt for license when needed
 */
async function updateLicenseBasedUI(): Promise<void> {
  try {
    const networkAvailable = await isNetworkFilteringAvailable();
    const locationAvailable = await isLocationFilteringAvailable();

    // Network Filters Section (ASN rules)
    setupLicenseProtectedSection('asn-rules-section', networkAvailable, 'Network');

    // Location Filters Section (GeoIP section)
    setupLicenseProtectedSection('geoip-section', locationAvailable, 'Location');
  } catch (error) {
    console.error('Failed to update license-based UI:', error);
  }
}

/**
 * Interface for HTML elements with license interceptors
 */
interface ElementWithInterceptor extends HTMLElement {
  _licenseInterceptor?: (_event: Event) => void;
}

/**
 * Sets up license protection for a section
 * @param sectionId - The ID of the section to protect
 * @param isAvailable - Whether the feature is available (license valid)
 * @param featureName - Name of the feature for display
 */
function setupLicenseProtectedSection(
  sectionId: string,
  isAvailable: boolean,
  featureName: string,
): void {
  const section = document.getElementById(sectionId) as ElementWithInterceptor;
  if (!section) return;

  if (!isAvailable) {
    // Add click interceptor for license prompting
    const clickInterceptor = (_event: Event): void => {
      _event.preventDefault();
      _event.stopPropagation();
      promptForLicense(featureName);
    };

    // Add interceptor to the section
    section.addEventListener('click', clickInterceptor, true);

    // Store the interceptor for potential cleanup
    section._licenseInterceptor = clickInterceptor;

    // Add visual indicator that license is required
    section.setAttribute('data-license-required', 'true');
    section.title = `${featureName} filtering requires a MaxMind license key`;
  } else {
    // Remove any existing interceptor
    if (section._licenseInterceptor) {
      section.removeEventListener('click', section._licenseInterceptor, true);
      delete section._licenseInterceptor;
    }

    // Remove visual indicators
    section.removeAttribute('data-license-required');
    section.removeAttribute('title');
  }
}

/**
 * Prompts user for license by opening settings and highlighting license field
 * @param featureName - Name of the feature requiring license
 */
function promptForLicense(featureName: string): void {
  // Open the settings section
  const settingsSection = document.getElementById('settings-section') as HTMLDetailsElement;
  if (settingsSection) {
    settingsSection.open = true;
  }

  // Find and highlight the license key field
  const licenseField = document.getElementById('license-key') as HTMLInputElement;
  if (licenseField) {
    // Scroll to and focus the field
    licenseField.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Add highlighting class
    licenseField.classList.add('license-required-highlight');

    // Remove highlight after a few seconds
    setTimeout(() => {
      licenseField.classList.remove('license-required-highlight');
    }, 3000);

    // Focus with a slight delay to ensure scroll completes
    setTimeout(() => {
      licenseField.focus();
    }, 500);
  }

  // Show the message
  toast.show(`A license key is required to use ${featureName} and Location filters.`, 'info', 5000);
} /**
 * Export the updateLicenseBasedUI function so it can be called from other modules
 */
export { updateLicenseBasedUI };
