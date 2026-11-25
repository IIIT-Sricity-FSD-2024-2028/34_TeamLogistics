import test from 'node:test';
import assert from 'node:assert/strict';
import { createBusinessClientStore, createDriverStore } from '../src/redux/store.js';
import { businessClientApi as api, BUSINESS_CLIENT_DATA_TAGS } from '../src/redux/businessClientApi.js';
import { setActiveFilters, setCompletedPage, setCompletedSearch } from '../src/redux/businessClientSlice.js';

function setup(t, businessClientRequest) {
  const store = createBusinessClientStore({ businessClientRequest });
  t.after(() => store.dispatch(api.util.resetApiState()));
  return store;
}
async function settle(store) {
  await Promise.all(store.dispatch(api.util.getRunningQueriesThunk()));
}

test('business pages share requests and normalize supported response envelopes', async (t) => {
  let resolve;
  let calls = 0;
  const store = setup(t, () => { calls += 1; return new Promise((done) => { resolve = done; }); });
  const dashboard = store.dispatch(api.endpoints.getDeliveries.initiate());
  const active = store.dispatch(api.endpoints.getDeliveries.initiate());
  resolve({ deliveries: [{ id: 'd1' }] });
  assert.deepEqual(await dashboard.unwrap(), [{ id: 'd1' }]);
  assert.deepEqual(await active.unwrap(), [{ id: 'd1' }]);
  assert.equal(calls, 1);
});

test('cancellation refreshes dashboard, detail, tracking and billing subscriptions', async (t) => {
  const calls = [];
  let status = 'Requested';
  const store = setup(t, async (method, url, body) => {
    calls.push([method, url, body]);
    if (method === 'PATCH') { status = 'Cancelled'; return { id: 'd1', status }; }
    if (url === '/deliveries/d1') return { id: 'd1', status };
    if (url === '/deliveries') return [{ id: 'd1', status }];
    return [];
  });
  await Promise.all([
    store.dispatch(api.endpoints.getDeliveries.initiate()),
    store.dispatch(api.endpoints.getDelivery.initiate('d1')),
    store.dispatch(api.endpoints.getTrips.initiate()),
    store.dispatch(api.endpoints.getInvoices.initiate()),
    store.dispatch(api.endpoints.getNotifications.initiate()),
  ]);
  await store.dispatch(api.endpoints.cancelDelivery.initiate({ id: 'd1', reason: 'Wrong address' })).unwrap();
  await settle(store);
  assert.equal(api.endpoints.getDeliveries.select()(store.getState()).data[0].status, 'Cancelled');
  assert.equal(api.endpoints.getDelivery.select('d1')(store.getState()).data.status, 'Cancelled');
  for (const path of ['/deliveries', '/deliveries/d1', '/trips', '/transactions/invoices', '/notifications']) {
    assert.equal(calls.filter(([method, url]) => method === 'GET' && url === path).length, 2, path);
  }
  assert.deepEqual(calls.find(([method]) => method === 'PATCH')[2], { reason: 'Wrong address' });
});

test('payment proof preserves FormData and payment submission refreshes billing', async (t) => {
  const calls = [];
  let paid = false;
  const store = setup(t, async (method, url, body) => {
    calls.push({ method, url, body });
    if (url === '/documents') return { fileUrl: '/uploads/receipt.pdf' };
    if (method === 'POST') { paid = true; return { id: 'payment1', ...body }; }
    if (url.endsWith('invoices')) return [{ id: 'i1', status: paid ? 'Pending' : 'Unpaid' }];
    return paid ? [{ id: 'payment1' }] : [];
  });
  await store.dispatch(api.endpoints.getInvoices.initiate());
  await store.dispatch(api.endpoints.getPayments.initiate());
  const receipt = new FormData();
  receipt.append('documentType', 'Payment Receipt');
  const uploaded = await store.dispatch(api.endpoints.uploadDocument.initiate(receipt)).unwrap();
  await store.dispatch(api.endpoints.createPayment.initiate({ invoiceId: 'i1', amount: 200, receiptUrl: uploaded.fileUrl })).unwrap();
  await settle(store);
  assert.equal(calls.find((call) => call.url === '/documents').body, receipt);
  assert.equal(calls.find((call) => call.url === '/transactions').body.receiptUrl, '/uploads/receipt.pdf');
  assert.equal(api.endpoints.getInvoices.select()(store.getState()).data[0].status, 'Pending');
  assert.equal(api.endpoints.getPayments.select()(store.getState()).data.length, 1);
});

