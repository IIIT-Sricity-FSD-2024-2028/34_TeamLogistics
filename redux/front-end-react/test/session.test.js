import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function storage(shared = new Map()) {
  return {
    getItem: (key) => shared.get(key) ?? null,
    setItem: (key, value) => shared.set(key, String(value)),
    removeItem: (key) => shared.delete(key),
  };
}

function tab(localStorage, role = 'login', fetchImplementation) {
  const source = readFileSync(new URL('../src/api/client.js', import.meta.url), 'utf8')
    .replace('import.meta.env.VITE_API_BASE_URL', "''")
    .replace(/export /g, '');
  const context = {
    localStorage, sessionStorage: storage(),
    window: { location: { pathname: `/${role}` }, dispatchEvent() {} },
    CustomEvent: class {}, URLSearchParams,
    fetch: fetchImplementation,
  };
  runInNewContext(`${source}\nthis.api = { getSession, setSession, clearSession, getCurrentToken, apiRequest };`, context);
  return context.api;
}

test('portal logins, refreshes and logout are isolated between tabs', () => {
  const remembered = storage();
  const driver = tab(remembered);
  const fleet = tab(remembered);
  driver.setSession({ token: 'driver-token', role: 'driver', remembered: true });
  fleet.setSession({ token: 'fleet-token', role: 'fleet-manager', remembered: true });
  assert.equal(driver.getCurrentToken(), 'driver-token');
  assert.equal(fleet.getCurrentToken(), 'fleet-token');
  assert.equal(tab(remembered, 'driver').getCurrentToken(), 'driver-token');
  fleet.clearSession();
  assert.equal(fleet.getSession(), null);
  assert.equal(driver.getCurrentToken(), 'driver-token');
});

test('unremembered logins are not restored in a new tab', () => {
  const remembered = storage();
  const driver = tab(remembered);
  driver.setSession({ token: 'temporary-token', role: 'driver', remembered: false });
  assert.equal(driver.getCurrentToken(), 'temporary-token');
  assert.equal(tab(remembered, 'driver').getSession(), null);
});

test('gateway outages produce a connection message and preserve the status', async () => {
  const api = tab(storage(), 'login', async () => ({
    ok: false, status: 502, json: async () => { throw new Error('Not JSON'); },
  }));
  await assert.rejects(api.apiRequest('POST', '/auth/login'), (error) =>
    error.status === 502 && error.message.includes('server is temporarily unavailable'),
  );
});

test('network failures are identified separately from password errors', async () => {
  const api = tab(storage(), 'login', async () => { throw new Error('Network unavailable'); });
  await assert.rejects(api.apiRequest('POST', '/auth/login'), (error) =>
    error.status === 0 && error.message.includes('Cannot connect to the server'),
  );
});
