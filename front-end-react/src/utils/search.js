export function matchesSearchFields(query, fields) {
  const terms = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;

  const searchableFields = fields
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).toLowerCase());

  return terms.every((term) => searchableFields.some((field) => field.includes(term)));
}

export function matchesFilter(value, selected) {
  if (!String(selected || '').trim()) return true;
  return String(value || '').trim().toLowerCase() === String(selected).trim().toLowerCase();
}

export function uniqueFilterOptions(items, getValue) {
  const values = (items || [])
    .map((item) => getValue(item))
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const unique = new Map();
  values.forEach((value) => {
    const key = value.toLowerCase();
    if (!unique.has(key)) unique.set(key, value);
  });
  return [...unique.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
