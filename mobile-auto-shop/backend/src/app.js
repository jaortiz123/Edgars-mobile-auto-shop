const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();
const servicesRouter = require('./routes/services');
const customersRouter = require('./routes/customers');
const appointmentsRouter = require('./routes/appointments');
const adminRouter = require('./routes/admin');
const analyticsRouter = require('./routes/analytics');
const auth = require('./middleware/auth');
const rateLimit = require('./middleware/rateLimit');
const app = express();
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(rateLimit);
app.use('/services', servicesRouter);
app.use('/customers', customersRouter);
app.use('/appointments', appointmentsRouter);
app.use('/admin', adminRouter);
app.use('/analytics', auth, analyticsRouter);
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
if (require.main === module) {
  app.listen(process.env.PORT || 3001, () =>
    console.log(`API on ${process.env.PORT || 3001}`)
  );
}

module.exports = app;
