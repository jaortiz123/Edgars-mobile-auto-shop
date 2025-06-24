import { vi, test, expect } from 'vitest';

let mockGet = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: mockGet,
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    }),
  },
}));

import { serviceAPI } from '../api';

test('serviceAPI.getAll retries on failure', async () => {
  mockGet.mockRejectedValueOnce(new Error('fail'));
  mockGet.mockResolvedValue({ data: [] });
  await serviceAPI.getAll();
  expect(mockGet).toHaveBeenCalledTimes(2);
});