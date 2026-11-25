import test from 'node:test';
import assert from 'node:assert/strict';
import { createSuperuserStore, createBusinessClientStore, createDriverStore } from '../src/redux/store.js';
import { superuserApi as api, SUPERUSER_DATA_TAGS } from '../src/redux/superuserApi.js';
import { setFilter } from '../src/redux/superuserSlice.js';

function setup(t, superuserRequest) {
  const store = createSuperuserStore({ superuserRequest });
  t.after(() => store.dispatch(api.util.resetApiState()));
  return store;
}
async function settle(store) {
  await Promise.all(store.dispatch(api.util.getRunningQueriesThunk()));
}

test('superuser reports and user management share one in-flight user list', async (t) => {
  let complete;
  let calls = 0;
  const store = setup(t, () => { calls += 1; return new Promise((resolve) => { complete = resolve; }); });
  const reports = store.dispatch(api.endpoints.getUsers.initiate());
  const users = store.dispatch(api.endpoints.getUsers.initiate());
  complete([{ id: 'u1', name: 'User' }]);
  assert.deepEqual(await reports.unwrap(), await users.unwrap());
  assert.equal(calls, 1);
});

for (const [name, argument, url, body, subscriptions] of [
  ['reviewApproval', { id: 'u1', decision: 'approve' }, '/users/u1/approval', { decision: 'approve' }, ['getApprovals', 'getUsers', 'getDrivers', 'getDashboard', 'getNotifications']],
  ['blockDelivery', { id: 'd1', reason: 'Address needs review' }, '/deliveries/d1/block', { reason: 'Address needs review' }, ['getDeliveries', 'getTrips', 'getDashboard']],
  ['createMaintenance', { vehicle: 'PLATE1', issue: 'Engine Oil Change' }, '/maintenance', { vehicle: 'PLATE1', issue: 'Engine Oil Change' }, ['getMaintenance', 'getVehicles', 'getDashboard']],
  ['reviewPayment', { id: 'p1', status: 'Approved' }, '/transactions/payments/p1/status', { status: 'Approved' }, ['getPayments', 'getInvoices', 'getRevenue', 'getPayouts', 'getSettlements', 'getDashboard']],
  ['markPayoutPaid', 'p1', '/payouts/driver/p1/paid', undefined, ['getPayouts', 'getRevenue', 'getSettlements']],
  ['lockSettlement', { fleetManagerId: 'fm1', month: '2026-11' }, '/payouts/fleet-manager/settlement/lock', { fleetManagerId: 'fm1', month: '2026-11' }, ['getSettlements', 'getNotifications']],
]) {
  test(`${name} sends the existing API payload and refreshes dependent screens`, async (t) => {
    const gets = new Map();
    let mutation;
    const store = setup(t, async (method, path, payload) => {
      if (method !== 'GET') { mutation = { path, payload }; return { id: 'changed' }; }
      gets.set(path, (gets.get(path) || 0) + 1);
      return [];
    });
    await Promise.all(subscriptions.map((endpoint) => store.dispatch(api.endpoints[endpoint].initiate())));
    await store.dispatch(api.endpoints.getSecurity.initiate());
    await store.dispatch(api.endpoints[name].initiate(argument)).unwrap();
    await settle(store);
    assert.deepEqual(mutation, { path: url, payload: body });
    for (const [path, count] of gets) assert.equal(count, path === '/settings/security' ? 1 : 2, path);
  });
}

test('failed destructive operations preserve cached records and surface backend errors', async (t) => {
  let gets = 0;
  const store = setup(t, async (method) => {
    if (method === 'DELETE') throw new Error('Cannot delete a vehicle with an active trip.');
    gets += 1;
    return [{ id: 'v1', status: 'On Trip' }];
  });
  await store.dispatch(api.endpoints.getVehicles.initiate());
  await assert.rejects(store.dispatch(api.endpoints.deleteVehicle.initiate('v1')).unwrap(),
    { message: 'Cannot delete a vehicle with an active trip.' });
  await settle(store);
  assert.equal(gets, 1);
  assert.equal(api.endpoints.getVehicles.select()(store.getState()).data[0].status, 'On Trip');
});

