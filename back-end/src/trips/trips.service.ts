import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataStoreService, Trip } from '../data-store/data-store.service';
import { PayoutsService } from '../payouts/payouts.service';

@Injectable()
export class TripsService {
  constructor(
    private readonly store: DataStoreService,
    private readonly payoutsService: PayoutsService,
  ) {}

  private findTripNotificationRecipients(trip: Trip): { driverUserId?: string; clientUserId?: string } {
    const driverUser: any = this.store.users.find(
      (u: any) => u.role === 'driver' && String(u.name || '').toLowerCase().trim() === String((trip as any).driver || '').toLowerCase().trim(),
    );

    let clientUser: any = null;
    const requestId = (trip as any).request;

    if (requestId) {
      const delivery: any = this.store.deliveryRequests.find((d: any) => d.id === requestId);

      if (delivery) {
        const customerName = String(delivery.customer || delivery.client || '').toLowerCase().trim();

        clientUser = this.store.users.find((u: any) => {
          if (u.role !== 'business-client') return false;
          const names = [u.name, u.companyName, u.company, u.profileDetails?.companyName]
            .filter(Boolean)
            .map((v: string) => String(v).toLowerCase().trim());
          return names.includes(customerName);
        });
      }
    }

    return { driverUserId: driverUser?.id, clientUserId: clientUser?.id };
  }

  private static readonly ACTIVE_TRIP_STATUSES = ['accepted', 'picked up', 'in transit'];

  private findActiveTripForDriver(driverName: string, excludeTripId: string): Trip | undefined {
    const normalized = String(driverName || '').toLowerCase().trim();
    if (!normalized) return undefined;

    return this.store.trips.find(
      (t) =>
        t.id !== excludeTripId &&
        String((t as any).driver || '').toLowerCase().trim() === normalized &&
        TripsService.ACTIVE_TRIP_STATUSES.includes(String(t.status || '').toLowerCase()),
    );
  }

  private assertDriverOwnsTrip(trip: Trip, requester?: { userId: string; role: string }): void {
    if (!requester || requester.role !== 'driver') return;

    const user: any = this.store.users.find((u) => u.id === requester.userId);
    const ownNames = [user?.name, user?.fullName, user?.profileDetails?.fullName]
      .filter(Boolean)
      .map((v: string) => String(v).toLowerCase().trim());

    const tripDriver = String((trip as any).driver || '').toLowerCase().trim();

    if (!ownNames.length || !ownNames.includes(tripDriver)) {
      throw new ForbiddenException('You can only update trips assigned to you');
    }
  }

