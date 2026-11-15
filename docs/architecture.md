# Architecture Notes

## Three-tier architecture

1. **Presentation layer:** HTML, CSS and browser JavaScript. The Passenger and Railway Authority use separate pages and role-protected menus.
2. **Application/business layer:** Node.js and Express. Routes validate requests, enforce role permissions, calculate fares, coordinate reservation transactions and call the demo payment processor.
3. **Database layer:** MySQL/InnoDB. Foreign keys, unique constraints and transactions preserve relationships and seat allocation consistency.

## External entity

The Payment Gateway is external. In this academic version it is represented by the `POST /api/bookings/:bookingId/pay` demo endpoint. The browser chooses a simulated success or failure response. No real payment provider is contacted.

## Booking transaction

1. Validate schedule day, origin/destination stop order, class fare and selected seat ownership.
2. Create a pending booking.
3. Create/update one seat reservation row for each selected seat and date.
4. Create passenger booking details.
5. Commit the transaction.
6. During successful demo payment, lock the pending booking and its seat holds, record payment, confirm seats and booking, and issue a ticket in one database transaction.

The unique key `uq_schedule_date_seat (schedule_id, journey_date, seat_id)` prevents duplicate rows for the same seat on the same scheduled journey date. A cancelled/expired/released reservation row can be reused only after it is locked and changed back to HELD. Booking details retain their own `seat_id`, so historical tickets remain attached to their original booking even when the seat reservation lock row is reused later.

## Normalization notes

The relational schema separates roles, users, stations, trains, routes, route stops, schedules, operating days, coaches, seats, fares, bookings, seat reservations, booking details, payments, tickets and cancellations. This reduces repeated descriptive data and gives foreign keys clear targets.
