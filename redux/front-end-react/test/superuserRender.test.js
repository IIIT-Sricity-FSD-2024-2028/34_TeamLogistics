import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

test('superuser pages render Redux data, missing records, errors and role-specific permissions', async (t) => {
  const vite = await createServer({ configFile: false, plugins: [react()], appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, watch: null, hmr: false, ws: false } });
  t.after(() => vite.close());
  const { createSuperuserStore } = await vite.ssrLoadModule('/src/redux/store.js');
  const { superuserApi: api } = await vite.ssrLoadModule('/src/redux/superuserApi.js');
  const { SessionProvider } = await vite.ssrLoadModule('/src/auth/SessionContext.jsx');
  const { ToastProvider } = await vite.ssrLoadModule('/src/hooks/useToast.jsx');
  const { PageHeaderProvider } = await vite.ssrLoadModule('/src/hooks/usePageHeader.jsx');
  const previousStorage = globalThis.sessionStorage;
  globalThis.sessionStorage = { getItem: () => JSON.stringify({ userId: 'su1', name: 'Admin User', role: 'superuser' }) };
  t.after(() => { globalThis.sessionStorage = previousStorage; });
  const user = { id: 'su1', name: 'Admin User', email: 'admin@example.test', role: 'superuser', status: 'Active' };
  const vehicle = { id: 'v1', plate: 'PLATE1', status: 'Active', type: 'Truck' };
  const responses = {
    '/dashboard/superuser': { totalUsers: 2, fleetManagers: 1, businessClients: 0, drivers: 0, activeDeliveries: 1, systemAlerts: 0,
      fleetStatus: { available: 1, inTransit: 0, maintenance: 0, offline: 0 }, deliveryPerformance: [1], deliveryPerformanceLabels: ['Today'], revenueTrends: [0], revenueTrendsLabels: ['Today'] },
    '/users': [user, { id: 'fm1', name: 'Fleet Manager', role: 'fleet-manager', status: 'Active' }], '/users/su1': user,
    '/users/approvals/pending': [{ id: 'pending1', name: 'Pending Applicant', role: 'driver', status: 'Pending' }],
    '/vehicles': [vehicle], '/vehicles/v1': vehicle, '/drivers': [],
    '/deliveries': [{ id: 'd1', customer: 'Client', status: 'Requested' }],
    '/deliveries/d1': { id: 'd1', customer: 'Client', pickup: 'Origin', dropoff: 'Destination' },
    '/trips': [{ id: 't1', request: 'd1', driver: 'Driver One', status: 'Assigned' }],
    '/maintenance': [{ id: 'm1', vehicle: 'OTHER', issue: 'Engine Oil Change', status: 'Scheduled' }],
    '/maintenance/m1': { id: 'm1', vehicle: 'OTHER', issue: 'Engine Oil Change', status: 'Scheduled' },
    '/documents': [{ id: 'doc1', ownerType: 'vehicle', vehicle: 'PLATE1', documentType: 'Insurance', status: 'Approved' }],
    '/transactions/invoices': [{ id: 'i1', client: 'Client', status: 'Unpaid', total: 200 }],
    '/transactions/payments': [{ id: 'p1', client: 'Client', invoiceId: 'i1', status: 'Pending', amount: 200 }],
    '/transactions/revenue-summary': {}, '/payouts/driver': [], '/payouts/fleet-manager/settlements': [],
    '/settings/security': { passwordLength: 12, failedAttempts: 4, sessionTimeout: 45 },
    '/settings/economics': { commissionRate: 10, minimumFleetMarginPercent: 15 },
    '/payouts/rate-card/platform': { baseFare: 50, perKm: 10, perKg: 5, customerBaseFare: 60, customerPerKm: 12, customerPerKg: 6 },
    '/settings/permissions/driver': [['Driver access', 'View assigned trips', true]],
    '/settings/permissions/business-client': [['Client access', 'View invoices', false]],
    '/notifications?page=1&limit=8&search=&filter=all': { items: [{ id: 'n1', title: 'Platform update', message: 'New activity', read: false }], currentPage: 1, totalPages: 1, totalItems: 1, pageSize: 8, counts: { total: 1, unread: 1, attention: 0 } },
  };
  responses['/vehicles?page=1&limit=8'] = {items:responses['/vehicles'],totalItems:responses['/vehicles'].length};
  responses['/trips?page=1&limit=8'] = {items: responses['/trips'], totalItems: responses['/trips'].length};
  responses['/deliveries?page=1&limit=8'] = {items: responses['/deliveries'], totalItems: responses['/deliveries'].length};
  const store = createSuperuserStore({ superuserRequest: async (_method, url) => {
    if (!(url in responses)) throw new Error('Record not found');
    return structuredClone(responses[url]);
  } });
  t.after(() => store.dispatch(api.util.resetApiState()));
  await Promise.all([
    store.dispatch(api.endpoints.getVehicles.initiate({page:1,limit:8})),
    store.dispatch(api.endpoints.getTrips.initiate({page: 1, limit: 8})),
    store.dispatch(api.endpoints.getDeliveries.initiate({page: 1, limit: 8})),
    store.dispatch(api.endpoints.getNotifications.initiate({ page: 1, limit: 8, search: '', filter: 'all' })),
    ...['getDashboard', 'getUsers', 'getApprovals', 'getDeliveries', 'getTrips', 'getVehicles', 'getDrivers', 'getMaintenance', 'getDocuments', 'getInvoices', 'getPayments', 'getRevenue', 'getPayouts', 'getSettlements', 'getSecurity', 'getEconomics', 'getRateCard']
      .map((name) => store.dispatch(api.endpoints[name].initiate())),
    ...[['getUser', 'su1'], ['getUser', 'missing'], ['getVehicle', 'v1'], ['getDelivery', 'd1'], ['getMaintenanceRecord', 'm1'], ['getMaintenanceRecord', 'missing'], ['getPermissions', 'driver'], ['getPermissions', 'business-client']]
      .map(([name, id]) => store.dispatch(api.endpoints[name].initiate(id))),
  ]);
  function wrap(Component, props, url = '/superuser/dashboard', targetStore = store) {
    return renderToString(h(Provider, { store: targetStore }, h(SessionProvider, null, h(ToastProvider, null,
      h(PageHeaderProvider, null, h(MemoryRouter, { initialEntries: [url] }, h(Component, props)))))));
  }
  async function render(page, props = {}, url, targetStore) {
    const { default: Component } = await vite.ssrLoadModule(`/src/pages/superuser/${page}.jsx`);
    return wrap(Component, props, url, targetStore);
  }
  for (const [page, expected] of [
    ['SuDashboard', 'Total Users'], ['SuReports', 'Report Summary'], ['SuManageUsers', 'Admin User'],
    ['SuApprovals', 'Pending Applicant'], ['SuDeliveryRequests', 'd1'], ['SuTripMonitoring', 't1'],
    ['SuVehicles', 'PLATE1'], ['SuMaintenance', 'm1'], ['SuDocuments', 'doc1'],
    ['SuTransactions', 'i1'], ['SuProfile', 'Admin User'], ['SuNotifications', 'Platform update'],
    ['SuUserForm', 'Create User'], ['SuScheduleMaintenance', 'PLATE1'], ['SuSystemConfiguration', 'value="12"'],
  ]) assert.ok((await render(page)).includes(expected), page);
  assert.match(await render('SuRoles', { roleKey: 'driver' }), /Driver access/);
  const clientRole = await render('SuRoles', { roleKey: 'business-client' });
  assert.match(clientRole, /Client access/);
  assert.doesNotMatch(clientRole, /Driver access/);
  assert.match(await render('SuScheduleMaintenance', {}, '/superuser/schedule-maintenance?id=missing'), /Record not found/);
  assert.doesNotMatch(await render('SuUserForm', { editMode: true }, '/superuser/edit-user?id=missing'), /Admin User/);
  const { default: DocumentDetails } = await vite.ssrLoadModule('/src/redux/SuperuserDocumentDetails.jsx');
  assert.match(wrap(DocumentDetails, { document: responses['/documents'][0], standalone: true }), /PLATE1/);
  assert.match(wrap(DocumentDetails, { document: { ownerType: 'delivery', delivery: 'd1' }, standalone: true }), /Driver One/);
  const failedStore = createSuperuserStore({ superuserRequest: async () => { throw new Error('Offline'); } });
  t.after(() => failedStore.dispatch(api.util.resetApiState()));
  await failedStore.dispatch(api.endpoints.getDashboard.initiate());
  assert.match(await render('SuDashboard', {}, undefined, failedStore), /Unable to load dashboard data/);
});
