const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, httpError } = require('../utils/http');

const router = express.Router();
const COOKIE_NAME = process.env.COOKIE_NAME || 'rrs_session';
const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000;

function publicUser(row) {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role_name
  };
}

function setAuthCookie(res, userId) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/'
  });
}

router.post('/register', asyncHandler(async (req, res) => {
  const fullName = String(req.body.fullName || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim() || null;
  const password = String(req.body.password || '');

  if (fullName.length < 2 || fullName.length > 120) throw httpError(400, 'Name must be between 2 and 120 characters.');
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 190) throw httpError(400, 'Enter a valid email address.');
  if (phone && !/^[0-9+()\-\s]{7,25}$/.test(phone)) throw httpError(400, 'Enter a valid phone number.');
  if (password.length < 8 || password.length > 72) throw httpError(400, 'Password must contain 8 to 72 characters.');

  const [roles] = await pool.execute("SELECT role_id FROM roles WHERE role_name = 'PASSENGER' LIMIT 1");
  if (!roles.length) throw httpError(500, 'Passenger role is missing. Import the schema and run the seed command.');

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const [result] = await pool.execute(
      `INSERT INTO users (role_id, full_name, email, phone, password_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [roles[0].role_id, fullName, email, phone, passwordHash]
    );
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.full_name, u.email, u.phone, r.role_name
       FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.user_id = ?`,
      [result.insertId]
    );
    setAuthCookie(res, result.insertId);
    res.status(201).json({ success: true, message: 'Account created successfully.', user: publicUser(rows[0]) });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw httpError(409, 'This email or phone number is already registered.');
    throw error;
  }
}));

router.post('/login', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) throw httpError(400, 'Email and password are required.');

  const [rows] = await pool.execute(
    `SELECT u.user_id, u.full_name, u.email, u.phone, u.password_hash,
            u.account_status, r.role_name
     FROM users u JOIN roles r ON r.role_id = u.role_id
     WHERE u.email = ? LIMIT 1`,
    [email]
  );

  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
    throw httpError(401, 'Invalid email or password.');
  }
  if (rows[0].account_status !== 'ACTIVE') throw httpError(403, 'This account is blocked. Contact Railway Authority.');

  setAuthCookie(res, rows[0].user_id);
  res.json({ success: true, message: 'Login successful.', user: publicUser(rows[0]) });
}));

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
  res.json({ success: true, message: 'Logged out successfully.' });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
});

router.put('/profile', authenticate, asyncHandler(async (req, res) => {
  const fullName = String(req.body.fullName || '').trim();
  const phone = String(req.body.phone || '').trim() || null;
  if (fullName.length < 2 || fullName.length > 120) throw httpError(400, 'Name must be between 2 and 120 characters.');
  if (phone && !/^[0-9+()\-\s]{7,25}$/.test(phone)) throw httpError(400, 'Enter a valid phone number.');
  try {
    await pool.execute('UPDATE users SET full_name = ?, phone = ? WHERE user_id = ?', [fullName, phone, req.user.user_id]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw httpError(409, 'This phone number is already in use.');
    throw error;
  }
  res.json({ success: true, message: 'Profile updated.' });
}));

module.exports = router;
