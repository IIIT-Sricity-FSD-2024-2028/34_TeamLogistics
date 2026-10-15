import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFleetManagerProfile } from '../src/utils/fleetManagerProfile.js';

const validProfile = {
  email: 'manager@example.com',
  phone: '9876543210',
  company: 'Acme Logistics',
  address: '12 Business Avenue',
  numVehicles: '25',
};

test('fleet manager profile accepts valid non-name fields', () => {
  assert.deepEqual(validateFleetManagerProfile(validProfile), {});
});

test('fleet manager profile validates every non-name field', () => {
  const errors = validateFleetManagerProfile({
    email: 'invalid',
    phone: '5123456789',
    company: '1',
    address: 'short',
    numVehicles: '2.5',
  });

  assert.deepEqual(Object.keys(errors).sort(), ['address', 'company', 'email', 'numVehicles', 'phone']);
});

test('fleet manager phone must be exactly ten digits starting from 6 to 9', () => {
  for (const phone of ['6123456789', '7123456789', '8123456789', '9123456789']) {
    assert.equal(validateFleetManagerProfile({ ...validProfile, phone }).phone, undefined);
  }
  for (const phone of ['5123456789', '987654321', '98765432100', '98765A3210']) {
    assert.ok(validateFleetManagerProfile({ ...validProfile, phone }).phone);
  }
});
