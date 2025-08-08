# Dead Code & Cleanup Audit
Generated: [Date]
Audit Type: Dead Code & Technical Debt Scan

## 📊 Summary Statistics
- **Estimated dead code:** ~X lines
- **Duplicate files found:** 11
- **Unused dependencies:** 5 packages
- **Console.logs found:** 100+ instances
- **Old TODOs:** 4
- **Potential file deletions:** 11+ files
- **Space to be reclaimed:** ~X MB

## 🗑️ Files to Delete (Safe)
These files can be deleted immediately with no impact:

| File Path | Reason | Size | Last Modified |
|-----------|--------|------|---------------|
| | | | |

## ⚠️ Files to Review (Possibly Delete)
These files might be deletable but need human verification:

| File Path | Concern | Evidence | Question for Dev |
|-----------|---------|----------|------------------|
| | | | |

## 🧹 Code Cleanup Needed

### Console Statements to Remove
```javascript
// File: frontend/src/admin/Dashboard.tsx, Line 166
console.log("🚀 Starting loadDashboardData");

// File: frontend/src/admin/Dashboard.tsx, Line 181
console.log("📡 Making API calls to backend...");

// File: frontend/src/admin/Dashboard.tsx, Line 183
console.log("✅ API calls completed", { aptRes }); // Potentially sensitive data

// File: frontend/src/admin/Dashboard.tsx, Line 227
console.error('❌ Dashboard API error', err); // Should use a proper logger

// File: frontend/src/admin/Dashboard.tsx, Line 335
console.log('🚀 QuickAdd submission:', formData); // Potentially sensitive data

// File: frontend/src/contexts/AuthContext.tsx, Line 49
console.log('Login attempt:', { email, password: password.replace(/./g, '*') }); // Logs email, even if password is redacted

// File: frontend/src/lib/api.ts, Line 199
console.error('🔧 API: Error details:', {
  // ... (error details)
}); // Exposes detailed error info to the console
```

### Large Commented Code Blocks
```javascript
// File: frontend/src/admin/Dashboard.tsx, Lines 572-581
/* 
{selectedAppointment && (
    <AppointmentDetailModal
    appointment={selectedAppointment}
    isOpen={!!selectedAppointment}
    onClose={() => setSelectedAppointment(null)}
    onStartJob={handleStartJob}
    onCompleteJob={handleCompleteJob}
    onCallCustomer={handleCallCustomer}
    />
)}
*/
```

### Ancient TODOs/FIXMEs
| File | Line | Comment | Git Blame Date | Priority |
|---|---|---|---|---|
| `frontend/src/contexts/AuthContext.tsx` | 35 | `// TODO: hit /me endpoint when available` | | Medium |
| `frontend/src/contexts/AuthContext.tsx` | 48 | `// TODO: call backend when auth is ready` | | High |
| `backend/local_server.py` | 1507 | `# TODO: Re-enable authentication after fixing frontend auth flow` | | High |
| `backend/local_server.py` | 1532 | `# TODO: Create messages table in SQLite schema` | | Medium |

### 📦 Unused Dependencies
| Package | Version | Used In Code? | Dev/Prod | Safe to Remove? |
|---|---|---|---|---|
| `@sentry/react` | `^9.31.0` | No | Prod | Likely |
| `@tailwindcss/forms` | `^0.5.10` | No | Prod | Likely (not in `tailwind.config.js`) |
| `@tailwindcss/typography` | `^0.5.16` | No | Prod | Likely (not in `tailwind.config.js`) |
| `clsx` | `^2.1.1` | No | Prod | Possibly |
| `tailwind-merge` | `^3.3.1` | No | Prod | Possibly |

### 🔄 Duplicate/Versioned Files
| Original | Duplicate(s) | Recommendation |
|---|---|---|
| `backend/notification_function.py` | `backend/notification_function_enhanced.py` | Verify which is the latest and delete the other. |
| `backend/lambda_packages/reminder_function.zip` | `backend/lambda_packages/reminder_function_fixed.zip`, `backend/lambda_packages/reminder_function_updated.zip` | Keep the latest version and delete the others. |
| `frontend/src/components/ServiceCard.tsx` | `frontend/src/components/ServiceCard.tsx.backup` | Delete the backup file. |
| `frontend/src/components/ToastProvider.tsx` | `frontend/src/components/ToastProviderOriginal.tsx`, `frontend/src/components/ToastProviderRobust.tsx` | Consolidate into a single `ToastProvider.tsx` and delete the others. |
| `frontend/src/contexts/AuthContext.tsx` | `frontend/src/contexts/AuthContextRobust.tsx` | Determine if `AuthContextRobust.tsx` is a replacement and delete the old one. |
| `frontend/src/services/offlineSupport.ts` | `frontend/src/services/offlineSupport_old.tsx` | Delete the `_old` file. |
| `frontend/src/styles/theme.css` | `frontend/src/styles/themeRobust.css` | Determine if `themeRobust.css` is a replacement and delete the old one. |
| `frontend/src/tests/testEnv.ts` | `frontend/src/tests/testEnv.backup.ts` | Delete the backup file. |
| `backend/booking_function.py` | `backend/booking_function_with_sms.py` | Determine if `booking_function_with_sms.py` is an enhancement or a separate function. Consolidate if possible. |
| `frontend/src/test/integrationUtils.tsx` | `frontend/src/test/integrationUtils.fixed.tsx`, `frontend/src/test/integrationUtils.old.tsx` | Keep the current version and delete the old/fixed ones. |
| `frontend/src/tests/services.crud.test.tsx` | `frontend/src/tests/services.crud.test.new.tsx` | If this is a new test file, it should be renamed to something more descriptive. If it's a replacement, the old one should be deleted. |
