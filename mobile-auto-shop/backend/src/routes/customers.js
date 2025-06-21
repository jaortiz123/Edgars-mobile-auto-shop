const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM customers ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

router.post('/', async (req, res) => {
  const { name, phone, email, address } = req.body;
  try {
    const { rows } = await db.query(
      'INSERT INTO customers (name, phone, email, address) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, phone, email, address]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

module.exports = router;
