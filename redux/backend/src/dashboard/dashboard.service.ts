import { ownsFleetAssignment, ownsDriverAssignment } from '../common/fleet-ownership';
import { Injectable } from '@nestjs/common';
import { deliveryForResponse } from '../common/delivery-response';
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
      if (!['delivery-payment', 'payment-reversal'].includes(txn.transactionType || '')) continue;
      const raw = txn.approvedAt || txn.updatedAt || txn.createdAt;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (totals.has(key)) {
        totals.set(key, (totals.get(key) as number) + Number(txn.platformCommission || 0));
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
      (d) => !['Delivered', 'Returned', 'Cancelled', 'Blocked'].includes(d.status),
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
      deliveries = deliveries.filter((d) => d.clientUserId === userId);
      invoices = invoices.filter((i: any) => {
        const owner = i.userId || this.store.deliveryRequests.find((d) => d.id === i.deliveryId)?.clientUserId;
        return owner === userId;
      });
    }

    const invoiceStates = new Map<string, string[]>();
    for (const invoice of invoices as Array<typeof invoices[number] & {deliveryId?:string; paymentStatus?:string}>) {
      if (!invoice.deliveryId) continue;
      const states = invoiceStates.get(invoice.deliveryId) || [];
      states.push(normalize(invoice.paymentStatus || invoice.status));
      invoiceStates.set(invoice.deliveryId, states);
    }
    const counts = {deliveredPaid:0, deliveredPaymentPending:0, cancelled:0, rejected:0, other:0};
    for (const delivery of deliveries) {
      const status = normalize(delivery.status);
      if (['delivered','completed'].includes(status)) {
        const bills = invoiceStates.get(delivery.id) || [];
        if (bills.length && bills.every(s => s === 'paid')) counts.deliveredPaid++;
        else if (bills.some(s => ['reversed','refunded','void','voided','cancelled','canceled'].includes(s))) counts.other++;
        else counts.deliveredPaymentPending++;
      } else if (['cancelled','canceled'].includes(status)) counts.cancelled++;
      else if (status === 'rejected') counts.rejected++;
      else if (status === 'returned') counts.other++;
    }

    const active = deliveries.filter((d) => !['Delivered', 'Returned', 'Completed', 'Cancelled', 'Rejected'].includes(d.status)).length;
    const completed = deliveries.filter((d) => d.status === 'Delivered').length;
    const total = deliveries.length;
    const unpaidInvoices = invoices.filter((i) => i.status !== 'Paid');
    const unpaidAmount = unpaidInvoices.reduce((sum, i) => sum + i.amount, 0);

    return {
      counts,
      totalDeliveries: total,
      activeDeliveries: active,
      completedDeliveries: completed,
      unpaidInvoices: unpaidInvoices.length,
      unpaidAmount,
      recentDeliveries: deliveries.slice(0, 5).map(deliveryForResponse),
    };
  }

  getFleetManagerDashboard(managerId?: string) {
    const vehicles = this.store.vehicles.filter((item) => !managerId || item.fleetManagerId === managerId);
    const drivers = this.store.drivers.filter((item) => !managerId || item.fleetManagerId === managerId);
    const trips = this.store.trips.filter((item) => !managerId || ownsFleetAssignment(item, managerId));

    return {
      totalVehicles: vehicles.length,
      activeVehicles: vehicles.filter((v) => v.status === 'Active').length,
      maintenanceVehicles: vehicles.filter((v) => v.status === 'Maintenance').length,
      totalDrivers: drivers.length,
      activeDrivers: drivers.filter((d) => ['On Duty', 'Available', 'Active'].includes(d.status)).length,
      activeTrips: trips.filter((t) => ['Accepted', 'Picked Up', 'In Transit', 'Attempt Failed', 'Returning', 'Issue Reported'].includes(t.status)).length,
      pendingMaintenance: this.store.maintenanceSchedules.filter(
        (m) => (!managerId || m.fleetManagerId === managerId) && (m.status === 'Scheduled' || m.status === 'Overdue'),
      ).length,
    };
  }

  getFleetManagerAnalytics(requester?: { userId: string; role: string }) {
    const scoped = requester && requester.role === 'fleet-manager';

    const vehicles = scoped
      ? this.store.vehicles.filter((v) => v.fleetManagerId === requester!.userId)
      : this.store.vehicles;
    const drivers = scoped
      ? this.store.drivers.filter((d) => d.fleetManagerId === requester!.userId)
      : this.store.drivers;
    const maintenance = scoped
      ? this.store.maintenanceSchedules.filter((m) => m.fleetManagerId === requester!.userId)
      : this.store.maintenanceSchedules;

    const trips = scoped
      ? this.store.trips.filter((t) => ownsFleetAssignment(t, requester!.userId))
      : this.store.trips;

    const active = vehicles.filter((v) => /active/i.test(v.status || '')).length;
    const completed = trips.filter((t) => /complete|deliver/i.test(t.status || '')).length;
    const cost = maintenance.reduce(
      (sum, m) => sum + (Number(String(m.cost || '').replace(/[₹,]/g, '')) || 0),
      0,
    );

    return {
      fleetScorePercent: vehicles.length ? Math.round((active / vehicles.length) * 100) : 0,
      completedTrips: completed,
      maintenanceCost: cost,
      driverCount: drivers.length,
      vehicleActiveRatioPercent: vehicles.length ? Math.round((active / vehicles.length) * 100) : 0,
      tripCompletionRatioPercent: trips.length ? Math.round((completed / trips.length) * 100) : 0,
    };
  }

  getDriverDashboard(userId?: string) {
    let trips = this.store.trips;

    if (userId) {
      trips = trips.filter((trip) => ownsDriverAssignment(trip, userId));
    }

    return {
      activeTrips: trips.filter((t) => ['Accepted', 'Picked Up', 'In Transit', 'Attempt Failed', 'Returning'].includes(t.status)).length,
      reportedIssues: trips.filter((t) => t.status === 'Issue Reported').length,
      completedTrips: trips.filter((t) => t.status === 'Delivered' || t.status === 'Completed').length,
      pendingTrips: trips.filter((t) => ['Pending', 'Queued', 'Assigned'].includes(t.status)).length,
      totalTrips: trips.length,
      recentTrips: trips.slice(0, 5),
    };
  }
}
