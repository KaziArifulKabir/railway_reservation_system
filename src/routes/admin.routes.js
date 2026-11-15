const express = require('express');
const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler, httpError, toPositiveInt } = require('../utils/http');

const router = express.Router();
router.use(authenticate, requireRole('RAILWAY_AUTHORITY'));

router.get('/dashboard', asyncHandler(async (req, res) => {
  const queries = await Promise.all([
    pool.execute('SELECT COUNT(*) AS total FROM users WHERE role_id = (SELECT role_id FROM roles WHERE role_name = \'PASSENGER\')'),
    pool.execute('SELECT COUNT(*) AS total FROM trains WHERE is_active = TRUE'),
    pool.execute("SELECT COUNT(*) AS total FROM bookings WHERE booking_status = 'CONFIRMED'"),
    pool.execute("SELECT COUNT(*) AS total FROM bookings WHERE booking_status = 'CANCELLED'"),
    pool.execute("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE payment_status = 'SUCCESS'"),
    pool.execute("SELECT COUNT(*) AS total FROM seats WHERE is_active = TRUE")
  ]);
  res.json({ success: true, stats: {
    passengers: Number(queries[0][0][0].total),
    trains: Number(queries[1][0][0].total),
    confirmedBookings: Number(queries[2][0][0].total),
    cancelledBookings: Number(queries[3][0][0].total),
    successfulPaymentTotal: Number(queries[4][0][0].total),
    configuredSeats: Number(queries[5][0][0].total)
  }});
}));

router.get('/users', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT u.user_id, u.full_name, u.email, u.phone, u.account_status, u.created_at, r.role_name
     FROM users u JOIN roles r ON r.role_id = u.role_id ORDER BY u.created_at DESC LIMIT 500`
  );
  res.json({ success: true, users: rows });
}));

router.patch('/users/:id/status', asyncHandler(async (req, res) => {
  const userId = toPositiveInt(req.params.id, 'User');
  const status = String(req.body.status || '').toUpperCase();
  if (!['ACTIVE', 'BLOCKED'].includes(status)) throw httpError(400, 'Status must be ACTIVE or BLOCKED.');
  if (userId === req.user.user_id) throw httpError(400, 'You cannot change your own account status.');
  const [result] = await pool.execute(
    `UPDATE users SET account_status = ?
     WHERE user_id = ? AND role_id = (SELECT role_id FROM roles WHERE role_name = 'PASSENGER')`,
    [status, userId]
  );
  if (!result.affectedRows) throw httpError(404, 'Passenger not found.');
  res.json({ success: true, message: `Passenger account ${status.toLowerCase()}.` });
}));

router.get('/trains', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM trains ORDER BY train_name');
  res.json({ success: true, trains: rows });
}));

router.post('/trains', asyncHandler(async (req, res) => {
  const trainNumber = String(req.body.trainNumber || '').trim();
  const trainName = String(req.body.trainName || '').trim();
  const trainType = String(req.body.trainType || 'Intercity').trim();
  if (!trainNumber || !trainName) throw httpError(400, 'Train number and train name are required.');
  try {
    const [result] = await pool.execute('INSERT INTO trains (train_number, train_name, train_type) VALUES (?, ?, ?)', [trainNumber, trainName, trainType]);
    res.status(201).json({ success: true, message: 'Train created.', trainId: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw httpError(409, 'This train number already exists.');
    throw error;
  }
}));

router.put('/trains/:id', asyncHandler(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'Train');
  const trainNumber = String(req.body.trainNumber || '').trim();
  const trainName = String(req.body.trainName || '').trim();
  const trainType = String(req.body.trainType || 'Intercity').trim();
  const active = req.body.isActive === false ? 0 : 1;
  if (!trainNumber || !trainName) throw httpError(400, 'Train number and train name are required.');
  try {
    const [result] = await pool.execute('UPDATE trains SET train_number = ?, train_name = ?, train_type = ?, is_active = ? WHERE train_id = ?', [trainNumber, trainName, trainType, active, id]);
    if (!result.affectedRows) throw httpError(404, 'Train not found or unchanged.');
    res.json({ success: true, message: 'Train updated.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw httpError(409, 'This train number already exists.');
    throw error;
  }
}));

router.delete('/trains/:id', asyncHandler(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'Train');
  const [result] = await pool.execute('UPDATE trains SET is_active = FALSE WHERE train_id = ?', [id]);
  if (!result.affectedRows) throw httpError(404, 'Train not found.');
  res.json({ success: true, message: 'Train deactivated. Historical records are preserved.' });
}));

router.get('/stations', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM stations ORDER BY station_name');
  res.json({ success: true, stations: rows });
}));

router.post('/stations', asyncHandler(async (req, res) => {
  const stationName = String(req.body.stationName || '').trim();
  const stationCode = String(req.body.stationCode || '').trim().toUpperCase();
  const city = String(req.body.city || '').trim();
  if (!stationName || !stationCode || !city) throw httpError(400, 'Station name, code and city are required.');
  try {
    const [result] = await pool.execute('INSERT INTO stations (station_name, station_code, city) VALUES (?, ?, ?)', [stationName, stationCode, city]);
    res.status(201).json({ success: true, message: 'Station created.', stationId: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw httpError(409, 'Station code already exists.');
    throw error;
  }
}));

router.put('/stations/:id', asyncHandler(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'Station');
  const stationName = String(req.body.stationName || '').trim();
  const stationCode = String(req.body.stationCode || '').trim().toUpperCase();
  const city = String(req.body.city || '').trim();
  const active = req.body.isActive === false ? 0 : 1;
  if (!stationName || !stationCode || !city) throw httpError(400, 'Station name, code and city are required.');
  const [result] = await pool.execute('UPDATE stations SET station_name = ?, station_code = ?, city = ?, is_active = ? WHERE station_id = ?', [stationName, stationCode, city, active, id]);
  if (!result.affectedRows) throw httpError(404, 'Station not found or unchanged.');
  res.json({ success: true, message: 'Station updated.' });
}));

router.delete('/stations/:id', asyncHandler(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'Station');
  const [result] = await pool.execute('UPDATE stations SET is_active = FALSE WHERE station_id = ?', [id]);
  if (!result.affectedRows) throw httpError(404, 'Station not found.');
  res.json({ success: true, message: 'Station deactivated. Historical records are preserved.' });
}));

router.get('/routes', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT r.route_id, r.route_name, r.is_active,
            GROUP_CONCAT(CONCAT(rs.stop_order, ': ', st.station_name) ORDER BY rs.stop_order SEPARATOR ' → ') AS stops
     FROM routes r LEFT JOIN route_stops rs ON rs.route_id = r.route_id
     LEFT JOIN stations st ON st.station_id = rs.station_id
     GROUP BY r.route_id ORDER BY r.route_name`
  );
  res.json({ success: true, routes: rows });
}));