test('permissions normalize both response formats and update only the selected role', async (t) => {
  const calls = [];
  let enabled = false;
  const store = setup(t, async (method, url, body) => {
    calls.push({ method, url, body });
    if (method === 'PUT') { enabled = body.permissions[0][2]; return body; }
    return url.endsWith('/driver') ? [['Trips', 'View trips', enabled]]
      : { permissions: [{ name: 'Invoices', description: 'View invoices', enabled: true }] };
  });
  await store.dispatch(api.endpoints.getPermissions.initiate('driver'));
  await store.dispatch(api.endpoints.getPermissions.initiate('business-client'));
  assert.deepEqual(api.endpoints.getPermissions.select('driver')(store.getState()).data,
    [{ name: 'Trips', description: 'View trips', enabled: false }]);
  await store.dispatch(api.endpoints.updatePermissions.initiate({ role: 'driver', permissions: [['Trips', 'View trips', true]] })).unwrap();
  await settle(store);
  assert.equal(api.endpoints.getPermissions.select('driver')(store.getState()).data[0].enabled, true);
  assert.equal(calls.filter((call) => call.url.endsWith('business-client')).length, 1);
  assert.deepEqual(calls.find((call) => call.method === 'PUT').body, { permissions: [['Trips', 'View trips', true]] });
});

test('configuration saves refresh saved settings without touching unrelated permissions', async (t) => {
  const data = {
    '/settings/security': { passwordLength: 8 },
    '/settings/economics': { commissionRate: 10, minimumFleetMarginPercent: 15 },
    '/payouts/rate-card/platform': { baseFare: 50 },
  };
  const store = setup(t, async (method, url, body) => {
    if (method === 'PUT') data[url] = body;
    return structuredClone(data[url]);
  });
  await Promise.all(['getSecurity', 'getEconomics', 'getRateCard'].map((name) => store.dispatch(api.endpoints[name].initiate())));
  await store.dispatch(api.endpoints.updateSecurity.initiate({ passwordLength: 12 })).unwrap();
  await store.dispatch(api.endpoints.updateEconomics.initiate({ commissionRate: 20, minimumFleetMarginPercent: 15 })).unwrap();
  await store.dispatch(api.endpoints.updateRateCard.initiate({ baseFare: 75 })).unwrap();
  await settle(store);
  assert.equal(api.endpoints.getSecurity.select()(store.getState()).data.passwordLength, 12);
  assert.equal(api.endpoints.getEconomics.select()(store.getState()).data.commissionRate, 20);
  assert.equal(api.endpoints.getRateCard.select()(store.getState()).data.baseFare, 75);
});

test('notification changes share the badge cache and live sync only fetches active resources', async (t) => {
  let read = false;
  const calls = [];
  const store = setup(t, async (method, url) => {
    calls.push(url);
    if (method === 'PATCH') read = true;
    return [{ id: 'n1', read }];
  });
  await store.dispatch(api.endpoints.getNotifications.initiate());
  await store.dispatch(api.endpoints.markAllNotificationsRead.initiate()).unwrap();
  await settle(store);
  assert.equal(api.endpoints.getNotifications.select()(store.getState()).data[0].read, true);
  store.dispatch(api.util.invalidateTags(SUPERUSER_DATA_TAGS));
  await settle(store);
  assert.deepEqual(calls, ['/notifications', '/notifications/mark-read', '/notifications', '/notifications']);
});

test('filters survive page navigation, reset pagination, and remain isolated by session and portal', async (t) => {
  const first = setup(t, async () => [{ id: 'private-user' }]);
  first.dispatch(setFilter({ page: 'users', field: 'page', value: 5 }));
  first.dispatch(setFilter({ page: 'users', field: 'search', value: 'private-user' }));
  await first.dispatch(api.endpoints.getUsers.initiate());
  assert.equal(first.getState().superuser.users.page, 1);
  assert.equal(first.getState().superuser.users.search, 'private-user');
  const next = setup(t, async () => []);
  assert.equal(next.getState().superuser.users.search, '');
  assert.equal(api.endpoints.getUsers.select()(next.getState()).data, undefined);
  assert.equal(createDriverStore().getState().superuserApi, undefined);
  assert.equal(createBusinessClientStore().getState().superuserApi, undefined);
});
