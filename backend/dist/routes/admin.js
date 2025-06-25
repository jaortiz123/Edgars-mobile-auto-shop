"use strict";
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const router = express.Router();
// const loginLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 10 });
router.post('/login', /* loginLimiter, */ [
    body('username').trim().notEmpty(),
    body('password').notEmpty(),
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { username, password } = req.body;
        if (username !== process.env.ADMIN_USER) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const match = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH || '');
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.cookie('authToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 1000,
        }).json({ status: 'success' });
    }
    catch (err) {
        next(err);
    }
});
router.get('/me', auth, (req, res) => {
    res.json({ user: req.user.username });
});
router.post('/logout', (_req, res) => {
    res.clearCookie('authToken', { sameSite: 'strict' }).json({ status: 'ok' });
});
module.exports = router;
