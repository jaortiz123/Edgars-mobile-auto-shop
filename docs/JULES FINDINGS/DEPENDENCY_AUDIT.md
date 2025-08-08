# Dependency Health Audit
Generated: 2025-08-07
Audit Type: Comprehensive Dependency Analysis

## 🚨 CRITICAL - Security Vulnerabilities

### Frontend Vulnerabilities (npm audit)
| Package | Version | Vulnerability | Severity | Fixed In | Breaking Change? |
|---------|---------|---------------|----------|----------|------------------|
| form-data | 4.0.0 | [GHSA-fjxv-7rqg-78g4](https://github.com/advisories/GHSA-fjxv-7rqg-78g4) | Critical | 4.0.4 | No |

### Backend Vulnerabilities (safety/pip-audit)
| Package | Version | Vulnerability | Severity | Fixed In | Breaking Change? |
|---------|---------|---------------|----------|----------|------------------|
| *None found* | - | - | - | - | - |

## 📊 Dependency Statistics

### Frontend (npm)
- **Total Dependencies:** 61 (20 production, 41 development)
- **Outdated Packages:** 21 (5 major, 16 minor/patch)
- **Security Vulnerabilities:** 1 critical, 1 low
- **Unused Dependencies:** 5 packages (+ 6 dev dependencies)
- **Bundle Size Impact:** *Analysis not possible (visualizer not configured)*
- **Last Update:** package-lock.json last modified *unknown*

### Backend (Python)
- **Total Dependencies:** 15
- **Unpinned Versions:** 15 packages (CRITICAL RISK!)
- **Outdated Packages:** 6
- **Security Issues:** 0
- **Python Version:** Not specified in project configuration.

## 🔄 Major Version Updates Available

### High Impact Updates (lots of breaking changes)
| Package | Current | Latest | Breaking Changes | Migration Effort | Files Affected |
|---------|---------|--------|------------------|------------------|----------------|
| vite | 6.3.5 | 7.1.0 | Potential config changes, plugin API updates | Medium | vite.config.js |
| tailwindcss | 3.4.17 | 4.1.11 | Major changes to config and classes | High | All components |
| zod | 3.25.67 | 4.0.15 | New API, potential type inference changes | Medium | Multiple files |
| @sentry/react | 9.32.0 | 10.2.0 | API changes, new features | Low | main.tsx |
| @vitejs/plugin-react | 4.6.0 | 5.0.0 | Possible compatibility issues with Vite 7 | Low | vite.config.js |

### Low Risk Updates (backward compatible)
| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| axios | 1.10.0 | 1.11.0 | Minor update |
| react | 19.1.0 | 19.1.1 | Patch release |
| ... | ... | ... | *14 other minor/patch updates available* |

## 🗑️ Unused Dependencies (Safe to Remove)

### Frontend - Never Imported
| Package | Size (npm) | Last Updated | Why Installed? |
|---------|------------|--------------|----------------|
| @tailwindcss/forms | 84 KB | 2023-09-26 | Potentially for a feature that was removed. |
| @tailwindcss/typography | 126 KB | 2023-09-26 | Potentially for a feature that was removed. |
| clsx | 3.5 KB | 2023-09-26 | Utility for classnames, likely replaced by `tailwind-merge`. |
| tailwind-merge | 7.4 KB | 2023-09-26 | Utility for merging tailwind classes. |
| rollup-plugin-visualizer | 1.1 MB | 2023-09-26 | Dev dependency, but not configured in `vite.config.js`.|

### Backend - Never Imported
| Package | Why Installed? | Safe to Remove? |
|---------|----------------|-----------------|
| pg8000 | Duplicate of psycopg2-binary | Yes, after migrating lambdas to use `psycopg2-binary`. |

## ⚠️ Duplicate Functionality

### Frontend Duplicates
| Function | Packages | Recommendation |
|----------|----------|----------------|
| HTTP Requests | `axios`, `fetch` API (via `react-query`) | Standardize on `react-query` with `fetch`. `axios` is redundant. |

### Backend Duplicates
| Function | Packages | Recommendation |
|----------|----------|----------------|
| PostgreSQL Driver | `psycopg2-binary`, `pg8000` | Standardize on `psycopg2-binary` for better performance and consistency. |

## 📦 Dependency Deep Dive

### Most Problematic Dependencies
1.  **All Backend Dependencies**
    -   Current Version: *Floating*
    -   Latest Version: *Unknown*
    -   Why Problematic: The `requirements.txt` file does not pin any versions. This is a critical risk for reproducible builds and can lead to unexpected breakages in CI/CD and production environments.
    -   Replacement Options: -
    -   Migration Complexity: Low (requires generating a pinned `requirements.txt`)

2.  **form-data (npm)**
    -   Current Version: 4.0.0
    -   Latest Version: 4.0.4 (fix available)
    -   Why Problematic: Has a critical security vulnerability (GHSA-fjxv-7rqg-78g4).
    -   Replacement Options: -
    -   Migration Complexity: Low (patch update).

### Heaviest Dependencies (Bundle Size)
*Analysis could not be performed because `rollup-plugin-visualizer` is not configured.*

## 🎯 Update Strategy

### Phase 1: Security & Stability Fixes (Do Immediately)
```bash
# Frontend: Fix critical vulnerability
npm install form-data@latest

# Backend: Pin all dependencies
cd backend
pip freeze > requirements.pinned.txt
# Then manually merge into requirements.txt or replace it
```

### Phase 2: Safe Updates (Low Risk)
- Update all frontend packages with minor/patch version bumps (16 packages).
- Update all backend packages to their latest stable versions and pin them.

### Phase 3: Major Updates (Requires Testing)
Priority order based on risk/reward:
1.  **Zod 3 -> 4**: Important for data validation correctness.
2.  **Vite 6 -> 7**: Better performance and features, requires config validation.
3.  **TailwindCSS 3 -> 4**: High effort, but important for future UI development.

### Phase 4: Cleanup (After Testing)
- Remove unused frontend dependencies identified by `depcheck`.
- Refactor Lambda functions to use `psycopg2-binary` and remove `pg8000`.
- Remove `axios` and refactor any remaining usage to `react-query`.

## 🤔 Questions for Development Team

**Critical Decisions Needed:**
- The `requirements.txt` file has no version pins. This means every build could pull different dependency versions, leading to instability. How should we proceed with creating a pinned, reproducible environment?
- The frontend has 1 critical and 1 low vulnerability. What is the team's policy on addressing security issues?

**Package Conflicts & Duplicates:**
- Both `psycopg2-binary` and `pg8000` are used for connecting to PostgreSQL. `psycopg2-binary` is used in the main application, while `pg8000` is used in several Lambda functions. Was this intentional? Can we standardize on `psycopg2-binary`?
- The frontend uses `axios` in some places and `react-query` (which uses `fetch`) in others. Can we standardize on `react-query` for all data fetching to simplify the codebase?

**Version & Compatibility Issues:**
- `package.json` does not specify a Node.js version in an "engines" field. What version is used in production? This is important for ensuring a consistent environment.
- The backend dependencies are not tested against a specific Python version. What version is targeted for production?

**Unusual or Suspicious Findings:**
- The `depcheck` tool reports that `@sentry/react` is unused, but it is a production dependency. It also reports `@sentry/browser` as a *missing* dependency. This suggests a potential misconfiguration in the Sentry setup. Could you clarify how Sentry is intended to be used?
- `depcheck` also reports several missing dependencies (`@types/node`, `glob`, `@storybook/react`). This indicates that `npm install` may not be sufficient to run all parts of the project (e.g., Storybook, certain tests).

## ⚙️ Configuration Issues Found

### package.json Problems:
- **Missing "engines" field:** No Node.js version is specified, which can lead to environment inconsistencies.
- **Missing dependencies:** `depcheck` found several missing dependencies, suggesting an incomplete installation.

### requirements.txt Problems:
- **No version pinning:** This is the most critical issue found in the audit. All 15 dependencies are floating, which is a major risk for build reproducibility.

## 📈 Dependency Health Score

### Scoring Metrics:
- **Security**: D (1 critical vulnerability in frontend)
- **Freshness**: C (many major versions behind in frontend, all versions floating in backend)
- **Optimization**: D (duplicate packages, unused dependencies)
- **Maintainability**: F (unpinned Python versions is a critical failure)
- **Overall Grade**: D-

### To Achieve "A" Grade:
1. Fix all security vulnerabilities.
2. Pin ALL Python package versions immediately.
3. Update all packages to their latest stable versions.
4. Remove unused and duplicate packages after migrating functionality.
5. Add an "engines" field to `package.json`.
6. Configure the bundle analyzer to monitor bundle size.

## 💡 Recommendations

### Immediate Actions:
1.  **Pin Python Dependencies:** Run `pip freeze > requirements.txt` in a known-good environment to immediately pin all backend versions.
2.  **Fix Critical Vulnerability:** Run `npm install form-data@latest` to patch the critical `form-data` vulnerability.

### Short-term (This Sprint):
1.  **Standardize DB Driver:** Migrate the Lambda functions from `pg8000` to `psycopg2-binary` and remove `pg8000`.
2.  **Remove Unused Packages:** Remove the unused frontend dependencies identified by `depcheck`.
3.  **Address Missing Packages:** Install the missing `npm` packages to ensure all project scripts can run.
4.  **Add `engines` field:** Add an "engines" field to `package.json` to specify the target Node.js version.

### Long-term Strategy:
1.  **Automated Updates:** Set up Dependabot or Renovate to automatically create pull requests for dependency updates.
2.  **Bundle Size Monitoring:** Configure and enable the `rollup-plugin-visualizer` to monitor the frontend bundle size as part of the build process.
3.  **Establish Dependency Policy:** Document a clear policy for when and how to update dependencies, including a regular review cycle.

## Areas Needing Manual Investigation:
- [X] Dynamic imports that tools can't trace (`depcheck` may have false positives/negatives)
- [ ] Dependencies used only in build scripts
- [ ] Platform-specific optional dependencies
- [ ] Git submodules or local packages
