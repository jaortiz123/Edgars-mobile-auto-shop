// Pre-setup: declare support for React 19 act() before any React import.
// Prevents the warning: "The current testing environment is not configured to support act(... )".
// Keep minimal and side-effect only.
export {} // make this file a module so global augmentation is allowed
interface ActEnvAugment { IS_REACT_ACT_ENVIRONMENT?: boolean }
// Assign with narrow cast to augmented shape
(globalThis as ActEnvAugment).IS_REACT_ACT_ENVIRONMENT = true;
// Debug marker to confirm earliest execution order (can be removed once stable)
if (process.env.DEBUG_ACT_ENV?.toLowerCase() === 'true') {
	// Minimal log to avoid noise in normal runs
	console.log('[preActEnv] IS_REACT_ACT_ENVIRONMENT set early');
}
