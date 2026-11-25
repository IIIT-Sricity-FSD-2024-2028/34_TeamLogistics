import test from 'node:test';
import assert from 'node:assert/strict';
import { createDriverStore } from '../src/redux/store.js';
import { driverApi, DRIVER_DATA_TAGS } from '../src/redux/driverApi.js';
import { setDashboardSearch, setHistorySearch, setHistoryPage } from '../src/redux/driverSlice.js';

function setup(t, request) {
  const store = createDriverStore({ driverRequest: request });
  t.after(() => store.dispatch(driverApi.util.resetApiState()));
  return store;
}

async function settle(store) {
  await Promise.all(store.dispatch(driverApi.util.getRunningQueriesThunk()));
}

test('multiple driver screens share one in-flight trips request', async (t) => {
  let resolve;
  let calls = 0;
  const store = setup(t, () => { calls += 1; return new Promise((done) => { resolve = done; }); });
  const dashboard = store.dispatch(driverApi.endpoints.getTrips.initiate());
  const history = store.dispatch(driverApi.endpoints.getTrips.initiate());
  resolve([{ id: 't1', status: 'Assigned' }]);
  assert.deepEqual(await dashboard.unwrap(), await history.unwrap());
  assert.equal(calls, 1);
});

test('trip completion refreshes subscribed lists, details, earnings and notifications', async (t) => {
  let status = 'Accepted';
  const calls = [];
  const store = setup(t, async (method, url, body) => {
    calls.push([method, url]);
    if (method === 'PATCH') { status = body.status; return { id: 't1', status }; }
    if (url === '/trips/t1') return { id: 't1', status };
    if (url === '/trips') return [{ id: 't1', status }];
    return [];
  });
  await Promise.all([
    store.dispatch(driverApi.endpoints.getTrips.initiate()),
    store.dispatch(driverApi.endpoints.getTrip.initiate('t1')),
    store.dispatch(driverApi.endpoints.getDeliveries.initiate()),
    store.dispatch(driverApi.endpoints.getPayouts.initiate()),
    store.dispatch(driverApi.endpoints.getNotifications.initiate()),
  ]);
  await store.dispatch(driverApi.endpoints.updateTripStatus.initiate({ id: 't1', status: 'Completed' })).unwrap();
  await settle(store);
  assert.equal(driverApi.endpoints.getTrips.select()(store.getState()).data[0].status, 'Completed');
  assert.equal(driverApi.endpoints.getTrip.select('t1')(store.getState()).data.status, 'Completed');
  for (const url of ['/trips', '/trips/t1', '/deliveries', '/payouts/driver/mine', '/notifications']) {
    assert.equal(calls.filter(([method, path]) => method === 'GET' && path === url).length, 2, url);
  }
});

test('failed status changes preserve cached trips and expose the API error', async (t) => {
  let gets = 0;
  const store = setup(t, async (method) => {
    if (method === 'PATCH') throw new Error('Finish your active delivery first.');
    gets += 1;
    return [{ id: 't1', status: 'Assigned' }];
  });
  await store.dispatch(driverApi.endpoints.getTrips.initiate());
  await assert.rejects(store.dispatch(driverApi.endpoints.updateTripStatus.initiate({ id: 't1', status: 'Accepted' })).unwrap(),
    { message: 'Finish your active delivery first.' });
  await settle(store);
  assert.equal(gets, 1);
  assert.equal(driverApi.endpoints.getTrips.select()(store.getState()).data[0].status, 'Assigned');
});

test('notification mutations update the shared inbox and badge query', async (t) => {
  let notifications = [{ id: 'n1', read: false }, { id: 'n2', read: false }];
  const store = setup(t, async (method, url, body) => {
    if (method === 'GET') return structuredClone(notifications);
    if (method === 'DELETE') notifications = notifications.filter((item) => url !== `/notifications/${item.id}`);
    else notifications = notifications.map((item) => url.endsWith('mark-read') || url.endsWith(item.id)
      ? { ...item, read: body?.read ?? true } : item);
    return null;
  });
  await store.dispatch(driverApi.endpoints.getNotifications.initiate());
  const unread = () => driverApi.endpoints.getNotifications.select()(store.getState()).data.filter((item) => !item.read).length;
  assert.equal(unread(), 2);
  await store.dispatch(driverApi.endpoints.markNotification.initiate({ id: 'n1', read: true })).unwrap();
  await settle(store);
  assert.equal(unread(), 1);
  await store.dispatch(driverApi.endpoints.markAllNotificationsRead.initiate()).unwrap();
  await settle(store);
  assert.equal(unread(), 0);
  await store.dispatch(driverApi.endpoints.deleteNotification.initiate('n1')).unwrap();
  await settle(store);
  assert.equal(driverApi.endpoints.getNotifications.select()(store.getState()).data.length, 1);
});

test('live sync refreshes active subscriptions without loading unused resources', async (t) => {
  const calls = [];
  const store = setup(t, async (_method, url) => { calls.push(url); return []; });
  await store.dispatch(driverApi.endpoints.getTrips.initiate());
  store.dispatch(driverApi.util.invalidateTags(DRIVER_DATA_TAGS));
  await settle(store);
  assert.deepEqual(calls, ['/trips', '/trips']);
});

test('a new driver session has no previous account data or filters', async (t) => {
  const oldStore = setup(t, async () => [{ id: 'private-trip' }]);
  oldStore.dispatch(setDashboardSearch('private-trip'));
  oldStore.dispatch(setHistoryPage(4));
  oldStore.dispatch(setHistorySearch('delivery'));
  assert.equal(oldStore.getState().driver.history.page, 1);
  await oldStore.dispatch(driverApi.endpoints.getTrips.initiate());
  const newStore = setup(t, async () => []);
  assert.equal(newStore.getState().driver.dashboard.search, '');
  assert.equal(driverApi.endpoints.getTrips.select()(newStore.getState()).data, undefined);
});

test('uploads preserve FormData and completion sends the saved proof reference', async (t) => {
  const calls = [];
  const store = setup(t, async (method, url, body) => {
    calls.push({ method, url, body });
    return url.includes('verify-delivery-otp') ? { valid: true } : { id: 'proof1' };
  });
  await store.dispatch(driverApi.endpoints.verifyDeliveryOtp.initiate({ id: 'trip/1', deliveryOtp: '123456' })).unwrap();
  const form = new FormData();
  form.append('documentType', 'Proof of Delivery');
  const proof = await store.dispatch(driverApi.endpoints.uploadDocument.initiate(form)).unwrap();
  await store.dispatch(driverApi.endpoints.updateTripStatus.initiate({
    id: 'trip/1', status: 'Completed', details: { proofDocumentId: proof.id, recipient: 'Customer', deliveryOtp: '123456' },
  })).unwrap();
  assert.equal(calls[0].url, '/trips/trip%2F1/verify-delivery-otp');
  assert.deepEqual(calls[0].body, { deliveryOtp: '123456' });
  assert.equal(calls[1].body, form);
  assert.equal(calls[2].url, '/trips/trip%2F1/status');
  assert.deepEqual(calls[2].body, { status: 'Completed', proofDocumentId: 'proof1', recipient: 'Customer', deliveryOtp: '123456' });
});
