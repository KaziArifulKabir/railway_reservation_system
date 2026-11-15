document.addEventListener('DOMContentLoaded', async () => {
  const user = await setupNavigation();
  if (!requireRole(user, ['PASSENGER'])) return;
  document.getElementById('printTicket').addEventListener('click', () => window.print());
  const bookingId = new URLSearchParams(window.location.search).get('id');
  const content = document.getElementById('ticketContent');
  const message = document.getElementById('ticketMessage');
  if (!bookingId) {
    message.innerHTML = '<div class="notice error">Ticket ID is missing.</div>';
    return;
  }
  try {
    const data = await apiRequest(`/api/bookings/${bookingId}`);
    const booking = data.booking;
    content.innerHTML = `<article class="ticket">
      <div class="ticket-header"><div><h2 style="margin:0">Railway Reservation System</h2><p class="muted" style="margin:3px 0 0">Electronic Journey Ticket · Academic Demo</p></div><span class="pill ${booking.status === 'CONFIRMED' ? 'success' : booking.status === 'CANCELLED' ? 'danger' : 'warning'}">${escapeHtml(booking.status)}</span></div>
      <div class="ticket-grid">
        <div class="ticket-item"><span>Ticket number</span><strong>${escapeHtml(booking.ticketNumber || 'Not issued')}</strong></div>
        <div class="ticket-item"><span>Booking reference</span><strong>${escapeHtml(booking.bookingCode)}</strong></div>
        <div class="ticket-item"><span>Train</span><strong>${escapeHtml(booking.trainName)} (${escapeHtml(booking.trainNumber)})</strong></div>
        <div class="ticket-item"><span>Journey date</span><strong>${escapeHtml(booking.journeyDate)}</strong></div>
        <div class="ticket-item"><span>From</span><strong>${escapeHtml(booking.origin)}</strong></div>
        <div class="ticket-item"><span>To</span><strong>${escapeHtml(booking.destination)}</strong></div>
        <div class="ticket-item"><span>Departure from route origin</span><strong>${escapeHtml(booking.departureTime)}</strong></div>
        <div class="ticket-item"><span>Total amount</span><strong>${formatMoney(booking.totalAmount)}</strong></div>
      </div>
      <hr style="border:0;border-top:1px solid var(--line);margin:20px 0">
      <h3>Passenger and seat details</h3>
      <div class="table-wrap"><table><thead><tr><th>Passenger</th><th>Class</th><th>Coach</th><th>Seat</th><th>Fare</th></tr></thead><tbody>${booking.passengers.map((passenger) => `<tr><td>${escapeHtml(passenger.name)}</td><td>${escapeHtml(passenger.className)}</td><td>${escapeHtml(passenger.coach)}</td><td>${escapeHtml(passenger.seat)}</td><td>${formatMoney(passenger.fare)}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted" style="margin:18px 0 0;font-size:.8rem">This is an academic demonstration ticket, not a valid Bangladesh Railway travel document. Payment is simulated.</p>
    </article>`;
  } catch (error) {
    message.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
  }
});
