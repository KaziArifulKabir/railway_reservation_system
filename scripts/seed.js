require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');

async function getOrInsert(sql, values, selectSql, selectValues) {
  const [found] = await pool.execute(selectSql, selectValues);
  if (found.length) return found[0].id;
  const [result] = await pool.execute(sql, values);
  return result.insertId;
}

async function main() {
  try {
    await pool.execute("INSERT IGNORE INTO roles (role_name) VALUES ('PASSENGER'), ('RAILWAY_AUTHORITY')");
    const [[passengerRole]] = await pool.execute("SELECT role_id FROM roles WHERE role_name='PASSENGER'");
    const [[authorityRole]] = await pool.execute("SELECT role_id FROM roles WHERE role_name='RAILWAY_AUTHORITY'");

    const adminHash = await bcrypt.hash('Admin@12345!', 12);
    const passengerHash = await bcrypt.hash('Passenger@12345!', 12);
    await pool.execute(
      `INSERT INTO users (role_id, full_name, email, phone, password_hash)
       VALUES (?, 'Railway Authority', 'authority@railway.local', '01700000001', ?)
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)`,
      [authorityRole.role_id, adminHash]
    );
    await pool.execute(
      `INSERT INTO users (role_id, full_name, email, phone, password_hash)
       VALUES (?, 'Demo Passenger', 'passenger@example.com', '01700000002', ?)
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)`,
      [passengerRole.role_id, passengerHash]
    );

    const stationSeed = [
      ['Dhaka', 'DHK', 'Dhaka'],
      ['Biman Bandar', 'BBA', 'Dhaka'],
      ['Cumilla', 'COM', 'Cumilla'],
      ['Feni', 'FNI', 'Feni'],
      ['Chattogram', 'CTG', 'Chattogram']
    ];
    const stationIds = {};
    for (const [name, code, city] of stationSeed) {
      await pool.execute(
        `INSERT INTO stations (station_name, station_code, city)
         VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE station_name=VALUES(station_name), city=VALUES(city), is_active=TRUE`,
        [name, code, city]
      );
      const [[row]] = await pool.execute('SELECT station_id FROM stations WHERE station_code=?', [code]);
      stationIds[code] = row.station_id;
    }

    await pool.execute(
      `INSERT INTO trains (train_number, train_name, train_type)
       VALUES ('701', 'Subarna Express (Demo)', 'Intercity')
       ON DUPLICATE KEY UPDATE train_name=VALUES(train_name), is_active=TRUE`
    );
    const [[train]] = await pool.execute("SELECT train_id FROM trains WHERE train_number='701'");

    await pool.execute(
      `INSERT INTO routes (route_name) VALUES ('Dhaka - Chattogram via Biman Bandar, Cumilla and Feni')
       ON DUPLICATE KEY UPDATE is_active=TRUE`
    );
    const [[route]] = await pool.execute("SELECT route_id FROM routes WHERE route_name='Dhaka - Chattogram via Biman Bandar, Cumilla and Feni'");

    const stops = [
      ['DHK', 1, 0],
      ['BBA', 2, 20],
      ['COM', 3, 180],
      ['FNI', 4, 245],
      ['CTG', 5, 360]
    ];
    for (const [code, order, offset] of stops) {
      await pool.execute(
        `INSERT INTO route_stops (route_id, station_id, stop_order, arrival_offset_minutes, departure_offset_minutes)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE arrival_offset_minutes=VALUES(arrival_offset_minutes), departure_offset_minutes=VALUES(departure_offset_minutes)`,
        [route.route_id, stationIds[code], order, offset, offset]
      );
    }

    const [[existingSchedule]] = await pool.execute(
      'SELECT schedule_id FROM schedules WHERE train_id=? AND route_id=? AND departure_time=? LIMIT 1',
      [train.train_id, route.route_id, '07:00:00']
    );
    let scheduleId = existingSchedule?.schedule_id;
    if (!scheduleId) {
      const [scheduleResult] = await pool.execute(
        'INSERT INTO schedules (train_id, route_id, departure_time) VALUES (?, ?, ?)',
        [train.train_id, route.route_id, '07:00:00']
      );
      scheduleId = scheduleResult.insertId;
    }
    for (let day = 1; day <= 7; day += 1) {
      await pool.execute('INSERT IGNORE INTO schedule_days (schedule_id, day_of_week) VALUES (?, ?)', [scheduleId, day]);
    }

    const coachSpecs = [
      { code: 'CHAIR-A', className: 'Shovon Chair', seats: Array.from({ length: 20 }, (_, i) => `A${i + 1}`) },
      { code: 'AC-A', className: 'AC Seat', seats: Array.from({ length: 12 }, (_, i) => `AC${i + 1}`) }
    ];
    for (const coachSpec of coachSpecs) {
      await pool.execute(
        `INSERT INTO coaches (train_id, coach_code, class_name, seat_capacity)
         VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE class_name=VALUES(class_name), seat_capacity=VALUES(seat_capacity), is_active=TRUE`,
        [train.train_id, coachSpec.code, coachSpec.className, coachSpec.seats.length]
      );
      const [[coach]] = await pool.execute('SELECT coach_id FROM coaches WHERE train_id=? AND coach_code=?', [train.train_id, coachSpec.code]);
      for (const seatNumber of coachSpec.seats) {
        await pool.execute('INSERT IGNORE INTO seats (coach_id, seat_number) VALUES (?, ?)', [coach.coach_id, seatNumber]);
      }
    }

    const routeOrder = stops.map(([code]) => code);
    for (let fromIndex = 0; fromIndex < routeOrder.length - 1; fromIndex += 1) {
      for (let toIndex = fromIndex + 1; toIndex < routeOrder.length; toIndex += 1) {
        const fromId = stationIds[routeOrder[fromIndex]];
        const toId = stationIds[routeOrder[toIndex]];
        const segmentCount = toIndex - fromIndex;
        const fares = [
          ['Shovon Chair', segmentCount * 125],
          ['AC Seat', segmentCount * 250]
        ];
        for (const [className, fare] of fares) {
          await pool.execute(
            `INSERT INTO fares (schedule_id, origin_station_id, destination_station_id, class_name, fare_amount)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE fare_amount=VALUES(fare_amount)`,
            [scheduleId, fromId, toId, className, fare]
          );
        }
      }
    }

    console.log('\nSeed completed successfully.');
    console.log('Demo Railway Authority: authority@railway.local / Admin@12345!');
    console.log('Demo Passenger: passenger@example.com / Passenger@12345!');
    console.log('Demo train: 701 - Subarna Express (Demo)');
    console.log('Demo route: Dhaka -> Biman Bandar -> Cumilla -> Feni -> Chattogram');
    console.log('The fares and train data are sample academic data, not official railway data.');
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
