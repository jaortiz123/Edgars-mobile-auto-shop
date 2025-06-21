const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT a.*, c.name AS customer_name, s.name AS service_name
       FROM appointments a
       LEFT JOIN customers c ON a.customer_id = c.id
       LEFT JOIN services s ON a.service_id = s.id
       ORDER BY a.id`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

router.post('/', async (req, res) => {
  const {
    customer_id,
    vehicle_id,
    service_id,
    scheduled_date,
    scheduled_time,
    location_address,
    notes,
  } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO appointments
       (customer_id, vehicle_id, service_id, scheduled_date, scheduled_time, location_address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        customer_id,
        vehicle_id,
        service_id,
        scheduled_date,
        scheduled_time,
        location_address,
        notes,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

module.exports = router;
