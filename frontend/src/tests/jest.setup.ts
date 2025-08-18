import '@testing-library/jest-dom/vitest';
import { beforeAll, afterAll, afterEach } from 'vitest';
import { server } from './server/server';
import './setup';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
