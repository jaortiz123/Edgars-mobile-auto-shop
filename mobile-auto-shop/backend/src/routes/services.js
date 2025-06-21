const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM services ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

router.post('/', async (req, res) => {
  const { name, description, duration_minutes, base_price } = req.body;
  try {
    const { rows } = await db.query(
      'INSERT INTO services (name, description, duration_minutes, base_price) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, description, duration_minutes, base_price]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

module.exports = router;
