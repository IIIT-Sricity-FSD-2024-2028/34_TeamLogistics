import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDriverLicenseExpiry,
  getDriverLicenseStatus,
  getDriverOverallCompliance,
} from '../src/utils/driverCompliance.js';

const driver = { id: 'DR-101', name: 'Asha Rao', status: 'Available' };
const documents = [
  { ownerType: 'driver', driver: 'Asha Rao', documentType: 'Driver License', expiryDate: '2027-08-01' },
  { ownerType: 'driver', driver: 'Asha Rao', documentType: 'Driver License', expiryDate: '2026-01-01' },
];

test('compliance uses the latest uploaded driver-license expiry date', () => {
  assert.equal(getDriverLicenseExpiry(driver, documents), '2027-08-01');
  assert.equal(getDriverLicenseStatus(driver, documents, new Date('2026-10-14T00:00:00')), 'Valid');
  assert.equal(getDriverOverallCompliance(driver, documents, new Date('2026-10-14T00:00:00')), 'Compliant');
});

test('missing, expired, and suspended licenses result in Not Compliant', () => {
  assert.equal(getDriverOverallCompliance(driver, [], new Date('2026-10-14T00:00:00')), 'Not Compliant');
  assert.equal(
    getDriverOverallCompliance(driver, [{ ...documents[0], expiryDate: '2026-10-13' }], new Date('2026-10-14T00:00:00')),
    'Not Compliant',
  );
  assert.equal(
    getDriverOverallCompliance({ ...driver, status: 'Suspended' }, documents, new Date('2026-10-14T00:00:00')),
    'Not Compliant',
  );
});
