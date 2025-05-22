import { Settings } from './types';

const DEFAULT_SETTINGS: Settings = {
  suspendUntilFiltersLoad: false,
  maxmind: {
    licenseKey: '',
  },
  httpHandling: 'redirect',
  blockRemoteFonts: false,
  blockImages: false,
  blockMedia: false,
  blockPrivateIPs: false,
  sectionStates: {
    'settings-section': true,
    'basic-rules-section': false,
    'dnr-rules-section': false,
    'ip-rules-section': false,
    'asn-rules-section': false,
    'geoip-section': false,
  },
};

export async function getSettings(): Promise<Settings> {
  try {
    const result = await browser.storage.local.get('settings');
    return result.settings || DEFAULT_SETTINGS;
  } catch (error) {
    void error;
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<boolean> {
  try {
    await browser.storage.local.set({ settings });
    return true;
  } catch (error) {
    void error;
    return false;
  }
}
