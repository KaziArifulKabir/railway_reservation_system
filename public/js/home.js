document.addEventListener('DOMContentLoaded', async () => {
  await setupNavigation();
  const from = document.getElementById('fromStationId');
  const to = document.getElementById('toStationId');
  const date = document.getElementById('journeyDate');
  const form = document.getElementById('searchForm');
  const results = document.getElementById('results');
  const message = document.getElementById('searchMessage');
  date.min = dateTodayLocal();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  date.value = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  try {
    const data = await apiRequest('/api/stations');
    const options = data.stations.map((station) => `<option value="${station.station_id}">${escapeHtml(station.station_name)} (${escapeHtml(station.station_code)})</option>`).join('');
    from.innerHTML = `<option value="">Choose origin</option>${options}`;
    to.innerHTML = `<option value="">Choose destination</option>${options}`;
    if (data.stations.length >= 2) {
      const dhaka = data.stations.find((station) => station.station_code === 'DHK');
      const chattogram = data.stations.find((station) => station.station_code === 'CTG');
      from.value = dhaka ? dhaka.station_id : data.stations[0].station_id;
      to.value = chattogram ? chattogram.station_id : data.stations[data.stations.length - 1].station_id;
    }
  } catch (error) {
    message.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    results.innerHTML = '<p class="loading">Searching trains...</p>';
    message.innerHTML = '';
    document.getElementById('resultSummary').textContent = 'Please wait while the schedule is checked.';
    try {
      const query = new URLSearchParams({ fromStationId: from.value, toStationId: to.value, journeyDate: date.value });
      const data = await apiRequest(`/api/trains/search?${query}`);
      if (!data.results.length) {
        results.innerHTML = '<div class="card">No train is available for the selected route and date. Try another date or route.</div>';
        document.getElementById('resultSummary').textContent = 'No matching train found.';
        return;
      }
      document.getElementById('resultSummary').textContent = `${data.results.length} train class option(s) found for ${date.value}.`;
      results.innerHTML = data.results.map((train) => {
        const available = Number(train.available_seats);
        const queryParams = new URLSearchParams({
          scheduleId: train.schedule_id,
          fromStationId: from.value,
          toStationId: to.value,
          journeyDate: date.value,
          className: train.class_name
        });
        return `<article class="train-card">
          <div><h3>${escapeHtml(train.train_name)}</h3><p>Train ${escapeHtml(train.train_number)} · ${escapeHtml(train.train_type)}</p><p>${escapeHtml(train.route_name)}</p></div>
          <div class="train-meta"><strong>${escapeHtml(train.departure_time)} → ${escapeHtml(train.arrival_time)}</strong><span>${escapeHtml(train.origin_name)} to ${escapeHtml(train.destination_name)}</span></div>
          <div class="train-meta"><strong>${escapeHtml(train.class_name)}</strong><span>${available} seat(s) · ${formatMoney(train.fare_amount)}</span></div>
          <div><a class="btn btn-primary" href="booking.html?${queryParams.toString()}" ${available < 1 ? 'aria-disabled="true" style="pointer-events:none;opacity:.5"' : ''}>Select Seat</a></div>
        </article>`;
      }).join('');
    } catch (error) {
      results.innerHTML = '';
      message.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
      document.getElementById('resultSummary').textContent = 'Search could not be completed.';
    }
  });
});
