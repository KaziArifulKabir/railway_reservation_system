document.addEventListener('DOMContentLoaded', async () => {
  const user = await setupNavigation();
  if (!requireRole(user, ['RAILWAY_AUTHORITY'])) return;
  const message = document.getElementById('adminMessage');
  const tabs = document.getElementById('adminTabs');

  function showMessage(text, type = 'success') {
    message.innerHTML = `<div class="notice ${type === 'error' ? 'error' : 'success'}">${escapeHtml(text)}</div>`;
  }
  function table(headers, rows) {
    if (!rows.length) return '<p class="muted">No records found.</p>';
    return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  }
  function statusPill(value) {
    const normalized = String(value || '').toUpperCase();
    const cls = normalized === 'ACTIVE' || normalized === 'CONFIRMED' || normalized === 'ISSUED' ? 'success' : normalized === 'BLOCKED' || normalized === 'CANCELLED' ? 'danger' : 'warning';
    return `<span class="pill ${cls}">${escapeHtml(normalized)}</span>`;
  }

  const loaders = {
    overview: loadOverview,
    trains: loadTrains,
    stations: loadStations,
    routes: loadRoutes,
    schedules: loadSchedules,
    coaches: loadCoaches,
    fares: loadFares,
    users: loadUsers,
    bookings: loadBookings
  };

  tabs.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-section]');
    if (!button) return;
    tabs.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
    document.querySelectorAll('.admin-section').forEach((section) => section.classList.toggle('active', section.id === `section-${button.dataset.section}`));
    try { await loaders[button.dataset.section](); } catch (error) { showMessage(error.message, 'error'); }
  });

  async function loadOverview() {
    const data = await apiRequest('/api/admin/dashboard');
    const stats = data.stats;
    document.getElementById('adminStats').innerHTML = `
      <div class="stat-card"><span>Passengers</span><strong>${stats.passengers}</strong></div>
      <div class="stat-card"><span>Active trains</span><strong>${stats.trains}</strong></div>
      <div class="stat-card"><span>Confirmed bookings</span><strong>${stats.confirmedBookings}</strong></div>
      <div class="stat-card"><span>Cancelled bookings</span><strong>${stats.cancelledBookings}</strong></div>
      <div class="stat-card"><span>Configured seats</span><strong>${stats.configuredSeats}</strong></div>
      <div class="stat-card"><span>Successful demo payments</span><strong>${formatMoney(stats.successfulPaymentTotal)}</strong></div>`;
    const report = await apiRequest('/api/admin/reports/summary');
    document.getElementById('monthlyReport').innerHTML = `<h3>Monthly Reservation Summary</h3>${table(['Month', 'Bookings', 'Confirmed value', 'Cancellations'], report.monthly.map((row) => `<tr><td>${escapeHtml(row.month)}</td><td>${row.bookings}</td><td>${formatMoney(row.confirmed_value)}</td><td>${row.cancellations}</td></tr>`))}`;
  }

  async function loadTrains() {
    const data = await apiRequest('/api/admin/trains');
    document.getElementById('trainTable').innerHTML = table(['ID', 'Number', 'Train name', 'Type', 'Status', 'Action'], data.trains.map((row) => `<tr><td>${row.train_id}</td><td>${escapeHtml(row.train_number)}</td><td>${escapeHtml(row.train_name)}</td><td>${escapeHtml(row.train_type)}</td><td>${statusPill(row.is_active ? 'ACTIVE' : 'INACTIVE')}</td><td>${row.is_active ? `<button class="btn btn-light btn-small" data-edit-train="${row.train_id}" data-number="${escapeHtml(row.train_number)}" data-name="${escapeHtml(row.train_name)}" data-type="${escapeHtml(row.train_type)}">Edit</button> <button class="btn btn-danger btn-small" data-deactivate-train="${row.train_id}">Deactivate</button>` : '—'}</td></tr>`));
    document.querySelectorAll('[data-edit-train]').forEach((button) => button.addEventListener('click', async () => {
      const trainNumber = prompt('Train number:', button.dataset.number);
      if (trainNumber === null) return;
      const trainName = prompt('Train name:', button.dataset.name);
      if (trainName === null) return;
      const trainType = prompt('Train type:', button.dataset.type);
      if (trainType === null) return;
      await apiRequest(`/api/admin/trains/${button.dataset.editTrain}`, { method: 'PUT', body: { trainNumber, trainName, trainType, isActive: true } });
      showMessage('Train updated.'); await loadTrains();
    }));
    document.querySelectorAll('[data-deactivate-train]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Deactivate this train? Historical booking records will remain.')) return;
      await apiRequest(`/api/admin/trains/${button.dataset.deactivateTrain}`, { method: 'DELETE' });
      showMessage('Train deactivated.'); await loadTrains();
    }));
  }

  async function loadStations() {
    const data = await apiRequest('/api/admin/stations');
    document.getElementById('stationTable').innerHTML = table(['ID', 'Code', 'Station', 'City', 'Status', 'Action'], data.stations.map((row) => `<tr><td>${row.station_id}</td><td>${escapeHtml(row.station_code)}</td><td>${escapeHtml(row.station_name)}</td><td>${escapeHtml(row.city)}</td><td>${statusPill(row.is_active ? 'ACTIVE' : 'INACTIVE')}</td><td>${row.is_active ? `<button class="btn btn-light btn-small" data-edit-station="${row.station_id}" data-code="${escapeHtml(row.station_code)}" data-name="${escapeHtml(row.station_name)}" data-city="${escapeHtml(row.city)}">Edit</button> <button class="btn btn-danger btn-small" data-deactivate-station="${row.station_id}">Deactivate</button>` : '—'}</td></tr>`));
    document.querySelectorAll('[data-edit-station]').forEach((button) => button.addEventListener('click', async () => {
      const stationName = prompt('Station name:', button.dataset.name); if (stationName === null) return;
      const stationCode = prompt('Station code:', button.dataset.code); if (stationCode === null) return;
      const city = prompt('City:', button.dataset.city); if (city === null) return;
      await apiRequest(`/api/admin/stations/${button.dataset.editStation}`, { method: 'PUT', body: { stationName, stationCode, city, isActive: true } });
      showMessage('Station updated.'); await loadStations();
    }));
    document.querySelectorAll('[data-deactivate-station]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Deactivate this station?')) return;
      await apiRequest(`/api/admin/stations/${button.dataset.deactivateStation}`, { method: 'DELETE' });
      showMessage('Station deactivated.'); await loadStations();
    }));
  }

  async function loadRoutes() {
    const data = await apiRequest('/api/admin/routes');
    document.getElementById('routeTable').innerHTML = table(['ID', 'Route name', 'Ordered stops', 'Status', 'Action'], data.routes.map((row) => `<tr><td>${row.route_id}</td><td>${escapeHtml(row.route_name)}</td><td>${escapeHtml(row.stops || '')}</td><td>${statusPill(row.is_active ? 'ACTIVE' : 'INACTIVE')}</td><td>${row.is_active ? `<button class="btn btn-light btn-small" data-edit-route="${row.route_id}" data-name="${escapeHtml(row.route_name)}">Rename</button> <button class="btn btn-danger btn-small" data-deactivate-route="${row.route_id}">Deactivate</button>` : '—'}</td></tr>`));
    document.querySelectorAll('[data-edit-route]').forEach((button) => button.addEventListener('click', async () => {
      const routeName = prompt('Route name:', button.dataset.name); if (routeName === null) return;
      await apiRequest(`/api/admin/routes/${button.dataset.editRoute}`, { method: 'PUT', body: { routeName } });
      showMessage('Route name updated.'); await loadRoutes();
    }));
    document.querySelectorAll('[data-deactivate-route]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Deactivate this route?')) return;
      await apiRequest(`/api/admin/routes/${button.dataset.deactivateRoute}`, { method: 'DELETE' });
      showMessage('Route deactivated.'); await loadRoutes();
    }));
  }

  async function loadSchedules() {
    const data = await apiRequest('/api/admin/schedules');
    document.getElementById('scheduleTable').innerHTML = table(['ID', 'Train', 'Route', 'Departure', 'Days', 'Status', 'Action'], data.schedules.map((row) => `<tr><td>${row.schedule_id}</td><td>${escapeHtml(row.train_name)} (${escapeHtml(row.train_number)})</td><td>${escapeHtml(row.route_name)}</td><td>${escapeHtml(row.departure_time)}</td><td>${escapeHtml(row.operating_days || '')}</td><td>${statusPill(row.is_active ? 'ACTIVE' : 'INACTIVE')}</td><td>${row.is_active ? `<button class="btn btn-light btn-small" data-edit-schedule="${row.schedule_id}" data-time="${String(row.departure_time).slice(0,5)}" data-days="${escapeHtml(row.operating_days || '1,2,3,4,5,6,7')}">Edit</button> <button class="btn btn-danger btn-small" data-deactivate-schedule="${row.schedule_id}">Deactivate</button>` : '—'}</td></tr>`));
    document.querySelectorAll('[data-edit-schedule]').forEach((button) => button.addEventListener('click', async () => {
      const departureTime = prompt('Departure time (HH:MM):', button.dataset.time); if (departureTime === null) return;
      const daysText = prompt('Operating days (1=Sun ... 7=Sat):', button.dataset.days); if (daysText === null) return;
      const days = daysText.split(',').map((value) => Number(value.trim()));
      await apiRequest(`/api/admin/schedules/${button.dataset.editSchedule}`, { method: 'PUT', body: { departureTime, days } });
      showMessage('Schedule updated.'); await loadSchedules();
    }));
    document.querySelectorAll('[data-deactivate-schedule]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Deactivate this schedule?')) return;
      await apiRequest(`/api/admin/schedules/${button.dataset.deactivateSchedule}`, { method: 'DELETE' });
      showMessage('Schedule deactivated.'); await loadSchedules();
    }));
  }

  async function loadCoaches() {
    const data = await apiRequest('/api/admin/coaches');
    document.getElementById('coachTable').innerHTML = table(['ID', 'Train', 'Coach', 'Class', 'Seat capacity', 'Created seats', 'Status', 'Action'], data.coaches.map((row) => `<tr><td>${row.coach_id}</td><td>${escapeHtml(row.train_name)}</td><td>${escapeHtml(row.coach_code)}</td><td>${escapeHtml(row.class_name)}</td><td>${row.seat_capacity}</td><td>${row.created_seats}</td><td>${statusPill(row.is_active ? 'ACTIVE' : 'INACTIVE')}</td><td><button class="btn btn-light btn-small" data-show-coach-seats="${row.coach_id}">Load seats</button> <button class="btn btn-small ${row.is_active ? 'btn-danger' : 'btn-teal'}" data-coach-status="${row.coach_id}" data-active="${row.is_active ? 'false' : 'true'}">${row.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>`));
    document.querySelectorAll('[data-show-coach-seats]').forEach((button) => button.addEventListener('click', () => loadSeats(button.dataset.showCoachSeats)));
    document.querySelectorAll('[data-coach-status]').forEach((button) => button.addEventListener('click', async () => {
      await apiRequest(`/api/admin/coaches/${button.dataset.coachStatus}/status`, { method: 'PATCH', body: { isActive: button.dataset.active === 'true' } });
      showMessage('Coach status updated.'); await loadCoaches();
    }));
  }

  async function loadFares() {
    const data = await apiRequest('/api/admin/fares');
    document.getElementById('fareTable').innerHTML = table(['Schedule', 'Train', 'From', 'To', 'Class', 'Fare', 'Action'], data.fares.map((row) => `<tr><td>${row.schedule_id}</td><td>${escapeHtml(row.train_name)}</td><td>${escapeHtml(row.origin_name)}</td><td>${escapeHtml(row.destination_name)}</td><td>${escapeHtml(row.class_name)}</td><td>${formatMoney(row.fare_amount)}</td><td><button class="btn btn-danger btn-small" data-delete-fare="${row.fare_id}">Delete</button></td></tr>`));
    document.querySelectorAll('[data-delete-fare]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Delete this fare?')) return;
      await apiRequest(`/api/admin/fares/${button.dataset.deleteFare}`, { method: 'DELETE' });
      showMessage('Fare deleted.'); await loadFares();
    }));
  }

  async function loadUsers() {
    const data = await apiRequest('/api/admin/users');
    const passengers = data.users.filter((row) => row.role_name === 'PASSENGER');
    document.getElementById('userTable').innerHTML = table(['ID', 'Name', 'Email', 'Phone', 'Status', 'Action'], passengers.map((row) => `<tr><td>${row.user_id}</td><td>${escapeHtml(row.full_name)}</td><td>${escapeHtml(row.email)}</td><td>${escapeHtml(row.phone || '—')}</td><td>${statusPill(row.account_status)}</td><td><button class="btn btn-small ${row.account_status === 'ACTIVE' ? 'btn-danger' : 'btn-teal'}" data-user-id="${row.user_id}" data-user-status="${row.account_status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE'}">${row.account_status === 'ACTIVE' ? 'Block' : 'Activate'}</button></td></tr>`));
    document.querySelectorAll('[data-user-id]').forEach((button) => button.addEventListener('click', async () => {
      await apiRequest(`/api/admin/users/${button.dataset.userId}/status`, { method: 'PATCH', body: { status: button.dataset.userStatus } });
      showMessage('Passenger account updated.'); await loadUsers();
    }));
  }

  async function loadBookings() {
    const data = await apiRequest('/api/admin/bookings');
    document.getElementById('adminBookingTable').innerHTML = table(['Booking code', 'Passenger', 'Train', 'Route', 'Journey date', 'Amount', 'Status', 'Action'], data.bookings.map((row) => `<tr><td>${escapeHtml(row.booking_code)}</td><td>${escapeHtml(row.passenger_name)}<br><small>${escapeHtml(row.email)}</small></td><td>${escapeHtml(row.train_name)}</td><td>${escapeHtml(row.origin_name)} → ${escapeHtml(row.destination_name)}</td><td>${escapeHtml(row.journey_date)}</td><td>${formatMoney(row.total_amount)}</td><td>${statusPill(row.booking_status)}</td><td>${row.booking_status === 'CONFIRMED' ? `<button class="btn btn-danger btn-small" data-authority-cancel="${row.booking_id}">Cancel</button>` : '—'}</td></tr>`));
    document.querySelectorAll('[data-authority-cancel]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Cancel this booking under the demo cancellation rule?')) return;
      try {
        const result = await apiRequest(`/api/admin/bookings/${button.dataset.authorityCancel}/cancel`, { method: 'POST', body: { reason: 'Cancelled by Railway Authority' } });
        showMessage(`${result.message} Simulated refund: ${formatMoney(result.refundAmount)}.`); await loadBookings();
      } catch (error) { showMessage(error.message, 'error'); }
    }));
  }

  function bindForm(formId, endpoint, transform, after) {
    document.getElementById(formId).addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"],button:not([type])');
      if (submit) submit.disabled = true;
      try {
        const raw = Object.fromEntries(new FormData(form).entries());
        const body = transform ? transform(raw) : raw;
        const data = await apiRequest(endpoint, { method: 'POST', body });
        showMessage(data.message || 'Saved successfully.');
        form.reset();
        if (after) await after();
      } catch (error) {
        showMessage(error.message, 'error');
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  async function loadSeats(coachId) {
    const data = await apiRequest(`/api/admin/seats?coachId=${encodeURIComponent(coachId)}`);
    document.getElementById('seatTable').innerHTML = table(['Seat ID', 'Coach', 'Class', 'Seat number', 'Status', 'Action'], data.seats.map((row) => `<tr><td>${row.seat_id}</td><td>${escapeHtml(row.coach_code)}</td><td>${escapeHtml(row.class_name)}</td><td>${escapeHtml(row.seat_number)}</td><td>${statusPill(row.is_active ? 'ACTIVE' : 'INACTIVE')}</td><td><button class="btn btn-small ${row.is_active ? 'btn-danger' : 'btn-teal'}" data-seat-status="${row.seat_id}" data-active="${row.is_active ? 'false' : 'true'}">${row.is_active ? 'Disable' : 'Enable'}</button></td></tr>`));
    document.querySelectorAll('[data-seat-status]').forEach((button) => button.addEventListener('click', async () => {
      await apiRequest(`/api/admin/seats/${button.dataset.seatStatus}/status`, { method: 'PATCH', body: { isActive: button.dataset.active === 'true' } });
      showMessage('Seat status updated.'); await loadSeats(coachId);
    }));
  }

  document.getElementById('seatLookupForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const coachId = event.currentTarget.coachId.value;
    try { await loadSeats(coachId); } catch (error) { showMessage(error.message, 'error'); }
  });

  bindForm('trainForm', '/api/admin/trains', (raw) => raw, loadTrains);
  bindForm('stationForm', '/api/admin/stations', (raw) => raw, loadStations);
  bindForm('routeForm', '/api/admin/routes', (raw) => {
    const ids = raw.stationIds.split(',').map((value) => Number(value.trim()));
    const offsets = raw.offsets.split(',').map((value) => Number(value.trim()));
    if (ids.some((id) => !Number.isInteger(id) || id <= 0) || offsets.length !== ids.length || offsets.some((offset) => !Number.isFinite(offset) || offset < 0)) {
      throw new Error('Enter valid station IDs and the same number of non-negative offsets.');
    }
    return { routeName: raw.routeName, stops: ids.map((stationId, index) => ({ stationId, arrivalOffsetMinutes: offsets[index], departureOffsetMinutes: offsets[index] })) };
  }, loadRoutes);
  bindForm('scheduleForm', '/api/admin/schedules', (raw) => ({ trainId: raw.trainId, routeId: raw.routeId, departureTime: raw.departureTime, days: raw.days.split(',').map((value) => Number(value.trim())) }), loadSchedules);
  bindForm('coachForm', '/api/admin/coaches', (raw) => ({ trainId: raw.trainId, coachCode: raw.coachCode, className: raw.className, seatNumbers: raw.seatNumbers.split(',').map((value) => value.trim()).filter(Boolean) }), loadCoaches);
  bindForm('fareForm', '/api/admin/fares', (raw) => raw, loadFares);

  try { await loadOverview(); } catch (error) { showMessage(error.message, 'error'); }
});