router.post('/routes', asyncHandler(async (req, res) => {
  const routeName = String(req.body.routeName || '').trim();
  const stops = Array.isArray(req.body.stops) ? req.body.stops : [];
  if (routeName.length < 3 || stops.length < 2) throw httpError(400, 'Route name and at least two ordered stops are required.');
  if (stops.some((stop) => !stop || typeof stop !== 'object')) throw httpError(400, 'Each route stop must contain a station ID.');
  const stationIds = stops.map((stop) => toPositiveInt(stop.stationId, 'Station'));
  if (new Set(stationIds).size !== stationIds.length) throw httpError(400, 'A station cannot appear twice in the same route.');
  if (Number(stops[0].arrivalOffsetMinutes || 0) !== 0 || Number(stops[0].departureOffsetMinutes || 0) !== 0) throw httpError(400, 'The first route stop must use offset 0 minutes.');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute('INSERT INTO routes (route_name) VALUES (?)', [routeName]);
    for (let index = 0; index < stops.length; index += 1) {
      const arrivalOffset = Math.max(0, Number(stops[index].arrivalOffsetMinutes || 0));
      const departureOffset = Math.max(arrivalOffset, Number(stops[index].departureOffsetMinutes || arrivalOffset));
      await connection.execute(
        `INSERT INTO route_stops (route_id, station_id, stop_order, arrival_offset_minutes, departure_offset_minutes)
         VALUES (?, ?, ?, ?, ?)`,
        [result.insertId, stationIds[index], index + 1, arrivalOffset, departureOffset]
      );
    }
    await connection.commit();
    res.status(201).json({ success: true, message: 'Route created.', routeId: result.insertId });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.get('/schedules', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT s.schedule_id, t.train_name, t.train_number, r.route_name, s.departure_time,
            GROUP_CONCAT(sd.day_of_week ORDER BY sd.day_of_week) AS operating_days,
            s.is_active
     FROM schedules s JOIN trains t ON t.train_id = s.train_id
     JOIN routes r ON r.route_id = s.route_id
     LEFT JOIN schedule_days sd ON sd.schedule_id = s.schedule_id
     GROUP BY s.schedule_id ORDER BY t.train_name`
  );
  res.json({ success: true, schedules: rows });
}));

router.post('/schedules', asyncHandler(async (req, res) => {
  const trainId = toPositiveInt(req.body.trainId, 'Train');
  const routeId = toPositiveInt(req.body.routeId, 'Route');
  const departureTime = String(req.body.departureTime || '');
  const days = Array.isArray(req.body.days) ? [...new Set(req.body.days.map(Number))] : [];
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(departureTime)) throw httpError(400, 'Departure time must use HH:MM format.');
  if (!days.length || days.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) throw httpError(400, 'Select at least one valid operating day (1=Sunday through 7=Saturday).');
  const [routeTrain] = await pool.execute('SELECT route_id FROM routes WHERE route_id = ? AND is_active = TRUE', [routeId]);
  const [train] = await pool.execute('SELECT train_id FROM trains WHERE train_id = ? AND is_active = TRUE', [trainId]);
  if (!routeTrain.length || !train.length) throw httpError(400, 'Select an active train and route.');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute('INSERT INTO schedules (train_id, route_id, departure_time) VALUES (?, ?, ?)', [trainId, routeId, `${departureTime}:00`]);
    for (const day of days) {
      await connection.execute('INSERT INTO schedule_days (schedule_id, day_of_week) VALUES (?, ?)', [result.insertId, day]);
    }
    await connection.commit();
    res.status(201).json({ success: true, message: 'Schedule created.', scheduleId: result.insertId });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.get('/coaches', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT c.coach_id, c.coach_code, c.class_name, c.seat_capacity, c.is_active,
            t.train_name, t.train_number, COUNT(se.seat_id) AS created_seats
     FROM coaches c JOIN trains t ON t.train_id = c.train_id
     LEFT JOIN seats se ON se.coach_id = c.coach_id
     GROUP BY c.coach_id ORDER BY t.train_name, c.coach_code`
  );
  res.json({ success: true, coaches: rows });
}));

