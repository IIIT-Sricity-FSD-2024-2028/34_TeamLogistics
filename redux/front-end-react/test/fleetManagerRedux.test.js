import test from 'node:test';
import assert from 'node:assert/strict';
import { createFleetManagerStore, createDriverStore, createSuperuserStore } from '../src/redux/store.js';
import { fleetManagerApi as api, FLEET_MANAGER_DATA_TAGS } from '../src/redux/fleetManagerApi.js';
import { setFilter } from '../src/redux/fleetManagerSlice.js';

function setup(t, fleetManagerRequest) {
  const store = createFleetManagerStore({ fleetManagerRequest });
  t.after(() => store.dispatch(api.util.resetApiState()));
  return store;
}

async function settle(store) {
  await Promise.all(store.dispatch(api.util.getRunningQueriesThunk()));
}

test('fleet dashboard and management pages share operational requests', async (t) => {
  let resolve;
  let calls = 0;
  const store = setup(t, () => { calls += 1; return new Promise((done) => { resolve = done; }); });
  const dashboard = store.dispatch(api.endpoints.getVehicles.initiate());
  const management = store.dispatch(api.endpoints.getVehicles.initiate());
  resolve([{ id: 'v1', plate: 'KA01AA0001' }]);
  assert.deepEqual(await dashboard.unwrap(), await management.unwrap());
  assert.equal(calls, 1);
});

for (const [name, argument, expected, subscriptions] of [
  ['updateDriver', { id: 'd1', changes: { status: 'Suspended' } }, ['PUT', '/drivers/d1', { status: 'Suspended' }], ['getDrivers', 'getVehicles', 'getTrips', 'getDocuments', 'getDashboard']],
  ['updateVehicle', { id: 'v1', changes: { status: 'Maintenance' } }, ['PUT', '/vehicles/v1', { status: 'Maintenance' }], ['getVehicles', 'getMaintenance', 'getDashboard']],
  ['reassignTrip', { id: 't1', driver: 'Driver Two' }, ['PATCH', '/trips/t1/reassign', { driver: 'Driver Two' }], ['getTrips', 'getDrivers', 'getVehicles', 'getAnalytics']],
  ['createMaintenance', { vehicle: 'KA01AA0001', issue: 'Brakes' }, ['POST', '/maintenance', { vehicle: 'KA01AA0001', issue: 'Brakes' }], ['getMaintenance', 'getVehicles', 'getAnalytics']],
  ['markPayoutPaid', 'p1', ['PATCH', '/payouts/driver/p1/paid', undefined], ['getDriverPayouts', 'getStatement', 'getPayments', 'getInvoices']],
]) {
  test(`${name} preserves the API contract and refreshes dependent fleet data`, async (t) => {
    const gets = new Map();
    let mutation;
    const store = setup(t, async (method, url, body) => {
      if (method !== 'GET') { mutation = [method, url, body]; return { id: 'changed' }; }
      gets.set(url, (gets.get(url) || 0) + 1);
      return [];
    });
    await Promise.all(subscriptions.map((endpoint) => store.dispatch(api.endpoints[endpoint].initiate(endpoint === 'getStatement' ? '2026-11' : undefined))));
    await store.dispatch(api.endpoints[name].initiate(argument)).unwrap();
    await settle(store);
    assert.deepEqual(mutation, expected);
    for (const count of gets.values()) assert.equal(count, 2);
  });
}

test('failed destructive changes preserve cached fleet data and expose backend errors', async (t) => {
  let gets = 0;
  const store = setup(t, async (method) => {
    if (method === 'DELETE') throw new Error('Vehicle has an active trip.');
    gets += 1;
    return [{ id: 'v1', status: 'On Trip' }];
  });
  await store.dispatch(api.endpoints.getVehicles.initiate());
  await assert.rejects(store.dispatch(api.endpoints.deleteVehicle.initiate('v1')).unwrap(), { message: 'Vehicle has an active trip.' });
  await settle(store);
  assert.equal(gets, 1);
  assert.equal(api.endpoints.getVehicles.select()(store.getState()).data[0].status, 'On Trip');
});

test('rate cards and notifications refresh their shared subscribers', async (t) => {
  const calls = [];
  let rate = 10;
  let read = false;
  const store = setup(t, async (method, url, body) => {
    calls.push([method, url]);
    if (url === '/payouts/rate-card/mine') {
      if (method === 'PUT') rate = body.perKm;
      return { effective: { perKm: rate } };
    }
    if (method === 'PATCH') read = true;
    return [{ id: 'n1', read }];
  });
  await Promise.all([
    store.dispatch(api.endpoints.getRateCard.initiate()),
    store.dispatch(api.endpoints.getNotifications.initiate()),
  ]);
  await store.dispatch(api.endpoints.updateRateCard.initiate({ perKm: 12 })).unwrap();
  await store.dispatch(api.endpoints.markAllNotificationsRead.initiate()).unwrap();
  await settle(store);
  assert.equal(api.endpoints.getRateCard.select()(store.getState()).data.effective.perKm, 12);
  assert.equal(api.endpoints.getNotifications.select()(store.getState()).data[0].read, true);
  store.dispatch(api.util.invalidateTags(FLEET_MANAGER_DATA_TAGS));
  await settle(store);
  assert.ok(calls.filter(([, url]) => url === '/notifications').length >= 3);
});

test('fleet filters persist within one session and stores remain isolated', async (t) => {
  const first = setup(t, async () => []);
  first.dispatch(setFilter({ page: 'documents', field: 'page', value: 4 }));
  first.dispatch(setFilter({ page: 'documents', field: 'search', value: 'insurance' }));
  assert.equal(first.getState().fleetManager.documents.page, 1);
  assert.equal(first.getState().fleetManager.documents.search, 'insurance');
  const next = setup(t, async () => []);
  assert.equal(next.getState().fleetManager.documents.search, '');
  assert.equal(createDriverStore().getState().fleetManagerApi, undefined);
  assert.equal(createSuperuserStore().getState().fleetManagerApi, undefined);
});
