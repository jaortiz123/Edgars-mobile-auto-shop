# Edgar's Mobile Auto Repair Hub

[![CI/CD Pipeline](https://github.com/jesus-orduno/Edgars-mobile-auto-shop/actions/workflows/ci.yml/badge.svg)](https://github.com/jesus-orduno/Edgars-mobile-auto-shop/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/jesus-orduno/Edgars-mobile-auto-shop/graph/badge.svg?token=YOUR_CODECOV_TOKEN)](https://codecov.io/gh/jesus-orduno/Edgars-mobile-auto-shop)
[![Coverage Status](https://codecov.io/gh/jesus-orduno/Edgars-mobile-auto-shop/branch/main/graph/badge.svg)](https://codecov.io/gh/jesus-orduno/Edgars-mobile-auto-shop)

This repository contains the serverless backend for "Edgar's Mobile Auto Repair Hub," a conversational AI system for generating service quotes. The project is built entirely on AWS and managed via Terraform, demonstrating modern cloud architecture and DevOps practices.

## Core Technologies

- **Cloud Provider:** AWS
- **Compute:** AWS Lambda (Python)
- **API:** Amazon API Gateway (HTTP API)
- **Database:** Amazon DynamoDB
- **Conversational AI:** Amazon Lex (planned integration)
- **Infrastructure as Code:** Terraform
- **CI/CD:** GitHub Actions

## 🎨 Design System & UI Standards

Edgar's Mobile Auto Shop uses a comprehensive **Typography and Spacing System** for consistent, maintainable UI development.

### 📖 **[Complete UI Standards Guide](docs/UI-Standards.md)**

Our design system features:

- **🔤 Typography Scale**: 7-level modular scale with CSS variables (`--fs-0` to `--fs-6`)
- **📐 Spacing System**: 8px base unit with micro-spacing support (`--sp-0` to `--sp-8`)
- **🛠 Utility Classes**: Tailwind-integrated design system classes
- **🎯 Real Examples**: Copy-paste code from actual components
- **✅ Automated Testing**: Validation tests ensure system compliance

### Quick Start Examples

```tsx
// Typography - Use design system scales
<h1 className="text-fs-5 font-bold">Page Title</h1>      {/* 32px */}
<h2 className="text-fs-3 font-semibold">Card Title</h2>  {/* 20px */}
<p className="text-fs-2">Body text content</p>           {/* 16px */}
<span className="text-fs-0 text-gray-500">Caption</span> {/* 12px */}

// Spacing - Consistent 8px grid system  
<div className="p-sp-3 space-y-sp-2">     {/* 24px padding, 16px vertical spacing */}
  <button className="px-sp-4 py-sp-2">    {/* 32px horizontal, 16px vertical padding */}
    Action Button
  </button>
</div>
```

### Component Examples

| Component | Typography | Spacing | Example |
|-----------|------------|---------|---------|
| **Dashboard Cards** | `text-fs-3` titles, `text-fs-1` labels | `p-sp-3` padding, `gap-sp-2` | Revenue cards, stats displays |
| **Forms** | `text-fs-1` labels, `text-fs-2` inputs | `space-y-sp-4` fields, `p-sp-2` inputs | Login, appointment forms |
| **Navigation** | `text-fs-1` links | `px-sp-3 py-sp-2` items, `space-y-sp-1` | Sidebar, top navigation |
| **Buttons** | `text-fs-1` or `text-fs-2` | `px-sp-3 py-sp-2` standard | Action buttons, form submits |


### Development Benefits

- ✅ **Consistent Visual Hierarchy** across all components
- ✅ **Maintainable Codebase** with centralized design tokens  
- ✅ **Developer Productivity** with clear guidelines and examples
- ✅ **Automated Quality Control** via linting and testing
- ✅ **Future-Proof** system for easy theme updates and scaling

**📋 [View the complete cheat sheet, migration guide, and real-world examples →](docs/UI-Standards.md)**

## 📋 Testing Framework

The project includes comprehensive testing infrastructure across multiple layers:

### Test Suites

- **Unit Tests**: Backend (pytest) and Frontend (Vitest)
- **Integration Tests**: End-to-end testing with Playwright
- **Cross-Browser Testing**: Chrome, Firefox, Safari support
- **Performance Tests**: Latency monitoring for critical endpoints
- **Accessibility Tests**: Automated a11y compliance checks

### Running Tests

```bash
# All tests
npm test

# Specific test suites
npm run test:backend     # Backend unit tests
npm run test:frontend    # Frontend unit tests  
npm run test:e2e         # End-to-end tests
npm run test:browsers    # Cross-browser tests
npm run test:perf        # Performance smoke tests
```

### CI/CD Integration

All tests run automatically on pull requests and main branch pushes. Performance tests enforce a P95 latency threshold of 500ms for critical endpoints, failing the build if exceeded.

#### Coverage Gate

The CI pipeline enforces strict coverage thresholds to prevent regressions:

- **Lines**: 80% minimum
- **Branches**: 80% minimum  
- **Functions**: 80% minimum
- **Statements**: 80% minimum

Any pull request that drops coverage below these thresholds will fail the "Coverage Check" step. Coverage reports are automatically uploaded as downloadable artifacts and to Codecov for detailed analysis.

---

## Architecture

The system is designed as a serverless, event-driven architecture. The initial implementation provides a core RESTful API for quote generation.

```mermaid
graph TD
    subgraph "User Interaction"
        Client[Web/Mobile Client]
    end

    subgraph "AWS Cloud"
        API_GW[API Gateway: POST /quote]
        Lambda[Lambda: QuoteFunction]
        DDB[DynamoDB: EdgarQuotes Table]
    end

    Client -- HTTPS Request --> API_GW
    API_GW -- Invokes --> Lambda
    Lambda -- Writes to --> DDB