router.post('/coaches', asyncHandler(async (req, res) => {
  const trainId = toPositiveInt(req.body.trainId, 'Train');
  const coachCode = String(req.body.coachCode || '').trim().toUpperCase();
  const className = String(req.body.className || '').trim();
  const seatNumbers = Array.isArray(req.body.seatNumbers) ? req.body.seatNumbers.map((item) => String(item).trim().toUpperCase()).filter(Boolean) : [];
  if (!coachCode || !className || !seatNumbers.length || seatNumbers.length > 100) throw httpError(400, 'Coach code, class and 1–100 seat numbers are required.');
  if (new Set(seatNumbers).size !== seatNumbers.length) throw httpError(400, 'Seat numbers must be unique within a coach.');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute('INSERT INTO coaches (train_id, coach_code, class_name, seat_capacity) VALUES (?, ?, ?, ?)', [trainId, coachCode, className, seatNumbers.length]);
    for (const seatNumber of seatNumbers) {
      await connection.execute('INSERT INTO seats (coach_id, seat_number) VALUES (?, ?)', [result.insertId, seatNumber]);
    }
    await connection.commit();
    res.status(201).json({ success: true, message: 'Coach and seats created.', coachId: result.insertId });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw httpError(409, 'Coach code or seat number already exists.');
    throw error;
  } finally {
    connection.release();
  }
}));

