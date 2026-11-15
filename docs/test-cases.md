# Test Cases

| ID | Scenario | Expected result |
|---|---|---|
| TC-01 | Register with valid details | Passenger account is created and session cookie is set |
| TC-02 | Register with existing email | HTTP 409 and duplicate-account message |
| TC-03 | Login with wrong password | HTTP 401; no authenticated session |
| TC-04 | Passenger calls admin endpoint | HTTP 403 |
| TC-05 | Search with correct route/date | Matching train/class/fare/availability results |
| TC-06 | Search with route stations in reverse order | No results or route validation error |
| TC-07 | Select booked seat | Seat is disabled in the UI |
| TC-08 | Two sessions request the same seat simultaneously | Only one reservation can hold/confirm that seat |
| TC-09 | Successful demo payment | Booking and reservations confirmed; ticket issued |
| TC-10 | Failed demo payment | Failed payment recorded; booking remains pending until hold expiry |
| TC-11 | Pay after hold expires | Request rejected and booking expired/released |
| TC-12 | Passenger views another user's booking | HTTP 404 |
| TC-13 | Eligible cancellation | Booking/ticket cancelled; seat released; sample refund recorded |
| TC-14 | Cancellation inside configured cutoff | Cancellation rejected |
| TC-15 | Railway Authority creates train | Train appears in management list |
| TC-16 | Railway Authority blocks passenger | Passenger account cannot log in |
