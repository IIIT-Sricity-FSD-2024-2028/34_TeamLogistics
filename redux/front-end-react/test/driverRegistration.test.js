import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDriverRegistration } from '../src/utils/driverRegistration.js';

const validRegistration = {
  name: 'Asha Rao',
  phone: '9876543210',
  license: 'KA-01-2024-1234567',
  licenseExpiry: '2099-08-01',
  licenseDoc: { name: 'license.png', type: 'image/png' },
  accountHolder: 'Asha Rao',
  accountNumber: '123456789012',
  ifsc: 'HDFC0001234',
  bankName: 'HDFC Bank',
  bankBook: { name: 'bank-book.png', type: 'image/png' },
  email: 'asha.rao@example.com',
  password: 'Driver@123',
  confirmPassword: 'Driver@123',
  terms: true,
};

test('driver registration validation accepts a complete valid driver form', () => {
  assert.deepEqual(validateDriverRegistration(validRegistration), {});
});

test('driver registration validation applies every public registration rule', () => {
  const errors = validateDriverRegistration({
    ...validRegistration,
    name: 'Asha 123',
    phone: '123',
    license: 'INVALID',
    licenseExpiry: '2020-01-01',
    licenseDoc: { name: 'license.pdf', type: 'application/pdf' },
    accountHolder: '123',
    accountNumber: '1234',
    ifsc: 'BAD',
    bankName: '123',
    bankBook: null,
    email: 'invalid',
    password: 'weak',
    confirmPassword: 'different',
    terms: false,
  });

  assert.deepEqual(Object.keys(errors).sort(), [
    'accountHolder',
    'accountNumber',
    'bankBook',
    'bankName',
    'confirmPassword',
    'email',
    'ifsc',
    'license',
    'licenseDoc',
    'licenseExpiry',
    'name',
    'password',
    'phone',
    'terms',
  ]);
});
