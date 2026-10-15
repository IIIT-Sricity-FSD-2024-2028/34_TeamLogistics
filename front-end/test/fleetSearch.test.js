import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesFilter, matchesSearchFields, uniqueFilterOptions } from '../src/utils/search.js';
import { canonicalTripStatus, fleetPortalDrivers, isRefundedFinancialRecord, payoutPaymentStatus } from '../src/pages/fleet-manager/fmUtils.js';

test('fleet finance removes full and partial refund records', () => {
  assert.equal(isRefundedFinancialRecord({ status: 'Refunded' }), true);
  assert.equal(isRefundedFinancialRecord({ paymentStatus: 'Partially Refunded' }), true);
  assert.equal(isRefundedFinancialRecord({ status: 'Paid', refundedAmount: 500 }), true);
  assert.equal(isRefundedFinancialRecord({ status: 'Paid', refundedAt: '2026-10-14T00:00:00Z' }), true);
  assert.equal(isRefundedFinancialRecord({ status: 'Paid' }), false);
});

test('fleet payout ledger shows outstanding earned payouts as Unpaid', () => {
  assert.equal(payoutPaymentStatus('Earned'), 'Unpaid');
  assert.equal(payoutPaymentStatus('Approved'), 'Approved');
  assert.equal(payoutPaymentStatus('Paid'), 'Paid');
});

test('fleet trips use Completed as the single terminal trip status', () => {
  assert.equal(canonicalTripStatus('Delivered'), 'Completed');
  assert.equal(canonicalTripStatus('Completed'), 'Completed');
  assert.equal(canonicalTripStatus('In Transit'), 'In Transit');
});

test('fleet driver list only includes backed accounts with supported statuses', () => {
  const drivers = [
    { id: 'DR-301', status: 'Available' },
    { id: 'DR-302', status: 'Document Review' },
    { id: 'DR-303', status: 'Active' },
    { id: 'DR-999', status: 'Available' },
  ];
  const users = [
    { id: 'DR-301', role: 'driver', status: 'Active' },
    { id: 'DR-302', role: 'driver', status: 'Document Review' },
    { id: 'DR-303', role: 'driver', status: 'Available' },
    { id: 'DR-999', role: 'business-client', status: 'Available' },
  ];

  assert.deepEqual(fleetPortalDrivers(drivers, users), [{ id: 'DR-301', status: 'Available' }]);
});

test('driver search only matches the displayed driver identity fields', () => {
  const arjun = { id: 'DR-308', name: 'Arjun Verma', license: 'KA61201900056712' };
  const kiran = { id: 'DR-302', name: 'Kiran Teja', license: 'AP07202100012478' };

  assert.equal(matchesSearchFields('k', [arjun.name, arjun.id]), false);
  assert.equal(matchesSearchFields('k', [kiran.name, kiran.id]), true);
});

test('fleet searches support multiple terms across visible columns', () => {
  assert.equal(matchesSearchFields('truck active', ['VH-1013', 'TN09AB1056', 'Truck', 'Active']), true);
  assert.equal(matchesSearchFields('truck maintenance', ['VH-1013', 'TN09AB1056', 'Truck', 'Active']), false);
  assert.equal(matchesSearchFields('   ', ['Any visible value']), true);
});

test('super user searches ignore unrelated hidden record values', () => {
  const user = { id: 'USR-104', name: 'Arjun Verma', email: 'arjun@example.com', license: 'KA61201900056712' };
  const visibleFields = [user.name, user.email, 'Driver'];

  assert.equal(matchesSearchFields('k', visibleFields), false);
  assert.equal(matchesSearchFields('arjun driver', visibleFields), true);
});

test('driver searches only match the ID, customer, and route shown to the driver', () => {
  const visibleFields = ['TRIP-104', 'DEL-204', 'Acme Foods', 'Majestic', 'Whitefield'];

  assert.equal(matchesSearchFields('white acme', visibleFields), true);
  assert.equal(matchesSearchFields('secret-note', visibleFields), false);
});

test('business client searches do not match hidden delivery metadata', () => {
  const visibleFields = ['DEL-204', 'Kiran Teja', 'Majestic', 'Whitefield', 'Delivered'];

  assert.equal(matchesSearchFields('k delivered', visibleFields), true);
  assert.equal(matchesSearchFields('internal-priority-code', visibleFields), false);
});

test('dropdown filters use exact values and expose unique sorted options', () => {
  assert.equal(matchesFilter('Active', 'active'), true);
  assert.equal(matchesFilter('Inactive', 'active'), false);
  assert.equal(matchesFilter('Inactive', ''), true);

  const options = uniqueFilterOptions(
    [{ status: 'Pending' }, { status: 'active' }, { status: 'Active' }, { status: '' }],
    (item) => item.status,
  );
  assert.deepEqual(options, ['active', 'Pending']);
});
