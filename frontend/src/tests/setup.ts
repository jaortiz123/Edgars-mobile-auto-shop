import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import './preActEnv';
import './testEnv';

afterEach(() => {
  cleanup();
});
