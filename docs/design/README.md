# Design Documentation Index

## Overview
This directory contains all design documentation for Edgar's Mobile Auto Shop backend refactoring initiative.

## Phase 0: Discovery & Analysis (In Progress)
*Must complete before any refactoring design work*

### Discovery Artifacts
- [`discovery/route_inventory.json`](discovery/route_inventory.json) - Complete API endpoint inventory (98 routes analyzed)
- [`discovery/route_inventory.csv`](discovery/route_inventory.csv) - CSV summary of all routes with auth requirements
- [`discovery/code_metrics.md`](discovery/code_metrics.md) - Lines of code analysis and complexity assessment
- [`discovery/complexity_hotspots.md`](discovery/complexity_hotspots.md) - Top complexity routes requiring refactor priority *(TODO)*
- [`discovery/dependency_map.md`](discovery/dependency_map.md) - Full tech stack inventory *(TODO)*

### Analysis Results Summary
- **Total Routes:** 98 endpoints discovered
- **Authentication Coverage:** 60.2% (59/98 endpoints secured)
- **Database Access:** 66.3% (65/98 endpoints touch database)
- **High Complexity Routes:** 55 routes exceed complexity threshold (>10)
- **Monolith Size:** 12,961 lines of code

## Governance Documents
- [`governance/Monolith_Refactoring_Master_Plan.md`](governance/Monolith_Refactoring_Master_Plan.md) - Complete Phase 0 discovery plan and Phase 1-6 roadmap

## Phase 1+: Architecture & Implementation (Future)
*Pending completion of Phase 0 discovery*

- API contract specifications
- Service boundary definitions
- Mobile integration strategy
- Migration playbooks
- Development standards

## Navigation Tips
- **Start here:** Read the [Master Plan](governance/Monolith_Refactoring_Master_Plan.md) for complete context
- **Current focus:** Phase 0 discovery tasks must complete before any design work
- **Mobile development:** iOS app development blocked until service boundaries are defined

## File Naming Standards
- Use underscores instead of spaces: `File_Name.md`
- No emoji characters in filenames
- Descriptive, searchable names
- Organize by phase/category in subdirectories
