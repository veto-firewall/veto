/**
 * Background script for the Veto extension
 * Main entry point that initializes the extension using the service architecture
 */

// Import function-based services that need initialization
import { initialize as initializeEvent } from '../services/events/EventService';
import { initialize as initializeLogging } from '../services/logging/LoggingService';
import { initialize as initializeDeclarativeRule } from '../services/declarative-rules/DeclarativeRuleService';

/**
 * Track initialization state to prevent concurrent initializations
 */
let isInitializing = false;
let isInitialized = false;

/**
 * Track when the background script was last active
 */
let lastActivityTime = Date.now();

/**
 * Check if the background script needs to be reinitialized
 * @returns true if reinitialization is needed
 */
function needsReinitialization(): boolean {
  // If not initialized or it's been more than 5 minutes since last activity
  const fiveMinutes = 5 * 60 * 1000;
  const timeSinceLastActivity = Date.now() - lastActivityTime;

  return !isInitialized || timeSinceLastActivity > fiveMinutes;
}

/**
 * Initialize the extension
 * Creates and initializes all services needed by the extension
 * @returns Promise that resolves when initialization is complete
 */
async function initExtension(): Promise<void> {
  // Update activity time
  lastActivityTime = Date.now();

  // Prevent concurrent initializations
  if (isInitializing) {
    console.log('Initialization already in progress, skipping...');
    return;
  }

  if (isInitialized && !needsReinitialization()) {
    console.log('Extension already initialized and recent, skipping...');
    return;
  }

  isInitializing = true;
  console.log('Starting Veto extension initialization...');

  try {
    // Initialize basic services first (these should be fast and reliable)
    await initializeLogging();
    console.log('Logging service initialized');

    await initializeDeclarativeRule();
    console.log('Declarative rule service initialized');

    // Initialize EventService (this handles more complex initialization)
    await initializeEvent();
    console.log('Event service initialized');

    isInitialized = true;
    lastActivityTime = Date.now();
    console.log('Veto extension initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Veto extension:', error);

    // Try to at least initialize basic event handling
    try {
      await initializeEvent();
      console.log('Fallback: Basic event service initialized');
      isInitialized = true;
      lastActivityTime = Date.now();
    } catch (fallbackError) {
      console.error('Critical: Even fallback initialization failed:', fallbackError);
      // Reset state so we can try again
      isInitialized = false;
    }
  } finally {
    isInitializing = false;
  }
} // Firefox MV3 specific initialization
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

// onConnect can be used to detect when popup connects, but don't reinitialize
browser.runtime.onConnect.addListener(port => {
  console.log('Port connected:', port.name);
  lastActivityTime = Date.now();

  // Check if we need to reinitialize
  if (needsReinitialization()) {
    console.log('Extension needs reinitialization, starting...');
    void initExtension();
  }
});

// Add a message listener to handle reinitialization requests
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  lastActivityTime = Date.now();

  // Type guard for message
  if (!message || typeof message !== 'object' || !('type' in message)) {
    return false;
  }

  const typedMessage = message as { type: string };

  // If this is a ping message and we're not initialized, reinitialize
  if (typedMessage.type === 'ping' && needsReinitialization()) {
    console.log('Ping received, extension needs reinitialization');
    void initExtension()
      .then(() => {
        sendResponse({ success: true, timestamp: Date.now(), reinitialized: true });
      })
      .catch(error => {
        console.error('Reinitialization failed:', error);
        sendResponse({ success: false, error: String(error) });
      });
    return true; // Keep the message channel open for async response
  }

  // For other messages, just update activity time - the EventService will handle them
  return false; // Let other handlers process the message
});

// Initial load initialization
void initExtension();
