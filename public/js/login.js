document.addEventListener('DOMContentLoaded', async () => {
  await setupNavigation();
  const form = document.getElementById('loginForm');
  const message = document.getElementById('formMessage');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    message.innerHTML = '';
    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: { email: document.getElementById('email').value, password: document.getElementById('password').value }
      });
      window.location.href = data.user.role === 'RAILWAY_AUTHORITY' ? 'admin.html' : 'passenger.html';
    } catch (error) {
      message.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
    } finally {
      button.disabled = false;
    }
  });
});