test('delivery OTP generation uses the owning delivery and refreshes its delivery and notifications', async (t) => {
  const calls = [];
  const store = setup(t, async (method, url) => {
    calls.push([method, url]);
    if (method === 'POST') return { deliveryId: 'd/1', deliveryOtp: '123456' };
    if (url === '/deliveries/d%2F1') return { id: 'd/1', deliveryOtp: { issued: true } };
    if (url === '/deliveries') return [{ id: 'd/1', deliveryOtp: { issued: true } }];
    if (url === '/notifications') return [{ id: 'n1', title: 'Delivery confirmation OTP' }];
    return [];
  });
  await Promise.all([
    store.dispatch(api.endpoints.getDeliveries.initiate()),
    store.dispatch(api.endpoints.getDelivery.initiate('d/1')),
    store.dispatch(api.endpoints.getNotifications.initiate()),
  ]);
  const result = await store.dispatch(api.endpoints.issueDeliveryOtp.initiate('d/1')).unwrap();
  await settle(store);

  assert.equal(result.deliveryOtp, '123456');
  assert.ok(calls.some(([method, url]) => method === 'POST' && url === '/deliveries/d%2F1/delivery-otp'));
  assert.equal(calls.filter(([method, url]) => method === 'GET' && url === '/deliveries').length, 2);
  assert.equal(calls.filter(([method, url]) => method === 'GET' && url === '/notifications').length, 2);
});

test('failed changes retain cached data and expose the backend message', async (t) => {
  let gets = 0;
  const store = setup(t, async (method) => {
    if (method === 'PATCH') throw new Error('This delivery can no longer be cancelled.');
    gets += 1;
    return [{ id: 'd1', status: 'In Transit' }];
  });
  await store.dispatch(api.endpoints.getDeliveries.initiate());
  await assert.rejects(store.dispatch(api.endpoints.cancelDelivery.initiate({ id: 'd1', reason: 'Changed plans' })).unwrap(),
    { message: 'This delivery can no longer be cancelled.' });
  await settle(store);
  assert.equal(gets, 1);
  assert.equal(api.endpoints.getDeliveries.select()(store.getState()).data[0].status, 'In Transit');
});

test('profile cache validates account identity and refreshes header data after editing', async (t) => {
  let user = { id: 'u1', name: 'Client', companyName: 'Old Company' };
  const store = setup(t, async (method, _url, body) => {
    if (method === 'PUT') user = { ...user, ...body };
    return structuredClone(user);
  });
  await assert.rejects(store.dispatch(api.endpoints.getCurrentUser.initiate('someone-else')).unwrap(),
    { message: 'Could not load the logged-in business client profile.' });
  await store.dispatch(api.endpoints.getCurrentUser.initiate('u1'));
  await store.dispatch(api.endpoints.updateProfile.initiate({ id: 'u1', changes: { companyName: 'New Company' } })).unwrap();
  await settle(store);
  assert.equal(api.endpoints.getCurrentUser.select('u1')(store.getState()).data.companyName, 'New Company');
});

test('quote cache keys keep a late estimate from replacing the current package estimate', async (t) => {
  let resolveFirst;
  const store = setup(t, async (_method, _url, body) => body.weight === 1
    ? new Promise((done) => { resolveFirst = done; }) : { total: 500 });
  const first = store.dispatch(api.endpoints.getDeliveryQuote.initiate({ weight: 1 }));
  const second = store.dispatch(api.endpoints.getDeliveryQuote.initiate({ weight: 5 }));
  await second.unwrap();
  resolveFirst({ total: 100 });
  await first.unwrap();
  assert.equal(api.endpoints.getDeliveryQuote.select({ weight: 5 })(store.getState()).data.total, 500);
});

test('notification changes and live updates refresh only subscribed business resources', async (t) => {
  let read = false;
  const urls = [];
  const store = setup(t, async (method, url) => {
    urls.push(url);
    if (method === 'PATCH') read = true;
    return [{ id: 'n1', read }];
  });
  await store.dispatch(api.endpoints.getNotifications.initiate());
  await store.dispatch(api.endpoints.markNotification.initiate({ id: 'n1', read: true })).unwrap();
  await settle(store);
  assert.equal(api.endpoints.getNotifications.select()(store.getState()).data[0].read, true);
  store.dispatch(api.util.invalidateTags(BUSINESS_CLIENT_DATA_TAGS));
  await settle(store);
  assert.deepEqual(urls, ['/notifications', '/notifications/n1', '/notifications', '/notifications']);
});

test('business filters persist in their store and fresh accounts and driver stores are isolated', async (t) => {
  const store = setup(t, async () => [{ id: 'private-delivery' }]);
  store.dispatch(setActiveFilters({ search: 'private-delivery', driverFilter: 'Driver' }));
  store.dispatch(setCompletedPage(5));
  store.dispatch(setCompletedSearch('delivery'));
  await store.dispatch(api.endpoints.getDeliveries.initiate());
  assert.equal(store.getState().businessClient.active.search, 'private-delivery');
  assert.equal(store.getState().businessClient.completed.page, 1);
  const next = setup(t, async () => []);
  assert.equal(next.getState().businessClient.active.search, '');
  assert.equal(api.endpoints.getDeliveries.select()(next.getState()).data, undefined);
  assert.equal(createDriverStore().getState().businessClientApi, undefined);
});
