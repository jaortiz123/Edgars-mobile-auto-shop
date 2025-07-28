import axios from 'axios';

// API client for service integration tests
const client = axios.create();

export const serviceAPI = {
  getAll: async (): Promise<unknown> => {
    try {
      const res = await client.get('');
      return res.data;
    } catch {
      // Retry once on failure
      const res = await client.get('');
      return res.data;
    }
  },
};