router.get('/fares', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT f.fare_id, f.fare_amount, f.class_name, s.schedule_id,
            t.train_name, st1.station_name AS origin_name, st2.station_name AS destination_name
     FROM fares f JOIN schedules s ON s.schedule_id = f.schedule_id
     JOIN trains t ON t.train_id = s.train_id
     JOIN stations st1 ON st1.station_id = f.origin_station_id
     JOIN stations st2 ON st2.station_id = f.destination_station_id
     ORDER BY t.train_name, f.class_name`
  );
  res.json({ success: true, fares: rows });
}));

router.post('/fares', asyncHandler(async (req, res) => {
  const scheduleId = toPositiveInt(req.body.scheduleId, 'Schedule');
  const originId = toPositiveInt(req.body.originStationId, 'Origin station');
  const destinationId = toPositiveInt(req.body.destinationStationId, 'Destination station');
  const className = String(req.body.className || '').trim();
  const amount = Number(req.body.fareAmount);
  if (!className || !Number.isFinite(amount) || amount < 0) throw httpError(400, 'Valid class and fare amount are required.');
  if (originId === destinationId) throw httpError(400, 'Origin and destination must be different.');
  const [validFareRoute] = await pool.execute(
    `SELECT s.schedule_id FROM schedules s
     JOIN route_stops rs1 ON rs1.route_id = s.route_id AND rs1.station_id = ?
     JOIN route_stops rs2 ON rs2.route_id = s.route_id AND rs2.station_id = ? AND rs1.stop_order < rs2.stop_order
     WHERE s.schedule_id = ? LIMIT 1`,
    [originId, destinationId, scheduleId]
  );
  if (!validFareRoute.length) throw httpError(400, 'The fare stations must appear in the correct order on the selected schedule route.');
  const [result] = await pool.execute(
    `INSERT INTO fares (schedule_id, origin_station_id, destination_station_id, class_name, fare_amount)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE fare_amount = VALUES(fare_amount)`,
    [scheduleId, originId, destinationId, className, amount]
  );
  res.status(201).json({ success: true, message: 'Fare saved.', fareId: result.insertId || null });
}));

router.get('/bookings', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT b.booking_id, b.booking_code, b.journey_date, b.total_amount, b.booking_status,
            u.full_name AS passenger_name, u.email, t.train_name, t.train_number,
            st1.station_name AS origin_name, st2.station_name AS destination_name
     FROM bookings b JOIN users u ON u.user_id = b.user_id
     JOIN schedules s ON s.schedule_id = b.schedule_id
     JOIN trains t ON t.train_id = s.train_id
     JOIN stations st1 ON st1.station_id = b.origin_station_id
     JOIN stations st2 ON st2.station_id = b.destination_station_id
     ORDER BY b.created_at DESC LIMIT 500`
  );
  res.json({ success: true, bookings: rows });
}));

