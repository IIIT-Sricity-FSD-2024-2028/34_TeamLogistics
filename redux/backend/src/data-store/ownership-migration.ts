import type { DataStoreService, Document } from './data-store.service';

// Run once on the existing snapshot, before users can edit their profiles.
export function migrateOwnership(store: DataStoreService) {
  const normal = (text: unknown) => String(text || '').trim().toLowerCase();
  const clientOwners = new Map<string, Set<string>>();
  for (const user of store.users.filter((u) => u.role === 'business-client')) {
    for (const alias of [user.name, user.profileDetails?.companyName, (user as any).username, (user as any).companyName, (user as any).company]) {
      if (!normal(alias)) continue;
      const owners = clientOwners.get(normal(alias)) || new Set<string>();
      owners.add(user.id);
      clientOwners.set(normal(alias), owners);
    }
  }
  const knownOwner = (name: unknown) => {
    const matches = clientOwners.get(normal(name));
    return matches?.size === 1 ? [...matches][0] : undefined;
  };
  const deliveryById = new Map(store.deliveryRequests.map((d) => [d.id, d]));
  for (const d of store.deliveryRequests) d.clientUserId ||= (d as any).businessClientId || (d as any).customerUserId || knownOwner(d.customer);
  for (const row of [...store.trips, ...store.deliveryRequests]) {
    const matches = row.driverId ? store.drivers.filter((d) => d.id === row.driverId) :
      store.drivers.filter((d) => normal(d.name) === normal(row.driver) && (!row.fleetManagerId || d.fleetManagerId === row.fleetManagerId));
    if (matches.length === 1) { row.driverId ||= matches[0].id; row.fleetManagerId ||= matches[0].fleetManagerId; }
  }
  for (const invoice of store.invoices as any[]) invoice.userId ||= deliveryById.get(invoice.deliveryId)?.clientUserId || knownOwner(invoice.client);
  const invoices = new Map(store.invoices.map((i) => [i.id, i]));
  for (const payment of store.transactions) payment.userId ||= (invoices.get(payment.invoiceId || '') as any)?.userId || deliveryById.get(payment.deliveryId || '')?.clientUserId;
  const trips = new Map(store.trips.map((t) => [t.id,t]));
  for (const payout of store.driverPayouts) payout.driverId ||= trips.get(payout.tripId)?.driverId;
  store.persistDeliveries(); store.persistTrips(); store.persistInvoices(); store.persistTransactions(); store.persistDriverPayouts();
}

export function bindDocumentOwner(doc: Document, store: DataStoreService, fleet?: string) {
  if (doc.ownerType === 'driver' && !doc.driverId) {
    const matches = store.drivers.filter(d => (!fleet || d.fleetManagerId === fleet) && (d.id === doc.driver || d.name === doc.driver));
    if (matches.length === 1) doc.driverId = matches[0].id;
  }
  if (doc.ownerType === 'vehicle' && !doc.vehicleId) {
    const matches = store.vehicles.filter(v => (!fleet || v.fleetManagerId === fleet) && (v.id === doc.vehicle || v.plate === doc.vehicle));
    if (matches.length === 1) doc.vehicleId = matches[0].id;
  }
}
