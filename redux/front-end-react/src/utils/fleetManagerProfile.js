export function validateFleetManagerProfile(fields) {
  const errors = {};
  const email = String(fields.email || '').trim();
  const phone = String(fields.phone || '').trim();
  const company = String(fields.company || '').trim();
  const address = String(fields.address || '').trim();
  const vehicleCount = String(fields.numVehicles || '').trim();

  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/.test(email) || email.length > 254) {
    errors.email = 'Enter a valid email address';
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    errors.phone = 'Phone number must have 10 digits and start with 6, 7, 8, or 9';
  }
  if (company.length < 2 || company.length > 80 || !/[A-Za-z]/.test(company)) {
    errors.company = 'Company name must be 2-80 characters and contain a letter';
  }
  if (address.length < 8 || address.length > 200 || !/[A-Za-z]/.test(address)) {
    errors.address = 'Company address must be 8-200 characters and contain a letter';
  }
  if (!/^\d+$/.test(vehicleCount) || Number(vehicleCount) < 1 || Number(vehicleCount) > 100000) {
    errors.numVehicles = 'Enter a whole number between 1 and 100000';
  }

  return errors;
}
