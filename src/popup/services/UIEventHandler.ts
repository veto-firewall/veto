import type { Settings, RuleSet } from '../../services/types';
import { Toast } from '../components/Toast';

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
export function setupUIEvents(
  settings: Settings,
  rules: RuleSet,
  saveSettings: () => Promise<void>,
  saveRules: () => Promise<void>,
): void {
  // Settings section events
  setupSettingsEvents(settings, saveSettings);

  // Rule saving events
  setupRuleSaveEvents(saveRules);

  // Export events
  setupExportEvents();
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
