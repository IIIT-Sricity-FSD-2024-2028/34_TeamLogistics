import { useEffect, useState } from 'react';
import { Notifications } from '../api/namespaces';
import { useLiveSync } from './useLiveSync';

export function useNotificationBadge() {
  const [unread, setUnread] = useState(0);

  async function load() {
    try {
      const all = await Notifications.getAll();
      const count = (all || []).filter((n) => !n.read).length;
      setUnread(count);
    } catch {
      // Preserve the last known count during a temporary network failure.
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      try {
        const all = await Notifications.getAll();
        if (cancelled) return;
        const count = (all || []).filter((n) => !n.read).length;
        setUnread(count);
      } catch {
        if (!cancelled) setUnread(0);
      }
    }

    loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  useLiveSync(load, { intervalMs: 30000 });

  return { unread };
}
