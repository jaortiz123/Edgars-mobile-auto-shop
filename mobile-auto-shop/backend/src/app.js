const express = require('express');
const logger = require('./logger');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();
const db = require('./db');
const servicesRouter = require('./routes/services');
const customersRouter = require('./routes/customers');
const appointmentsRouter = require('./routes/appointments');
const adminRouter = require('./routes/admin');
const cookieParser = require('cookie-parser');
// const doubleCsrf = require('csrf-protection');
const analyticsRouter = require('./routes/analytics');
const errorHandler = require('./middleware/errorHandler');
const auth = require('./middleware/auth');
const docsRouter = require('./docs/swagger');
// Temporarily remove rate limiting
// const rateLimit = require('./middleware/rateLimit');
const app = express();

// Temporarily disable CSRF for quick setup
// const { invalidCsrfTokenError, generateToken } = doubleCsrf({
//   getSecret: () => require('crypto').randomBytes(32).toString('hex'),
//   cookieName: 'XSRF-TOKEN',
// });

async function checkDbConnection() {
  try {
    await db.query('SELECT 1');
    logger.info('Connected to Postgres');
  } catch (err) {
    logger.error('Postgres connection failed', err);
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
    logger.info('Seeded fallback services');
  }
}

app.use(helmet());
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
app.use(express.json());
app.use(cookieParser());

// Attach CSRF token generator to every response (temporarily disabled)
// app.use((req, res, next) => {
//   res.locals.csrfToken = generateToken(req, res);
//   next();
// });

// Temporarily disable rate limiting for debugging
// app.use(rateLimit);

app.use('/api/services', servicesRouter);
app.use('/api/customers', customersRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/analytics', auth, analyticsRouter);
app.use('/docs', docsRouter);

// Endpoint to expose CSRF token to the frontend (temporarily disabled)
// app.get('/csrf-token', (req, res) => {
//   const token = generateToken(req, res);
//   res.json({ csrfToken: token });
// });

app.get('/', (req, res) =>
  res.json({ status: 'Backend is live', timestamp: new Date().toISOString() })
);

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
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

app.post('/debug/reset-db', async (_req, res) => {
  await db.query('TRUNCATE appointments RESTART IDENTITY CASCADE');
  await db.query('TRUNCATE customers RESTART IDENTITY CASCADE');
  await db.query('TRUNCATE vehicles RESTART IDENTITY CASCADE');
  res.json({ status: 'reset' });
});

app.post('/debug/reset-and-seed', async (_req, res) => {
  await db.query('TRUNCATE appointments RESTART IDENTITY CASCADE');
  await db.query('TRUNCATE customers RESTART IDENTITY CASCADE');
  await db.query('TRUNCATE vehicles RESTART IDENTITY CASCADE');
  await seedIfEmpty();
  res.json({ status: 'reset-seeded' });
});

app.post('/debug/seed', async (_req, res) => {
  await seedIfEmpty();
  res.json({ status: 'seeded' });
});

app.use(errorHandler);

if (require.main === module) {
  app.listen(process.env.PORT || 3001, async () => {
    logger.info(`API listening on http://localhost:${process.env.PORT || 3001}`);
    await checkDbConnection();
    await seedIfEmpty();
  });
}

module.exports = app;