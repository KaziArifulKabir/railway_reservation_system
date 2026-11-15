# Railway Reservation System (Academic Project)

A runnable academic web application built with **HTML, CSS, Vanilla JavaScript, Node.js, Express 5 and MySQL**. It follows the project scope in the supplied System Analysis Lab report and the final actor decision:

- Passenger
- Railway Authority
- Payment Gateway (external integration represented by a demo simulator)

There is no Reservation Officer panel and no Notification/SMS module in this version.

> **Important:** This is an academic prototype, not Bangladesh Railway's live system. The seeded train, timetable and fare data are sample data. The demo payment gateway does not charge or transfer real money. The sample cancellation cutoff and refund percentage are configurable demonstration rules, not official Bangladesh Railway cancellation/refund rules.

## 1. Included features

### Passenger
- Passenger registration, login and logout.
- Profile view/update.
- Train search by origin, destination and journey date.
- Route stops and scheduled departure/arrival time display.
- Class-wise fare and seat availability.
- Multi-seat booking (up to five seats per booking).
- Temporary seat hold while payment is completed.
- Demo payment success/failure and retry.
- Booking confirmation and e-ticket display/print.
- Booking history and eligible cancellation.
- Demonstration refund calculation/record.

### Railway Authority
- Dashboard counts and monthly booking summary.
- Passenger list and activate/block account.
- Add/list/update/deactivate trains.
- Add/list/update/deactivate stations.
- Create routes with ordered station stops and offsets.
- Create schedules and select operating days.
- Create coaches and their seats.
- Set route/class/schedule fares.
- View all bookings.

### Backend / database
- Express API and static frontend hosting from the same origin.
- MySQL connection pool using mysql2 Promise API.
- Password hashing with bcryptjs.
- HttpOnly, SameSite=Strict login cookie.
- JWT-based login session (8-hour expiry).
- Role-based route protection.
- Login/register rate limit and Helmet security headers.
- Parameterized SQL queries.
- Transactional booking and payment operations.
- Unique `(schedule_id, journey_date, seat_id)` seat reservation constraint to prevent duplicate active seat allocations.

## 2. Requirements

- Windows 10/11, macOS or Linux.
- Node.js 26 LTS recommended (Node.js 20+ is the package minimum).
- MySQL 8.0.16+ / MySQL 8.4, or a compatible MySQL server.
- VS Code or another code editor.
- XAMPP may be used to run MySQL and phpMyAdmin on Windows.

Official downloads/documentation:
- Node.js: https://nodejs.org/
- XAMPP: https://www.apachefriends.org/
- VS Code: https://code.visualstudio.com/
- Express 5: https://expressjs.com/en/5x/
- MySQL 8.4: https://dev.mysql.com/doc/refman/8.4/en/

## 3. Installation on Windows (step by step)

### Step 1 — Install and start MySQL

1. Install XAMPP.
2. Open XAMPP Control Panel.
3. Start **MySQL**. Also start **Apache** if you plan to use phpMyAdmin from the XAMPP control panel. The Railway application itself is served by Express and does not need Apache.
4. Open `http://localhost/phpmyadmin`.
5. Make sure the MySQL service is running on port `3306` (or note the port you configured).

### Step 2 — Open the project in VS Code

1. Extract the project ZIP to a convenient folder, for example `C:\Users\YourName\Projects\railway_reservation_system`.
2. Open VS Code.
3. Select **File → Open Folder** and choose `railway_reservation_system`.
4. Open **Terminal → New Terminal**.

### Step 3 — Create the database

1. In phpMyAdmin, select the **Import** tab.
2. Choose `database/schema.sql` from this project.
3. Click **Import** / **Go**.
4. The script creates the `railway_reservation_system` database and its tables.

> **Warning:** `schema.sql` is a development setup script. It drops and recreates the project's tables. Do not import it into a database that contains data you need to keep.

### Step 4 — Configure environment values

In the VS Code terminal, run:

```powershell
Copy-Item .env.example .env
```

Open `.env` and check these values against your local MySQL setup:

