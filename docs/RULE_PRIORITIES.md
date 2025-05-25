# VETO Rule Priority System

This document explains the rule priority architecture in VETO, the analysis of proposed priority orders, and the solutions implemented to handle rule interactions effectively.

## Table of Contents

- [Overview](#overview)
- [Current Architecture](#current-architecture)
- [The Terminating Rule Issue](#the-terminating-rule-issue)
- [Solution Implementation](#solution-implementation)
- [Priority Analysis](#priority-analysis)
- [Performance Optimizations](#performance-optimizations)
- [Technical Details](#technical-details)

## Overview

VETO uses a sophisticated two-tier filtering system that combines Mozilla's Declarative Net Request (DNR) API with custom web request filtering. This hybrid approach provides both performance and flexibility while maintaining browser compatibility.

The system processes different rule types with carefully designed priorities to ensure proper behavior and optimal performance.

## Current Architecture

### Two-Tier System

1. **Tier 1: Declarative Net Request (DNR) Rules**
   - Tracking parameter removal rules (priority 60)
   - Domain allow/block rules (priority 50/10)
   - URL allow/block rules (priority 50/10)
   - Regex allow/block rules (priority 50/10)
   - Processed by browser engine (very fast)

2. **Tier 2: Web Request Rules**
   - IP filtering (CIDR, ranges, individual IPs)
   - ASN (Autonomous System Number) filtering
   - GeoIP filtering (country-based)
   - Processed by extension JavaScript (slower but flexible)

### Processing Flow

```
Request → DNR Processing → Web Request Processing → Final Decision
```

### Rule Design

1. **Use DNR for Simple Rules**: Domain, URL, and regex patterns
2. **Use Web Requests for Complex Logic**: IP ranges, ASN lookups, GeoIP
3. **Prefer Allow Rules**: Use allow rules rather than complex block exceptions
4. **Enable Terminating**: Set `terminating: true` for rules that should override subsequent filtering

### Performance Considerations

1. **Minimize Web Request Rules**: They're slower than DNR rules
2. **Use Specific Domains**: More specific rules are faster to match
3. **Batch Rule Updates**: Update multiple rules together to reduce overhead
4. **Monitor Rule Counts**: Stay within browser DNR limits

## Conclusion

The current two-tier architecture with priority optimizations provides an effective balance of performance, functionality, and maintainability. The terminating rule bridge ensures proper interaction between DNR and web request rules, while the priority system ensures optimal processing order.

This approach is superior to complex multi-tier priority systems because it:
- Leverages browser engine performance for simple rules
- Maintains flexibility for complex filtering logic
- Provides clear, debuggable behavior
- Scales well with large rule sets
- Works within browser API constraints

The implemented solution resolves the original issue where terminating domain allow rules weren't properly overriding GeoIP blocking, while maintaining the system's performance and architectural benefits.
