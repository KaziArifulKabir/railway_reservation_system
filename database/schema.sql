-- Railway Reservation System database schema
-- Compatible with MySQL 8.0+ / MySQL 8.4. Uses InnoDB and foreign keys.

CREATE DATABASE IF NOT EXISTS railway_reservation_system
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE railway_reservation_system;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS cancellations;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS booking_details;
DROP TABLE IF EXISTS seat_reservations;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS fares;
DROP TABLE IF EXISTS seats;
DROP TABLE IF EXISTS coaches;
DROP TABLE IF EXISTS schedule_days;
DROP TABLE IF EXISTS schedules;
DROP TABLE IF EXISTS route_stops;
DROP TABLE IF EXISTS routes;
DROP TABLE IF EXISTS trains;
DROP TABLE IF EXISTS stations;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE roles (
  role_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(40) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE users (
  user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id BIGINT UNSIGNED NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(25) NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  account_status ENUM('ACTIVE','BLOCKED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id),
  INDEX idx_users_role_status (role_id, account_status)
) ENGINE=InnoDB;

CREATE TABLE stations (
  station_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  station_name VARCHAR(120) NOT NULL,
  station_code VARCHAR(20) NOT NULL UNIQUE,
  city VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE trains (
  train_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  train_number VARCHAR(20) NOT NULL UNIQUE,
  train_name VARCHAR(120) NOT NULL,
  train_type VARCHAR(50) NOT NULL DEFAULT 'Intercity',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE routes (
  route_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  route_name VARCHAR(160) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE route_stops (
  route_stop_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  route_id BIGINT UNSIGNED NOT NULL,
  station_id BIGINT UNSIGNED NOT NULL,
  stop_order SMALLINT UNSIGNED NOT NULL,
  arrival_offset_minutes INT UNSIGNED NOT NULL DEFAULT 0,
  departure_offset_minutes INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_route_stops_route FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE CASCADE,
  CONSTRAINT fk_route_stops_station FOREIGN KEY (station_id) REFERENCES stations(station_id),
  UNIQUE KEY uq_route_stop_order (route_id, stop_order),
  UNIQUE KEY uq_route_station (route_id, station_id),
  INDEX idx_route_stops_station (station_id)
) ENGINE=InnoDB;

CREATE TABLE schedules (
  schedule_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  train_id BIGINT UNSIGNED NOT NULL,
  route_id BIGINT UNSIGNED NOT NULL,
  departure_time TIME NOT NULL COMMENT 'Departure time from the first stop of the route',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedules_train FOREIGN KEY (train_id) REFERENCES trains(train_id),
  CONSTRAINT fk_schedules_route FOREIGN KEY (route_id) REFERENCES routes(route_id),
  INDEX idx_schedules_train_route (train_id, route_id, is_active)
) ENGINE=InnoDB;

CREATE TABLE schedule_days (
  schedule_day_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  schedule_id BIGINT UNSIGNED NOT NULL,
  day_of_week TINYINT UNSIGNED NOT NULL COMMENT 'MySQL DAYOFWEEK: 1=Sunday, 2=Monday, ... 7=Saturday',
  CONSTRAINT fk_schedule_days_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id) ON DELETE CASCADE,
  UNIQUE KEY uq_schedule_day (schedule_id, day_of_week),
  CONSTRAINT chk_schedule_day CHECK (day_of_week BETWEEN 1 AND 7)
) ENGINE=InnoDB;

CREATE TABLE coaches (
  coach_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  train_id BIGINT UNSIGNED NOT NULL,
  coach_code VARCHAR(20) NOT NULL,
  class_name VARCHAR(50) NOT NULL,
  seat_capacity SMALLINT UNSIGNED NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_coaches_train FOREIGN KEY (train_id) REFERENCES trains(train_id) ON DELETE CASCADE,
  UNIQUE KEY uq_train_coach (train_id, coach_code)
) ENGINE=InnoDB;

CREATE TABLE seats (
  seat_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  coach_id BIGINT UNSIGNED NOT NULL,
  seat_number VARCHAR(20) NOT NULL,
  seat_type VARCHAR(30) NOT NULL DEFAULT 'Regular',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_seats_coach FOREIGN KEY (coach_id) REFERENCES coaches(coach_id) ON DELETE CASCADE,
  UNIQUE KEY uq_coach_seat (coach_id, seat_number)
) ENGINE=InnoDB;

CREATE TABLE fares (
  fare_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  schedule_id BIGINT UNSIGNED NOT NULL,
  origin_station_id BIGINT UNSIGNED NOT NULL,
  destination_station_id BIGINT UNSIGNED NOT NULL,
  class_name VARCHAR(50) NOT NULL,
  fare_amount DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_fares_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id) ON DELETE CASCADE,
  CONSTRAINT fk_fares_origin FOREIGN KEY (origin_station_id) REFERENCES stations(station_id),
  CONSTRAINT fk_fares_destination FOREIGN KEY (destination_station_id) REFERENCES stations(station_id),
  UNIQUE KEY uq_fare_pair_class (schedule_id, origin_station_id, destination_station_id, class_name),
  CONSTRAINT chk_fare_positive CHECK (fare_amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE bookings (
  booking_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_code VARCHAR(40) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  schedule_id BIGINT UNSIGNED NOT NULL,
  journey_date DATE NOT NULL,
  origin_station_id BIGINT UNSIGNED NOT NULL,
  destination_station_id BIGINT UNSIGNED NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  booking_status ENUM('PENDING','CONFIRMED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  expires_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT fk_bookings_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id),
  CONSTRAINT fk_bookings_origin FOREIGN KEY (origin_station_id) REFERENCES stations(station_id),
  CONSTRAINT fk_bookings_destination FOREIGN KEY (destination_station_id) REFERENCES stations(station_id),
  INDEX idx_booking_user_date (user_id, journey_date),
  INDEX idx_booking_schedule_date (schedule_id, journey_date, booking_status),
  CONSTRAINT chk_booking_amount CHECK (total_amount >= 0)
) ENGINE=InnoDB;

-- One row represents the reservation state of a seat for a specific schedule and journey date.
-- The unique key is the key protection against duplicate seat allocation.
CREATE TABLE seat_reservations (
  reservation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL,
  schedule_id BIGINT UNSIGNED NOT NULL,
  journey_date DATE NOT NULL,
  seat_id BIGINT UNSIGNED NOT NULL,
  reservation_status ENUM('HELD','CONFIRMED','RELEASED') NOT NULL DEFAULT 'HELD',
  hold_expires_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reservations_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
  CONSTRAINT fk_reservations_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id),
  CONSTRAINT fk_reservations_seat FOREIGN KEY (seat_id) REFERENCES seats(seat_id),
  UNIQUE KEY uq_schedule_date_seat (schedule_id, journey_date, seat_id),
  INDEX idx_reservation_booking (booking_id, reservation_status)
) ENGINE=InnoDB;

CREATE TABLE booking_details (
  booking_detail_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL,
  seat_id BIGINT UNSIGNED NOT NULL,
  passenger_name VARCHAR(120) NOT NULL,
  passenger_id_type ENUM('NID','BIRTH_CERTIFICATE','PASSPORT','OTHER') NOT NULL DEFAULT 'OTHER',
  passenger_id_number VARCHAR(60) NULL,
  fare_amount DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_booking_details_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_details_seat FOREIGN KEY (seat_id) REFERENCES seats(seat_id),
  UNIQUE KEY uq_booking_seat (booking_id, seat_id),
  CONSTRAINT chk_detail_fare CHECK (fare_amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE payments (
  payment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'DEMO_GATEWAY',
  payment_method VARCHAR(40) NOT NULL DEFAULT 'DEMO',
  transaction_id VARCHAR(80) NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  payment_status ENUM('SUCCESS','FAILED','REFUND_SIMULATED') NOT NULL,
  gateway_response JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
  INDEX idx_payment_booking (booking_id, created_at),
  CONSTRAINT chk_payment_amount CHECK (amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE tickets (
  ticket_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL UNIQUE,
  ticket_number VARCHAR(50) NOT NULL UNIQUE,
  issue_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ticket_status ENUM('ISSUED','CANCELLED') NOT NULL DEFAULT 'ISSUED',
  CONSTRAINT fk_tickets_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE cancellations (
  cancellation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL UNIQUE,
  cancellation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason VARCHAR(255) NULL,
  refund_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  cancellation_status ENUM('PROCESSED','REFUND_SIMULATED') NOT NULL DEFAULT 'PROCESSED',
  CONSTRAINT fk_cancellations_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
  CONSTRAINT chk_refund_amount CHECK (refund_amount >= 0)
) ENGINE=InnoDB;

INSERT INTO roles (role_name) VALUES ('PASSENGER'), ('RAILWAY_AUTHORITY');
