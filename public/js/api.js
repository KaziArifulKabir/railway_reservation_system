async function apiRequest(url, options = {}) {
  const config = {
    method: options.method || 'GET',
    credentials: 'same-origin',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  };
  const response = await fetch(url, config);
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : { message: await response.text() };
  if (!response.ok) {
    const error = new Error(data.message || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(Number(value || 0));
}

function showToast(message, type = 'info') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast ${type === 'error' ? 'error' : type === 'success' ? 'success' : ''}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.remove(), 4200);
}

async function currentUser() {
  try {
    const data = await apiRequest('/api/auth/me');
    return data.user;
  } catch {
    return null;
  }
}

async function setupNavigation() {
  const user = await currentUser();
  const nav = document.querySelector('[data-nav-links]');
  if (!nav) return user;
  if (!user) {
    nav.innerHTML = `
      <a href="index.html">Home</a>
      <a href="login.html">Login</a>
      <a class="btn btn-teal btn-small" href="register.html">Register</a>`;
  } else if (user.role === 'RAILWAY_AUTHORITY') {
    nav.innerHTML = `
      <a href="admin.html">Authority Dashboard</a>
      <span class="muted" style="color:#d9e8f5">${escapeHtml(user.fullName)}</span>
      <button type="button" data-logout>Logout</button>`;
  } else {
    nav.innerHTML = `
      <a href="index.html">Search Train</a>
      <a href="passenger.html">My Dashboard</a>
      <a href="bookings.html">My Bookings</a>
      <span class="muted" style="color:#d9e8f5">${escapeHtml(user.fullName)}</span>
      <button type="button" data-logout>Logout</button>`;
  }
  nav.querySelector('[data-logout]')?.addEventListener('click', async () => {
    try { await apiRequest('/api/auth/logout', { method: 'POST' }); } catch { /* local redirect still clears the page */ }
    window.location.href = 'index.html';
  });
  return user;
}

function requireRole(user, roles) {
  if (!user || !roles.includes(user.role)) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function dateTodayLocal() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
