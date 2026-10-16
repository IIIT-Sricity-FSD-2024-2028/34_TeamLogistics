import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataStoreService, Trip } from '../data-store/data-store.service';
import { PayoutsService } from '../payouts/payouts.service';
import { DocumentsService } from '../documents/documents.service';
import { randomUUID } from 'crypto';

@Injectable()
export class TripsService {
  constructor(
    private readonly store: DataStoreService,
    private readonly payoutsService: PayoutsService,
    private readonly documentsService: DocumentsService,
  ) {}

  private tripForResponse(trip: Trip): Trip {
    if (String(trip.status || '').trim().toLowerCase() !== 'delivered') return trip;
    return { ...trip, status: 'Completed' };
  }

  updateLocation(id: string, location: { latitude: number; longitude: number; accuracy?: number }, requester: { userId: string; role: string }) {
    const trip = this.findOne(id, requester);
    if (!['accepted', 'picked up', 'in transit', 'issue reported'].includes(String(trip.status).toLowerCase())) {
      throw new BadRequestException('Location can only be shared for an active trip');
    }
    const position = { ...location, recordedAt: new Date().toISOString() };
    (trip as any).lastPosition = position;
    this.store.persistTrips();
    // Linked portals read the same position. Sharing location never advances
    // the operational status or invents an arrival estimate.
    const delivery = this.store.deliveryRequests.find((item) => item.id === trip.request);
    if (delivery) {
      (delivery as any).lastPosition = position;
      this.store.persistDeliveries();
    }
    return position;
  }

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

  private notifyOperations(trip: Trip, title: string, message: string): void {
    const managerId = this.payoutsService.findFleetManagerIdForDriverName(trip.driver || '');
    for (const role of ['superuser', 'fleet-manager']) {
      this.store.notifications.push({
        id: `N-${randomUUID()}`, title, message, time: 'Just now',
        to: role, toUserId: role === 'fleet-manager' ? managerId || undefined : undefined,
        read: false, createdAt: new Date().toISOString(),
      });
    }
  }

  private static readonly ACTIVE_TRIP_STATUSES = ['accepted', 'picked up', 'in transit'];

