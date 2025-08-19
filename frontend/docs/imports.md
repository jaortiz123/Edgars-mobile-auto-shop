# Import conventions

To improve readability and avoid fragile deep relative paths, we use path aliases:

- `@/` maps to `src/`
- `@lib/` maps to `src/lib/`

Examples:

```ts
// Before
import { login } from '../lib/api'
import { Card } from '../components/ui/Card'

// After
import { login } from '@lib/api'
import { Card } from '@/components/ui/Card'
```

Lint rule enforces this policy by banning deep relative imports two+ levels up:

- Disallowed: `../..*`, `../../..*`

Configuration lives in `eslint.config.js` (`no-restricted-imports`).
