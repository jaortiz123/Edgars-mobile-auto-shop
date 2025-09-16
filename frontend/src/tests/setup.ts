import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import './preActEnv';
import './testEnv';

afterEach(() => {
  cleanup();
});
