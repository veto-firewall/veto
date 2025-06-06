/**
 * Background script for the Veto extension
 * Main entry point that initializes the extension using the service architecture
 */
import { ServiceFactory } from '../services/ServiceFactory';

/**
 * Export the service factory for use by other modules
 * This allows other parts of the extension to access services without having to recreate them
 */
export const serviceFactory = ServiceFactory.getInstance();

/**
 * Initialize the extension
 * Creates and initializes all services needed by the extension
 * @returns Promise that resolves when initialization is complete
 */
async function initExtension(): Promise<void> {
  // Initialize all services
  const serviceFactory = ServiceFactory.getInstance();
  await serviceFactory.initializeAllServices();
}

// Start initialization
void initExtension();