```env
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=railway_reservation_system
DB_USER=root
DB_PASSWORD=
JWT_SECRET=replace_this_with_a_long_random_secret_at_least_32_characters
COOKIE_NAME=rrs_session
BOOKING_HOLD_MINUTES=10
CANCELLATION_CUTOFF_HOURS=6
DEMO_REFUND_PERCENT=80
```

If your MySQL root account has a password, put it after `DB_PASSWORD=`. Set `JWT_SECRET` to a private random value of at least 32 characters. One way to generate a value is:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Do not share your real `.env` file or commit it to Git.

### Step 5 — Install Node packages

```powershell
npm install
```

### Step 6 — Insert demo data

```powershell
npm run seed
```

The seed command creates sample roles, demo accounts, stations, a train, a route, a daily schedule, coaches, seats and fares.

### Step 7 — Run the application

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

To stop the server, press `Ctrl + C` in the terminal.

## 4. Demo accounts

| Role | Email | Password |
|---|---|---|
| Railway Authority | `authority@railway.local` | `Admin@12345!` |
| Passenger | `passenger@example.com` | `Passenger@12345!` |

These accounts are only for local testing. Change or remove them before any deployment beyond a private academic demo.

## 5. Sample train data

The seed script creates one illustrative train:

- Train: Subarna Express (Demo)
- Number: 701
- Route: Dhaka → Biman Bandar → Cumilla → Feni → Chattogram
- Departure from route origin: 07:00
- Classes: Shovon Chair and AC Seat
- Operating days: all seven days

Fares are generated as sample academic data. They are not verified/current Bangladesh Railway fares.

## 6. Passenger workflow

1. Register or log in as Passenger.
2. On the home page, choose From, To and Journey Date.
3. Click **Search Trains**.
4. Choose a train/class option and click **Select Seat**.
5. Select one or more available seats (maximum five).
6. Enter passenger names and optional identity information.
7. Click **Create Pending Booking**.
8. Complete a simulated payment:
   - **Simulate Successful Payment** confirms the booking and issues an e-ticket.
   - **Simulate Failed Payment** records a failed attempt and leaves the booking pending while the seat hold remains active.
9. Open **My Bookings** to view history or cancel an eligible confirmed booking.
10. Open the ticket and use **Print Ticket** if required.

The demo cancellation policy is controlled by `.env`. Default values are a six-hour cutoff and an 80% simulated refund. These are academic examples only.

## 7. Railway Authority workflow

1. Log in using the Railway Authority demo account.
2. Open the Authority Dashboard.
3. Add stations and trains.
4. Create a route by entering station IDs in travel order and their minute offsets from the route's first departure.
5. Create a schedule using train ID, route ID, departure time and operating days.
6. Create coaches and comma-separated seat numbers.
7. Add fares for a schedule, origin, destination and class.
8. View passengers and activate/block a passenger account.
9. Monitor bookings and dashboard reports.

For the seeded route, the station IDs are shown in the station table in the Authority dashboard. The IDs may differ if you have already inserted data before running the seed script.

### Day values for schedule creation

The schedule form uses MySQL `DAYOFWEEK()` numbering:

- 1 = Sunday
- 2 = Monday
- 3 = Tuesday
- 4 = Wednesday
- 5 = Thursday
- 6 = Friday
- 7 = Saturday

Example: `1,2,3,4,5,6,7` means every day.

### Route stop offsets

Offsets are minutes after the schedule's base departure time from the first stop. Example `0,20,180,245,360` means the fifth stop is reached 360 minutes after the route-origin departure. This is a simplified student-project model.

## 8. API overview

