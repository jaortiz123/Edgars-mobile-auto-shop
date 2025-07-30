# Quick Add Appointment - Developer Setup Guide

## Quick Start

### 1. Prerequisites
- Node.js 16+ and npm
- React development environment
- TypeScript support

### 2. Installation
```bash
# Navigate to frontend directory
cd /Users/jesusortiz/Edgars-mobile-auto-shop/frontend

# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

### 3. File Structure
```
src/
├── components/
│   ├── QuickAddModal/
│   │   ├── QuickAddModal.jsx          # Main modal component
│   │   ├── QuickAddModal.css          # Modal styling
│   │   └── QuickAddModal.d.ts         # TypeScript declarations
│   └── ui/
│       └── FloatingActionButton.tsx   # Enhanced FAB
├── services/
│   └── templateService.js             # Template CRUD operations
├── utils/
│   └── shortcut.js                    # One-click scheduling utility
├── admin/
│   └── Dashboard.tsx                  # Main integration point
└── docs/
    └── Sprint3A-QuickAddAppointment.md # Full documentation
```

### 4. Quick Test
1. Start dev server: `npm run dev`
2. Navigate to Dashboard
3. Click the floating + button (FAB)
4. QuickAddModal should open
5. Test template selection and form submission

### 5. Key Components

#### FAB Integration
```tsx
// In Dashboard.tsx
const handleAddAppointment = () => {
  setShowQuickAddModal(true);
};

<FloatingActionButton onClick={handleAddAppointment} />
```

#### Modal Integration
```tsx
// In Dashboard.tsx
{showQuickAddModal && (
  <QuickAddModal
    isOpen={showQuickAddModal}
    onClose={() => setShowQuickAddModal(false)}
    onSubmit={handleQuickAddSubmit}
    customers={customers}
    services={services}
  />
)}
```

### 6. Template Service Usage
```javascript
import { getTemplates, createTemplate } from '../services/templateService';

// Load templates
const templates = await getTemplates();

// Create new template
await createTemplate({
  name: 'Oil Change',
  serviceId: 'service_1',
  duration: 30,
  price: 29.99
});
```

### 7. One-Click Scheduling
```javascript
import { generateSmartDefaults, scheduleQuickAppointment } from '../utils/shortcut';

// Generate smart defaults
const defaults = generateSmartDefaults();

// Quick schedule
const result = await scheduleQuickAppointment(defaults);
```

## Configuration

### Environment Variables
```bash
# .env.local
REACT_APP_API_URL=http://localhost:3001
REACT_APP_ENABLE_QUICK_ADD=true
REACT_APP_DEBUG_MODE=false
```

### TypeScript Configuration
Ensure `tsconfig.json` includes:
```json
{
  "compilerOptions": {
    "allowJs": true,
    "declaration": true,
    "declarationDir": "./dist/types"
  },
  "include": [
    "src/**/*",
    "src/**/*.d.ts"
  ]
}
```

## Testing

### Manual Testing Flow
1. **FAB Test**: Click floating action button
2. **Modal Test**: Verify modal opens with form
3. **Template Test**: Select template, verify auto-population
4. **Validation Test**: Submit with invalid data
5. **Success Test**: Submit valid appointment
6. **Accessibility Test**: Tab navigation, screen reader

### Common Issues
- **TypeScript Errors**: Check `.d.ts` files
- **Modal Not Opening**: Verify state management
- **ARIA Warnings**: Ensure string values for ARIA attributes

## Development Tips

### Debugging
```javascript
// Enable debug mode
localStorage.setItem('quickAddDebug', 'true');

// Check console for debug logs
console.log('QuickAdd:', data);
```

### Adding Features
1. **New Template Fields**: Update `templateService.js`
2. **New Quick Actions**: Extend `shortcut.js`
3. **UI Changes**: Modify `QuickAddModal.jsx` and `.css`
4. **Validation Rules**: Update form validation logic

### Performance
- Use React DevTools to check re-renders
- Monitor bundle size with `npm run build`
- Test with slow 3G network simulation

## Deployment

### Production Build
```bash
npm run build
npm run preview  # Test production build
```

### Checklist
- [ ] All TypeScript errors resolved
- [ ] No console errors
- [ ] Accessibility tests pass
- [ ] Performance within limits
- [ ] Manual testing complete

## Support

### Documentation
- Full docs: `docs/Sprint3A-QuickAddAppointment.md`
- Component docs: JSDoc comments in source files
- API docs: Service file headers

### Getting Help
1. Check console for error messages
2. Review component prop interfaces
3. Test with minimal data
4. Check network tab for API issues

---

**Sprint 3A Status**: ✅ Complete and Production Ready
