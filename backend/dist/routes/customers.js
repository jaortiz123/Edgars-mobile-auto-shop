"use strict";
const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();
router.get('/', async (req, res, next) => {
    try {
        const { rows } = await db.query('SELECT * FROM customers ORDER BY id');
        res.json(rows);
    }
    catch (err) {
        next(err);
    }
});
router.post('/', [body('name').trim().notEmpty(), body('email').isEmail().optional({ checkFalsy: true })], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { name, phone, email, address } = req.body;
    try {
        const { rows } = await db.query('INSERT INTO customers (name, phone, email, address) VALUES ($1,$2,$3,$4) RETURNING *', [name, phone, email, address]);
        res.status(201).json(rows[0]);
    }
    catch (err) {
        next(err);
    }
});
module.exports = router;
