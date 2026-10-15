import { useEffect, useRef } from 'react';

export const DATA_CHANGED_EVENT = 'deliverysync:data-changed';
export const DATA_CHANGED_STORAGE_KEY = 'deliverysync-data-changed-v1';
export const DATA_CHANGED_CHANNEL = 'deliverysync-data-v1';

/**
 * Keeps an API-backed screen current when another portal changes data.
 * BroadcastChannel handles other tabs in the same browser, the storage event
 * covers older browsers, and polling reconciles changes made by other devices.
 */
export function useLiveSync(refresh, { intervalMs = 20000, enabled = true } = {}) {
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return undefined;

    let running = false;
    let lastStartedAt = 0;
    let pending = false;
    let disposed = false;
    let deferredTimer;
    const run = async () => {
      if (disposed || document.visibilityState === 'hidden') return;
      if (running) {
        pending = true;
        return;
      }

      // A mutation, focus and visibility event can arrive together. Coalesce
      // that burst so every mounted consumer makes at most one refresh call.
      const now = Date.now();
      if (now - lastStartedAt < 1000) {
        window.clearTimeout(deferredTimer);
        deferredTimer = window.setTimeout(run, 1000 - (now - lastStartedAt));
        return;
      }

      running = true;
      lastStartedAt = now;
      try {
        await refreshRef.current?.({ background: true });
      } catch (error) {
        console.warn('Background portal refresh failed:', error);
      } finally {
        running = false;
        if (pending && !disposed) {
          pending = false;
          run();
        }
      }
    };

    const onStorage = (event) => {
      if (event.key === DATA_CHANGED_STORAGE_KEY) run();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };

    let channel;
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(DATA_CHANGED_CHANNEL);
      channel.addEventListener('message', run);
    }

    window.addEventListener(DATA_CHANGED_EVENT, run);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', onVisible);
    // Stagger tabs slightly so several portals do not hit the API at exactly
    // the same instant. Mutations still refresh immediately via the events
    // above; this timer is only a reconciliation fallback.
    const jitter = Math.floor(Math.random() * Math.min(3000, intervalMs * 0.15));
    const timer = window.setInterval(run, intervalMs + jitter);

    return () => {
      disposed = true;
      window.clearTimeout(deferredTimer);
      window.clearInterval(timer);
      window.removeEventListener(DATA_CHANGED_EVENT, run);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', onVisible);
      channel?.removeEventListener('message', run);
      channel?.close();
    };
  }, [enabled, intervalMs]);
}

