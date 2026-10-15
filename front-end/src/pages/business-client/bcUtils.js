export function getArray(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.deliveries)) return result.deliveries;
  if (Array.isArray(result?.deliveryRequests)) return result.deliveryRequests;
  if (Array.isArray(result?.invoices)) return result.invoices;
  if (Array.isArray(result?.notifications)) return result.notifications;
  if (Array.isArray(result?.trips)) return result.trips;
  if (Array.isArray(result?.users)) return result.users;
  return [];
}

export function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

export function cleanId(value) {
  return String(value || '').replace(/^#/, '').trim();
}

export function money(value) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return '₹0';
  return `₹${num.toLocaleString('en-IN')}`;
}

export function formatDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return String(value);
}

export function getPickup(delivery) {
  return delivery.pickup || delivery.from || delivery.pickupAddress || delivery.source || '--';
}

export function getDropoff(delivery) {
  return delivery.dropoff || delivery.destination || delivery.to || delivery.dropAddress || delivery.drop || '--';
}

export function getDriver(delivery) {
  return delivery.driver || delivery.assignedDriver || delivery.driverName || 'Assigning';
}

export async function resolveClientName() {
  const { getSession } = await import('../../api/client');
  const { Users } = await import('../../api/namespaces');
  const session = getSession();
  let user = null;
  try {
    if (session && session.userId) {
      user = await Users.getById(session.userId);
    }
  } catch (e) {
    console.error('Failed to resolve current business client from backend:', e);
  }
  const clientName =
    user?.companyName || user?.company || user?.profileDetails?.companyName || user?.name || session?.name || '';
  return { user, clientName };
}

export function belongsToClient(entityClient, clientName) {
  const client = normalize(entityClient);
  const target = normalize(clientName);
  if (!target || !client) return false;
  return client === target || client.includes(target) || target.includes(client);
}

export async function getCurrentClientNames() {
  const { getSession } = await import('../../api/client');
  const { Users } = await import('../../api/namespaces');
  try {
    const session = getSession();
    if (!session || !session.userId) return [];
    const user = await Users.getById(session.userId);
    if (!user) return [];
    return [user.name, user.username, user.companyName, user.company, user.profileDetails?.companyName]
      .filter(Boolean)
      .map((v) => String(v).trim().toLowerCase());
  } catch (e) {
    console.error('Failed to resolve current business client identity:', e);
    return [];
  }
}

export function belongsToCurrentClient(entity, clientNames) {
  if (!clientNames.length) return false;
  const c = normalize(entity.customer ?? entity.client);
  if (!c) return false;
  return clientNames.some((name) => c === name || c.includes(name) || name.includes(c));
}
