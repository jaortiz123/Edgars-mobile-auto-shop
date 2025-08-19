import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGet, mockPost, mockPut, mockPatch, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockPatch: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      patch: mockPatch,
      delete: mockDelete,
    }),
  },
}));

import { serviceAPI } from '../api';

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockPut.mockReset();
  mockPatch.mockReset();
  mockDelete.mockReset();
});

describe('serviceAPI', () => {
  it('getAll retries on failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('fail'));
    mockGet.mockResolvedValueOnce({ data: { data: [], errors: null } });
    await serviceAPI.getAll();
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});
