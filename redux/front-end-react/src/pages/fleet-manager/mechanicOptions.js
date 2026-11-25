export async function loadAvailableMechanics(mechanicsApi) {
  const records = await mechanicsApi.getAll(true);
  if (!Array.isArray(records)) return [];

  return records.filter((record) =>
    record && record.active === true && String(record.id || '').trim() && String(record.name || '').trim(),
  );
}
