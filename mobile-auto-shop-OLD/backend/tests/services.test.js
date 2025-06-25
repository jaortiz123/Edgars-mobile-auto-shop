const request = require('supertest');
const app = require('../src/app');
jest.mock('../src/db');
const db = require('../src/db');
const jwt = require('jsonwebtoken');

describe('Services API', () => {
  beforeAll(() => { process.env.JWT_SECRET = 'secret'; });
  beforeEach(() => { db.query.mockClear(); });

  test('lists services', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Oil' }] });
    const res = await request(app).get('/services');
    expect(res.statusCode).toBe(200);
    expect(res.body[0].name).toBe('Oil');
  });

  test('rejects invalid create payload', async () => {
    const tokenRes = await request(app).get('/csrf-token');
    const cookie = tokenRes.headers['set-cookie'];
    const csrfToken = tokenRes.body.csrfToken;
    const token = jwt.sign({ id: 1 }, 'secret');
    const res = await request(app)
      .post('/services')
      .set('Cookie', [...cookie, `authToken=${token}`])
      .set('X-CSRF-Token', csrfToken)
      .send({ name: '', base_price: 'notnum' });
    expect(res.statusCode).toBe(400);
  });
});
