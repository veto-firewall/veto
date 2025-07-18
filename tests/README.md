# VETO Extension Testing Setup

## Quick Start Guide

### 1. Install Dependencies
```bash
npm install --save-dev @playwright/test@^1.54.1 @types/node@^24.0.14
npx playwright install firefox
```

### 2. Build Extension for Testing
```bash
npm run build
```

### 3. Load Extension in Firefox
1. Open Firefox
2. Go to `about:debugging`
3. Click "This Firefox"
4. Click "Load Temporary Add-on"
5. Select the `manifest.json` from your `dist/` folder
6. Note the extension ID for test configuration

### 4. Update Test Configuration
Edit `tests/e2e/functional/functional-tests.ts` and replace:
```typescript
// Replace 'moz-extension://test/popup.html' with your actual extension URL
await page.goto('moz-extension://YOUR-EXTENSION-ID/popup.html');
```

### 5. Run Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run with UI (visual test runner)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run only performance tests
npm run test:performance

# Run only functional tests
npm run test:functional
```

## Test Strategy Implementation

### Phase 1: Basic E2E Tests ✅
- [x] Extension loading and popup functionality
- [x] Basic rule processing
- [x] Settings persistence
- [x] Input validation

### Phase 2: Performance Testing ✅
- [x] Initialization time measurement
- [x] Rule scaling performance
- [x] Memory usage monitoring
- [x] Large rule set stress testing

### Phase 3: Next Steps (To Implement)
- [ ] Real-world website testing
- [ ] Network blocking verification
- [ ] Firefox-specific MV3 behavior testing
- [ ] Mobile Firefox testing

## Key Benefits of This Approach

✅ **Clean Setup**: Only Playwright, no questionable dependencies
✅ **Built-in Performance**: Uses browser's native Performance API
✅ **Real Browser Testing**: Tests actual extension behavior
✅ **Latest Versions**: All dependencies are current
✅ **Focused Scope**: E2E first, then expand

## Test Results Dashboard

Tests will generate:
- HTML reports in `test-results/`
- JSON results for CI/CD integration
- Screenshots/videos on failure
- Performance metrics logging

## Browser Support

Currently configured for:
- ✅ Firefox Desktop (latest)
- 🔄 Firefox Mobile (can be added)
- ❌ Chrome (not needed for VETO)

## Performance Benchmarks

Target metrics established:
- Initialization: <2s baseline, <2ms per rule
- Page Load: <5s baseline, <10s with large rulesets
- Memory: <200MB with heavy rule loads
- Stress Test: Handle 2000+ rules without crashing

This gives you a solid foundation to start testing immediately!
