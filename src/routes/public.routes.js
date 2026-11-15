const express = require('express');
const { pool } = require('../config/db');
const { asyncHandler, httpError, isValidDateOnly, toPositiveInt } = require('../utils/http');

const router = express.Router();

router.get('/stations', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT station_id, station_name, station_code, city FROM stations WHERE is_active = TRUE ORDER BY station_name'
  );
  res.json({ success: true, stations: rows });
}));

router.get('/trains/search', asyncHandler(async (req, res) => {
  const fromId = toPositiveInt(req.query.fromStationId, 'Origin station');
  const toId = toPositiveInt(req.query.toStationId, 'Destination station');
  const journeyDate = String(req.query.journeyDate || '');
  if (!isValidDateOnly(journeyDate)) throw httpError(400, 'Journey date must use YYYY-MM-DD format.');
  if (fromId === toId) throw httpError(400, 'Origin and destination stations must be different.');

  const today = new Date();
  const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (journeyDate < todayText) throw httpError(400, 'Journey date cannot be in the past.');

  const [rows] = await pool.execute(
    `SELECT s.schedule_id, t.train_id, t.train_number, t.train_name, t.train_type,
            r.route_name,
            st_from.station_name AS origin_name,
            st_to.station_name AS destination_name,
            DATE_FORMAT(SEC_TO_TIME(TIME_TO_SEC(s.departure_time) + rs_from.departure_offset_minutes * 60), '%H:%i') AS departure_time,
            DATE_FORMAT(SEC_TO_TIME(TIME_TO_SEC(s.departure_time) + rs_to.arrival_offset_minutes * 60), '%H:%i') AS arrival_time,
            f.class_name, f.fare_amount,
            COUNT(DISTINCT se.seat_id) AS total_seats,
            COUNT(DISTINCT CASE
              WHEN sr.reservation_status = 'CONFIRMED'
                OR (sr.reservation_status = 'HELD' AND sr.hold_expires_at > NOW())
              THEN se.seat_id END) AS occupied_seats
     FROM schedules s
     JOIN trains t ON t.train_id = s.train_id AND t.is_active = TRUE
     JOIN routes r ON r.route_id = s.route_id AND r.is_active = TRUE
     JOIN route_stops rs_from ON rs_from.route_id = r.route_id AND rs_from.station_id = ?
     JOIN route_stops rs_to ON rs_to.route_id = r.route_id AND rs_to.station_id = ? AND rs_to.stop_order > rs_from.stop_order
     JOIN stations st_from ON st_from.station_id = rs_from.station_id
     JOIN stations st_to ON st_to.station_id = rs_to.station_id
     JOIN schedule_days sd ON sd.schedule_id = s.schedule_id AND sd.day_of_week = DAYOFWEEK(?)
     JOIN fares f ON f.schedule_id = s.schedule_id
                 AND f.origin_station_id = ? AND f.destination_station_id = ?
     JOIN coaches c ON c.train_id = t.train_id AND c.class_name = f.class_name AND c.is_active = TRUE
     JOIN seats se ON se.coach_id = c.coach_id AND se.is_active = TRUE
     LEFT JOIN seat_reservations sr ON sr.schedule_id = s.schedule_id
          AND sr.journey_date = ? AND sr.seat_id = se.seat_id
          AND (sr.reservation_status = 'CONFIRMED'
               OR (sr.reservation_status = 'HELD' AND sr.hold_expires_at > NOW()))
     WHERE s.is_active = TRUE
     GROUP BY s.schedule_id, t.train_id, t.train_number, t.train_name, t.train_type,
              r.route_name, st_from.station_name, st_to.station_name,
              s.departure_time, rs_from.departure_offset_minutes,
              rs_to.arrival_offset_minutes, f.class_name, f.fare_amount
     ORDER BY departure_time, t.train_name, f.class_name`,
    [fromId, toId, journeyDate, fromId, toId, journeyDate]
  );

  const results = rows.map((row) => ({
    ...row,
    total_seats: Number(row.total_seats),
    occupied_seats: Number(row.occupied_seats),
    available_seats: Math.max(0, Number(row.total_seats) - Number(row.occupied_seats))
  }));
  res.json({ success: true, journeyDate, results });
}));

router.get('/trains/:scheduleId/seats', asyncHandler(async (req, res) => {
  const scheduleId = toPositiveInt(req.params.scheduleId, 'Schedule');
  const fromId = toPositiveInt(req.query.fromStationId, 'Origin station');
  const toId = toPositiveInt(req.query.toStationId, 'Destination station');
  const journeyDate = String(req.query.journeyDate || '');
  const className = String(req.query.className || '').trim();
  if (!isValidDateOnly(journeyDate) || !className) throw httpError(400, 'Journey date and class are required.');

  const [routeRows] = await pool.execute(
    `SELECT s.schedule_id, s.train_id, s.route_id, rs1.stop_order AS from_order, rs2.stop_order AS to_order
     FROM schedules s
     JOIN route_stops rs1 ON rs1.route_id = s.route_id AND rs1.station_id = ?
     JOIN route_stops rs2 ON rs2.route_id = s.route_id AND rs2.station_id = ?
     JOIN schedule_days sd ON sd.schedule_id = s.schedule_id AND sd.day_of_week = DAYOFWEEK(?)
     WHERE s.schedule_id = ? AND s.is_active = TRUE AND rs1.stop_order < rs2.stop_order
     LIMIT 1`,
    [fromId, toId, journeyDate, scheduleId]
  );
  if (!routeRows.length) throw httpError(404, 'This train does not operate for the selected route and date.');

  const [fareRows] = await pool.execute(
    `SELECT fare_amount FROM fares WHERE schedule_id = ? AND origin_station_id = ?
     AND destination_station_id = ? AND class_name = ? LIMIT 1`,
    [scheduleId, fromId, toId, className]
  );
  if (!fareRows.length) throw httpError(404, 'Fare is not configured for this class and route.');

  const [seats] = await pool.execute(
    `SELECT se.seat_id, se.seat_number, se.seat_type, c.coach_code, c.class_name,
            CASE
              WHEN sr.reservation_status = 'CONFIRMED' THEN 'BOOKED'
              WHEN sr.reservation_status = 'HELD' AND sr.hold_expires_at > NOW() THEN 'HELD'
              ELSE 'AVAILABLE'
            END AS seat_status
     FROM schedules s
     JOIN coaches c ON c.train_id = s.train_id AND c.class_name = ? AND c.is_active = TRUE
     JOIN seats se ON se.coach_id = c.coach_id AND se.is_active = TRUE
     LEFT JOIN seat_reservations sr ON sr.schedule_id = s.schedule_id
          AND sr.journey_date = ? AND sr.seat_id = se.seat_id
     WHERE s.schedule_id = ?
     ORDER BY c.coach_code, se.seat_number`,
    [className, journeyDate, scheduleId]
  );

  res.json({
    success: true,
    scheduleId,
    journeyDate,
    className,
    fareAmount: Number(fareRows[0].fare_amount),
    seats
  });
}));

module.exports = router;
