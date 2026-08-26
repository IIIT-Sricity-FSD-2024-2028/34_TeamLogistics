import { Injectable } from '@nestjs/common';
import { DataStoreService } from '../data-store/data-store.service';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SUCCESS_STATUSES = ['completed', 'approved', 'paid'];

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

@Injectable()
export class DashboardService {
  constructor(private readonly store: DataStoreService) {}

  private computeDeliveryPerformance(): number[] {
    const counts = [0, 0, 0, 0, 0, 0, 0];

    for (const trip of this.store.trips) {
      const parsed = new Date(trip.startTime);
      if (Number.isNaN(parsed.getTime())) continue;
      const index = (parsed.getDay() + 6) % 7;
      counts[index] += 1;
    }

    return counts;
  }

  private computeRevenueTrends(): { labels: string[]; values: number[] } {
    const now = new Date();
    const months: { key: string; label: string }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString('en-US', { month: 'short' }),
      });
    }

    const totals = new Map(months.map((m) => [m.key, 0]));

    for (const txn of this.store.transactions) {
      if (!SUCCESS_STATUSES.includes(normalize(txn.status))) continue;
      const raw = (txn as any).date || txn.createdAt;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (totals.has(key)) {
        totals.set(key, (totals.get(key) as number) + Number(txn.amount || 0));
      }
    }

    return {
      labels: months.map((m) => m.label),
      values: months.map((m) => Number((totals.get(m.key) as number).toFixed(2))),
    };
  }

  private computeFleetStatus() {
    const vehicles = this.store.vehicles;
    let available = 0;
    let inTransit = 0;
    let maintenance = 0;
    let offline = 0;

    for (const v of vehicles) {
      const status = normalize(v.status);
      if (status === 'active') available++;
      else if (status.includes('trip') || status.includes('transit')) inTransit++;
      else if (status === 'maintenance') maintenance++;
      else offline++;
    }

    return { available, inTransit, maintenance, offline };
  }

  getSuperuserDashboard() {
    const users = this.store.users;
    const totalUsers = users.length;
    const fleetManagers = users.filter((u) => u.role === 'fleet-manager').length;
    const businessClients = users.filter((u) => u.role === 'business-client').length;
    const drivers = users.filter((u) => u.role === 'driver').length;
    const activeDeliveries = this.store.deliveryRequests.filter(
      (d) => !['Delivered', 'Cancelled', 'Blocked'].includes(d.status),
    ).length;
    const systemAlerts = this.store.notifications.filter((n) => n.to === 'superuser' && !n.read).length;

    const revenueTrends = this.computeRevenueTrends();

    return {
      totalUsers,
      fleetManagers,
      businessClients,
      drivers,
      activeDeliveries,
      systemAlerts,
      deliveryPerformance: this.computeDeliveryPerformance(),
      deliveryPerformanceLabels: WEEKDAY_LABELS,
      revenueTrends: revenueTrends.values,
      revenueTrendsLabels: revenueTrends.labels,
      fleetStatus: this.computeFleetStatus(),
    };
  }

  getBusinessClientDashboard(userId?: string) {
    let deliveries = this.store.deliveryRequests;
    let invoices = this.store.invoices;

    if (userId) {
      const user: any = this.store.users.find((u) => u.id === userId);
      const ownerNames = user
        ? [user.name, user.username, user.companyName, user.company, user.profileDetails?.companyName]
            .filter(Boolean)
            .map((v: string) => normalize(v))
        : [];

      if (ownerNames.length) {
        const belongsToClient = (client: unknown) => {
          const c = normalize(client);
          return ownerNames.some((name) => c === name || c.includes(name) || name.includes(c));
        };
        deliveries = deliveries.filter((d: any) => belongsToClient(d.customer));
        invoices = invoices.filter((i: any) => belongsToClient(i.client));
      }
    }

    const active = deliveries.filter((d) => !['Delivered', 'Cancelled'].includes(d.status)).length;
    const completed = deliveries.filter((d) => d.status === 'Delivered').length;
    const total = deliveries.length;
    const unpaidInvoices = invoices.filter((i) => i.status !== 'Paid');
    const unpaidAmount = unpaidInvoices.reduce((sum, i) => sum + i.amount, 0);

    return {
      totalDeliveries: total,
      activeDeliveries: active,
      completedDeliveries: completed,
      unpaidInvoices: unpaidInvoices.length,
      unpaidAmount,
      recentDeliveries: deliveries.slice(0, 5),
    };
  }

  getFleetManagerDashboard() {
    const vehicles = this.store.vehicles;
    const drivers = this.store.drivers;
    const trips = this.store.trips;

    return {
      totalVehicles: vehicles.length,
      activeVehicles: vehicles.filter((v) => v.status === 'Active').length,
      maintenanceVehicles: vehicles.filter((v) => v.status === 'Maintenance').length,
      totalDrivers: drivers.length,
      activeDrivers: drivers.filter((d) => ['On Duty', 'Available', 'Active'].includes(d.status)).length,
      activeTrips: trips.filter((t) => t.status === 'In Transit').length,
      pendingMaintenance: this.store.maintenanceSchedules.filter(
        (m) => m.status === 'Scheduled' || m.status === 'Overdue',
      ).length,
    };
  }

  getDriverDashboard(userId?: string) {
    let trips = this.store.trips;

    if (userId) {
      const user: any = this.store.users.find((u) => u.id === userId);
      const driverName = user ? normalize(user.name) : '';

      if (driverName) {
        trips = trips.filter((t: any) => normalize(t.driver) === driverName);
      }
    }

    return {
      activeTrips: trips.filter((t) => t.status === 'In Transit').length,
      completedTrips: trips.filter((t) => t.status === 'Delivered' || t.status === 'Completed').length,
      pendingTrips: trips.filter((t) => t.status === 'Queued').length,
      totalTrips: trips.length,
      recentTrips: trips.slice(0, 5),
    };
  }
}
