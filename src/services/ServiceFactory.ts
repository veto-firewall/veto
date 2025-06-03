/**
 * ServiceFactory provides centralized access to remaining class-based services
 * Creates and initializes services with proper dependencies
 */
import { IService } from './types';
import { MaxMindService } from './maxmind';

/**
 * Factory for creating and initializing services
 */
export class ServiceFactory {
  /**
   * Singleton instance of the factory
   */
  private static instance: ServiceFactory;

  /**
   * Map of service instances
   */
  private services: Map<string, IService> = new Map();

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Get the singleton instance of the factory
   * @returns The factory instance
   */
  public static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  /**
   * Get or create a MaxMind service
   * @returns MaxMind service instance
   */
  public getMaxMindService(): MaxMindService {
    const key = 'maxmind';

    if (!this.services.has(key)) {
      const service = new MaxMindService();
      this.services.set(key, service);

      // Auto-initialize
      if (document.readyState === 'complete') {
        service
          .initialize()
          .catch((err: unknown) => console.error('Failed to initialize MaxMindService:', err));
      } else {
        window.addEventListener('load', () => {
          service
            .initialize()
            .catch((err: unknown) => console.error('Failed to initialize MaxMindService:', err));
        });
      }
    }

    return this.services.get(key) as MaxMindService;
  }

  /**
   * Initialize all services
   * @returns Promise that resolves when all services are initialized
   */
  public async initializeAllServices(): Promise<void> {
    // Create MaxMind service to ensure it is registered
    this.getMaxMindService();

    // Initialize all services in proper order
    const initPromises = Array.from(this.services.values()).map(service => service.initialize());
    await Promise.all(initPromises);
  }

  /**
   * Refresh MaxMind-related services after configuration changes
   * This ensures that rule processors get updated service instances with new configuration
   * @returns Promise that resolves when refresh is complete
   */
  public async refreshMaxMindServices(): Promise<boolean> {
    try {
      // Delegate to MaxMind service's own refresh method
      const maxMindService = this.getMaxMindService();
      return await maxMindService.refreshService();
    } catch (error) {
      console.error('Error during MaxMind services refresh:', error);
      return false;
    }
  }
}
