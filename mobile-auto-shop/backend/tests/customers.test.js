const request = require('supertest');
const app = require('../src/app');
jest.mock('../src/db');
const db = require('../src/db');
const jwt = require('jsonwebtoken');

describe('Customers API', () => {
  beforeAll(() => { process.env.JWT_SECRET = 'secret'; });
  beforeEach(() => { db.query.mockClear(); });

  test('list customers', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Jane' }] });
    const res = await request(app).get('/customers');
    expect(res.statusCode).toBe(200);
    expect(res.body[0].name).toBe('Jane');
  });

  test('reject invalid create data', async () => {
    const tokenRes = await request(app).get('/csrf-token');
    const cookie = tokenRes.headers['set-cookie'];
    const csrfToken = tokenRes.body.csrfToken;
    const token = jwt.sign({ id: 1 }, 'secret');
    const res = await request(app)
      .post('/customers')
      .set('Cookie', [...cookie, `authToken=${token}`])
      .set('X-CSRF-Token', csrfToken)
      .send({ name: '', email: 'bad' });
    expect(res.statusCode).toBe(400);
  });
});
