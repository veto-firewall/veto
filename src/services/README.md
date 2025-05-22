# Service Architecture

This directory contains service modules that form the core architecture of the Veto extension. The service-based approach provides:

1. **Clear Separation of Concerns** - Each service has a distinct responsibility
2. **Dependency Injection** - Services are injected where needed rather than imported directly
3. **Improved Testability** - Modular design makes unit testing easier
4. **Centralized State Management** - Services maintain state and handle operations on that state

## Service Overview

### ServiceFactory

`ServiceFactory` is the central point for accessing all services. It handles lazy initialization and dependency management.

### StorageService

Responsible for all browser storage operations:
- Reading and writing settings
- Managing rule storage
- Providing a consistent interface to browser.storage APIs

### RuleService

Handles rule management and processing:
- Rule creation and validation
- Rule parsing from text
- Rule exporting to text
- Rule processing logic

### NetworkService

Manages network-related operations:
- DNS resolution
- IP address validation and classification
- Private IP detection

### MaxMindService

Handles GeoIP and ASN database operations:
- Database downloading and updating
- Database loading
- Country and ASN lookups

### EventService

Coordinates browser events and message handling:
- Processes web request interception
- Handles extension message passing
- Manages caching

## Processors

Rule processors handle specific types of rules:
- `BaseRuleProcessor` - Abstract base class with common functionality
- `IpRuleProcessor` - Processes IP-based rules
- `AsnRuleProcessor` - Processes ASN-based rules
- `GeoIpRuleProcessor` - Processes GeoIP-based rules

## Usage

Services should be accessed through the ServiceFactory:

```typescript
import { ServiceFactory } from '../services';

// Get a service instance
const storageService = ServiceFactory.getInstance().getStorageService();
const ruleService = ServiceFactory.getInstance().getRuleService();

// Use the service
await storageService.getSettings();
await ruleService.getRules();
```

In the background script, the factory is exported for convenience:

```typescript
import { serviceFactory } from '../background';

// Get a service instance
const storageService = serviceFactory.getStorageService();
```
