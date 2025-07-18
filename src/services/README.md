# Service Architecture

This directory contains service modules that form the core architecture of the Veto extension. The service-based approach provides:

1. **Clear Separation of Concerns** - Each service has a distinct responsibility
2. **Direct Imports** - Services are imported directly where needed for simplicity
3. **Improved Testability** - Modular design makes unit testing easier
4. **Centralized State Management** - Services maintain state and handle operations on that state

## Service Overview

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

Services should be imported directly:

```typescript
import { getSettings, saveSettings } from '../services/storage/StorageService';
import { parseRules, exportRules } from '../services/rule/RuleService';

// Use the services directly
await getSettings();
await parseRules('domain', rulesText, 'block', false);
```
