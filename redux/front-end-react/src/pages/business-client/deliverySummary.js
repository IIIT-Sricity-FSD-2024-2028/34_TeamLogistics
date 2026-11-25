const normalize = (value) => String(value || '').trim().toLowerCase();
const idOf = (value) => String(value || '').replace(/^#/, '').trim();
const activeStatuses = new Set(['requested', 'pending', 'approved', 'queued', 'assigned', 'accepted', 'picked up', 'in transit', 'issue reported', 'blocked', 'active', 'in progress', 'preparing', 'delayed']);

export function summarizeDeliveries(deliveries, invoices) {
  const groups = { active: [], deliveredPaid: [], deliveredPaymentPending: [], cancelled: [], rejected: [], other: [] };
  const unique = [...new Map(deliveries.map((d, index) => [idOf(d.id || d.deliveryId) || `missing-${index}`, d])).values()];
  for (const delivery of unique) {
    const status = normalize(delivery.status);
    let group;
    if (['cancelled', 'canceled'].includes(status)) group = 'cancelled';
    else if (status === 'rejected') group = 'rejected';
    else if (['delivered', 'completed'].includes(status)) {
      const id = idOf(delivery.id || delivery.deliveryId);
      const linked = invoices.filter((invoice) => id && idOf(invoice.deliveryId || invoice.request || invoice.deliveryRequestId || invoice.requestId) === id);
      const states = linked.map((invoice) => normalize(invoice.paymentStatus || invoice.status));
      if (states.length && states.every((state) => state === 'paid')) group = 'deliveredPaid';
      else if (states.some((state) => ['void', 'voided', 'cancelled', 'canceled'].includes(state))) group = 'other';
      else group = 'deliveredPaymentPending';
    } else if (activeStatuses.has(status)) group = 'active';
    else group = 'other';
    groups[group].push(delivery);
  }
  return { total: unique.length, groups, counts: Object.fromEntries(Object.entries(groups).map(([key, rows]) => [key, rows.length])) };
}
