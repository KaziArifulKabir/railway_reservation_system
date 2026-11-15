const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { httpError } = require('../utils/http');

async function authenticate(req, res, next) {
  try {
    const cookieName = process.env.COOKIE_NAME || 'rrs_session';
    const token = req.cookies?.[cookieName];
    if (!token) throw httpError(401, 'Please log in to continue.');

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw httpError(401, 'Your session is invalid or expired. Please log in again.');
    }

    const [rows] = await pool.execute(
      `SELECT u.user_id, u.full_name, u.email, u.phone, u.account_status,
              r.role_name
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = ? LIMIT 1`,
      [payload.userId]
    );

    if (!rows.length || rows[0].account_status !== 'ACTIVE') {
      throw httpError(401, 'Your account is unavailable. Please contact Railway Authority.');
    }

    req.user = rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(...allowedRoles) {
  return function roleGuard(req, res, next) {
    if (!req.user || !allowedRoles.includes(req.user.role_name)) {
      return next(httpError(403, 'You do not have permission to perform this action.'));
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
