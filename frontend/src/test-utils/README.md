# Test Utilities

This directory contains shared testing utilities to improve test consistency and reduce code duplication across the project.

## AsyncEvent Helper (`asyncEvent.ts`)

### Overview

The AsyncEvent helper provides a standardized way to wrap `fireEvent` calls in React's `act()` utility, preventing React act() warnings and ensuring consistent async handling across tests.

### Problem Solved

Before this helper, tests needed manual `act()` wrapping which was:
- **Verbose**: Required multiple lines for simple fireEvent calls
- **Inconsistent**: Easy to forget act() wrapping, leading to warnings
- **Repetitive**: Same pattern repeated across many test files

### Usage

#### Basic Pattern

```typescript
// ❌ Old way: Manual act() wrapping
await act(async () => {
  fireEvent.click(button);
});

// ✅ New way: Clean asyncEvent helper
await asyncEvent(() => fireEvent.click(button));
```

#### Convenience Methods

```typescript
// Click helper
await asyncClick(button);

// Change helper
await asyncChange(input, 'new value');

// Semantic alias for clarity
await wrapUserAction(() => fireEvent.focus(element));
```

#### Multiple Events

```typescript
// Multiple fireEvent calls in single wrapper
await asyncEvent(() => {
  fireEvent.change(input, { target: { value: 'test' } });
  fireEvent.click(button);
  fireEvent.blur(input);
});
```

### API Reference

#### `asyncEvent(fn: () => void | Promise<void>): Promise<void>`

Main helper function that wraps any callback in `act()`.

**Parameters:**
- `fn` - Callback function containing fireEvent calls

**Returns:** Promise that resolves when act-wrapped function completes

#### `asyncClick(element: Element): Promise<void>`

Convenience wrapper for `fireEvent.click()` operations.

#### `asyncChange(element: Element, value: string): Promise<void>`

Convenience wrapper for `fireEvent.change()` operations.

#### `wrapUserAction(fn: () => void | Promise<void>): Promise<void>`

Semantic alias for `asyncEvent()` - use when the name better represents the test intent.

### Implementation Details

- ✅ Eliminates React act() warnings
- ✅ Handles both sync and async callback functions
- ✅ Compatible with all fireEvent methods
- ✅ Zero dependencies beyond @testing-library/react
- ✅ TypeScript support with full type safety

### Migration Guide

#### Finding Manual act() Usage

Search for patterns like:
```typescript
await act(async () => {
  fireEvent.*
});
```

#### Replace With AsyncEvent

```typescript
// Before
await act(async () => {
  fireEvent.change(input, { target: { value: 'test' } });
});

// After
await asyncEvent(() => fireEvent.change(input, { target: { value: 'test' } }));

// Or use convenience method
await asyncChange(input, 'test');
```

### Best Practices

1. **Import directly in test files** (not as globals)
2. **Use convenience methods** when available for cleaner code
3. **Group related fireEvents** in single asyncEvent call when logical
4. **Use wrapUserAction** for semantic clarity when appropriate

### Examples

See demonstration tests in:
- `src/tests/asyncEvent.demo.test.tsx` - Complete usage examples
- `src/tests/act-warnings-clean.test.tsx` - Before/after comparisons

### ESLint Configuration

The helper utility disables testing-library eslint rules that conflict with fireEvent usage in demonstrations:

```typescript
/* eslint-disable testing-library/prefer-user-event */
```

This is intentional since the helper is specifically designed to improve fireEvent usage patterns while maintaining compatibility.
