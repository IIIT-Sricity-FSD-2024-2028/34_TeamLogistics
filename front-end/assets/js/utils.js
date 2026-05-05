(function () {
  function $(selector, scope = document) {
    return scope.querySelector(selector);
  }
  function $all(selector, scope = document) {
    return Array.from(scope.querySelectorAll(selector));
  }
  function generateId(prefix, collection) {
    const numericParts = collection
      .map((item) => String(item.id || '').match(/(\d+)/))
      .filter(Boolean)
      .map((match) => Number(match[1]));
    const next = (numericParts.length ? Math.max(...numericParts) : 0) + 1;
    return `${prefix}-${String(next).padStart(3, '0')}`;
  }
  function showToast(message) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
  }
  function setError(input, message) {
    const field = input.closest('.form-control') || input.parentElement;
    const error = field.querySelector('.error-message');
    if (error) error.textContent = message || '';
    input.style.borderColor = message ? '#ff5b5b' : '';
  }
  function clearErrors(form) {
    $all('.error-message', form).forEach((node) => (node.textContent = ''));
    $all('input, select, textarea', form).forEach((node) => (node.style.borderColor = ''));
  }
  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  function validatePhone(phone) {
    return /^[0-9+\-\s]{10,15}$/.test(phone.trim());
  }
  function validatePassword(password) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password);
  }
  function setupPasswordToggles(scope = document) {
    $all('.toggle-visibility', scope).forEach((button) => {
      button.addEventListener('click', () => {
        const input = button.parentElement.querySelector('input');
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        button.textContent = input.type === 'password' ? '👁' : '🙈';
      });
    });
  }
  window.DeliverySyncUtils = {
    $, $all, generateId, showToast, setError, clearErrors,
    validateEmail, validatePhone, validatePassword, setupPasswordToggles
  };
})();
