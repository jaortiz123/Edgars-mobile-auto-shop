const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/revenue', async (_req, res) => {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(s.base_price),0) AS revenue
     FROM appointments a
     JOIN services s ON a.service_id = s.id
     WHERE a.status = 'completed'`
  );
  res.json(rows[0]);
});

router.get('/popular-services', async (_req, res) => {
  const { rows } = await db.query(
    `SELECT s.name, COUNT(*) AS count
     FROM appointments a
     JOIN services s ON a.service_id = s.id
     GROUP BY s.name
     ORDER BY count DESC
     LIMIT 5`
  );
  res.json(rows);
});

router.get('/busy-hours', async (_req, res) => {
  const { rows } = await db.query(
    `SELECT scheduled_time, COUNT(*) AS count
     FROM appointments
     GROUP BY scheduled_time
     ORDER BY count DESC
     LIMIT 5`
  );
  res.json(rows);
});

module.exports = router;
