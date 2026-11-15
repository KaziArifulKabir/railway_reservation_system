document.addEventListener('DOMContentLoaded', async () => {
  const user = await setupNavigation();
  if (!requireRole(user, ['PASSENGER'])) return;
  document.getElementById('welcomeTitle').textContent = `Welcome, ${user.fullName}`;
  document.getElementById('fullName').value = user.fullName || '';
  document.getElementById('email').value = user.email || '';
  document.getElementById('phone').value = user.phone || '';

  try {
    const data = await apiRequest('/api/bookings');
    const bookings = data.bookings;
    const confirmed = bookings.filter((item) => item.booking_status === 'CONFIRMED').length;
    const pending = bookings.filter((item) => item.booking_status === 'PENDING').length;
    document.getElementById('passengerStats').innerHTML = `
      <div class="stat-card"><span>Total bookings</span><strong>${bookings.length}</strong></div>
      <div class="stat-card"><span>Confirmed</span><strong>${confirmed}</strong></div>
      <div class="stat-card"><span>Pending payment</span><strong>${pending}</strong></div>`;
  } catch (error) {
    document.getElementById('dashboardMessage').innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
  }

  document.getElementById('profileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await apiRequest('/api/auth/profile', { method: 'PUT', body: { fullName: document.getElementById('fullName').value, phone: document.getElementById('phone').value } });
      showToast('Profile updated successfully.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
});
