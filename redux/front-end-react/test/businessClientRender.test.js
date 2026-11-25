import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

test('business client pages render from Redux and handle missing URL records', async (t) => {
  const vite = await createServer({
    configFile: false, plugins: [react()], appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
  });
  t.after(() => vite.close());
  const { createBusinessClientStore } = await vite.ssrLoadModule('/src/redux/store.js');
  const { businessClientApi: api } = await vite.ssrLoadModule('/src/redux/businessClientApi.js');
  const { SessionProvider } = await vite.ssrLoadModule('/src/auth/SessionContext.jsx');
  const session = { userId: 'u1', role: 'business-client', name: 'Client', token: 'test-token' };
  const previousStorage = globalThis.sessionStorage;
  globalThis.sessionStorage = { getItem: () => JSON.stringify(session) };
  t.after(() => { globalThis.sessionStorage = previousStorage; });
  const delivery = { id: 'd1', customer: 'Example Company', status: 'Delivered', pickup: 'Origin', dropoff: 'Destination', packageType: 'Box' };
  const responses = {
    '/users/u1': { id: 'u1', name: 'Client', companyName: 'Example Company', role: 'business-client' },
    '/deliveries': [delivery], '/deliveries/d1': delivery,
    '/trips': [{ id: 't1', request: 'd1', driver: 'Driver One', status: 'Completed' }],
    '/drivers': [], '/vehicles': [], '/transactions/payments': [],
    '/transactions/invoices': [{ id: 'i1', deliveryId: 'd1', client: 'Example Company', status: 'Unpaid', totalAmount: 200 }],
    '/notifications?page=1&limit=8&search=&filter=all': { items: [{ id: 'n1', title: 'Delivery update', message: 'Completed', read: false }], currentPage: 1, totalPages: 1, totalItems: 1, pageSize: 8, counts: { total: 1, unread: 1, attention: 0 } },
  };
  responses['/deliveries/d1/tracking'] = {delivery, trip:responses['/trips'][0]};
  responses['/dashboard/business-client'] = {totalDeliveries:1,counts:{deliveredPaid:1}};
  responses['/deliveries?page=1&limit=8&view=completed'] = {items:responses['/deliveries'],totalItems:1};
  for (const path of ['/transactions/invoices','/transactions/payments']) {
    responses[path+'?page=1&limit=8'] = {items:responses[path],totalItems:responses[path].length};
  }
  const store = createBusinessClientStore({ businessClientRequest: async (_method, url) => {
    if (!(url in responses)) throw new Error('Not found');
    return structuredClone(responses[url]);
  } });
  t.after(() => store.dispatch(api.util.resetApiState()));
  await Promise.all([
    store.dispatch(api.endpoints.getTracking.initiate('d1')),
    store.dispatch(api.endpoints.getTracking.initiate('missing')),
    store.dispatch(api.endpoints.getBusinessDashboard.initiate()),
    store.dispatch(api.endpoints.getDeliveries.initiate({page:1,limit:8,view:'completed'})),
    ...['getInvoices','getPayments'].map(name => store.dispatch(api.endpoints[name].initiate({page:1,limit:8}))),
    store.dispatch(api.endpoints.getNotifications.initiate({ page: 1, limit: 8, search: '', filter: 'all' })),
    ...['getDeliveries', 'getTrips', 'getDrivers', 'getVehicles', 'getInvoices', 'getPayments']
      .map((name) => store.dispatch(api.endpoints[name].initiate())),
    store.dispatch(api.endpoints.getCurrentUser.initiate('u1')),
    store.dispatch(api.endpoints.getDelivery.initiate('d1')),
    store.dispatch(api.endpoints.getDelivery.initiate('missing')),
  ]);
  async function render(page, url = '/business-client/dashboard') {
    const { default: Component } = await vite.ssrLoadModule(`/src/pages/business-client/${page}.jsx`);
    return renderToString(h(Provider, { store }, h(SessionProvider, null,
      h(MemoryRouter, { initialEntries: [url] }, h(Component)))));
  }
  for (const [page, url, expected] of [
    ['BcDashboard', undefined, 'Delivered &amp; Paid'],
    ['BcActiveDeliveries', undefined, 'Active Deliveries'],
    ['BcCompletedDeliveries', undefined, 'd1'],
    ['BcInvoices', undefined, 'i1'],
    ['BcCreateDelivery', undefined, 'Delivery Type'],
    ['BcProfile', undefined, 'Profile Settings'],
    ['BcSubmitTransaction', '/business-client/submit-transaction?invoiceId=i1', 'i1'],
    ['BcCancelOrder', '/business-client/cancel-order?id=d1', 'can no longer be cancelled'],
    ['BcFeedback', '/business-client/feedback?id=d1', 'Driver One'],
    ['BcLiveTracking', '/business-client/live-tracking?id=d1', 'Driver One'],
    ['BcNotifications', undefined, 'Delivery update'],
  ]) {
    assert.ok((await render(page, url)).includes(expected), page);
  }
  const invoice = await render('BcInvoiceView', '/business-client/invoice-view?id=i1');
  assert.match(invoice, /i1/);
  assert.match(invoice, /submit-transaction\?invoiceId=i1/);
  const missingInvoice = await render('BcInvoiceView', '/business-client/invoice-view?id=missing');
  assert.doesNotMatch(missingInvoice, /Example Company/);
  const missingTracking = await render('BcLiveTracking', '/business-client/live-tracking?id=missing');
  assert.match(missingTracking, /Could not load tracking data/);
  assert.doesNotMatch(missingTracking, /Driver One/);
  await store.dispatch(api.util.upsertQueryData('getTracking', 'd1', {delivery,trip:{
    id: 't1', request: 'd1', status: 'Returned', statusHistory: [
      { status: 'Attempt Failed', reason: 'Recipient unavailable', source: 'driver' },
      { status: 'Returning', source: 'fleet-manager' },
      { status: 'Returned', source: 'driver' },
    ],
  }}));
  const returned = await render('BcLiveTracking', '/business-client/live-tracking?id=d1');
  assert.match(returned, /Recipient unavailable/);
  assert.match(returned, /Returned/);
  assert.doesNotMatch(returned, /Generate OTP/);
});
