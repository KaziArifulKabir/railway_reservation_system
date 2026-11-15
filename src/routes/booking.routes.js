const express = require('express');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler, httpError, isValidDateOnly, toPositiveInt } = require('../utils/http');

const router = express.Router();
router.use(authenticate, requireRole('PASSENGER'));

function makeCode(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

router.post('/', asyncHandler(async (req, res) => {
  const scheduleId = toPositiveInt(req.body.scheduleId, 'Schedule');
  const fromId = toPositiveInt(req.body.fromStationId, 'Origin station');
  const toId = toPositiveInt(req.body.toStationId, 'Destination station');
  const journeyDate = String(req.body.journeyDate || '');
  const className = String(req.body.className || '').trim();
  const passengers = Array.isArray(req.body.passengers) ? req.body.passengers : [];

  if (!isValidDateOnly(journeyDate)) throw httpError(400, 'Journey date must use YYYY-MM-DD format.');
  const nowForDate = new Date();
  const todayForDate = `${nowForDate.getFullYear()}-${String(nowForDate.getMonth() + 1).padStart(2, '0')}-${String(nowForDate.getDate()).padStart(2, '0')}`;
  if (journeyDate < todayForDate) throw httpError(400, 'Journey date cannot be in the past.');
  if (fromId === toId) throw httpError(400, 'Origin and destination must be different.');
  if (!className || className.length > 50) throw httpError(400, 'A valid travel class is required.');
  if (passengers.length < 1 || passengers.length > 5) throw httpError(400, 'Select between 1 and 5 passengers per booking.');

  if (passengers.some((passenger) => !passenger || typeof passenger !== 'object')) throw httpError(400, 'Each passenger entry must be an object.');
  const seatIds = passengers.map((passenger) => toPositiveInt(passenger.seatId, 'Seat'));
  if (new Set(seatIds).size !== seatIds.length) throw httpError(400, 'A seat cannot be selected more than once.');

  for (const passenger of passengers) {
    const name = String(passenger.fullName || '').trim();
    if (name.length < 2 || name.length > 120) throw httpError(400, 'Each passenger must have a valid full name.');
    const idType = String(passenger.idType || 'OTHER').toUpperCase();
    if (!['NID', 'BIRTH_CERTIFICATE', 'PASSPORT', 'OTHER'].includes(idType)) throw httpError(400, 'Invalid passenger ID type.');
    const idNumber = String(passenger.idNumber || '').trim();
    if (idNumber.length > 60) throw httpError(400, 'Passenger ID number is too long.');
  }

  const holdMinutes = Math.max(2, Math.min(30, Number(process.env.BOOKING_HOLD_MINUTES || 10)));
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [scheduleRows] = await connection.execute(
      `SELECT s.schedule_id, s.train_id, s.route_id
       FROM schedules s
       JOIN schedule_days sd ON sd.schedule_id = s.schedule_id AND sd.day_of_week = DAYOFWEEK(?)
       JOIN route_stops rs1 ON rs1.route_id = s.route_id AND rs1.station_id = ?
       JOIN route_stops rs2 ON rs2.route_id = s.route_id AND rs2.station_id = ?
       WHERE s.schedule_id = ? AND s.is_active = TRUE AND rs1.stop_order < rs2.stop_order
       FOR UPDATE`,
      [journeyDate, fromId, toId, scheduleId]
    );
    if (!scheduleRows.length) throw httpError(400, 'The selected train does not operate on this route and date.');
    const schedule = scheduleRows[0];

    const [fareRows] = await connection.execute(
      `SELECT fare_amount FROM fares WHERE schedule_id = ? AND origin_station_id = ?
       AND destination_station_id = ? AND class_name = ? FOR UPDATE`,
      [scheduleId, fromId, toId, className]
    );
    if (!fareRows.length) throw httpError(400, 'Fare is not configured for the selected class and route.');
    const fare = Number(fareRows[0].fare_amount);
    const totalAmount = fare * passengers.length;

    const placeholders = seatIds.map(() => '?').join(',');
    const [validSeats] = await connection.execute(
      `SELECT se.seat_id FROM seats se
       JOIN coaches c ON c.coach_id = se.coach_id
       WHERE c.train_id = ? AND c.class_name = ? AND se.is_active = TRUE
         AND c.is_active = TRUE AND se.seat_id IN (${placeholders})
       FOR UPDATE`,
      [schedule.train_id, className, ...seatIds]
    );
    if (validSeats.length !== seatIds.length) throw httpError(400, 'One or more selected seats do not belong to this train and class.');

    const bookingCode = makeCode('RRS');
    const [bookingResult] = await connection.execute(
      `INSERT INTO bookings
       (booking_code, user_id, schedule_id, journey_date, origin_station_id,
        destination_station_id, total_amount, booking_status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', TIMESTAMPADD(MINUTE, ?, NOW()))`,
      [bookingCode, req.user.user_id, scheduleId, journeyDate, fromId, toId, totalAmount, holdMinutes]
    );
    const bookingId = bookingResult.insertId;

    for (const passenger of passengers) {
      const seatId = Number(passenger.seatId);
      const [existingRows] = await connection.execute(
        `SELECT reservation_id, reservation_status, hold_expires_at
         FROM seat_reservations
         WHERE schedule_id = ? AND journey_date = ? AND seat_id = ?
         FOR UPDATE`,
        [scheduleId, journeyDate, seatId]
      );

      let reservationId;
      if (existingRows.length) {
        const existing = existingRows[0];
        const activeHold = existing.reservation_status === 'HELD' && existing.hold_expires_at && new Date(existing.hold_expires_at) > new Date();
        if (existing.reservation_status === 'CONFIRMED' || activeHold) {
          throw httpError(409, 'One of the selected seats has just been reserved by another passenger. Please choose another seat.');
        }
        await connection.execute(
          `UPDATE seat_reservations
           SET booking_id = ?, reservation_status = 'HELD',
               hold_expires_at = TIMESTAMPADD(MINUTE, ?, NOW())
           WHERE reservation_id = ?`,
          [bookingId, holdMinutes, existing.reservation_id]
        );
        reservationId = existing.reservation_id;
      } else {
        const [reservationResult] = await connection.execute(
          `INSERT INTO seat_reservations
           (booking_id, schedule_id, journey_date, seat_id, reservation_status, hold_expires_at)
           VALUES (?, ?, ?, ?, 'HELD', TIMESTAMPADD(MINUTE, ?, NOW()))`,
          [bookingId, scheduleId, journeyDate, seatId, holdMinutes]
        );
        reservationId = reservationResult.insertId;
      }

      await connection.execute(
        `INSERT INTO booking_details
         (booking_id, seat_id, passenger_name, passenger_id_type, passenger_id_number, fare_amount)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [bookingId, seatId, String(passenger.fullName).trim(), String(passenger.idType || 'OTHER').toUpperCase(), String(passenger.idNumber || '').trim() || null, fare]
      );
    }

    await connection.commit();
    res.status(201).json({
      success: true,
      message: `Seats held for ${holdMinutes} minutes. Complete the demo payment to confirm your booking.`,
      booking: { bookingId, bookingCode, totalAmount, journeyDate, status: 'PENDING', holdMinutes }
    });
  } catch (error) {
    await connection.rollback();
    if (['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) throw httpError(409, 'Seat reservation conflict. Please search and select again.');
    throw error;
  } finally {
    connection.release();
  }
}));

router.post('/:bookingId/pay', asyncHandler(async (req, res) => {
  const bookingId = toPositiveInt(req.params.bookingId, 'Booking');
  const decision = String(req.body.decision || '').toUpperCase();
  if (!['SUCCESS', 'FAILURE'].includes(decision)) throw httpError(400, 'Demo payment decision must be SUCCESS or FAILURE.');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [bookingRows] = await connection.execute(
      `SELECT * FROM bookings WHERE booking_id = ? AND user_id = ? FOR UPDATE`,
      [bookingId, req.user.user_id]
    );
    if (!bookingRows.length) throw httpError(404, 'Booking not found.');
    const booking = bookingRows[0];
    if (booking.booking_status === 'CONFIRMED') throw httpError(409, 'This booking is already confirmed.');
    if (booking.booking_status !== 'PENDING') throw httpError(409, 'This booking is not awaiting payment.');
    if (!booking.expires_at || new Date(booking.expires_at) <= new Date()) {
      await connection.execute("UPDATE bookings SET booking_status = 'EXPIRED' WHERE booking_id = ?", [bookingId]);
      await connection.execute("UPDATE seat_reservations SET reservation_status = 'RELEASED' WHERE booking_id = ? AND reservation_status = 'HELD'", [bookingId]);
      await connection.commit();
      return res.status(409).json({ success: false, message: 'The seat hold expired. Please create a new booking.' });
    }

    const [reservationRows] = await connection.execute(
      `SELECT reservation_id FROM seat_reservations
       WHERE booking_id = ? AND reservation_status = 'HELD' AND hold_expires_at > NOW()
       FOR UPDATE`,
      [bookingId]
    );
    const [detailRows] = await connection.execute('SELECT COUNT(*) AS count FROM booking_details WHERE booking_id = ?', [bookingId]);
    if (!reservationRows.length || Number(detailRows[0].count) !== reservationRows.length) {
      throw httpError(409, 'The seat hold is no longer valid. Please create a new booking.');
    }

    const transactionId = decision === 'SUCCESS' ? makeCode('DEMO-PAY') : null;
    await connection.execute(
      `INSERT INTO payments (booking_id, provider, payment_method, transaction_id, amount, payment_status, gateway_response)
       VALUES (?, 'DEMO_GATEWAY', 'SIMULATED', ?, ?, ?, ?)
      `,
      [bookingId, transactionId, booking.total_amount, decision, JSON.stringify({ mode: 'DEMO_ONLY', decision, note: 'No real payment was processed.' })]
    );

    if (decision === 'FAILURE') {
      await connection.commit();
      return res.json({ success: true, paymentSuccessful: false, message: 'Demo payment failed. Your pending booking remains available until the seat hold expires.' });
    }

    await connection.execute("UPDATE seat_reservations SET reservation_status = 'CONFIRMED', hold_expires_at = NULL WHERE booking_id = ?", [bookingId]);
    await connection.execute("UPDATE bookings SET booking_status = 'CONFIRMED', expires_at = NULL WHERE booking_id = ?", [bookingId]);
    const ticketNumber = makeCode('TKT');
    await connection.execute(
      `INSERT INTO tickets (booking_id, ticket_number, ticket_status) VALUES (?, ?, 'ISSUED')`,
      [bookingId, ticketNumber]
    );

    await connection.commit();
    res.json({ success: true, paymentSuccessful: true, message: 'Demo payment successful. Booking confirmed.', ticketNumber });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT b.booking_id, b.booking_code, b.journey_date, b.total_amount, b.booking_status,
            t.train_name, t.train_number, st1.station_name AS origin_name,
            st2.station_name AS destination_name, tk.ticket_number
     FROM bookings b
     JOIN schedules sc ON sc.schedule_id = b.schedule_id
     JOIN route_stops origin_stop ON origin_stop.route_id = sc.route_id AND origin_stop.station_id = b.origin_station_id
     JOIN trains t ON t.train_id = sc.train_id
     JOIN stations st1 ON st1.station_id = b.origin_station_id
     JOIN stations st2 ON st2.station_id = b.destination_station_id
     LEFT JOIN tickets tk ON tk.booking_id = b.booking_id
     WHERE b.user_id = ? ORDER BY b.created_at DESC`,
    [req.user.user_id]
  );
  res.json({ success: true, bookings: rows });
}));

router.get('/:bookingId', asyncHandler(async (req, res) => {
  const bookingId = toPositiveInt(req.params.bookingId, 'Booking');
  const [rows] = await pool.execute(
    `SELECT b.booking_id, b.booking_code, b.journey_date, b.total_amount, b.booking_status,
            b.created_at, t.train_name, t.train_number,
            DATE_FORMAT(SEC_TO_TIME(TIME_TO_SEC(sc.departure_time) + origin_stop.departure_offset_minutes * 60), '%H:%i') AS departure_time,
            st1.station_name AS origin_name, st2.station_name AS destination_name,
            tk.ticket_number, tk.ticket_status,
            bd.passenger_name, bd.passenger_id_type, bd.passenger_id_number,
            bd.fare_amount, se.seat_number, c.coach_code, c.class_name
     FROM bookings b
     JOIN schedules sc ON sc.schedule_id = b.schedule_id
     JOIN route_stops origin_stop ON origin_stop.route_id = sc.route_id AND origin_stop.station_id = b.origin_station_id
     JOIN trains t ON t.train_id = sc.train_id
     JOIN stations st1 ON st1.station_id = b.origin_station_id
     JOIN stations st2 ON st2.station_id = b.destination_station_id
     LEFT JOIN tickets tk ON tk.booking_id = b.booking_id
     JOIN booking_details bd ON bd.booking_id = b.booking_id
     JOIN seats se ON se.seat_id = bd.seat_id
     JOIN coaches c ON c.coach_id = se.coach_id
     WHERE b.booking_id = ? AND b.user_id = ?`,
    [bookingId, req.user.user_id]
  );
  if (!rows.length) throw httpError(404, 'Booking or ticket not found.');
  const first = rows[0];
  res.json({
    success: true,
    booking: {
      bookingId: first.booking_id,
      bookingCode: first.booking_code,
      journeyDate: first.journey_date,
      totalAmount: Number(first.total_amount),
      status: first.booking_status,
      trainName: first.train_name,
      trainNumber: first.train_number,
      departureTime: first.departure_time,
      origin: first.origin_name,
      destination: first.destination_name,
      ticketNumber: first.ticket_number,
      ticketStatus: first.ticket_status,
      passengers: rows.map((row) => ({
        name: row.passenger_name,
        idType: row.passenger_id_type,
        idNumber: row.passenger_id_number,
        fare: Number(row.fare_amount),
        seat: row.seat_number,
        coach: row.coach_code,
        className: row.class_name
      }))
    }
  });
}));

router.post('/:bookingId/cancel', asyncHandler(async (req, res) => {
  const bookingId = toPositiveInt(req.params.bookingId, 'Booking');
  const reason = String(req.body.reason || 'Cancelled by passenger').trim().slice(0, 255);
  const cutoffHours = Math.max(0, Number(process.env.CANCELLATION_CUTOFF_HOURS || 6));
  const refundPercent = Math.max(0, Math.min(100, Number(process.env.DEMO_REFUND_PERCENT || 80)));

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT b.*, s.departure_time, rs.departure_offset_minutes,
              TIMESTAMPADD(MINUTE, rs.departure_offset_minutes,
                TIMESTAMP(CONCAT(b.journey_date, ' ', s.departure_time))) AS departure_at
       FROM bookings b
       JOIN schedules s ON s.schedule_id = b.schedule_id
       JOIN route_stops rs ON rs.route_id = s.route_id AND rs.station_id = b.origin_station_id
       WHERE b.booking_id = ? AND b.user_id = ? FOR UPDATE`,
      [bookingId, req.user.user_id]
    );
    if (!rows.length) throw httpError(404, 'Booking not found.');
    const booking = rows[0];
    if (booking.booking_status !== 'CONFIRMED') throw httpError(409, 'Only confirmed bookings can be cancelled.');
    const departureAt = new Date(booking.departure_at);
    const cutoffAt = departureAt.getTime() - cutoffHours * 60 * 60 * 1000;
    if (Date.now() > cutoffAt) throw httpError(400, `Cancellation is closed within ${cutoffHours} hours of departure under this demo project's sample rule.`);

    const refundAmount = Number((Number(booking.total_amount) * refundPercent / 100).toFixed(2));
    await connection.execute(
      `INSERT INTO cancellations (booking_id, reason, refund_amount, cancellation_status)
       VALUES (?, ?, ?, 'REFUND_SIMULATED')`,
      [bookingId, reason || null, refundAmount]
    );
    await connection.execute("UPDATE bookings SET booking_status = 'CANCELLED' WHERE booking_id = ?", [bookingId]);
    await connection.execute("UPDATE seat_reservations SET reservation_status = 'RELEASED', hold_expires_at = NULL WHERE booking_id = ?", [bookingId]);
    await connection.execute("UPDATE tickets SET ticket_status = 'CANCELLED' WHERE booking_id = ?", [bookingId]);
    await connection.execute(
      `UPDATE payments SET payment_status = 'REFUND_SIMULATED'
       WHERE booking_id = ? AND payment_status = 'SUCCESS'`,
      [bookingId]
    );

    await connection.commit();
    res.json({
      success: true,
      message: 'Ticket cancelled. Refund is recorded as a simulation only; no real money was transferred.',
      refundAmount,
      refundPercent
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

module.exports = router;
