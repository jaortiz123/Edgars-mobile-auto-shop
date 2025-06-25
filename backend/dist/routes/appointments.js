"use strict";
const express = require('express');
const db = require('../db');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { createEvent } = require('ics');
const nodemailer = require('nodemailer');
const { appointmentSchema } = require('../validation/schemas');
const validate = require('../middleware/validate');
const router = express.Router();
router.get('/', async (req, res, next) => {
    try {
        const { rows } = await db.query(`SELECT a.*, c.name AS customer_name, s.name AS service_name
       FROM appointments a
       LEFT JOIN customers c ON a.customer_id = c.id
       LEFT JOIN services s ON a.service_id = s.id
       ORDER BY a.id`);
        res.json(rows);
    }
    catch (err) {
        next(err);
    }
});
router.post('/', validate(appointmentSchema), async (req, res, next) => {
    const { customer_id, vehicle_id, service_id, scheduled_date, scheduled_time, location_address, notes, } = req.body;
    try {
        const { rows } = await db.query(`INSERT INTO appointments
       (customer_id, vehicle_id, service_id, scheduled_date, scheduled_time, location_address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [
            customer_id,
            vehicle_id,
            service_id,
            scheduled_date,
            scheduled_time,
            location_address,
            notes,
        ]);
        const appointment = rows[0];
        try {
            const customerRes = await db.query('SELECT email, name FROM customers WHERE id=$1', [appointment.customer_id]);
            const customer = customerRes.rows[0];
            const dateParts = appointment.scheduled_date.split('-').map(Number);
            const timeParts = appointment.scheduled_time.split(':').map(Number);
            const { error, value } = createEvent({
                title: 'Auto Service Appointment',
                start: [...dateParts, ...timeParts],
                duration: { minutes: 30 },
                description: appointment.notes || '',
                location: appointment.location_address,
            });
            if (!error && customer && customer.email) {
                const transporter = nodemailer.createTransport({ jsonTransport: true });
                await transporter.sendMail({
                    from: 'no-reply@edgarsauto.com',
                    to: customer.email,
                    subject: 'Appointment Scheduled',
                    text: 'Your appointment has been scheduled.',
                    icalEvent: { content: value },
                });
            }
        }
        catch (e) {
            const logger = require('../logger');
            logger.error('email error', e);
        }
        res.status(201).json(appointment);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/:id', auth, [
    body('scheduled_date').optional().isISO8601(),
    body('scheduled_time').optional().notEmpty(),
    body('status').optional().isString(),
], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    const fields = [];
    const values = [];
    Object.entries(req.body).forEach(([key, value], idx) => {
        fields.push(`${key}=$${idx + 1}`);
        values.push(value);
    });
    try {
        const { rows } = await db.query(`UPDATE appointments SET ${fields.join(', ')} WHERE id=$${values.length + 1} RETURNING *`, [...values, req.params.id]);
        res.json(rows[0]);
    }
    catch (err) {
        next(err);
    }
});
module.exports = router;