  private syncOperationalStatus(trip: Trip, previousDriverName?: string): void {
    const activeStatuses = ['accepted', 'picked up', 'in transit'];
    const isBusy = activeStatuses.includes(String(trip.status || '').toLowerCase().trim());
    let driversChanged = false;
    let vehiclesChanged = false;

    const updateDriver = (driverName: string | undefined) => {
      if (!driverName) return;
      const driver = this.store.drivers.find(
        (item) => String(item.name || '').toLowerCase().trim() === String(driverName).toLowerCase().trim(),
      );
      if (!driver) return;
      const hasOtherActiveTrip = this.store.trips.some(
        (item) =>
          item.id !== trip.id &&
          String(item.driver || '').toLowerCase().trim() === String(driverName).toLowerCase().trim() &&
          activeStatuses.includes(String(item.status || '').toLowerCase().trim()),
      );
      const nextStatus = (driverName === trip.driver && isBusy) || hasOtherActiveTrip ? 'On Duty' : 'Available';
      if (driver.status !== nextStatus) {
        driver.status = nextStatus;
        driversChanged = true;
      }
    };

    updateDriver(previousDriverName);
    updateDriver(trip.driver);

    const vehicle = this.store.vehicles.find(
      (item) => String(item.plate || '').toLowerCase().trim() === String(trip.vehicle || '').toLowerCase().trim(),
    );
    if (vehicle && !/maintenance/i.test(vehicle.status || '')) {
      const hasOtherActiveTrip = this.store.trips.some(
        (item) =>
          item.id !== trip.id &&
          String(item.vehicle || '').toLowerCase().trim() === String(trip.vehicle || '').toLowerCase().trim() &&
          activeStatuses.includes(String(item.status || '').toLowerCase().trim()),
      );
      const nextStatus = isBusy || hasOtherActiveTrip ? 'On Trip' : 'Active';
      if (vehicle.status !== nextStatus) {
        vehicle.status = nextStatus;
        vehiclesChanged = true;
      }
    }

    if (driversChanged) this.store.persistDrivers();
    if (vehiclesChanged) this.store.persistVehicles();
  }

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
    let trips = this.store.trips.map((trip) => this.tripForResponse(trip));

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
        const linkedDelivery = this.store.deliveryRequests.find((delivery) => delivery.id === t.request);
        const field = requester.role === 'driver' ? String(t.driver || '') : String(t.customer || linkedDelivery?.customer || '');
        const normalized = field.toLowerCase().trim();
        return Boolean(normalized) && ownNames.includes(normalized);
      });
    }

    if (search) {
      const q = search.toLowerCase();
      trips = trips.filter((t) => JSON.stringify(t).toLowerCase().includes(q));
    }

    return trips;
  }

  findOne(id: string, requester?: { userId: string; role: string }): Trip {
    const trip = this.store.trips.find((t) => t.id === id);

    if (!trip) {
      throw new NotFoundException(`Trip "${id}" not found`);
    }

    this.assertDriverOwnsTrip(trip, requester);
    if (requester?.role === 'business-client') {
      const user: any = this.store.users.find((item) => item.id === requester.userId);
      const ownNames = [user?.name, user?.companyName, user?.company, user?.profileDetails?.companyName]
        .filter(Boolean)
        .map((value: string) => String(value).toLowerCase().trim());
      const linkedDelivery: any = this.store.deliveryRequests.find((delivery) => delivery.id === trip.request);
      const customer = String((trip as any).customer || linkedDelivery?.customer || linkedDelivery?.client || '').toLowerCase().trim();
      if (!customer || !ownNames.includes(customer)) {
        throw new NotFoundException(`Trip "${id}" not found`);
      }
    }

    return this.tripForResponse(trip);
  }

  reassign(id: string, driverName: string, requester?: { userId: string; role: string }): Trip {
    const idx = this.store.trips.findIndex((t) => t.id === id);

    if (idx < 0) {
      throw new NotFoundException(`Trip "${id}" not found`);
    }

    if (['completed', 'delivered', 'cancelled', 'canceled', 'blocked'].includes(String(this.store.trips[idx].status || '').toLowerCase())) {
      throw new BadRequestException(`Trip "${id}" cannot be assigned while its status is ${this.store.trips[idx].status}`);
    }

    const previousDriverName = this.store.trips[idx].driver;
    const driver = this.store.drivers.find((d) => d.name === driverName);

    if (!driver) {
      throw new BadRequestException(`Driver "${driverName}" not found`);
    }

    if (requester?.role === 'fleet-manager' && driver.fleetManagerId && driver.fleetManagerId !== requester.userId) {
      throw new NotFoundException(`Driver "${driverName}" not found`);
    }

    if (!/available|^active$/i.test(driver.status || '') || /suspended|rejected|inactive|blocked/i.test(driver.status || '')) {
      throw new BadRequestException(`Driver "${driverName}" is not available for assignment`);
    }

    const conflictingTrip = this.findActiveTripForDriver(driverName, id);
    if (conflictingTrip) {
      throw new BadRequestException(`Driver "${driverName}" already has active trip ${conflictingTrip.id}`);
    }

    let assignedVehicle = this.store.vehicles.find(
      (vehicle) => String(vehicle.plate || '').toLowerCase().trim() === String(driver.vehicle || '').toLowerCase().trim(),
    );
    const currentVehicleHasActiveTrip = assignedVehicle && this.store.trips.some(
      (trip) =>
        trip.id !== id &&
        String(trip.vehicle || '').toLowerCase().trim() === String(assignedVehicle?.plate || '').toLowerCase().trim() &&
        TripsService.ACTIVE_TRIP_STATUSES.includes(String(trip.status || '').toLowerCase()),
    );
    const currentVehicleReady = assignedVehicle &&
      String(assignedVehicle.status || '').toLowerCase() === 'active' &&
      (!assignedVehicle.assignedDriver || assignedVehicle.assignedDriver === '--' || assignedVehicle.assignedDriver === driver.name) &&
      !currentVehicleHasActiveTrip;

    if (!currentVehicleReady) {
      assignedVehicle = this.store.vehicles.find((vehicle) => {
        const sameFleet = !driver.fleetManagerId || !vehicle.fleetManagerId || vehicle.fleetManagerId === driver.fleetManagerId;
        const available = String(vehicle.status || '').toLowerCase() === 'active';
        const unassigned = !vehicle.assignedDriver || vehicle.assignedDriver === '--' || vehicle.assignedDriver === driver.name;
        const hasActiveTrip = this.store.trips.some(
          (trip) =>
            trip.id !== id &&
            String(trip.vehicle || '').toLowerCase().trim() === String(vehicle.plate || '').toLowerCase().trim() &&
            TripsService.ACTIVE_TRIP_STATUSES.includes(String(trip.status || '').toLowerCase()),
        );
        return sameFleet && available && unassigned && !hasActiveTrip;
      });

      if (!assignedVehicle) {
        throw new BadRequestException(`No active available vehicle can be paired with driver "${driverName}"`);
      }

      driver.vehicle = assignedVehicle.plate;
      (driver as any).vehicleType = assignedVehicle.type || (driver as any).vehicleType || '';
      assignedVehicle.assignedDriver = driver.name;
      this.store.persistDrivers();
      this.store.persistVehicles();
    }

    if (!assignedVehicle) {
      throw new BadRequestException(`No active available vehicle can be paired with driver "${driverName}"`);
    }

    if (driver.vehicle !== assignedVehicle.plate || assignedVehicle.assignedDriver !== driver.name) {
      driver.vehicle = assignedVehicle.plate;
      (driver as any).vehicleType = assignedVehicle.type || (driver as any).vehicleType || '';
      assignedVehicle.assignedDriver = driver.name;
      this.store.persistDrivers();
      this.store.persistVehicles();
    }

    this.store.trips[idx].driver = driverName;
    this.store.trips[idx].status = 'Assigned';
    (this.store.trips[idx] as any).updatedAt = new Date().toISOString();
    (this.store.trips[idx] as any).statusHistory = Array.isArray((this.store.trips[idx] as any).statusHistory)
      ? (this.store.trips[idx] as any).statusHistory
      : [];
    (this.store.trips[idx] as any).statusHistory.push({
      status: 'Assigned',
      at: (this.store.trips[idx] as any).updatedAt,
      actor: driverName,
      source: 'fleet-manager',
    });

    if (driver) {
      this.store.trips[idx].phone = driver.phone || '';
      this.store.trips[idx].vehicle = driver.vehicle || '';
      (this.store.trips[idx] as any).vehicleType = (driver as any).vehicleType || assignedVehicle.type || '';
    }

    const requestId = this.store.trips[idx].request;

    if (requestId) {
      const deliveryIndex = this.store.deliveryRequests.findIndex((d) => d.id === requestId);

      if (deliveryIndex >= 0) {
        (this.store.deliveryRequests[deliveryIndex] as any).driver = driverName;
        (this.store.deliveryRequests[deliveryIndex] as any).assignedDriver = driverName;
        this.store.deliveryRequests[deliveryIndex].status = 'Assigned';
        (this.store.deliveryRequests[deliveryIndex] as any).updatedAt = new Date().toISOString();
        (this.store.deliveryRequests[deliveryIndex] as any).statusHistory = Array.isArray(
          (this.store.deliveryRequests[deliveryIndex] as any).statusHistory,
        )
          ? (this.store.deliveryRequests[deliveryIndex] as any).statusHistory
          : [];
        (this.store.deliveryRequests[deliveryIndex] as any).statusHistory.push({
          status: 'Assigned',
          at: (this.store.deliveryRequests[deliveryIndex] as any).updatedAt,
          actor: driverName,
          source: 'fleet-manager',
        });
        this.store.persistDeliveries();
      }
    }

    const reassignedDriverUser: any = this.store.users.find(
      (u: any) => u.role === 'driver' && String(u.name || '').toLowerCase() === String(driverName || '').toLowerCase(),
    );

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: previousDriverName ? 'Trip reassigned' : 'Delivery assigned',
      message: previousDriverName ? `Trip ${id} has been reassigned to you.` : `Trip ${id} has been assigned to you.`,
      time: 'Just now',
      to: 'driver',
      toUserId: reassignedDriverUser?.id,
      read: false,
      createdAt: new Date().toISOString(),
    });

    const { clientUserId } = this.findTripNotificationRecipients(this.store.trips[idx]);
    if (clientUserId) {
      this.store.notifications.push({
        id: `N-${Date.now() + 1}`,
        title: 'Driver assigned',
        message: `${driverName} was assigned to delivery ${requestId || id}.`,
        time: 'Just now',
        to: 'business-client',
        toUserId: clientUserId,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    this.notifyOperations(this.store.trips[idx], 'Driver assigned', `${driverName} was assigned to trip ${id}.`);
    this.store.persistTrips();
    this.store.persistNotifications();
    this.syncOperationalStatus(this.store.trips[idx], previousDriverName);

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
  const weightNumber = Number(String((delivery as any).weight || (delivery as any).estimatedWeight || '').replace(/[^\d.]/g, ''));
  const fleetManagerId = this.payoutsService.findFleetManagerIdForDriverName(trip.driver || '');
  const rateCard = this.payoutsService.getEffectiveCustomerRateCard(fleetManagerId);
  const baseCost = Number((
    Number(rateCard?.baseFare || 0) +
    (Number.isFinite(distanceNumber) ? distanceNumber : 0) * Number(rateCard?.perKm || 0) +
    (Number.isFinite(weightNumber) ? weightNumber : 0) * Number(rateCard?.perKg || 0)
  ).toFixed(2));
  const taxAmount = 0;

  const totalAmount = baseCost + taxAmount;

  const invoice = {
    id: `INV-${deliveryId}`,
    invoiceId: `INV-${deliveryId}`,
    deliveryId: deliveryId,

    client: delivery.customer || 'Business Client',
    address: (delivery as any).address || (delivery as any).clientAddress || (delivery as any).billingAddress || '',

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
    rateCardSnapshot: {
      type: 'customer-pricing',
      ownerId: rateCard.ownerId,
      baseFare: rateCard.baseFare,
      perKm: rateCard.perKm,
      perKg: rateCard.perKg,
    },

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
  private canonicalStatus(value: string): string {
    const statuses: Record<string, string> = {
      assigned: 'Assigned',
      accepted: 'Accepted',
      rejected: 'Rejected',
      'picked up': 'Picked Up',
      'in transit': 'In Transit',
      delivered: 'Completed',
      completed: 'Completed',
    };
    const canonical = statuses[String(value || '').toLowerCase().trim()];
    if (!canonical) {
      throw new BadRequestException(`Unsupported trip status "${value}"`);
    }
    return canonical;
  }

  private assertValidTransition(trip: Trip, nextStatus: string): void {
    const current = String(trip.status || '').toLowerCase().trim();
    const next = nextStatus.toLowerCase();
    const allowed: Record<string, string[]> = {
      assigned: ['accepted', 'rejected'],
      queued: ['accepted', 'rejected'],
      accepted: ['picked up', 'rejected'],
      'picked up': ['in transit'],
      'in transit': ['completed'],
      'issue reported': [String((trip as any).statusBeforeIssue || '').toLowerCase().trim()],
    };

    if (current === next) return;
    if (!(allowed[current] || []).includes(next)) {
      throw new BadRequestException(
        `Invalid trip transition from "${trip.status}" to "${nextStatus}". Statuses must be advanced from the driver workflow in order.`,
      );
    }
  }

  updateStatus(
    id: string,
    status: string,
    requester?: { userId: string; role: string },
    completion?: { recipient?: string; notes?: string; proofDocumentId?: string },
  ): Trip {
    const tripIndex = this.store.trips.findIndex((t) => t.id === id);

    if (tripIndex < 0) {
      throw new NotFoundException(`Trip "${id}" not found`);
    }

    const trip = this.store.trips[tripIndex];
    this.assertDriverOwnsTrip(trip, requester);
    const nextStatus = this.canonicalStatus(status);
    this.assertValidTransition(trip, nextStatus);

    let proofDocument: any = null;
    if (nextStatus === 'Completed') {
      if (!completion?.recipient?.trim() || !completion?.proofDocumentId) {
        throw new BadRequestException('Recipient name and uploaded proof document are required to complete a delivery');
      }
      proofDocument = this.documentsService.findOne(completion.proofDocumentId);
      const expectedDeliveryId = String(trip.request || trip.id);
      if (
        proofDocument.ownerType !== 'delivery' ||
        String(proofDocument.delivery || '') !== expectedDeliveryId ||
        proofDocument.documentType !== 'Proof of Delivery' ||
        !proofDocument.fileUrl
      ) {
        throw new BadRequestException('Proof must contain an uploaded file linked to this delivery');
      }
    }

    if (String(trip.status).toLowerCase().trim() === nextStatus.toLowerCase()) {
      return trip;
    }

    if (nextStatus === 'Accepted') {
      const driverName = trip.driver;
      if (!driverName) {
        throw new BadRequestException('This trip must be assigned by a fleet manager before it can be accepted');
      }
      const activeTrip = this.findActiveTripForDriver(driverName, id);

      if (activeTrip) {
        throw new ForbiddenException(
          `You already have an active delivery (${activeTrip.id}, status: ${activeTrip.status}). Complete or report an issue on it before accepting a new one.`,
        );
      }
    }

    const changedAt = new Date().toISOString();
    trip.status = nextStatus;
    (trip as any).updatedAt = changedAt;
    if (nextStatus === 'Picked Up') (trip as any).pickedUpAt = changedAt;
    if (nextStatus === 'In Transit') (trip as any).inTransitAt = changedAt;
    if (nextStatus === 'Completed') (trip as any).completedAt = changedAt;
    if (nextStatus === 'Completed') {
      (trip as any).proofOfDelivery = {
        recipient: completion!.recipient!.trim(),
        notes: completion?.notes?.trim() || '',
        documentId: proofDocument.id,
        fileUrl: proofDocument.fileUrl || '',
        submittedAt: changedAt,
      };
      this.documentsService.update(proofDocument.id, { status: 'Valid' });
    }
    (trip as any).statusHistory = Array.isArray((trip as any).statusHistory) ? (trip as any).statusHistory : [];
    (trip as any).statusHistory.push({
      status: nextStatus,
      at: changedAt,
      actor: requester?.userId || trip.driver || 'system',
      source: requester?.role || 'system',
    });
    this.store.persistTrips();

    const requestId = trip.request;

    if (requestId) {
      const deliveryIndex = this.store.deliveryRequests.findIndex(
        (d) => d.id === requestId,
      );

      if (deliveryIndex >= 0) {
        const normalizedStatus = nextStatus.toLowerCase();
        if (normalizedStatus === 'accepted') {
          this.store.deliveryRequests[deliveryIndex].status = 'Accepted';
        } else if (normalizedStatus === 'rejected') {
          this.store.deliveryRequests[deliveryIndex].status = 'Rejected';
        } else if (normalizedStatus === 'in transit') {
          this.store.deliveryRequests[deliveryIndex].status = 'In Transit';
        } else if (normalizedStatus === 'picked up') {
          this.store.deliveryRequests[deliveryIndex].status = 'Picked Up';
        } else if (normalizedStatus === 'completed') {
          this.store.deliveryRequests[deliveryIndex].status = 'Delivered';

          this.createInvoiceForDeliveredTrip(trip);
          this.payoutsService.createForTrip(trip);
        } else {
          this.store.deliveryRequests[deliveryIndex].status = nextStatus;
        }

        const delivery: any = this.store.deliveryRequests[deliveryIndex];
        delivery.updatedAt = changedAt;
        if (nextStatus === 'Picked Up') delivery.pickedUpAt = changedAt;
        if (nextStatus === 'In Transit') delivery.inTransitAt = changedAt;
        if (nextStatus === 'Completed') delivery.completedAt = changedAt;
        if (nextStatus === 'Completed') delivery.proofOfDelivery = (trip as any).proofOfDelivery;
        delivery.statusHistory = Array.isArray(delivery.statusHistory) ? delivery.statusHistory : [];
        delivery.statusHistory.push({
          status: delivery.status,
          at: changedAt,
          actor: requester?.userId || trip.driver || 'system',
          source: requester?.role || 'system',
        });

        this.store.persistDeliveries();
      }
    }

    const now = new Date().toISOString();
    const { driverUserId, clientUserId } = this.findTripNotificationRecipients(trip);

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: `Trip ${nextStatus}`,
      message: `Trip ${id} has been marked as ${nextStatus}.`,
      time: 'Just now',
      to: 'driver',
      toUserId: driverUserId,
      read: false,
      createdAt: now,
    });

    if (clientUserId) {
      this.store.notifications.push({
        id: `N-${Date.now() + 1}`,
        title: `Delivery ${nextStatus}`,
        message: `Your delivery via trip ${id} has been marked as ${nextStatus}.`,
        time: 'Just now',
        to: 'business-client',
        toUserId: clientUserId,
        read: false,
        createdAt: now,
      });
    }

    this.notifyOperations(trip, `Delivery ${nextStatus}`, `Trip ${id} was marked as ${nextStatus} by ${trip.driver}.`);
    this.store.persistNotifications();
    this.syncOperationalStatus(this.store.trips[tripIndex]);

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

    const currentStatus = String(this.store.trips[tripIndex].status || '').toLowerCase().trim();
    if (currentStatus === 'issue reported') {
      throw new BadRequestException('This trip already has a saved issue report. View it in History.');
    }
    if (!['accepted', 'picked up', 'in transit'].includes(currentStatus)) {
      throw new BadRequestException('Issues can only be reported after a trip is accepted and before it is completed');
    }

    const issueStatus = 'Issue Reported';
    const issueType = body.issueType || 'General Issue';
    const issueDescription = body.description || '';
    const reportedAt = new Date().toISOString();
    const previousStatus = this.store.trips[tripIndex].status;

    this.store.trips[tripIndex].status = issueStatus;
    (this.store.trips[tripIndex] as any).issueType = issueType;
    (this.store.trips[tripIndex] as any).issueDescription = issueDescription;
    (this.store.trips[tripIndex] as any).issueReportedAt = reportedAt;
    (this.store.trips[tripIndex] as any).updatedAt = reportedAt;
    (this.store.trips[tripIndex] as any).statusHistory = Array.isArray((this.store.trips[tripIndex] as any).statusHistory)
      ? (this.store.trips[tripIndex] as any).statusHistory
      : [];
    (this.store.trips[tripIndex] as any).statusHistory.push({
      status: issueStatus,
      at: reportedAt,
      actor: requester?.userId || this.store.trips[tripIndex].driver || 'system',
      source: requester?.role || 'system',
    });

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
        (this.store.deliveryRequests[deliveryIndex] as any).updatedAt = reportedAt;
        (this.store.deliveryRequests[deliveryIndex] as any).statusHistory = Array.isArray(
          (this.store.deliveryRequests[deliveryIndex] as any).statusHistory,
        )
          ? (this.store.deliveryRequests[deliveryIndex] as any).statusHistory
          : [];
        (this.store.deliveryRequests[deliveryIndex] as any).statusHistory.push({
          status: issueStatus,
          at: reportedAt,
          actor: requester?.userId || this.store.trips[tripIndex].driver || 'system',
          source: requester?.role || 'system',
        });

        this.store.persistDeliveries();
      }
    }

    const { clientUserId } = this.findTripNotificationRecipients(this.store.trips[tripIndex]);

    this.notifyOperations(this.store.trips[tripIndex], 'Delivery issue reported', `Trip ${id}: ${issueType}. ${issueDescription}`);

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
    this.syncOperationalStatus(this.store.trips[tripIndex]);

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
