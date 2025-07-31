/**
 * Background script for the Veto extension
 * Main entry point that initializes the extension using the service architecture
 */

// Import function-based services that need initialization
import {
  initialize as initializeEvent,
  registerEventListeners,
} from '../services/events/EventService';
import { initialize as initializeLogging } from '../services/logging/LoggingService';
import { initialize as initializeDeclarativeRule } from '../services/declarative-rules/DeclarativeRuleService';

/**
 * Track initialization state
 */
let isInitialized = false;

/**
 * Initialize the extension
 * Creates and initializes all services needed by the extension
 */
async function initExtension(): Promise<void> {
  if (isInitialized) {
    console.log('Background: Extension already initialized, skipping...');
    return;
  }

  console.log('Background: Starting Veto extension initialization...');

  try {
    // Initialize basic services first
    console.log('Background: Initializing logging service...');
    await initializeLogging();

    console.log('Background: Initializing declarative rule service...');
    await initializeDeclarativeRule();

    // Initialize EventService (loads settings, rules, and sets up declarative rules)
    console.log('Background: Initializing event service...');
    await initializeEvent();

    isInitialized = true;
    console.log('Background: Veto extension initialized successfully');
  } catch (error) {
    console.error('Background: Failed to initialize Veto extension:', error);
    // Don't set isInitialized = true on failure so we can retry
  }
} // CRITICAL: Register event listeners IMMEDIATELY and SYNCHRONOUSLY
// This must happen before any async operations to ensure listeners are registered
// when the background script starts, preventing missed events during idle wake-up
console.log('Background: Registering event listeners immediately...');
registerEventListeners();

// Firefox MV3 specific initialization
// onStartup fires when Firefox starts up
browser.runtime.onStartup.addListener(() => {
  console.log('Background: Browser startup detected, initializing Veto...');
  void initExtension();
});

// onInstalled fires when the extension is installed/updated/enabled
browser.runtime.onInstalled.addListener(details => {
  console.log('Background: Extension event:', details.reason, '- initializing Veto...');
  void initExtension();
});

// Initial load initialization - start immediately when script loads
console.log('Background: Background script loaded, starting initial initialization...');
void initExtension();
