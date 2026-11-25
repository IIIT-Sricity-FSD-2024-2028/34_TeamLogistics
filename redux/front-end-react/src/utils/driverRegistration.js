import { isFutureDate } from './dateConstraints.js';

export const DRIVER_EMAIL_REGEX =
  /^(?=.{1,64}@)(?=.{6,320}$)(?!\.)(?!.*\.\.)([A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+(?:\.[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+)*)@([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)$/;

export function validateDriverRegistration(fields) {
  const errors = {};
  const fullName = String(fields.name || '').trim();
  const phone = String(fields.phone || '').trim();
  const license = String(fields.license || '').trim().toUpperCase();
  const accountHolder = String(fields.accountHolder || '').trim();
  const accountNumber = String(fields.accountNumber || '').trim();
  const ifsc = String(fields.ifsc || '').trim().toUpperCase();
  const bankName = String(fields.bankName || '').trim();
  const email = String(fields.email || '').trim();
  const password = String(fields.password || '');
  const confirmPassword = String(fields.confirmPassword || '');

  if (!/^[A-Za-z ]+$/.test(fullName) || fullName.length < 2) errors.name = 'Full name should contain only letters and spaces';
  if (!/^[6-9]\d{9}$/.test(phone)) errors.phone = 'Phone number should be 10 digits and start with 9, 8, 7, or 6';
  if (!/^[A-Z]{2}-\d{2}-\d{4}-\d{7}$/.test(license)) errors.license = 'Driver License Number should be in AA-12-1234-1234567 format';
  if (!isFutureDate(fields.licenseExpiry)) errors.licenseExpiry = 'License expiry date must be in the future';
  if (!fields.licenseDoc) errors.licenseDoc = 'Upload License is required';
  else if (!/\.png$/i.test(fields.licenseDoc.name) && fields.licenseDoc.type !== 'image/png') errors.licenseDoc = 'Only PNG file is allowed for Upload License';
  if (!/^[A-Za-z ]+$/.test(accountHolder) || accountHolder.length < 2)
    errors.accountHolder = 'Account Holder Name should contain only letters and spaces';
  if (!/^\d{12}$/.test(accountNumber)) errors.accountNumber = 'Account Number should be exactly 12 digits';
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) errors.ifsc = 'IFSC Code must be 11 characters: first 4 letters, 5th 0, last 6 letters or numbers';
  if (!/^[A-Za-z .&-]+$/.test(bankName) || bankName.length < 2)
    errors.bankName = 'Bank Name should contain only letters, spaces, dots, ampersand, and hyphen';
  if (!fields.bankBook) errors.bankBook = 'Upload Bank Book is required';
  else if (!/\.png$/i.test(fields.bankBook.name) && fields.bankBook.type !== 'image/png') errors.bankBook = 'Only PNG file is allowed for Upload Bank Book';
  if (!DRIVER_EMAIL_REGEX.test(email)) errors.email = 'Enter a valid email address';
  if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password))
    errors.password = 'Password must be minimum 8 characters with 1 capital letter, 1 number, and 1 special character';
  if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match';
  if (!fields.terms) errors.terms = 'You must accept the Terms & Conditions';

  return errors;
}
