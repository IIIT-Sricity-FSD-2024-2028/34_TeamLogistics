import { API_BASE, clearSession } from './client';

// Fetch streams allow an Authorization header without putting tokens in URLs.
// One connection per tab serves all mounted portal screens.
export function connectLiveUpdates(token) {
  const controller = new AbortController();
  let retryTimer;

  async function connect() {
    try {
      const response = await fetch(`${API_BASE}/changes`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        signal: controller.signal,
        cache: 'no-store',
      });
      if (response.status === 401) {
        clearSession();
        return;
      }
      if (!response.ok || !response.body) throw new Error('Live updates unavailable');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const event = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const data = event.split('\n').filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim()).join('\n');
          if (!data) continue;
          const message = JSON.parse(data);
          if (message.type === 'connected' || message.type === 'changed') {
            window.dispatchEvent(new CustomEvent('deliverysync:data-changed'));
          }
        }
      }
    } catch {
      // Polling remains available while the stream reconnects.
    }
    if (!controller.signal.aborted) retryTimer = window.setTimeout(connect, 5000);
  }

  connect();
  return () => {
    controller.abort();
    window.clearTimeout(retryTimer);
  };
}
