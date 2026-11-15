const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const publicRoutes = require('./routes/public.routes');
const bookingRoutes = require('./routes/booking.routes');
const adminRoutes = require('./routes/admin.routes');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '30kb' }));
app.use(express.urlencoded({ extended: false, limit: '30kb' }));
app.use(cookieParser());

// The application serves its frontend and API from the same origin.
// Requests carrying a different Origin are rejected for state-changing methods.
app.use((req, res, next) => {
  const unsafe = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const origin = req.get('origin');
  if (unsafe && origin) {
    try {
      const originUrl = new URL(origin);
      const expectedHost = req.get('host');
      if (originUrl.host !== expectedHost) {
        return res.status(403).json({ success: false, message: 'Cross-origin request blocked.' });
      }
    } catch {
      return res.status(403).json({ success: false, message: 'Invalid request origin.' });
    }
  }
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Try again later.' }
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Railway Reservation API is running.' });
});
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);

const publicDirectory = path.join(__dirname, '..', 'public');
app.use(express.static(publicDirectory));
app.get('/', (req, res) => res.sendFile(path.join(publicDirectory, 'index.html')));

app.use('/api', notFound);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
