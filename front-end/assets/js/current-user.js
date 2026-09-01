(function () {
  'use strict';

  const SESSION_KEY = 'deliverysync-session-v1';
  const SELECTOR = [
    '[data-current-user-avatar]',
    '[data-current-user-name]',
    '[data-current-user-role]',
    '[data-current-user-email]',
  ].join(',');

  const ROLE_LABELS = {
    superuser: 'Super User',
    'fleet-manager': 'Fleet Manager',
    'business-client': 'Business Client',
    driver: 'Driver',
  };

  function getSession() {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');

      if (!session || typeof session.userId !== 'string' || !session.userId.trim()) {
        return null;
      }

      return session;
    } catch (error) {
      console.error('Unable to read DeliverSync session for current-user header:', error);
      return null;
    }
  }

  function getInitials(name) {
    const parts = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!parts.length) return '?';

    const first = Array.from(parts[0])[0] || '';
    const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] || '' : '';

    return `${first}${last}`.toLocaleUpperCase() || '?';
  }

  function roleLabel(role) {
    const normalized = String(role || '').trim().toLowerCase();
    return ROLE_LABELS[normalized] || (role ? String(role) : '');
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = value;
    });
  }

  function setSafePlaceholder(isError) {
    setText('[data-current-user-avatar]', isError ? '?' : '…');
    setText('[data-current-user-name]', isError ? 'Unavailable' : 'Loading…');
    setText('[data-current-user-role]', '');
    setText('[data-current-user-email]', '');
  }

  function getDisplayName(user, element) {
    if (element.getAttribute('data-current-user-name') === 'company') {
      return user.companyName || user.company || user.profileDetails?.companyName || user.name || '';
    }

    return user.name || '';
  }

  function populate(user) {
    const name = String(user.name || '').trim();

    setText('[data-current-user-avatar]', getInitials(name));
    document.querySelectorAll('[data-current-user-name]').forEach((element) => {
      element.textContent = getDisplayName(user, element);
    });
    setText('[data-current-user-role]', roleLabel(user.role));
    setText('[data-current-user-email]', user.email || '');
  }

  async function load() {
    if (!document.querySelector(SELECTOR)) return null;

    setSafePlaceholder(false);
    const session = getSession();

    if (!session) {
      console.error('Current-user header was requested without a valid DeliverSync session.');
      setSafePlaceholder(true);
      return null;
    }

    try {
      const usersApi = window.DeliverySyncAPI && window.DeliverySyncAPI.Users;
      const getById = usersApi && (usersApi.getById || usersApi.getOne);

      if (typeof getById !== 'function') {
        throw new Error('DeliverySyncAPI.Users.getById is unavailable.');
      }

      const user = await getById(session.userId);

      if (!user || String(user.id) !== String(session.userId)) {
        throw new Error('Current-user endpoint did not return the requested user ID.');
      }

      populate(user);
      return user;
    } catch (error) {
      console.error(`Unable to load current user ${session.userId} for header:`, error);
      setSafePlaceholder(true);
      return null;
    }
  }

  async function updateNotificationBadge() {
    const badgeEls = document.querySelectorAll('.bc-bell .badge');
    if (!badgeEls.length) return;

    const api = window.DeliverySyncAPI;
    if (!api || !api.Notifications || typeof api.Notifications.getAll !== 'function') return;

    try {
      const list = await api.Notifications.getAll();
      const count = (list || []).filter(
        (n) => !(n.read === true || String(n.status || '').toLowerCase() === 'read')
      ).length;

      badgeEls.forEach((el) => {
        el.textContent = String(count);
        el.style.display = count > 0 ? '' : 'none';
      });
    } catch (error) {
      console.error('Unable to load notification count:', error);
    }
  }

  window.DeliverySyncCurrentUser = { load, getInitials, SESSION_KEY, updateNotificationBadge };
  load();
  updateNotificationBadge();

  let reloadTimer = null;
  const scheduleLoad = () => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(load, 0);
  };

  if (document.documentElement && window.MutationObserver) {
    const observer = new MutationObserver((records) => {
      const addedCurrentUserHeader = records.some((record) =>
        Array.from(record.addedNodes).some((node) =>
          node.nodeType === Node.ELEMENT_NODE &&
          (node.matches(SELECTOR) || node.querySelector(SELECTOR))
        )
      );

      if (addedCurrentUserHeader) scheduleLoad();
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.addEventListener('storage', (event) => {
    if (event.key === SESSION_KEY) load();
  });
})();
