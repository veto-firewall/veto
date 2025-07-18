/**
 * License validation service
 * Manages license key validation for premium features
 */
import { getSettings } from '../storage/StorageService';
import type { Settings } from '../types/settingsTypes';

/**
 * Check if a valid license key is provided
 * @returns Promise resolving to true if license is valid
 */
export async function hasValidLicense(): Promise<boolean> {
  try {
    const settings = await getSettings<Settings>();

    if (!settings?.maxmind?.licenseKey) {
      return false;
    }

    const licenseKey = settings.maxmind.licenseKey.trim();

    // Basic validation: license key should be non-empty and have reasonable length
    // MaxMind license keys are typically 16 characters long
    if (licenseKey.length < 10) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to check license validity:', error);
    return false;
  }
}

/**
 * Check if network filtering features are available
 * @returns Promise resolving to true if network features are available
 */
export async function isNetworkFilteringAvailable(): Promise<boolean> {
  return hasValidLicense();
}

/**
 * Check if location filtering features are available
 * @returns Promise resolving to true if location features are available
 */
export async function isLocationFilteringAvailable(): Promise<boolean> {
  return hasValidLicense();
}
