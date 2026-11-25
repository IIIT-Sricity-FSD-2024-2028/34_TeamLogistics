function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

export function formatComplianceDate(value) {
  const date = parseDate(value);
  if (!date) return value || '--';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getDriverLicenseExpiry(driver, documents = []) {
  const direct = driver.licenseExpiry || driver.expiry || driver.documentExpiry;
  const identities = new Set([driver.id, driver.name, driver.driver, driver.email].map(normalize).filter(Boolean));
  const licenses = documents.filter((document) =>
    normalize(document.ownerType) === 'driver' &&
    normalize(document.documentType).includes('license') &&
    identities.has(normalize(document.driver)) &&
    parseDate(document.expiryDate),
  );

  const expiryDates = [direct, ...licenses.map((document) => document.expiryDate)].filter((value) => parseDate(value));
  expiryDates.sort((left, right) => parseDate(right).getTime() - parseDate(left).getTime());
  return expiryDates[0] || '';
}

export function getDriverLicenseStatus(driver, documents = [], now = new Date()) {
  const expiryValue = getDriverLicenseExpiry(driver, documents);
  const expiry = parseDate(expiryValue);
  if (!expiry) return 'Missing';

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return expiry < today ? 'Expired' : 'Valid';
}

export function getDriverOverallCompliance(driver, documents = [], now = new Date()) {
  if (getDriverLicenseStatus(driver, documents, now) !== 'Valid') return 'Not Compliant';

  const driverStatus = normalize(driver.status);
  const explicitStatus = normalize(driver.complianceStatus || driver.overallStatus);
  if (/suspend|reject|document review/.test(driverStatus)) return 'Not Compliant';
  if (/non|not compliant|attention/.test(explicitStatus)) return 'Not Compliant';
  return 'Compliant';
}
