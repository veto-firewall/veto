/**
 * Background script for the Veto extension
 * Main entry point that initializes the extension using the service architecture
 */

// Import function-based services that need initialization
import { initialize as initializeEvent } from '../services/events/EventService';
import { initialize as initializeLogging } from '../services/logging/LoggingService';
import { initialize as initializeDeclarativeRule } from '../services/declarative-rules/DeclarativeRuleService';

/**
 * Initialize the extension
 * Creates and initializes all services needed by the extension
 * @returns Promise that resolves when initialization is complete
 */
async function initExtension(): Promise<void> {
  try {
    // Initialize function-based services
    await Promise.all([initializeLogging(), initializeDeclarativeRule()]);

    // Initialize EventService last since it depends on other services and handles MaxMind
    await initializeEvent();

    console.log('Veto extension initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Veto extension:', error);
  }
}

// Firefox MV3 specific initialization
// onStartup fires when Firefox starts up
browser.runtime.onStartup.addListener(() => {
  console.log('Browser startup detected, initializing Veto...');
  void initExtension();
});

// onInstalled fires when the extension is installed/updated
browser.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated, initializing Veto...');
  void initExtension();
});

browser.runtime.onConnect.addListener(() => {
  console.log('Extension installed/updated, initializing Veto...');
  void initExtension();
});

// Initial load initialization
void initExtension();
