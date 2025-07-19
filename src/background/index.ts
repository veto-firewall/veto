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
    console.log('Background: Initialization already in progress, skipping...');
    return;
  }

  if (isInitialized && !needsReinitialization()) {
    console.log('Background: Extension already initialized and recent, skipping...');
    return;
  }

  isInitializing = true;
  console.log('Background: Starting Veto extension initialization...');

  try {
    // Initialize basic services first (these should be fast and reliable)
    console.log('Background: Initializing logging service...');
    await initializeLogging();
    console.log('Background: Logging service initialized');

    console.log('Background: Initializing declarative rule service...');
    await initializeDeclarativeRule();
    console.log('Background: Declarative rule service initialized');

    // Initialize EventService (this handles more complex initialization including setupRules)
    console.log('Background: Initializing event service...');
    await initializeEvent();
    console.log('Background: Event service initialized');

    isInitialized = true;
    lastActivityTime = Date.now();
    console.log('Background: Veto extension initialized successfully');
  } catch (error) {
    console.error('Background: Failed to initialize Veto extension:', error);

    // Try to at least initialize basic event handling
    try {
      console.log('Background: Attempting fallback initialization...');
      await initializeEvent();
      console.log('Background: Fallback event service initialized');
      isInitialized = true;
      lastActivityTime = Date.now();
    } catch (fallbackError) {
      console.error('Background: Critical - even fallback initialization failed:', fallbackError);
      // Reset state so we can try again
      isInitialized = false;
    }
  } finally {
    isInitializing = false;
  }
} // Firefox MV3 specific initialization
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

// onConnect can be used to detect when popup connects
browser.runtime.onConnect.addListener(port => {
  console.log('Background: Port connected:', port.name);
  lastActivityTime = Date.now();

  // Check if we need to reinitialize
  if (needsReinitialization()) {
    console.log('Background: Extension needs reinitialization due to port connection');
    void initExtension();
  }
});

// Improved message listener with better ping handling
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  lastActivityTime = Date.now();

  // Type guard for message
  if (!message || typeof message !== 'object' || !('type' in message)) {
    return false;
  }

  const typedMessage = message as { type: string };

  // Handle ping messages specially to ensure responsiveness
  if (typedMessage.type === 'ping') {
    if (needsReinitialization()) {
      console.log('Background: Ping received, extension needs reinitialization');
      void initExtension()
        .then(() => {
          sendResponse({ success: true, timestamp: Date.now(), reinitialized: true });
        })
        .catch(error => {
          console.error('Background: Reinitialization failed:', error);
          sendResponse({ success: false, error: String(error) });
        });
      return true; // Keep the message channel open for async response
    } else {
      // Already initialized, respond immediately
      sendResponse({ success: true, timestamp: Date.now(), reinitialized: false });
      return false;
    }
  }

  // For other messages, ensure we're initialized
  if (needsReinitialization()) {
    console.log(
      'Background: Message received but extension not initialized, initializing first...',
    );
    void initExtension();
  }

  // Let EventService handle the message
  return false;
});

// Initial load initialization - start immediately when script loads
console.log('Background: Background script loaded, starting initial initialization...');
void initExtension();
