const request = require('supertest');
const app = require('../src/app');
jest.mock('../src/db');
const db = require('../src/db');

describe('Appointments API', () => {
  beforeEach(() => {
    db.query.mockClear();
  });

  test('should create an appointment with valid data', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 100 }] });

    const res = await request(app)
      .post('/appointments')
      .send({
        customer_id: 1,
        service_id: 1,
        vehicle_id: null,
        scheduled_date: '2025-08-15',
        scheduled_time: '14:00',
        location_address: '123 Test Street',
        notes: 'Test appointment notes'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
  });
});
