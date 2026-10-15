export function pillClass(v) {
  const s = String(v || '').toLowerCase();
  if (s.includes('active') || s.includes('approved') || s.includes('available') || s.includes('completed') || s.includes('paid') || s.includes('compliant')) return 'pill-green';
  if (s.includes('trip') || s.includes('pending') || s.includes('submitted') || s.includes('manual') || s.includes('review') || s.includes('renew')) return 'pill-yellow';
  if (s.includes('maint') || s.includes('delay') || s.includes('minor') || s.includes('unavailable') || s.includes('overdue')) return 'pill-orange';
  if (s.includes('block') || s.includes('suspend') || s.includes('reject') || s.includes('expired') || s.includes('attention')) return 'pill-red';
  return 'pill-gray';
}

export { matchesFilter, matchesSearchFields, uniqueFilterOptions } from '../../utils/search.js';

const hiddenLegacyDriverStatuses = new Set(['active', 'document review']);

export function fleetPortalDrivers(drivers = [], users = []) {
  const driverUsers = new Map(
    users
      .filter((user) => String(user.role || '').trim().toLowerCase() === 'driver')
      .map((user) => [String(user.id || '').trim().toLowerCase(), user]),
  );

  return drivers.filter((driver) => {
    const user = driverUsers.get(String(driver.id || '').trim().toLowerCase());
    if (!user) return false;

    const profileStatus = String(driver.status || '').trim().toLowerCase();
    return !hiddenLegacyDriverStatuses.has(profileStatus);
  });
}

export function canonicalTripStatus(status) {
  return String(status || '').trim().toLowerCase() === 'delivered' ? 'Completed' : status;
}

export function payoutPaymentStatus(status) {
  const value = String(status || '').trim();
  return !value || value.toLowerCase() === 'earned' ? 'Unpaid' : value;
}

export function isRefundedFinancialRecord(record = {}) {
  const labels = [record.status, record.paymentStatus, record.transactionType, record.type]
    .map((value) => String(value || '').trim().toLowerCase());
  return labels.some((value) => value.includes('refund')) ||
    record.refunded === true ||
    Boolean(record.refundedAt) ||
    Number(record.refundedAmount || 0) > 0 ||
    Number(record.refundAmount || 0) > 0;
}

export function money(v) {
  if (v === undefined || v === null || v === '') return '--';
  const raw = String(v).replace(/[₹,]/g, '').trim();
  return isNaN(Number(raw)) ? String(v) : `₹${Number(raw).toLocaleString('en-IN')}`;
}

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function tripDateKey(t) {
  const m = String(t.startTime || '').match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(t.startTime);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function maintDateKey(m) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(m.date || '')) return m.date;
  const d = new Date(m.date);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function maintCost(m) {
  const n = Number(String(m.cost || '').replace(/[^\d.]/g, ''));
  return isNaN(n) ? 0 : n;
}

export function tripsPerDayBars(trips) {
  const counts = {};
  trips.forEach((t) => {
    const d = tripDateKey(t);
    if (d) counts[d] = (counts[d] || 0) + 1;
  });
  const days = Object.keys(counts).sort().slice(-7);
  if (!days.length) return [];
  const max = Math.max(1, ...days.map((d) => counts[d]));
  return days.map((d) => {
    const h = Math.round((counts[d] / max) * 130) + 10;
    const label = new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
    return { height: h, label, title: `${d}: ${counts[d]} trip(s)` };
  });
}

export function maintenanceCostLine(maintenance) {
  const byMonth = {};
  maintenance.forEach((m) => {
    const d = maintDateKey(m);
    if (!d) return;
    const month = d.slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + maintCost(m);
  });
  const months = Object.keys(byMonth).sort().slice(-6);
  if (!months.length) return [];
  const max = Math.max(1, ...months.map((m) => byMonth[m]));
  const stepX = months.length > 1 ? 500 / (months.length - 1) : 0;
  return months.map((m, i) => ({
    x: Math.round(i * stepX),
    y: Math.round(180 - (byMonth[m] / max) * 160),
    title: `${m}: ₹${byMonth[m].toLocaleString('en-IN')}`,
  }));
}

export function driverPerformanceRows(drivers) {
  const rated = drivers
    .filter((d) => d.rating && !isNaN(Number(d.rating)))
    .sort((a, b) => Number(b.rating) - Number(a.rating))
    .slice(0, 5);
  return rated.map((d) => {
    const pct = Math.max(0, Math.min(100, Math.round((Number(d.rating) / 5) * 100)));
    const label = String(d.name || '').trim().split(/\s+/)[0] || d.name || '--';
    return { label, pct, value: `${pct}%` };
  });
}

export function quickAlerts(vehicles, drivers, maintenance) {
  const alerts = [];
  maintenance
    .filter((m) => /scheduled|in progress/i.test(m.status || ''))
    .slice(0, 2)
    .forEach((m) => alerts.push({ title: `Maintenance ${m.status || 'Due'}`, sub: m.vehicle || '--', when: m.date || '' }));
  vehicles
    .filter((v) => String(v.status).toLowerCase().includes('maint'))
    .slice(0, 2)
    .forEach((v) => alerts.push({ title: 'Vehicle In Maintenance', sub: v.plate || v.id || '--', when: '' }));
  drivers
    .filter((d) => /suspend/i.test(d.status || ''))
    .slice(0, 2)
    .forEach((d) => alerts.push({ title: 'Driver Suspended', sub: d.name || '--', when: '' }));
  const rows = alerts.slice(0, 4);
  return { rows, count: rows.length };
}

export function validateDriver(payload) {
  const errors = {};
  if (!/^[A-Za-z][A-Za-z\s]{1,79}$/.test(payload.name)) errors.name = 'Enter a valid name';
  const digits = payload.phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 13) errors.phone = 'Enter a valid phone number (7-13 digits)';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) errors.email = 'Enter a valid email';
  if (payload.license && !/^[A-Z0-9\s-]{5,20}$/.test(payload.license)) errors.license = 'License should be 5-20 letters/digits';
  if (payload.vehicle && !/^[A-Z0-9 -]{4,15}$/.test(payload.vehicle)) errors.vehicle = 'Enter a valid vehicle plate';
  return errors;
}

export function statusBreakdownRows(items) {
  const counts = {};
  items.forEach((i) => {
    const k = String(i.status || '--').trim() || '--';
    counts[k] = (counts[k] || 0) + 1;
  });
  const total = items.length || 1;
  const entries = Object.entries(counts).sort((x, y) => y[1] - x[1]);
  return entries.map(([label, count]) => {
    const pct = Math.round((count / total) * 100);
    return { label, pct, value: `${count} (${pct}%)` };
  });
}
