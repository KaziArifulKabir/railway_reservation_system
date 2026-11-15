document.addEventListener('DOMContentLoaded', async () => {
  const user = await setupNavigation();
  if (!requireRole(user, ['PASSENGER'])) return;
  const list = document.getElementById('bookingsList');
  const message = document.getElementById('bookingsMessage');
  try {
    const data = await apiRequest('/api/bookings');
    if (!data.bookings.length) {
      list.innerHTML = '<div class="card">You have no bookings yet. <a href="index.html">Search for a train</a>.</div>';
      return;
    }
    list.innerHTML = data.bookings.map((booking) => {
      const statusClass = booking.booking_status === 'CONFIRMED' ? 'success' : booking.booking_status === 'CANCELLED' ? 'danger' : 'warning';
      return `<article class="card">
        <div class="section-heading"><div><h3>${escapeHtml(booking.train_name)} (${escapeHtml(booking.train_number)})</h3><p>${escapeHtml(booking.origin_name)} → ${escapeHtml(booking.destination_name)} · ${escapeHtml(booking.journey_date)}</p></div><span class="pill ${statusClass}">${escapeHtml(booking.booking_status)}</span></div>
        <p><strong>Booking:</strong> ${escapeHtml(booking.booking_code)} &nbsp; <strong>Amount:</strong> ${formatMoney(booking.total_amount)}</p>
        <div class="form-actions"><a class="btn btn-light btn-small" href="ticket.html?id=${booking.booking_id}">View Ticket</a>${booking.booking_status === 'CONFIRMED' ? `<button class="btn btn-danger btn-small" data-cancel="${booking.booking_id}">Cancel Booking</button>` : ''}</div>
      </article>`;
    }).join('');
    list.querySelectorAll('[data-cancel]').forEach((button) => button.addEventListener('click', async () => {
      if (!window.confirm('Cancel this booking? The demo refund policy is illustrative and no real money will be returned.')) return;
      button.disabled = true;
      try {
        const response = await apiRequest(`/api/bookings/${button.dataset.cancel}/cancel`, { method: 'POST', body: { reason: 'Cancelled by passenger' } });
        message.innerHTML = `<div class="notice success">${escapeHtml(response.message)} Demo refund amount: ${formatMoney(response.refundAmount)}.</div>`;
        window.location.reload();
      } catch (error) {
        message.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
        button.disabled = false;
      }
    }));
  } catch (error) {
    message.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
  }
});
