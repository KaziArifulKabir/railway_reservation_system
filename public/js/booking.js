document.addEventListener('DOMContentLoaded', async () => {
  const user = await setupNavigation();
  if (!requireRole(user, ['PASSENGER'])) return;
  const params = new URLSearchParams(window.location.search);
  const scheduleId = params.get('scheduleId');
  const fromStationId = params.get('fromStationId');
  const toStationId = params.get('toStationId');
  const journeyDate = params.get('journeyDate');
  const className = params.get('className');
  const message = document.getElementById('bookingMessage');
  const seatGrid = document.getElementById('seatGrid');
  const passengerForms = document.getElementById('passengerForms');
  const createButton = document.getElementById('createBookingButton');
  const paymentPanel = document.getElementById('paymentPanel');
  const selectedSeatIds = new Set();
  let fareAmount = 0;
  let pendingBookingId = null;

  if (!scheduleId || !fromStationId || !toStationId || !journeyDate || !className) {
    message.innerHTML = '<div class="notice error">Missing journey information. Please search for a train again.</div>';
    createButton.disabled = true;
    return;
  }

  document.getElementById('journeyInfo').textContent = `Journey date: ${journeyDate} · Class: ${className}`;

  function renderPassengerForms() {
    passengerForms.innerHTML = [...selectedSeatIds].map((seatId, index) => `
      <div class="passenger-detail" data-passenger-seat="${seatId}">
        <h4>Passenger ${index + 1} · Seat ${escapeHtml(findSeatLabel(Number(seatId)))}</h4>
        <div class="form-grid">
          <div class="field"><label>Passenger full name</label><input data-name required maxlength="120" value="${index === 0 ? escapeHtml(user.fullName) : ''}"></div>
          <div class="field"><label>ID type</label><select data-id-type><option value="OTHER">Other</option><option value="NID">NID</option><option value="BIRTH_CERTIFICATE">Birth Certificate</option><option value="PASSPORT">Passport</option></select></div>
          <div class="field full"><label>ID number (optional)</label><input data-id-number maxlength="60"></div>
        </div>
      </div>`).join('');
    createButton.disabled = selectedSeatIds.size === 0;
  }

  let seatLabels = new Map();
  function findSeatLabel(seatId) { return seatLabels.get(seatId) || seatId; }

  try {
    const query = new URLSearchParams({ journeyDate, fromStationId, toStationId, className });
    const data = await apiRequest(`/api/trains/${scheduleId}/seats?${query}`);
    fareAmount = Number(data.fareAmount);
    document.getElementById('fareInfo').textContent = `Fare per passenger: ${formatMoney(fareAmount)}. Select up to 5 seats.`;
    seatLabels = new Map(data.seats.map((seat) => [Number(seat.seat_id), `${seat.coach_code} / ${seat.seat_number}`]));
    if (!data.seats.length) {
      seatGrid.innerHTML = '<p>No seats have been configured for this class.</p>';
      return;
    }
    seatGrid.innerHTML = data.seats.map((seat) => {
      const disabled = seat.seat_status !== 'AVAILABLE';
      const statusClass = seat.seat_status.toLowerCase();
      return `<button type="button" class="seat ${statusClass}" data-seat-id="${seat.seat_id}" ${disabled ? 'disabled' : ''} title="${escapeHtml(seat.seat_status)}">${escapeHtml(seat.seat_number)}<small style="display:block;font-size:.62rem;font-weight:500">${escapeHtml(seat.coach_code)}</small></button>`;
    }).join('');
    seatGrid.querySelectorAll('[data-seat-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const seatId = Number(button.dataset.seatId);
        if (selectedSeatIds.has(seatId)) {
          selectedSeatIds.delete(seatId);
          button.classList.remove('selected');
          button.classList.add('available');
        } else {
          if (selectedSeatIds.size >= 5) return showToast('Maximum 5 seats per booking.', 'error');
          selectedSeatIds.add(seatId);
          button.classList.remove('available');
          button.classList.add('selected');
        }
        renderPassengerForms();
      });
    });
  } catch (error) {
    message.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
    createButton.disabled = true;
  }

  createButton.addEventListener('click', async () => {
    const passengers = [...passengerForms.querySelectorAll('[data-passenger-seat]')].map((element) => ({
      seatId: Number(element.dataset.passengerSeat),
      fullName: element.querySelector('[data-name]').value,
      idType: element.querySelector('[data-id-type]').value,
      idNumber: element.querySelector('[data-id-number]').value
    }));
    createButton.disabled = true;
    try {
      const data = await apiRequest('/api/bookings', {
        method: 'POST',
        body: { scheduleId: Number(scheduleId), fromStationId: Number(fromStationId), toStationId: Number(toStationId), journeyDate, className, passengers }
      });
      pendingBookingId = data.booking.bookingId;
      document.getElementById('paymentSummary').textContent = `Booking ${data.booking.bookingCode} · Total ${formatMoney(data.booking.totalAmount)} · Seat hold ${data.booking.holdMinutes} minutes.`;
      paymentPanel.classList.remove('hidden');
      message.innerHTML = `<div class="notice success">${escapeHtml(data.message)}</div>`;
      document.getElementById('seatPanel').classList.add('hidden');
      document.getElementById('passengerPanel').classList.add('hidden');
    } catch (error) {
      message.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
      createButton.disabled = false;
    }
  });

  async function pay(decision) {
    if (!pendingBookingId) return;
    document.getElementById('paySuccessButton').disabled = true;
    document.getElementById('payFailureButton').disabled = true;
    try {
      const result = await apiRequest(`/api/bookings/${pendingBookingId}/pay`, { method: 'POST', body: { decision } });
      if (result.paymentSuccessful) {
        window.location.href = `ticket.html?id=${pendingBookingId}`;
      } else {
        message.innerHTML = `<div class="notice error">${escapeHtml(result.message)}</div>`;
        document.getElementById('paySuccessButton').disabled = false;
        document.getElementById('payFailureButton').disabled = false;
      }
    } catch (error) {
      message.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
      document.getElementById('paySuccessButton').disabled = false;
      document.getElementById('payFailureButton').disabled = false;
    }
  }
  document.getElementById('paySuccessButton').addEventListener('click', () => pay('SUCCESS'));
  document.getElementById('payFailureButton').addEventListener('click', () => pay('FAILURE'));
});