router.get('/reports/summary', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
            COUNT(*) AS bookings,
            SUM(CASE WHEN booking_status = 'CONFIRMED' THEN total_amount ELSE 0 END) AS confirmed_value,
            SUM(CASE WHEN booking_status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancellations
     FROM bookings GROUP BY DATE_FORMAT(created_at, '%Y-%m') ORDER BY month DESC LIMIT 12`
  );
  res.json({ success: true, monthly: rows });
}));


// Update a route's display name. Route-stop order is intentionally managed as a new route
// after bookings exist, so historical journey data is not silently rewritten.
router.put('/routes/:id', asyncHandler(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'Route');
  const routeName = String(req.body.routeName || '').trim();
  if (routeName.length < 3 || routeName.length > 160) throw httpError(400, 'Route name must be between 3 and 160 characters.');
  try {
    const [result] = await pool.execute('UPDATE routes SET route_name = ? WHERE route_id = ?', [routeName, id]);
    if (!result.affectedRows) throw httpError(404, 'Route not found or unchanged.');
    res.json({ success: true, message: 'Route name updated.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw httpError(409, 'This route name already exists.');
    throw error;
  }
}));

router.delete('/routes/:id', asyncHandler(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'Route');
  const [result] = await pool.execute('UPDATE routes SET is_active = FALSE WHERE route_id = ?', [id]);
  if (!result.affectedRows) throw httpError(404, 'Route not found.');
  res.json({ success: true, message: 'Route deactivated. Historical records are preserved.' });
}));

router.put('/schedules/:id', asyncHandler(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'Schedule');
  const departureTime = String(req.body.departureTime || '');
  const days = Array.isArray(req.body.days) ? [...new Set(req.body.days.map(Number))] : [];
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(departureTime)) throw httpError(400, 'Departure time must use HH:MM format.');
  if (!days.length || days.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) throw httpError(400, 'Select valid operating days.');
  const [bookings] = await pool.execute('SELECT COUNT(*) AS total FROM bookings WHERE schedule_id = ?', [id]);
  if (Number(bookings[0].total) > 0) throw httpError(409, 'This schedule has booking history. Create a new schedule instead of changing historical journey details.');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute('UPDATE schedules SET departure_time = ? WHERE schedule_id = ?', [`${departureTime}:00`, id]);
    if (!result.affectedRows) throw httpError(404, 'Schedule not found or unchanged.');
    await connection.execute('DELETE FROM schedule_days WHERE schedule_id = ?', [id]);
    for (const day of days) await connection.execute('INSERT INTO schedule_days (schedule_id, day_of_week) VALUES (?, ?)', [id, day]);
    await connection.commit();
    res.json({ success: true, message: 'Schedule updated.' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.delete('/schedules/:id', asyncHandler(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'Schedule');
  const [result] = await pool.execute('UPDATE schedules SET is_active = FALSE WHERE schedule_id = ?', [id]);
  if (!result.affectedRows) throw httpError(404, 'Schedule not found.');
  res.json({ success: true, message: 'Schedule deactivated.' });
}));

router.patch('/coaches/:id/status', asyncHandler(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'Coach');
  const active = req.body.isActive === false ? 0 : req.body.isActive === true ? 1 : null;
  if (active === null) throw httpError(400, 'isActive must be true or false.');
  const [result] = await pool.execute('UPDATE coaches SET is_active = ? WHERE coach_id = ?', [active, id]);
  if (!result.affectedRows) throw httpError(404, 'Coach not found or unchanged.');
  res.json({ success: true, message: 'Coach status updated.' });
}));

router.get('/seats', asyncHandler(async (req, res) => {
  const coachId = toPositiveInt(req.query.coachId, 'Coach');
  const [rows] = await pool.execute(
    `SELECT se.seat_id, se.seat_number, se.seat_type, se.is_active, c.coach_code, c.class_name
     FROM seats se JOIN coaches c ON c.coach_id = se.coach_id
     WHERE se.coach_id = ? ORDER BY se.seat_number`, [coachId]
  );
  res.json({ success: true, seats: rows });
}));

router.patch('/seats/:id/status', asyncHandler(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'Seat');
  const active = req.body.isActive === false ? 0 : req.body.isActive === true ? 1 : null;
  if (active === null) throw httpError(400, 'isActive must be true or false.');
  const [result] = await pool.execute('UPDATE seats SET is_active = ? WHERE seat_id = ?', [active, id]);
  if (!result.affectedRows) throw httpError(404, 'Seat not found or unchanged.');
  res.json({ success: true, message: 'Seat status updated.' });
}));

router.delete('/fares/:id', asyncHandler(async (req, res) => {
  const id = toPositiveInt(req.params.id, 'Fare');
  const [result] = await pool.execute('DELETE FROM fares WHERE fare_id = ?', [id]);
  if (!result.affectedRows) throw httpError(404, 'Fare not found.');
  res.json({ success: true, message: 'Fare deleted.' });
}));

router.post('/bookings/:id/cancel', asyncHandler(async (req, res) => {
  const bookingId = toPositiveInt(req.params.id, 'Booking');
  const reason = String(req.body.reason || 'Cancelled by Railway Authority').trim().slice(0, 255);
  const cutoffHours = Math.max(0, Number(process.env.CANCELLATION_CUTOFF_HOURS || 6));
  const refundPercent = Math.max(0, Math.min(100, Number(process.env.DEMO_REFUND_PERCENT || 80)));
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT b.*, TIMESTAMPADD(MINUTE, rs.departure_offset_minutes,
         TIMESTAMP(CONCAT(b.journey_date, ' ', s.departure_time))) AS departure_at
       FROM bookings b JOIN schedules s ON s.schedule_id = b.schedule_id
       JOIN route_stops rs ON rs.route_id = s.route_id AND rs.station_id = b.origin_station_id
       WHERE b.booking_id = ? FOR UPDATE`, [bookingId]
    );
    if (!rows.length) throw httpError(404, 'Booking not found.');
    const booking = rows[0];
    if (booking.booking_status !== 'CONFIRMED') throw httpError(409, 'Only confirmed bookings can be cancelled.');
    const departureAt = new Date(booking.departure_at);
    if (Date.now() > departureAt.getTime() - cutoffHours * 60 * 60 * 1000) throw httpError(400, `Cancellation is closed within ${cutoffHours} hours of departure under this demo rule.`);
    const refundAmount = Number((Number(booking.total_amount) * refundPercent / 100).toFixed(2));
    await connection.execute(
      `INSERT INTO cancellations (booking_id, reason, refund_amount, cancellation_status)
       VALUES (?, ?, ?, 'REFUND_SIMULATED')`, [bookingId, reason || null, refundAmount]
    );
    await connection.execute("UPDATE bookings SET booking_status = 'CANCELLED' WHERE booking_id = ?", [bookingId]);
    await connection.execute("UPDATE seat_reservations SET reservation_status = 'RELEASED', hold_expires_at = NULL WHERE booking_id = ?", [bookingId]);
    await connection.execute("UPDATE tickets SET ticket_status = 'CANCELLED' WHERE booking_id = ?", [bookingId]);
    await connection.execute("UPDATE payments SET payment_status = 'REFUND_SIMULATED' WHERE booking_id = ? AND payment_status = 'SUCCESS'", [bookingId]);
    await connection.commit();
    res.json({ success: true, message: 'Booking cancelled; refund recorded as a simulation only.', refundAmount });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

module.exports = router;
