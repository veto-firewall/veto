/**
 * ServiceFactory provides centralized access to all services
 * Creates and initializes services with proper dependencies
 */
import { IService } from './types';
import { StorageService } from './storage';
import { RuleService } from './rule';
import { NetworkService } from './network';
import { MaxMindService } from './maxmind';
import { EventService } from './events';
import { CacheService } from './cache';
import { LoggingService } from './logging';
import { DeclarativeRuleService } from './declarative-rules';

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
   * Get or create a storage service
   * @returns Storage service instance
   */
  public getStorageService(): StorageService {
    const key = 'storage';

    if (!this.services.has(key)) {
      const service = new StorageService();
      this.services.set(key, service);

      // Auto-initialize
      if (document.readyState === 'complete') {
        service
          .initialize()
          .catch(err => console.error('Failed to initialize StorageService:', err));
      } else {
        window.addEventListener('load', () => {
          service
            .initialize()
            .catch(err => console.error('Failed to initialize StorageService:', err));
        });
      }
    }

    return this.services.get(key) as StorageService;
  }

  /**
   * Get or create a rule service
   * @returns Rule service instance
   */
  public getRuleService(): RuleService {
    const key = 'rule';

    if (!this.services.has(key)) {
      const storageService = this.getStorageService();
      const service = new RuleService(storageService);
      this.services.set(key, service);

      // Auto-initialize
      if (document.readyState === 'complete') {
        service.initialize().catch(err => console.error('Failed to initialize RuleService:', err));
      } else {
        window.addEventListener('load', () => {
          service
            .initialize()
            .catch(err => console.error('Failed to initialize RuleService:', err));
        });
      }
    }

    return this.services.get(key) as RuleService;
  }

  /**
   * Get or create a network service
   * @returns Network service instance
   */
  public getNetworkService(): NetworkService {
    const key = 'network';

    if (!this.services.has(key)) {
      const service = new NetworkService();
      this.services.set(key, service);

      // Auto-initialize
      if (document.readyState === 'complete') {
        service
          .initialize()
          .catch(err => console.error('Failed to initialize NetworkService:', err));
      } else {
        window.addEventListener('load', () => {
          service
            .initialize()
            .catch(err => console.error('Failed to initialize NetworkService:', err));
        });
      }
    }

    return this.services.get(key) as NetworkService;
  }

  /**
   * Get or create a MaxMind service
   * @returns MaxMind service instance
   */
  public getMaxMindService(): MaxMindService {
    const key = 'maxmind';

    if (!this.services.has(key)) {
      const storageService = this.getStorageService();
      const service = new MaxMindService(storageService);
      this.services.set(key, service);

      // Auto-initialize
      if (document.readyState === 'complete') {
        service
          .initialize()
          .catch(err => console.error('Failed to initialize MaxMindService:', err));
      } else {
        window.addEventListener('load', () => {
          service
            .initialize()
            .catch(err => console.error('Failed to initialize MaxMindService:', err));
        });
      }
    }

    return this.services.get(key) as MaxMindService;
  }

  /**
   * Get or create an event service
   * @returns Event service instance
   */
  public getEventService(): EventService {
    const key = 'event';

    if (!this.services.has(key)) {
      const service = new EventService();

      this.services.set(key, service);

      // Auto-initialize
      if (document.readyState === 'complete') {
        service.initialize().catch(err => console.error('Failed to initialize EventService:', err));
      } else {
        window.addEventListener('load', () => {
          service
            .initialize()
            .catch(err => console.error('Failed to initialize EventService:', err));
        });
      }
    }

    return this.services.get(key) as EventService;
  }

  /**
   * Get or create a cache service
   * @returns Cache service instance
   */
  public getCacheService(): CacheService {
    const key = 'cache';

    if (!this.services.has(key)) {
      const service = new CacheService();

      this.services.set(key, service);

      // Auto-initialize
      if (document.readyState === 'complete') {
        service.initialize().catch(err => console.error('Failed to initialize CacheService:', err));
      } else {
        window.addEventListener('load', () => {
          service
            .initialize()
            .catch(err => console.error('Failed to initialize CacheService:', err));
        });
      }
    }

    return this.services.get(key) as CacheService;
  }

  /**
   * Get or create a logging service
   * @returns Logging service instance
   */
  public getLoggingService(): LoggingService {
    const key = 'logging';

    if (!this.services.has(key)) {
      const service = new LoggingService();

      this.services.set(key, service);

      // Auto-initialize
      if (document.readyState === 'complete') {
        service
          .initialize()
          .catch(err => console.error('Failed to initialize LoggingService:', err));
      } else {
        window.addEventListener('load', () => {
          service
            .initialize()
            .catch(err => console.error('Failed to initialize LoggingService:', err));
        });
      }
    }

    return this.services.get(key) as LoggingService;
  }

  /**
   * Get or create a declarative rule service
   * @returns Declarative rule service instance
   */
  public getDeclarativeRuleService(): DeclarativeRuleService {
    const key = 'declarativeRule';

    if (!this.services.has(key)) {
      const storageService = this.getStorageService();
      const service = new DeclarativeRuleService(storageService);

      this.services.set(key, service);

      // Auto-initialize
      if (document.readyState === 'complete') {
        service
          .initialize()
          .catch(err => console.error('Failed to initialize DeclarativeRuleService:', err));
      } else {
        window.addEventListener('load', () => {
          service
            .initialize()
            .catch(err => console.error('Failed to initialize DeclarativeRuleService:', err));
        });
      }
    }

    return this.services.get(key) as DeclarativeRuleService;
  }

  /**
   * Initialize all services
   * @returns Promise that resolves when all services are initialized
   */
  public async initializeAllServices(): Promise<void> {
    // Create all services to ensure they are registered
    this.getStorageService();
    this.getRuleService();
    this.getNetworkService();
    this.getMaxMindService();
    this.getEventService();
    this.getCacheService();
    this.getLoggingService();
    this.getDeclarativeRuleService();

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
