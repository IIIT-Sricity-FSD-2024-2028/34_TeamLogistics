(function () {
  const { readState, initialState, setSession, roleRoutes, seed } = window.DeliverySyncData;
  const { $, setError, clearErrors, validateEmail, setupPasswordToggles, showToast } = window.DeliverySyncUtils;

  function loginHandler() {
    seed();
    const form = $('#login-form');
    if (!form) return;
    setupPasswordToggles(form);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      clearErrors(form);
      const emailInput = $('#email');
      const passwordInput = $('#password');
      const rememberMe = $('#rememberMe');
      const identifier = emailInput.value.trim();
      const password = passwordInput.value;
      let valid = true;

      if (!identifier) {
        setError(emailInput, 'Email is required');
        valid = false;
      }
      if (!password) {
        setError(passwordInput, 'Password is required');
        valid = false;
      }
      if (!valid) return;

      const state = readState();
      const normalizedIdentifier = identifier.toLowerCase();
      const findUser = (list) => (list || []).find((item) => {
        const email = (item.email || '').toLowerCase();
        return email === normalizedIdentifier;
      });

      const user = findUser(state.users) || findUser(initialState.users);

      if (!user) {
        setError(emailInput, 'No account found for this email');
        return;
      }

      if ((user.status || '').toLowerCase() === 'pending approval') {
        setError(emailInput, 'Your account is awaiting super user approval');
        return;
      }
      if ((user.status || '').toLowerCase() === 'rejected' || (user.status || '').toLowerCase() === 'suspended') {
        setError(emailInput, 'Your account is not allowed to sign in');
        return;
      }
      if (user.password !== password) {
        setError(passwordInput, 'Incorrect password');
        return;
      }

      setSession({
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        remembered: rememberMe.checked,
        loggedInAt: new Date().toISOString()
      });

      showToast(`${user.name} signed in successfully`);
      setTimeout(() => {
        window.location.href = roleRoutes[user.role];
      }, 350);
    });

    const demo = $('#demo-credentials');
    if (demo) {
      demo.innerHTML = `
        <strong>Mock credentials</strong><br>
        Super User: superuser@deliverysync.com / Super@123<br>
        Fleet Manager: fleet@deliverysync.com / Fleet@123<br>
        Business Client: client@deliverysync.com / Client@123<br>
        Driver: driver@deliverysync.com / Driver@123
      `;
    }
  }

  document.addEventListener('DOMContentLoaded', loginHandler);
})();
