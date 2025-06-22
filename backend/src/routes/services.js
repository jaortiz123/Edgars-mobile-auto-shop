const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM services ORDER BY id');
    if (rows.length === 0) console.warn('⚠️ No services available');
    res.json(rows);
  } catch (err) {
    console.error('❌ /services failed:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

router.post(
  '/',
  auth,
  [body('name').trim().notEmpty(), body('base_price').isNumeric()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
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
  }
);

module.exports = router;
