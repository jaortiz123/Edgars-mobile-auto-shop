const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/db', () => ({
  query: jest.fn(() => Promise.resolve({ rows: [{ revenue: 100 }] })),
}));
const db = require('../src/db');
const app = require('../src/app');

describe('analytics', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'secret';
  });

  test('revenue endpoint', async () => {
    const token = jwt.sign({ user: 'admin' }, 'secret');
    const res = await request(app)
      .get('/analytics/revenue')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.revenue).toBe(100);
    expect(db.query).toHaveBeenCalled();
  });
});
