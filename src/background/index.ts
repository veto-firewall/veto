/**
 * Background script for the Veto extension
 * Main entry point that initializes the extension using the service architecture
 */
import { ServiceFactory } from '../services/ServiceFactory';

// Import function-based services that need initialization
import { initialize as initializeEvent } from '../services/events/EventService';
import { initialize as initializeLogging } from '../services/logging/LoggingService';
import { initialize as initializeDeclarativeRule } from '../services/declarative-rules/DeclarativeRuleService';

/**
 * Export the service factory for use by other modules that still need class-based services
 * This allows other parts of the extension to access remaining class-based services
 */
export const serviceFactory = ServiceFactory.getInstance();

/**
 * Initialize the extension
 * Creates and initializes all services needed by the extension
 * @returns Promise that resolves when initialization is complete
 */
async function initExtension(): Promise<void> {
  try {
    // Initialize function-based services that need explicit initialization
    await Promise.all([
      initializeLogging(),
      initializeDeclarativeRule(),
    ]);

    // Initialize remaining class-based services through ServiceFactory
    const serviceFactory = ServiceFactory.getInstance();
    // Only initialize services that are still class-based
    serviceFactory.getMaxMindService(); // This will auto-initialize
    
    // Initialize EventService last since it depends on other services
    await initializeEvent();

    console.log('Veto extension initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Veto extension:', error);
  }
}

// Start initialization
void initExtension();
