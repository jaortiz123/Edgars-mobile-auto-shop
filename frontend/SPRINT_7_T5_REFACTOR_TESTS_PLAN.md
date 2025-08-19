# Sprint 7 Task 5 (T5): Refactor Tests for Clean Component Isolation

## Objective
Refactor existing tests to use the new Mock Factory System for improved:
- **Component isolation**: Clean separation between components and dependencies
- **Test reliability**: Consistent mock behavior across test runs
- **Maintainability**: Centralized mock configuration and reusable test utilities
- **Performance**: Optimized mock setup and teardown

## Refactoring Strategy

### 1. **API Mock Integration**
**Target Files**:
- `services.crud.test.tsx` - Currently uses manual `vi.mock` for API calls
- `MessageThread.test.tsx` - Ad-hoc API mocking
- `appointments.optimisticMove.test.tsx` - Basic API mocking
- `CustomerHistory.test.tsx` - Manual API mocking

**Improvements**:
- Replace manual `vi.mock('@/lib/api')` with `mockFactory.api`
- Use API mock factory's network simulation features
- Add realistic response timing and failure scenarios
- Implement consistent error handling patterns

### 2. **Time-Dependent Test Enhancement**
**Target Files**:
- `sprint3c-simple.test.tsx` - Basic time calculations
- Tests using `Date.now()` or time-sensitive logic

**Improvements**:
- Use `mockFactory.time` for deterministic time testing
- Add time progression scenarios
- Test countdown and status changes over time
- Implement timezone-aware testing

### 3. **Component Test Isolation**
**Target Files**:
- `components/__tests__/Button.test.tsx`
- `components/__tests__/ServiceCard.test.tsx`
- `components/__tests__/ServiceList.test.tsx`

**Improvements**:
- Use browser API mocks for intersection/resize observers
- Add performance monitoring integration
- Implement accessibility testing utilities
- Create reusable component test scenarios

### 4. **Integration Test Enhancement**
**Target Files**:
- `dashboardStats.v2.test.tsx` - Dashboard component testing
- `services/__tests__/api.integration.test.ts` - API integration

**Improvements**:
- Use mock factory for end-to-end scenarios
- Add realistic data flow testing
- Implement offline/network failure testing
- Performance measurement integration

## Implementation Plan

### Phase 1: Core API Mock Refactoring
1. Refactor `services.crud.test.tsx` to use `mockFactory.api`
2. Enhance `MessageThread.test.tsx` with mock factory patterns
3. Improve `appointments.optimisticMove.test.tsx` with network simulation

### Phase 2: Time-Dependent Test Enhancement
1. Refactor `sprint3c-simple.test.tsx` to use `mockFactory.time`
2. Add new time progression test scenarios
3. Create appointment lifecycle testing utilities

### Phase 3: Component Test Standardization
1. Enhance component tests with browser API mocks
2. Add performance monitoring integration
3. Create reusable component testing utilities

### Phase 4: Advanced Integration Scenarios
1. Create comprehensive dashboard testing scenarios
2. Add offline/failure testing patterns
3. Implement accessibility-focused test utilities

## Success Metrics
- **Maintain 100% test pass rate** throughout refactoring
- **Reduce test setup code** by 50% through reusable mock utilities
- **Improve test reliability** with deterministic mock behavior
- **Add 20+ new test scenarios** demonstrating mock factory capabilities
- **Standardize mock patterns** across all test files

## Expected Benefits
- **Faster test execution** through optimized mock setup
- **More reliable tests** with consistent mock behavior
- **Easier test maintenance** through centralized mock configuration
- **Better test coverage** with realistic scenario testing
- **Improved developer experience** with standardized testing patterns
