export function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function minimumFutureDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return localDateValue(tomorrow);
}

export function isFutureDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && value >= minimumFutureDate();
}
