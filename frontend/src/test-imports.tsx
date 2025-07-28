// Save this as: frontend/src/test-imports.tsx
// Then try to compile it: cd frontend && npx tsc src/test-imports.tsx --noEmit

// Test 1: Direct import from contexts
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// Test 2: Import from hooks re-export
import { useAuth as hookAuth } from '@/hooks/useAuth';

// Test 3: Test relative imports (from a component perspective)
// Uncomment based on where you save this file:
// import { AuthProvider as RelativeAuth } from './contexts/AuthContext';  // If in src/
// import { AuthProvider as RelativeAuth } from '../contexts/AuthContext'; // If in src/pages/

// Test 4: Check if old path exists (this should fail)
// import { AuthProvider as OldAuth } from '@/Context/AuthContext'; // This should error!

// Simple component to test usage
const TestComponent = () => {
  // Test hook usage
  const auth1 = useAuth();
  const auth2 = hookAuth();
  
  console.log('✅ All imports working correctly!');
  console.log('Auth from direct import:', auth1);
  console.log('Auth from hook re-export:', auth2);
  
  return (
    <AuthProvider>
      <div>If this compiles, your imports are fixed!</div>
    </AuthProvider>
  );
};

// Type checks
const typeCheck1: typeof useAuth = hookAuth; // Should work
const typeCheck2: typeof AuthProvider = AuthProvider; // Should work

console.log('🎉 All import tests passed!');

export default TestComponent;
