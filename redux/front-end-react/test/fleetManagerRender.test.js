import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

test('fleet manager pages render shared Redux data and missing route records safely', async (t) => {
  const vite = await createServer({ configFile: false, plugins: [react()], appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, watch: null, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { createFleetManagerStore } = await vite.ssrLoadModule('/src/redux/store.js');
  const { fleetManagerApi: api } = await vite.ssrLoadModule('/src/redux/fleetManagerApi.js');
  const { SessionProvider } = await vite.ssrLoadModule('/src/auth/SessionContext.jsx');
  const { ToastProvider } = await vite.ssrLoadModule('/src/hooks/useToast.jsx');
  const { PageHeaderProvider } = await vite.ssrLoadModule('/src/hooks/usePageHeader.jsx');
  const previousStorage = globalThis.sessionStorage;
  globalThis.sessionStorage = { getItem: () => JSON.stringify({ userId: 'fm1', name: 'Fleet Manager', role: 'fleet-manager' }) };
  t.after(() => { globalThis.sessionStorage = previousStorage; });

  const vehicle = { id: 'v1', plate: 'KA01AA0001', type: 'Truck', status: 'Active', assignedDriver: 'Driver One' };
  const driver = { id: 'd1', name: 'Driver One', email: 'driver@example.test', phone: '9876543210', status: 'Available', vehicle: vehicle.plate, license: 'KA0120260001', licenseExpiry: '2099-12-31' };
  const trip = { id: 't1', request: 'del1', driver: driver.name, vehicle: vehicle.plate, pickup: 'Origin', destination: 'Destination', status: 'In Transit' };
  const maintenance = { id: 'm1', vehicle: vehicle.plate, issue: 'Engine Oil Change', date: '2099-12-31', mechanicId: 'mech1', mechanic: 'Workshop', status: 'Scheduled' };
  const document = { id: 'doc1', ownerType: 'vehicle', vehicle: vehicle.plate, documentType: 'Insurance', status: 'Approved', expiryDate: '2099-12-31' };
  const user = { id: 'fm1', name: 'Fleet Manager', email: 'fleet@example.test', role: 'fleet-manager', status: 'Active', profileDetails: {} };
  const responses = {
    '/dashboard/fleet-manager': {},
    '/dashboard/fleet-manager/analytics': { vehicleActiveRatioPercent: 100, tripCompletionRatioPercent: 0, completedTrips: 0, maintenanceCost: 0 },
    '/vehicles': [vehicle], '/vehicles/v1': vehicle,
    '/drivers': [driver], '/drivers/d1': driver, '/users?role=driver': [driver], '/users/fm1': user,
    '/trips': [trip], '/trips/t1': trip,
    '/deliveries/del1': { id: 'del1', pickup: 'Origin', dropoff: 'Destination' },
    '/maintenance': [maintenance], '/maintenance/m1': maintenance,
    '/mechanics?active=true': [{ id: 'mech1', name: 'Workshop', active: true }],
    '/documents': [document], '/documents/doc1': document,
    '/transactions/invoices': [{ id: 'i1', client: 'Client', status: 'Unpaid', total: 100 }],
    '/transactions/payments': [], '/payouts/driver': [],
    '/payouts/fleet-manager/statement?month=2026-11': { netIncome: 100, tripRevenue: 100, platformCommission: 0, driverPayoutsTotal: 0, maintenanceCosts: 0, pendingDriverEarnings: 0, completedTrips: 0 },
    '/payouts/rate-card/mine': { effective: { baseFare: 10, perKm: 10, perKg: 1, customerBaseFare: 20, customerPerKm: 20, customerPerKg: 2 }, platformFloor: {}, economics: { minimumFleetMarginPercent: 10, commissionRate: 10 } },
    '/settings/platform': { name: 'Granthik', language: 'English', timezone: 'Asia/Kolkata' },
    '/settings/permissions/fleet-manager': [['Reports Access', 'View reports', true]],
    '/notifications?page=1&limit=8&search=&filter=all': { items: [{ id: 'n1', title: 'Update', message: 'Fleet update', read: false }], currentPage: 1, totalPages: 1, totalItems: 1, pageSize: 8, counts: { total: 1, unread: 1, attention: 0 } },
  };
  responses['/drivers?page=1&limit=8'] = {items:responses['/drivers'],totalItems:responses['/drivers'].length};
  responses['/vehicles?page=1&limit=8'] = {items:responses['/vehicles'],totalItems:responses['/vehicles'].length};
  responses['/trips?page=1&limit=8'] = {items: responses['/trips'], totalItems: responses['/trips'].length};
  const store = createFleetManagerStore({ fleetManagerRequest: async (_method, url) => {
    if (!(url in responses)) throw new Error(`Missing mocked response: ${url}`);
    return structuredClone(responses[url]);
  } });
  t.after(() => store.dispatch(api.util.resetApiState()));
  await Promise.all([
    store.dispatch(api.endpoints.getDrivers.initiate({page:1,limit:8})),
    store.dispatch(api.endpoints.getVehicles.initiate({page:1,limit:8})),
    store.dispatch(api.endpoints.getTrips.initiate({page: 1, limit: 8})),
    store.dispatch(api.endpoints.getNotifications.initiate({ page: 1, limit: 8, search: '', filter: 'all' })),
    ...['getDashboard', 'getAnalytics', 'getVehicles', 'getDrivers', 'getDriverUsers', 'getTrips', 'getMaintenance', 'getMechanics', 'getDocuments', 'getInvoices', 'getPayments', 'getDriverPayouts', 'getRateCard', 'getPlatform', 'getPermissions']
      .map((name) => store.dispatch(api.endpoints[name].initiate())),
    ...[['getUser', 'fm1'], ['getDriver', 'd1'], ['getDriver', 'missing'], ['getVehicle', 'v1'], ['getTrip', 't1'], ['getMaintenanceRecord', 'm1'], ['getMaintenanceRecord', 'missing'], ['getDocument', 'doc1'], ['getDelivery', 'del1'], ['getStatement', '2026-11']]
      .map(([name, argument]) => store.dispatch(api.endpoints[name].initiate(argument))),
  ]);

  function wrap(Component, url) {
    return renderToString(h(Provider, { store }, h(SessionProvider, null, h(ToastProvider, null,
      h(PageHeaderProvider, null, h(MemoryRouter, { initialEntries: [url] }, h(Component)))))));
  }
  const pages = [
    ['FmDashboard', '/fleet-manager/dashboard'], ['FmVehicles', '/fleet-manager/vehicles'],
    ['FmAddVehicle', '/fleet-manager/add-vehicle'], ['FmEditVehicle', '/fleet-manager/edit-vehicle?id=v1'],
    ['FmDrivers', '/fleet-manager/drivers'], ['FmAddDriver', '/fleet-manager/add-driver'],
    ['FmEditDriver', '/fleet-manager/edit-driver?id=d1'], ['FmDriverProfile', '/fleet-manager/driver-profile?id=d1'],
    ['FmCompliance', '/fleet-manager/compliance'], ['FmTrips', '/fleet-manager/trips'],
    ['FmLiveTracking', '/fleet-manager/live-tracking?id=t1'], ['FmMaintenance', '/fleet-manager/maintenance'],
    ['FmScheduleMaintenance', '/fleet-manager/schedule-maintenance?id=missing'], ['FmDocuments', '/fleet-manager/documents'],
    ['FmUploadDocument', '/fleet-manager/upload-document?id=doc1'], ['FmDocumentRelated', '/fleet-manager/document-related?id=doc1'],
    ['FmAnalytics', '/fleet-manager/analytics'], ['FmTransactions', '/fleet-manager/transactions'],
    ['FmSettings', '/fleet-manager/settings'], ['FmProfile', '/fleet-manager/profile'], ['FmNotifications', '/fleet-manager/notifications'],
  ];
  for (const [name, url] of pages) {
    const module = await vite.ssrLoadModule(`/src/pages/fleet-manager/${name}.jsx`);
    const html = wrap(module.default, url);
    assert.ok(html.length > 50, name);
  }
});