  findAll(search?: string, requester?: { userId: string; role: string }): Trip[] {
    let trips = [...this.store.trips];

    if (requester && (requester.role === 'business-client' || requester.role === 'driver')) {
      const user: any = this.store.users.find((u) => u.id === requester.userId);
      const ownNames = [
        user?.name,
        user?.username,
        user?.companyName,
        user?.company,
        user?.profileDetails?.companyName,
        user?.profileDetails?.fullName,
      ]
        .filter(Boolean)
        .map((v: string) => String(v).toLowerCase().trim());

      trips = trips.filter((t: any) => {
        const field = requester.role === 'driver' ? String(t.driver || '') : String(t.customer || '');
        const normalized = field.toLowerCase().trim();
        return ownNames.some((name) => normalized === name || normalized.includes(name) || name.includes(normalized));
      });
    }

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

    const reassignedDriverUser: any = this.store.users.find(
      (u: any) => u.role === 'driver' && String(u.name || '').toLowerCase() === String(driverName || '').toLowerCase(),
    );

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Trip reassigned',
      message: `Trip ${id} has been reassigned to you.`,
      time: 'Just now',
      to: 'driver',
      toUserId: reassignedDriverUser?.id,
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

  const owningClientUser: any = this.store.users.find((u: any) => {
    if (u.role !== 'business-client') return false;
    const names = [u.name, u.companyName, u.company, u.profileDetails?.companyName]
      .filter(Boolean)
      .map((v: string) => String(v).toLowerCase().trim());
    return names.includes(String((invoice as any).client || '').toLowerCase().trim());
  });

  this.store.notifications.push({
    id: `N-${Date.now()}`,
    title: 'Invoice generated',
    message: `Invoice ${invoice.id} has been generated for delivery ${deliveryId}.`,
    time: 'Just now',
    to: 'business-client',
    toUserId: owningClientUser?.id,
    read: false,
    createdAt: now.toISOString(),
  });

  this.store.persistNotifications();
}
  updateStatus(id: string, status: string, requester?: { userId: string; role: string }): Trip {
    const tripIndex = this.store.trips.findIndex((t) => t.id === id);

    if (tripIndex < 0) {
      throw new NotFoundException(`Trip "${id}" not found`);
    }

    this.assertDriverOwnsTrip(this.store.trips[tripIndex], requester);

    if (String(status).toLowerCase() === 'accepted') {
      const driverName = this.store.trips[tripIndex].driver;
      const activeTrip = this.findActiveTripForDriver(driverName, id);

      if (activeTrip) {
        throw new ForbiddenException(
          `You already have an active delivery (${activeTrip.id}, status: ${activeTrip.status}). Complete or report an issue on it before accepting a new one.`,
        );
      }
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
  this.payoutsService.createForTrip(this.store.trips[tripIndex]);
        } else {
          this.store.deliveryRequests[deliveryIndex].status = status;
        }

        this.store.persistDeliveries();
      }
    }

    const now = new Date().toISOString();
    const { driverUserId, clientUserId } = this.findTripNotificationRecipients(this.store.trips[tripIndex]);

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: `Trip ${status}`,
      message: `Trip ${id} has been marked as ${status}.`,
      time: 'Just now',
      to: 'driver',
      toUserId: driverUserId,
      read: false,
      createdAt: now,
    });

    if (clientUserId) {
      this.store.notifications.push({
        id: `N-${Date.now() + 1}`,
        title: `Delivery ${status}`,
        message: `Your delivery via trip ${id} has been marked as ${status}.`,
        time: 'Just now',
        to: 'business-client',
        toUserId: clientUserId,
        read: false,
        createdAt: now,
      });
    }

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
    requester?: { userId: string; role: string },
  ): Trip {
    const tripIndex = this.store.trips.findIndex((t) => t.id === id);

    if (tripIndex < 0) {
      throw new NotFoundException(`Trip "${id}" not found`);
    }

    this.assertDriverOwnsTrip(this.store.trips[tripIndex], requester);

    const issueStatus = body.status || 'Issue Reported';
    const issueType = body.issueType || 'General Issue';
    const issueDescription = body.description || '';
    const reportedAt = new Date().toISOString();
    const previousStatus = this.store.trips[tripIndex].status;

    this.store.trips[tripIndex].status = issueStatus;
    (this.store.trips[tripIndex] as any).issueType = issueType;
    (this.store.trips[tripIndex] as any).issueDescription = issueDescription;
    (this.store.trips[tripIndex] as any).issueReportedAt = reportedAt;

    if (['accepted', 'picked up', 'in transit'].includes(String(previousStatus || '').toLowerCase())) {
      (this.store.trips[tripIndex] as any).statusBeforeIssue = previousStatus;
    }

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

    const { clientUserId } = this.findTripNotificationRecipients(this.store.trips[tripIndex]);

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Trip Issue Reported',
      message: `Issue reported for trip ${id}: ${issueType}. ${issueDescription}`,
      time: 'Just now',
      to: 'fleet-manager',
      read: false,
      createdAt: reportedAt,
    });

    if (clientUserId) {
      this.store.notifications.push({
        id: `N-${Date.now() + 1}`,
        title: 'Delivery Issue Reported',
        message: `An issue was reported on your delivery via trip ${id}: ${issueType}.`,
        time: 'Just now',
        to: 'business-client',
        toUserId: clientUserId,
        read: false,
        createdAt: reportedAt,
      });
    }

    this.store.persistNotifications();

    return this.store.trips[tripIndex];
  }

  addNote(id: string, text: string, requester?: { userId: string; role: string }): Trip {
    const tripIndex = this.store.trips.findIndex((t) => t.id === id);

    if (tripIndex < 0) {
      throw new NotFoundException(`Trip "${id}" not found`);
    }

    this.assertDriverOwnsTrip(this.store.trips[tripIndex], requester);

    const trip: any = this.store.trips[tripIndex];
    trip.driverNotes = Array.isArray(trip.driverNotes) ? trip.driverNotes : [];
    trip.driverNotes.unshift({ text, time: new Date().toISOString() });

    this.store.persistTrips();

    return this.store.trips[tripIndex];
  }

  resolveDispute(
    id: string,
    resolvedAmount: number,
    reason: string,
    requester?: { userId: string; role: string },
  ): Trip {
    const tripIndex = this.store.trips.findIndex((t) => t.id === id);

    if (tripIndex < 0) {
      throw new NotFoundException(`Trip "${id}" not found`);
    }

    const trip: any = this.store.trips[tripIndex];

    if (String(trip.status || '').toLowerCase() !== 'issue reported') {
      throw new BadRequestException(
        'A dispute can only be resolved for a trip currently in "Issue Reported" status',
      );
    }

    if (typeof resolvedAmount !== 'number' || Number.isNaN(resolvedAmount) || resolvedAmount < 0) {
      throw new BadRequestException('resolvedAmount must be a non-negative number');
    }

    trip.disputeResolution = {
      resolvedAmount,
      resolvedBy: requester?.userId || 'system',
      resolvedAt: new Date().toISOString(),
      reason: reason || '',
    };

    this.store.persistTrips();

    const { clientUserId } = this.findTripNotificationRecipients(this.store.trips[tripIndex]);

    if (clientUserId) {
      this.store.notifications.push({
        id: `N-${Date.now()}`,
        title: 'Delivery dispute resolved',
        message: `Your delivery dispute for trip ${id} was resolved: billable amount set to ₹${resolvedAmount.toLocaleString('en-IN')}.`,
        time: 'Just now',
        to: 'business-client',
        toUserId: clientUserId,
        read: false,
        createdAt: new Date().toISOString(),
      });
      this.store.persistNotifications();
    }

    return this.store.trips[tripIndex];
  }
}