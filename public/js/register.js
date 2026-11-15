document.addEventListener('DOMContentLoaded', async () => {
  await setupNavigation();
  const form = document.getElementById('registerForm');
  const message = document.getElementById('formMessage');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.innerHTML = '';
    if (document.getElementById('password').value !== document.getElementById('confirmPassword').value) {
      message.innerHTML = '<div class="notice error">Passwords do not match.</div>';
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: {
          fullName: document.getElementById('fullName').value,
          email: document.getElementById('email').value,
          phone: document.getElementById('phone').value,
          password: document.getElementById('password').value
        }
      });
      window.location.href = 'passenger.html';
    } catch (error) {
      message.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
    } finally {
      button.disabled = false;
    }
  });
});
