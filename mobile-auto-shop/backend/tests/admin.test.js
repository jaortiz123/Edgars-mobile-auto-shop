const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');

describe('admin login', () => {
  beforeAll(async () => {
    process.env.ADMIN_USER = 'admin';
    process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash('secret', 10);
    process.env.JWT_SECRET = 'testsecret';
  });

  test('valid credentials return token', async () => {
    const res = await request(app)
      .post('/admin/login')
      .send({ username: 'admin', password: 'secret' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});
