const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');

describe('admin login', () => {
  beforeAll(async () => {
    process.env.ADMIN_USER = 'admin';
    process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash('secret', 10);
    process.env.JWT_SECRET = 'testsecret';
  });

  test('valid credentials set auth cookie', async () => {
    const tokenRes = await request(app).get('/csrf-token')
    const csrfToken = tokenRes.body.csrfToken
    const cookie = tokenRes.headers['set-cookie']
    const res = await request(app)
      .post('/admin/login')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ username: 'admin', password: 'secret' });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
  });
});