All API responses are JSON. The browser sends the login cookie automatically.

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PUT /api/auth/profile`

### Public train search

- `GET /api/stations`
- `GET /api/trains/search?fromStationId=1&toStationId=5&journeyDate=YYYY-MM-DD`
- `GET /api/trains/:scheduleId/seats?journeyDate=YYYY-MM-DD&fromStationId=1&toStationId=5&className=Shovon%20Chair`

### Passenger booking

- `POST /api/bookings`
- `POST /api/bookings/:bookingId/pay` (demo gateway only)
- `GET /api/bookings`
- `GET /api/bookings/:bookingId`
- `POST /api/bookings/:bookingId/cancel`

### Railway Authority

- `GET /api/admin/dashboard`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/status`
- `GET|POST|PUT|DELETE /api/admin/trains`
- `GET|POST|PUT|DELETE /api/admin/stations`
- `GET|POST|PUT|DELETE /api/admin/routes` (PUT/DELETE use `/:id`)
- `GET|POST|PUT|DELETE /api/admin/schedules` (PUT/DELETE use `/:id`)
- `GET|POST /api/admin/coaches` plus `PATCH /api/admin/coaches/:id/status`
- `GET /api/admin/seats?coachId=1` plus `PATCH /api/admin/seats/:id/status`
- `GET|POST|DELETE /api/admin/fares` (DELETE uses `/:id`)
- `GET /api/admin/bookings`
- `POST /api/admin/bookings/:id/cancel`
- `GET /api/admin/reports/summary`

## 9. Important project limitations

1. **No live payment:** Payment success/failure is simulated. A real payment gateway requires an approved merchant account, gateway documentation, secrets and server-side verification/webhooks.
2. **No official railway data:** Train, schedule, route, seat and fare records are sample data.
3. **Simplified route model:** Route stop times are minute offsets from the first stop; complex operational railway timetable rules are outside this student prototype.
4. **Simplified cancellation:** The cutoff and refund percentage are configurable sample rules, not official railway policy.
5. **Academic deployment:** Before public deployment, add HTTPS, production-grade session management, CSRF protection, audit logging, backups, monitoring, stronger operational controls and a security review.
6. **Seat reservation:** The unique schedule/date/seat key and transactions reduce duplicate reservation risk in this application. It is still necessary to test concurrency with multiple browser sessions before claiming production readiness.

## 10. Troubleshooting

### `ECONNREFUSED 127.0.0.1:3306`
- Start MySQL in XAMPP.
- Confirm `DB_PORT` in `.env`.
- Check whether another MySQL service is using a different port.

### `Access denied for user 'root'`
- Check `DB_USER` and `DB_PASSWORD` in `.env`.

### `Unknown database railway_reservation_system`
- Import `database/schema.sql` in phpMyAdmin.

### `JWT_SECRET is missing or too short`
- Create `.env` from `.env.example` and set a random secret of at least 32 characters.

### `Cannot find module ...`
- Run `npm install` in the project root.

### No trains found
- Run `npm run seed`.
- Check that selected origin and destination are in the correct order on the same route.
- Select a journey date on a day when the schedule operates.

## 11. Suggested testing checklist

- [ ] Register a new Passenger.
- [ ] Log in and log out.
- [ ] Block a Passenger through Railway Authority and confirm the account cannot log in.
- [ ] Search a valid origin/destination/date.
- [ ] Search an invalid route order.
- [ ] Check available seats by class.
- [ ] Create a pending booking.
- [ ] Attempt to reserve the same seat in another browser before payment; the second attempt should be rejected.
- [ ] Complete successful demo payment; booking and ticket should be confirmed/issued.
- [ ] Complete failed demo payment; booking should remain unconfirmed.
- [ ] Cancel a confirmed ticket outside the sample cutoff period.
- [ ] Verify that the released seat becomes available again.
- [ ] Verify that Railway Authority reports reflect booking/payment changes.

## 12. Project folder structure

```text
railway_reservation_system/
├── database/
│   └── schema.sql
├── docs/
│   ├── architecture.md
│   └── test-cases.md
├── public/
│   ├── css/style.css
│   ├── js/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── passenger.html
│   ├── booking.html
│   ├── bookings.html
│   ├── ticket.html
│   └── admin.html
├── scripts/
│   ├── check-env.js
│   └── seed.js
├── src/
│   ├── config/db.js
│   ├── middleware/
│   ├── routes/
│   ├── utils/
│   ├── app.js
│   └── server.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```
