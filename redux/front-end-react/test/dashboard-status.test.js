import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDeliveries } from '../src/pages/business-client/deliverySummary.js';
import { isPendingTrip, isInProgressTrip, isOpenTrip, isReportedIssue } from '../src/pages/driver/tripStatus.js';

test('driver pending count excludes every accepted and terminal status', () => {
  assert.equal(isPendingTrip('Assigned'), true);
  assert.equal(isPendingTrip(' Queued '), true);
  for (const status of ['Accepted', 'Picked Up', 'In Transit', 'Issue Reported', 'Completed', 'Delivered', 'Rejected', 'Cancelled', 'Blocked']) {
    assert.equal(isPendingTrip(status), false, status);
  }
  assert.equal(isInProgressTrip('Issue Reported'), false);
  assert.equal(isReportedIssue('Issue Reported'), true);
  assert.equal(isOpenTrip('Issue Reported'), false);
  assert.equal(isOpenTrip('Blocked'), false);
  assert.equal(isOpenTrip('Completed'), false);
});

test('delivery groups are disjoint and add up to the total', () => {
  const deliveries = [
    { id: 'active', status: 'In Transit' }, { id: 'paid', status: 'Delivered' },
    { id: 'unpaid', status: 'Delivered' }, { id: 'cancelled', status: 'Cancelled' },
    { id: 'rejected', status: 'Rejected' }, { id: 'no-invoice', status: 'Completed' },
    { id: 'voided', status: 'Delivered' },
  ];
  const invoices = [
    { deliveryId: 'paid', status: 'Paid' },
    { deliveryId: 'unpaid', status: 'Unpaid' },
    { deliveryId: 'unpaid', status: 'Pending' },
    { deliveryId: 'cancelled', status: 'Unpaid' },
    { deliveryId: 'voided', status: 'Voided' },
  ];
  const result = summarizeDeliveries(deliveries, invoices);
  assert.equal(result.total, 7);
  assert.equal(result.counts.deliveredPaid, 1);
  assert.equal(result.counts.deliveredPaymentPending, 2);
  assert.equal(result.counts.cancelled, 1);
  assert.equal(result.counts.other, 1);
  assert.equal(Object.values(result.counts).reduce((total, count) => total + count, 0), result.total);
  const assignedIds = Object.values(result.groups).flat().map((d) => d.id);
  assert.equal(new Set(assignedIds).size, assignedIds.length);
});

test('duplicate delivery rows and multiple invoices cannot inflate delivery counts', () => {
  const result = summarizeDeliveries(
    [{ id: 'one', status: 'Delivered' }, { id: 'one', status: 'Delivered' }],
    [{ deliveryId: 'one', status: 'Unpaid' }, { deliveryId: 'one', status: 'Unpaid' }],
  );
  assert.equal(result.total, 1);
  assert.equal(result.counts.deliveredPaymentPending, 1);
});
