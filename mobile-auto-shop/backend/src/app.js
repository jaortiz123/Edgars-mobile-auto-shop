const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();
const db = require('./db');
const servicesRouter = require('./routes/services');
const customersRouter = require('./routes/customers');
const appointmentsRouter = require('./routes/appointments');
const adminRouter = require('./routes/admin');
const analyticsRouter = require('./routes/analytics');
const auth = require('./middleware/auth');
const rateLimit = require('./middleware/rateLimit');
const app = express();

async function checkDbConnection() {
  try {
    await db.query('SELECT 1');
    console.log('✅ Connected to Postgres');
  } catch (err) {
    console.error('❌ Postgres connection failed:', err);
  }
}

async function seedIfEmpty() {
  const { rows } = await db.query('SELECT COUNT(*) FROM services');
  if (Number(rows[0].count) === 0) {
    await db.query(
      `INSERT INTO services (name, description, duration_minutes, base_price)
       VALUES
       ('Oil Change', 'Synthetic oil', 30, 50),
       ('Brake Repair', 'Pads + fluid', 60, 120),
       ('Battery', 'Battery check + install', 45, 90)`
    );
    console.log('🌱 Seeded fallback services');
  }
}
app.use(helmet());
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(morgan('combined'));
app.use(express.json());
app.use(rateLimit);
app.use('/services', servicesRouter);
app.use('/customers', customersRouter);
app.use('/appointments', appointmentsRouter);
app.use('/admin', adminRouter);
app.use('/analytics', auth, analyticsRouter);
app.get('/', (req, res) =>
  res.json({ status: 'Backend is live', timestamp: new Date().toISOString() })
);

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch {
    res.status(500).json({ ok: false, db: 'disconnected' });
  }
});

app.get('/debug/seed-status', async (req, res) => {
  const [{ rows: services }, { rows: customers }, { rows: appointments }] =
    await Promise.all([
      db.query('SELECT COUNT(*) FROM services'),
      db.query('SELECT COUNT(*) FROM customers'),
      db.query('SELECT COUNT(*) FROM appointments'),
    ]);
  res.json({
    services: Number(services[0].count),
    customers: Number(customers[0].count),
    appointments: Number(appointments[0].count),
  });
});
if (require.main === module) {
  app.listen(process.env.PORT || 3001, async () => {
    console.log(`🚀 API listening on http://localhost:${process.env.PORT || 3001}`);
    await checkDbConnection();
    await seedIfEmpty();
  });
}

module.exports = app;
