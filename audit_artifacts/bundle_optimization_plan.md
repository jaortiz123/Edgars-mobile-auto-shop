## 🚀 **CRITICAL PERFORMANCE OPTIMIZATION PLAN**

### **Root Cause Analysis**
The 399KB AnalyticsDashboardPage and 386KB main bundle are caused by:

1. **Massive dependency chains** - Each page imports dozens of heavy components
2. **api.ts dynamic/static import conflict** - Preventing code splitting
3. **No route-based code splitting** - Everything loads upfront
4. **Heavy chart/visualization libraries** - Not lazy loaded
5. **CSS bundle bloat** - All styles loaded at once

### **Phase 1: Fix api.ts Import Pattern**
- ❌ **Current**: api.ts both dynamically AND statically imported
- ✅ **Fix**: Split into apiCore (static) and apiChunks (dynamic)

### **Phase 2: Route-Based Code Splitting**
- ❌ **Current**: All admin routes in single 386KB bundle
- ✅ **Target**: Split into route chunks <100KB each

### **Phase 3: Component-Level Lazy Loading**
- ❌ **Current**: StatusBoard (112KB) loads synchronously
- ✅ **Target**: Lazy load heavy components within routes

### **Phase 4: Third-Party Library Optimization**
- ❌ **Current**: All chart libraries bundled upfront
- ✅ **Target**: Dynamic imports for visualization components

### **Performance Targets**
- Main bundle: 386KB → **<150KB** (-61%)
- AnalyticsDashboardPage: 399KB → **<100KB** (-75%)
- StatusBoard: 112KB → **<50KB** (-55%)
- **Target Lighthouse Score**: 85+ (currently 37)

### **Implementation Order**
1. Fix api.ts import conflict (blocks all other optimizations)
2. Implement route-based code splitting
3. Add lazy loading for heavy components
4. Optimize third-party libraries
5. CSS optimization and critical path
