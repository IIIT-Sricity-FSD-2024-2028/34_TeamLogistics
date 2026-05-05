import { Injectable, NotFoundException } from '@nestjs/common';
import { DataStoreService, Trip } from '../data-store/data-store.service';

@Injectable()
export class TripsService {
  constructor(private readonly store: DataStoreService) {}

  findAll(search?: string): Trip[] {
    let trips = [...this.store.trips];

    if (search) {
      const q = search.toLowerCase();
      trips = trips.filter((t) => JSON.stringify(t).toLowerCase().includes(q));
    }

    return trips;
  }

  findOne(id: string): Trip {
    const trip = this.store.trips.find((t) => t.id === id);

    if (!trip) {
      throw new NotFoundException(`Trip "${id}" not found`);
    }

    return trip;
  }

  reassign(id: string, driverName: string): Trip {
    const idx = this.store.trips.findIndex((t) => t.id === id);

    if (idx < 0) {
      throw new NotFoundException(`Trip "${id}" not found`);
    }

    const driver = this.store.drivers.find((d) => d.name === driverName);

    this.store.trips[idx].driver = driverName;

    if (driver) {
      this.store.trips[idx].phone = driver.phone || '';
    }

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Trip reassigned',
      message: `Trip ${id} has been reassigned to you.`,
      time: 'Just now',
      to: 'driver',
      read: false,
      createdAt: new Date().toISOString(),
    });

    this.store.persistTrips();
    this.store.persistNotifications();

    return this.store.trips[idx];
  }
private createInvoiceForDeliveredTrip(trip: Trip): void {
  const deliveryId = trip.request;

  if (!deliveryId) {
    return;
  }

  const delivery = this.store.deliveryRequests.find((d) => d.id === deliveryId);

  if (!delivery) {
    return;
  }

  const existingInvoice = this.store.invoices.find(
    (invoice: any) =>
      invoice.deliveryId === deliveryId ||
      invoice.request === deliveryId ||
      invoice.deliveryRequestId === deliveryId,
  );

  if (existingInvoice) {
    return;
  }

  const now = new Date();

  const invoiceDate = now.toISOString().split('T')[0];

  const dueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const distanceNumber = Number(
    String(trip.distance || '').replace(/[^\d.]/g, ''),
  );

  const baseCost =
    !Number.isNaN(distanceNumber) && distanceNumber > 0
      ? Math.round(distanceNumber * 100)
      : 5000;

  const taxAmount = Math.round(baseCost * 0.1);

  const totalAmount = baseCost + taxAmount;

  const invoice = {
    id: `INV-${deliveryId}`,
    invoiceId: `INV-${deliveryId}`,
    deliveryId: deliveryId,

    client: delivery.customer || 'Business Client',
    address: '123 Business Avenue',

    invoiceDate: invoiceDate,
    date: invoiceDate,
    dueDate: dueDate,

    driver: trip.driver || delivery.driver || 'Not assigned',
    pickup: trip.pickup || delivery.pickup || '',
    dropoff: trip.destination || delivery.dropoff || '',
    distance: trip.distance || 'Distance not available',

    baseCost: baseCost,
    taxAmount: taxAmount,
    tax: taxAmount,
    totalAmount: totalAmount,
    total: totalAmount,
    amount: totalAmount,

    status: 'Unpaid',
    paymentStatus: 'Pending',

    createdAt: now.toISOString(),
  };

  this.store.invoices.push(invoice as any);
  this.store.persistInvoices();

  this.store.notifications.push({
    id: `N-${Date.now()}`,
    title: 'Invoice generated',
    message: `Invoice ${invoice.id} has been generated for delivery ${deliveryId}.`,
    time: 'Just now',
    to: 'business-client',
    read: false,
    createdAt: now.toISOString(),
  });

  this.store.persistNotifications();
}
  updateStatus(id: string, status: string): Trip {
    const tripIndex = this.store.trips.findIndex((t) => t.id === id);

    if (tripIndex < 0) {
      throw new NotFoundException(`Trip "${id}" not found`);
    }

    this.store.trips[tripIndex].status = status;
    this.store.persistTrips();

    const requestId = this.store.trips[tripIndex].request;

    if (requestId) {
      const deliveryIndex = this.store.deliveryRequests.findIndex(
        (d) => d.id === requestId,
      );

      if (deliveryIndex >= 0) {
        if (status === 'Accepted') {
          this.store.deliveryRequests[deliveryIndex].status = 'Accepted';
        } else if (status === 'Rejected') {
          this.store.deliveryRequests[deliveryIndex].status = 'Rejected';
        } else if (status === 'In Transit') {
          this.store.deliveryRequests[deliveryIndex].status = 'In Transit';
        } else if (status === 'Picked Up') {
          this.store.deliveryRequests[deliveryIndex].status = 'Picked Up';
        } else if (status === 'Delivered' || status === 'Completed') {
          this.store.deliveryRequests[deliveryIndex].status = 'Delivered';

  this.createInvoiceForDeliveredTrip(this.store.trips[tripIndex]);
        } else {
          this.store.deliveryRequests[deliveryIndex].status = status;
        }

        this.store.persistDeliveries();
      }
    }

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: `Trip ${status}`,
      message: `Trip ${id} has been marked as ${status}.`,
      time: 'Just now',
      to: 'all',
      read: false,
      createdAt: new Date().toISOString(),
    });

    this.store.persistNotifications();

    return this.store.trips[tripIndex];
  }

  reportIssue(
    id: string,
    body: {
      issueType?: string;
      description?: string;
      status?: string;
    },
  ): Trip {
    const tripIndex = this.store.trips.findIndex((t) => t.id === id);

    if (tripIndex < 0) {
      throw new NotFoundException(`Trip "${id}" not found`);
    }

    const issueStatus = body.status || 'Issue Reported';
    const issueType = body.issueType || 'General Issue';
    const issueDescription = body.description || '';
    const reportedAt = new Date().toISOString();

    this.store.trips[tripIndex].status = issueStatus;
    (this.store.trips[tripIndex] as any).issueType = issueType;
    (this.store.trips[tripIndex] as any).issueDescription = issueDescription;
    (this.store.trips[tripIndex] as any).issueReportedAt = reportedAt;

    this.store.persistTrips();

    const requestId = this.store.trips[tripIndex].request;

    if (requestId) {
      const deliveryIndex = this.store.deliveryRequests.findIndex(
        (d) => d.id === requestId,
      );

      if (deliveryIndex >= 0) {
        this.store.deliveryRequests[deliveryIndex].status = issueStatus;
        (this.store.deliveryRequests[deliveryIndex] as any).issueType = issueType;
        (this.store.deliveryRequests[deliveryIndex] as any).issueDescription =
          issueDescription;
        (this.store.deliveryRequests[deliveryIndex] as any).issueReportedAt =
          reportedAt;

        this.store.persistDeliveries();
      }
    }

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Trip Issue Reported',
      message: `Issue reported for trip ${id}: ${issueType}. ${issueDescription}`,
      time: 'Just now',
      to: 'all',
      read: false,
      createdAt: reportedAt,
    });

    this.store.persistNotifications();

    return this.store.trips[tripIndex];
  }
}