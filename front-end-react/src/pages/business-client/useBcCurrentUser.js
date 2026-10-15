import { useEffect, useState } from 'react';
import { getSession } from '../../api/client';
import { Users } from '../../api/namespaces';

const ROLE_LABELS = {
  superuser: 'Super User',
  'fleet-manager': 'Fleet Manager',
  'business-client': 'Business Client',
  driver: 'Driver',
};

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = Array.from(parts[0])[0] || '';
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] || '' : '';
  return `${first}${last}`.toLocaleUpperCase() || '?';
}

export function useBcCurrentUser() {
  const [state, setState] = useState({
    loading: true,
    error: false,
    user: null,
    companyName: 'Loading...',
    name: 'Loading…',
    role: '',
    initials: '…',
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const session = getSession();
      if (!session || !session.userId) {
        if (!cancelled) {
          setState({ loading: false, error: true, user: null, companyName: 'Unavailable', name: 'Unavailable', role: '', initials: '?' });
        }
        return;
      }

      try {
        const user = await Users.getById(session.userId);
        if (!user || String(user.id) !== String(session.userId)) {
          throw new Error('Current-user endpoint did not return the requested user ID.');
        }
        if (cancelled) return;
        const name = String(user.name || '').trim();
        const companyName = user.companyName || user.company || user.profileDetails?.companyName || user.name || '';
        const role = ROLE_LABELS[normalizeRole(user.role)] || (user.role ? String(user.role) : '');
        setState({
          loading: false,
          error: false,
          user,
          companyName,
          name,
          role,
          initials: getInitials(name),
        });
      } catch (e) {
        console.error(`Unable to load current user ${session.userId} for header:`, e);
        if (!cancelled) {
          setState({ loading: false, error: true, user: null, companyName: 'Unavailable', name: 'Unavailable', role: '', initials: '?' });
        }
      }
    }

    function normalizeRole(role) {
      return String(role || '').trim().toLowerCase();
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
