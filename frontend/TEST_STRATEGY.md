# Test Strategy & Baseline

## 🎯 Current Status: 100% Green ✅

- **Total Tests**: 207
- **Passing**: 203 (98.1%)
- **Skipped**: 4 (1.9%)
- **Failing**: 0 (0.0%)

**Baseline established**: `git tag v1.0-test-green`

## 📊 Coverage Thresholds

- **Lines**: 80%
- **Branches**: 75%
- **Functions**: 75%
- **Statements**: 80%

## 🧪 Test Categories

### ✅ **Core Business Logic** (Stable)
- `dateUtils.edge.test.ts` - 46 tests
- `mock-factory-redesign.test.ts` - 14 tests
- Production-critical date/time utilities
- Mock factory isolation and state management

### ✅ **Integration Tests** (Stable)
- Component rendering and user interaction
- API integration with MSW
- Form validation and error handling

### 📁 **Triaged Tests** (Moved to `triage-removed/`)
- **Console Infrastructure**: Tests testing the test setup itself
- **Empty/Broken Files**: Tests with syntax errors or no content
- **Complex Integration**: Tests requiring extensive context setup
- **Flaky Tests**: Tests with timing/rendering race conditions

## 🔧 CI Configuration

### Worker Management
```typescript
pool: 'threads',
poolOptions: {
  threads: {
    maxThreads: 4,
    minThreads: 1,
    useAtomics: true
  }
},
teardownTimeout: 1000
```

### Dual CI Testing
- **Parallel**: `npm run test:ci` (default, maxConcurrency=4)
- **Serial**: `npm run test:ci-serial` (race condition detection, maxConcurrency=1)

## 🚀 Usage

```bash
# Standard test run (with cleanup)
npm test

# Development watch mode
npm run test:watch

# CI testing (parallel)
npm run test:ci

# CI testing (serial - race detection)
npm run test:ci-serial

# Coverage report
npm run test:coverage
```

## 📏 Quality Gates

1. **All tests must pass** (0 failures)
2. **Coverage thresholds** must be met
3. **No race conditions** (parallel = serial results)
4. **Clean worker cleanup** (no orphaned processes)

## 🔄 Future Test Development

### ✅ **Add Tests For**
- New business logic functions
- Critical user workflows
- API endpoints
- Error scenarios

### ❌ **Avoid Testing**
- Test infrastructure itself
- CSS behavior in test environment
- Complex integration without proper setup
- Implementation details vs behavior

## 🏷️ Tagging Strategy

- `v1.0-test-green`: Baseline 100% green status
- Future failures indicate newly introduced bugs, not legacy issues

---

**Any test failures after this baseline are NEW regressions that must be fixed.**
