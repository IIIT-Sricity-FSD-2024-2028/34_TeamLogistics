import { Injectable } from '@nestjs/common';
import { DataStoreService } from '../data-store/data-store.service';

@Injectable()
export class DashboardService {
  constructor(private readonly store: DataStoreService) {}

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

    return {
      totalUsers,
      fleetManagers,
      businessClients,
      drivers,
      activeDeliveries,
      systemAlerts,
      deliveryPerformance: [680, 720, 850, 790, 920, 640, 580],
      revenueTrends: [42000, 48000, 51000, 58000, 62000, 69000],
      fleetStatus: { available: 240, inTransit: 90, maintenance: 12, offline: 7 },
    };
  }

  getBusinessClientDashboard() {
    const deliveries = this.store.deliveryRequests;
    const active = deliveries.filter((d) => !['Delivered', 'Cancelled'].includes(d.status)).length;
    const completed = deliveries.filter((d) => d.status === 'Delivered').length;
    const total = deliveries.length;
    const unpaidInvoices = this.store.invoices.filter((i) => i.status !== 'Paid');
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

  getDriverDashboard() {
    const trips = this.store.trips;
    return {
      activeTrips: trips.filter((t) => t.status === 'In Transit').length,
      completedTrips: trips.filter((t) => t.status === 'Delivered' || t.status === 'Completed').length,
      pendingTrips: trips.filter((t) => t.status === 'Queued').length,
      totalTrips: trips.length,
      recentTrips: trips.slice(0, 5),
    };
  }
}
