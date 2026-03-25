# TEMP Backlog: Modernization, Security, Performance, and Bug Fixes

## Purpose
This document is the working source of truth for implementation planning and execution.
It is intentionally lightweight (no issue tracker overhead) and optimized for iterative AI-assisted delivery.

---

## Priority Backlog (Implementation Order)

### [DONE] P0-1 — Runtime schema validation for storage models (Native)
**Goal:** Ensure persisted `settings` and `rules` are always valid/versionable, and replace `validator` dependency usage with native validation boundaries where applicable.

**Why:** Current storage reads trust shape too much and can lead to hidden runtime errors.

**Scope:**
- Add schema definitions for storage payloads.
- Parse storage payloads at read boundaries.
- Normalize data to current format via schema transforms.
- Reject invalid payloads with explicit errors.

**Acceptance criteria:**
- Invalid storage payloads never propagate into runtime state.
- Default/normalized values are applied deterministically.
- Implemented using native normalization/type-guard boundaries in `StorageService`.

---

### P0-2 — Replace `countries-list` with MMDB-derived country/continent data model
**Goal:** Remove redundant dependency and use a single authoritative geo data source.

**Why:** The extension already relies on MaxMind DBs; country/continent metadata should come from that pipeline.

**Scope:**
- Build country/continent model from MMDB-compatible source used in extension flow.
- Use this model in popup GeoIP UI.
- Keep no legacy path for `countries-list`.

**Acceptance criteria:**
- GeoIP UI renders without `countries-list`.
- Country/continent selection behavior remains unchanged for users.

---

### P0-3 — Message contract hardening between popup and background
**Goal:** Eliminate payload drift with validated message schemas.

**Why:** A known message field mismatch currently exists and can silently fail.

**Scope:**
- Introduce typed message schema map.
- Validate every inbound message in background before dispatch.
- Standardize response envelope for popup-facing APIs.

**Acceptance criteria:**
- Contract mismatch class of bugs is prevented.
- Invalid payloads return deterministic structured errors.

---

### P0-4 — Fix `getRuleLimit` response protocol mismatch
**Goal:** Ensure popup gets reliable rule-limit data.

**Scope:**
- Standardize `getRuleLimit` response shape.
- Update popup consumer accordingly.

**Acceptance criteria:**
- Rule limit display is correct and stable.

---

### P0-5 — Make event listener registration idempotent
**Goal:** Prevent duplicate listener registration and side effects.

**Scope:**
- Convert listeners to named handlers.
- Ensure add/remove flow is idempotent for all registered listeners.

**Acceptance criteria:**
- Re-register operations keep exactly one active handler per event.

---

### P0-6 — Fix processor lifecycle/cache design bug
**Goal:** Remove timestamp-keyed pseudo-cache behavior.

**Scope:**
- Replace timestamp-based processor keying with deterministic lifecycle.
- Ensure processors are reused safely or recreated intentionally.

**Acceptance criteria:**
- No unbounded map growth from processor instances.

---

### [DONE] P1-7 — Fix storage falsy-value handling
**Goal:** Preserve valid falsy values (`false`, `0`, `''`) from storage.

**Scope:**
- Replace truthy/falsy coercion patterns with explicit null/undefined checks.

**Acceptance criteria:**
- Falsy values round-trip correctly through storage layer.

---

### P1-8 — Harden MaxMind download/update pipeline
**Goal:** Improve robustness and failure behavior for DB refresh.

**Scope:**
- Add request timeout and bounded retries.
- Enforce safe write behavior (no partial corrupt state commits).
- Improve failure telemetry in extension state.

**Acceptance criteria:**
- DB refresh failures are recoverable and observable.

---

### P2-9 — Move more request handling to native DNR
**Goal:** Reduce JS hot-path request handling where native rule engine can do the same.

**Scope:**
- Audit current webRequest path.
- Move representable logic to DNR.
- Keep JS only for logic that cannot be represented declaratively.

**Acceptance criteria:**
- Fewer request-time JS decisions with no behavior regression.

---

### P2-10 — Stabilize command flow for quality checks
**Goal:** Ensure checks are deterministic from clean state.

**Scope:**
- Ensure required build artifacts are available before running E2E checks.
- Eliminate accidental focus-only execution modes in checks.

**Acceptance criteria:**
- Reproducible check flow for local and CI execution.

---

### P2-11 — Permission minimization and capability mapping
**Goal:** Explicitly map each permission to user-visible functionality.

**Scope:**
- Build permission-to-feature matrix.
- Remove unnecessary permissions if identified.

**Acceptance criteria:**
- Every permission has documented purpose and active usage.

---

## AI Agent Instructions (Codex-focused)

### Core behavior
1. Read relevant modules end-to-end before patching.
2. Prefer minimal, high-confidence diffs.
3. Keep logic centralized; avoid duplicated code paths.
4. Use browser-native APIs first, then dependency, then custom implementation.
5. Remove obsolete code when replacing behavior; do not keep dead compatibility layers.
6. After each change, do a self-review pass for simplification and consistency.
7. After implementation of a backlog step, mark it as `[DONE]` in this document.
8. Perform `npm run fix` and `npm run web-ext:lint`, resolve all warnings, then commit and create a pull request.

### Implementation constraints
1. Preserve existing user-visible behavior unless change explicitly requires behavior update.
2. Make one logical change per commit.
3. Keep naming consistent with existing domain terms.
4. Avoid introducing new dependencies unless they are mainstream, maintained, and justified.
5. Prefer explicit types and schema boundaries over implicit assumptions.

### Quality bar
1. Validate all extension message payload boundaries.
2. Validate all storage load boundaries.
3. Keep request-time logic lean; avoid expensive operations in hot paths.
4. Ensure listener registration is idempotent.
5. Ensure failure paths are explicit and non-silent.

### Decision framework (native-first)
When choosing an approach, use this order:
1. Firefox built-in API capability
2. Existing project module/service
3. Well-known maintained dependency
4. New custom implementation (last resort)

---

## Team Rules
- Thoroughly study code and requirements before changes.
- Provide critical expert feedback.
- Maintain clean/simple/efficient code.
- Avoid redundancy and overengineering.
- Prefer native/built-in capabilities.
- Follow modern best practices.
- Review and refine after each implementation.
- Keep codebase modern and maintainable.
- Don't write tests, comments, and docs.
