# Archived Tests

This directory contains tests that have been archived as part of the Value Audit test pruning strategy based on the Test Pyramid principle.

## Archive Categories

### 1. Redundant Robustness Tests
Tests that provide low value due to redundancy or over-testing implementation details:
- Mock factory robustness tests (implementation detail testing)
- CI-strict robustness edge cases (redundant with core CI-strict functionality)

### 2. Static Analysis Candidates
Tests that are better handled by static analysis tools:
- Type safety validation
- File structure standards
- Linting rule enforcement

## Rationale

These tests were archived to:
- Reduce CI execution time
- Focus on high-value integration tests
- Eliminate test suite noise
- Improve developer experience
- Maintain lean, focused test pyramid

## Restoration

Tests can be restored from this archive if business requirements change or if specific edge cases become critical to the application's success.

---
*Archived as part of Value Audit strategy - Test Pyramid optimization*
