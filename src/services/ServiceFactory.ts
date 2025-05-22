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
  private constructor() { }
  
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
        service.initialize().catch(err => console.error('Failed to initialize StorageService:', err));
      } else {
        window.addEventListener('load', () => {
          service.initialize().catch(err => console.error('Failed to initialize StorageService:', err));
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
          service.initialize().catch(err => console.error('Failed to initialize RuleService:', err));
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
        service.initialize().catch(err => console.error('Failed to initialize NetworkService:', err));
      } else {
        window.addEventListener('load', () => {
          service.initialize().catch(err => console.error('Failed to initialize NetworkService:', err));
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
        service.initialize().catch(err => console.error('Failed to initialize MaxMindService:', err));
      } else {
        window.addEventListener('load', () => {
          service.initialize().catch(err => console.error('Failed to initialize MaxMindService:', err));
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
          service.initialize().catch(err => console.error('Failed to initialize EventService:', err));
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
          service.initialize().catch(err => console.error('Failed to initialize CacheService:', err));
        });
      }
    }
    
    return this.services.get(key) as CacheService;
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
    
    // Initialize all services in proper order
    const initPromises = Array.from(this.services.values()).map(service => service.initialize());
    await Promise.all(initPromises);
  }
}
