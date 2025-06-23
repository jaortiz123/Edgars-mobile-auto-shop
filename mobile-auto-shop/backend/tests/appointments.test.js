const request = require('supertest');
jest.mock('../src/db');
const db = require('../src/db');
const app = require('../src/app');

describe('appointments API', () => {
  test('create appointment', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const res = await request(app)
      .post('/appointments')
      .send({
        customer_id: 1,
        service_id: 1,
        vehicle_id: null,
        scheduled_date: '2025-12-25',
        scheduled_time: '10:00',
        location_address: '123 Main St',
        notes: '',
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });
});
