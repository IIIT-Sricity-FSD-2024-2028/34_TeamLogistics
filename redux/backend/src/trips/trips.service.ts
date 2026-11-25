import { paise, rupees } from '../common/money';
import { dispatchVehicle, driverStatus, onShift, reservesDriver, trackPosition, WORK_TRIP_STATUSES } from '../common/dispatch';
import { serviceRoutes } from '../common/service-routes';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataStoreService, Trip } from '../data-store/data-store.service';
import { PayoutsService } from '../payouts/payouts.service';
import { DocumentsService } from '../documents/documents.service';
import { randomUUID } from 'crypto';
import { ownsFleetAssignment, ownsDriverAssignment } from '../common/fleet-ownership';
import { fitsVehicle } from '../common/vehicle-capacity';
import {
  checkDeliveryOtp,
  markDeliveryOtpUsed,
} from '../common/delivery-otp';

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

  updateLocation(id: string, location: { latitude: number; longitude: number; accuracy?: number; measuredAt?: string }, requester: { userId: string; role: string }) {
    const trip = this.findOne(id, requester);
    if (!['accepted', 'picked up', 'in transit', 'issue reported', 'attempt failed', 'returning'].includes(String(trip.status).toLowerCase())) {
      throw new BadRequestException('Location can only be shared for an active trip');
    }
    const delivery = this.store.deliveryRequests.find((item) => item.id === trip.request);
    const route = serviceRoutes.find(r => r.id === (delivery as any)?.routeId);
    const position = trackPosition(location, (trip as any).lastPosition, route);
    if (position === (trip as any).lastPosition) return position;
    (trip as any).lastPosition = position;
    this.store.persistTrips();
    // Linked portals read the same position. Sharing location never advances
    // the operational status or invents an arrival estimate.
    if (delivery) {
      (delivery as any).lastPosition = position;
      this.store.persistDeliveries();
    }
    return position;
  }

  private findTripNotificationRecipients(trip: Trip): { driverUserId?: string; clientUserId?: string } {
    const driverUser = this.store.users.find((user) => user.role === 'driver' &&
      ownsDriverAssignment(trip, user.id));
    const clientUser = this.store.users.find((user) => user.role === 'business-client' && this.clientOwnsTrip(trip, user.id));
    return { driverUserId: driverUser?.id, clientUserId: clientUser?.id };
  }

  private notifyOperations(trip: Trip, title: string, message: string): void {
    const managerId = trip.fleetManagerId;
    for (const role of ['superuser', 'fleet-manager']) {
      if (role === 'fleet-manager' && !managerId) continue;
      this.store.notifications.push({
        id: `N-${randomUUID()}`, title, message, time: 'Just now',
        to: role, toUserId: role === 'fleet-manager' ? managerId || undefined : undefined,
        read: false, createdAt: new Date().toISOString(),
      });
    }
  }

  private syncVehicleStatus(trip: Trip): void {
    const activeStatuses = WORK_TRIP_STATUSES;
    const isBusy = activeStatuses.includes(String(trip.status || '').toLowerCase().trim());
    let vehiclesChanged = false;

    const vehicle = this.store.vehicles.find(
      (item) => item.fleetManagerId === trip.fleetManagerId && String(item.plate || '').toLowerCase().trim() === String(trip.vehicle || '').toLowerCase().trim(),
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

    if (vehiclesChanged) this.store.persistVehicles();
  }

  private findActiveTripForDriver(trip: Trip): Trip | undefined {

    return this.store.trips.find(
      (t) =>
        t.id !== trip.id && (trip.driverId ? ownsDriverAssignment(t, trip.driverId) : t.driver === trip.driver && t.fleetManagerId === trip.fleetManagerId) &&
        WORK_TRIP_STATUSES.includes(String(t.status || '').toLowerCase()),
    );
  }

  private assertDriverOwnsTrip(trip: Trip, requester?: { userId: string; role: string }): void {
    if (requester?.role === 'driver' && !ownsDriverAssignment(trip, requester.userId)) {
      throw new NotFoundException(`Trip "${trip.id}" not found`);
    }
  }

  verifyDeliveryOtp(id: string, code: string, requester?: { userId: string; role: string }) {
    const trip = this.findOne(id, requester);
    const status = trip.status.toLowerCase().trim();
    if (status !== 'in transit' && !(status === 'issue reported' && trip.statusBeforeIssue?.toLowerCase() === 'in transit')) {
      throw new BadRequestException('Delivery OTP can only be verified for an in-transit trip');
    }
    const delivery = this.store.deliveryRequests.find((item) => item.id === trip.request);
    if (!delivery) throw new BadRequestException('The linked delivery request could not be found');
    if (Date.parse((trip as any).retryAt) > Date.now()) throw new BadRequestException('The second attempt is scheduled for later');
    const result = checkDeliveryOtp(delivery, code);
    if (!result.valid) {
      this.store.persistDeliveries();
      throw new BadRequestException(result.message);
    }
    return result;
  }

  findAll(search?: string, requester?: { userId: string; role: string }): Trip[] {
    return this.store.trips.filter((trip) => {
      if (requester?.role === 'fleet-manager') return ownsFleetAssignment(trip, requester.userId);
      if (requester?.role === 'driver') return ownsDriverAssignment(trip, requester.userId);
      if (requester?.role === 'business-client') return this.clientOwnsTrip(trip, requester.userId);
      return true;
    }).filter((trip) => !search || JSON.stringify(trip).toLowerCase().includes(search.toLowerCase()))
      .map((trip) => this.tripForResponse(trip));
  }

  private clientOwnsTrip(trip: Trip, userId: string) {
    const delivery = this.store.deliveryRequests.find((item) => item.id === trip.request);
    return delivery?.clientUserId === userId;
  }

  findOne(id: string, requester?: { userId: string; role: string }): Trip {
    const trip = this.store.trips.find((item) => item.id === id);
    if (!trip || (requester?.role === 'fleet-manager' && !ownsFleetAssignment(trip, requester.userId))) {
      throw new NotFoundException(`Trip "${id}" not found`);
    }
    this.assertDriverOwnsTrip(trip, requester);
    if (requester?.role === 'business-client' && !this.clientOwnsTrip(trip, requester.userId)) {
      throw new NotFoundException(`Trip "${id}" not found`);
    }

    return this.tripForResponse(trip);
  }

  reassign(id: string, driverRef: string, requester?: { userId: string; role: string }): Trip {
    this.findOne(id, requester);
    const idx = this.store.trips.findIndex((t) => t.id === id);

    if (idx < 0) {
      throw new NotFoundException(`Trip "${id}" not found`);
    }

    if (!['requested', 'assigned', 'queued', 'pending', 'accepted', 'rejected'].includes(String(this.store.trips[idx].status || '').toLowerCase())) {
      throw new BadRequestException(`Trip "${id}" cannot be assigned while its status is ${this.store.trips[idx].status}`);
    }

    const previousTrip = { ...this.store.trips[idx] };
    const previousDriverName = this.store.trips[idx].driver;
    const byId = this.store.drivers.some(d => d.id === driverRef);
    const candidates = this.store.drivers.filter((d) => (byId ? d.id === driverRef : d.name === driverRef) &&
      (requester?.role !== 'fleet-manager' || d.fleetManagerId === requester.userId));
    if (candidates.length > 1) throw new BadRequestException('Select a driver with an unambiguous account');
    const driver = candidates[0];
    const driverName = driver?.name || driverRef;

    if (!driver) {
      throw new BadRequestException(`Driver "${driverName}" not found`);
    }

    if (requester?.role === 'fleet-manager' && driver.fleetManagerId !== requester.userId) {
      throw new NotFoundException(`Driver "${driverName}" not found`);
    }

    const account = this.store.users.find(u => u.id === driver.id && u.role === 'driver');
    if (!onShift(driver.id) || !account || !['available','active','on duty'].includes(account.status.toLowerCase()) ||
        driverStatus(driver.status, false) !== 'Available') {
      throw new BadRequestException(`Driver "${driverName}" is not available for assignment`);
    }

    const conflictingTrip = this.store.trips.find(t => t.id !== id &&
      (t.driverId ? t.driverId === driver.id : t.driver === driverName && t.fleetManagerId === driver.fleetManagerId) && reservesDriver(t));
    if (conflictingTrip) {
      throw new BadRequestException(`Driver "${driverName}" already has active trip ${conflictingTrip.id}`);
    }

    const load = this.store.deliveryRequests.find((item) => item.id === this.store.trips[idx].request);
    const weight = Number((load as any)?.weight || load?.pricing?.actualWeightKg || 0);
    const cargo = { ...load, weight, routeId: (load as any)?.routeId, refrigerated: (load as any)?.refrigerated };
    const occupied = new Set(this.store.trips.filter(t => t.id !== id && reservesDriver(t) &&
      t.fleetManagerId === driver.fleetManagerId).map(t => t.vehicle));
    const vehicles = this.store.vehicles.filter(v => !occupied.has(v.plate) && fitsVehicle(v, cargo) &&
      (v.status.toLowerCase() === 'active' || (v.plate === previousTrip.vehicle &&
        v.fleetManagerId === previousTrip.fleetManagerId && v.status === 'On Trip')));
    const assignedVehicle = dispatchVehicle(driver, vehicles, this.store.drivers);
    if (!assignedVehicle) {
      throw new BadRequestException(`No active available vehicle can be paired with driver "${driverName}"`);
    }
    if (previousTrip.driverId !== driver.id) {
      driver.lastAssignedAt = new Date().toISOString();
      this.store.persistDrivers();
    }

    this.store.trips[idx].driver = driverName;
    this.store.trips[idx].driverId = driver.id;
    this.store.trips[idx].fleetManagerId = driver.fleetManagerId;
    this.store.trips[idx].status = 'Assigned';
    (this.store.trips[idx] as any).updatedAt = new Date().toISOString();
    (this.store.trips[idx] as any).statusHistory = Array.isArray((this.store.trips[idx] as any).statusHistory)
      ? (this.store.trips[idx] as any).statusHistory
      : [];
    (this.store.trips[idx] as any).statusHistory.push({
      status: 'Assigned',
      at: (this.store.trips[idx] as any).updatedAt,
      actor: requester?.userId || driverName,
      source: requester?.role || 'fleet-manager',
    });

    if (driver) {
      this.store.trips[idx].phone = driver.phone || '';
      this.store.trips[idx].vehicle = assignedVehicle.plate;
      (this.store.trips[idx] as any).vehicleType = assignedVehicle.type || '';
    }

    const requestId = this.store.trips[idx].request;

    if (requestId) {
      const deliveryIndex = this.store.deliveryRequests.findIndex((d) => d.id === requestId);

      if (deliveryIndex >= 0) {
        (this.store.deliveryRequests[deliveryIndex] as any).driver = driverName;
        (this.store.deliveryRequests[deliveryIndex] as any).assignedDriver = driverName;
        this.store.deliveryRequests[deliveryIndex].status = 'Assigned';
        this.store.deliveryRequests[deliveryIndex].fleetManagerId = driver.fleetManagerId;
        this.store.deliveryRequests[deliveryIndex].driverId = driver.id;
        (this.store.deliveryRequests[deliveryIndex] as any).updatedAt = new Date().toISOString();
        (this.store.deliveryRequests[deliveryIndex] as any).statusHistory = Array.isArray(
          (this.store.deliveryRequests[deliveryIndex] as any).statusHistory,
        )
          ? (this.store.deliveryRequests[deliveryIndex] as any).statusHistory
          : [];
        (this.store.deliveryRequests[deliveryIndex] as any).statusHistory.push({
          status: 'Assigned',
          at: (this.store.deliveryRequests[deliveryIndex] as any).updatedAt,
          actor: requester?.userId || driverName,
          source: requester?.role || 'fleet-manager',
        });
        this.store.persistDeliveries();
      }
    }

    const reassignedDriverUser: any = this.store.users.find(
      (u: any) => u.role === 'driver' && u.id === driver.id,
    );

    if (reassignedDriverUser?.id) this.store.notifications.push({
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
    if (previousTrip.vehicle !== assignedVehicle.plate || previousTrip.fleetManagerId !== driver.fleetManagerId) {
      this.syncVehicleStatus({ ...previousTrip, status: 'Released' });
    }
    this.syncVehicleStatus(this.store.trips[idx]);

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
  const fleetManagerId = trip.fleetManagerId;
  const rateCard = this.payoutsService.getEffectiveCustomerRateCard(fleetManagerId);
  const baseCost = rupees(paise(rateCard.baseFare) + paise(rateCard.perKm, distanceNumber || 0) + paise(rateCard.perKg, weightNumber || 0));
  const taxAmount = 0;

  const totalAmount = trip.disputeResolution?.resolvedAmount ?? delivery.pricing?.total ?? baseCost + taxAmount;

  const invoice = {
    id: `INV-${deliveryId}`,
    invoiceId: `INV-${deliveryId}`,
    deliveryId: deliveryId,
    userId: delivery.clientUserId,
    fleetManagerId,

    client: delivery.customer || 'Business Client',
    address: (delivery as any).address || (delivery as any).clientAddress || (delivery as any).billingAddress || '',

    invoiceDate: invoiceDate,
    date: invoiceDate,
    dueDate: dueDate,

    driver: trip.driver || delivery.driver || 'Not assigned',
    pickup: trip.pickup || delivery.pickup || '',
    dropoff: trip.destination || delivery.dropoff || '',
    distance: trip.distance || 'Distance not available',

    baseCost: totalAmount - taxAmount,
    pricing: delivery.pricing,
    taxAmount: taxAmount,
    tax: taxAmount,
    totalAmount: totalAmount,
    total: totalAmount,
    amount: totalAmount,
    rateCardSnapshot: {
      type: 'customer-pricing',
      ownerId: delivery.pricing?.rateCardOwnerId || rateCard.ownerId,
      baseFare: delivery.pricing?.baseFare ?? rateCard.baseFare,
      perKm: delivery.pricing?.perKm ?? (delivery.pricing ? 0 : rateCard.perKm),
      perKg: delivery.pricing?.perKg ?? rateCard.perKg,
    },

    status: totalAmount === 0 ? 'Paid' : 'Unpaid',
    paymentStatus: totalAmount === 0 ? 'Paid' : 'Pending',

    createdAt: now.toISOString(),
  };

  this.store.invoices.push(invoice as any);
  this.store.persistInvoices();

  const { clientUserId } = this.findTripNotificationRecipients(trip);
  if (clientUserId) this.store.notifications.push({
    id: `N-${Date.now()}`,
    title: 'Invoice generated',
    message: `Invoice ${invoice.id} has been generated for delivery ${deliveryId}.`,
    time: 'Just now',
    to: 'business-client',
    toUserId: clientUserId,
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
      returning: 'Returning',
      returned: 'Returned',
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
      pending: ['accepted', 'rejected'],
      accepted: ['picked up', 'rejected'],
      'picked up': ['in transit'],
      'in transit': ['completed'],
      'attempt failed': ['in transit', 'returning'],
      returning: ['returned'],
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
    completion?: { parcelBarcode?: string; recipient?: string; notes?: string; proofDocumentId?: string; deliveryOtp?: string },
  ): Trip {
    const tripIndex = this.store.trips.findIndex((t) => t.id === id);

    if (tripIndex < 0) {
      throw new NotFoundException(`Trip "${id}" not found`);
    }

    const trip = this.store.trips[tripIndex];
    this.assertDriverOwnsTrip(trip, requester);
    const nextStatus = this.canonicalStatus(status);
    if (trip.status === 'Attempt Failed' && requester?.role !== 'fleet-manager') throw new ForbiddenException('Your fleet manager must choose another attempt or return');
    if (requester?.role === 'fleet-manager') this.findOne(id, requester);
    this.assertValidTransition(trip, nextStatus);

    if (String(trip.status).toLowerCase().trim() === nextStatus.toLowerCase()) {
      return trip;
    }

    if (nextStatus === 'Picked Up' || nextStatus === 'Completed') {
      const parcel = this.store.deliveryRequests.find((d) => d.id === trip.request);
      if (parcel?.parcelBarcode && parcel.parcelBarcode !== completion?.parcelBarcode?.trim()) {
        throw new BadRequestException('Scan the matching parcel label before confirming custody');
      }
    }
    let proofDocument: any = null;
    let otpDelivery: any = null;
    if (nextStatus === 'Completed') {
      if (Date.parse((trip as any).retryAt) > Date.now()) throw new BadRequestException('The second attempt is scheduled for later');
      otpDelivery = this.store.deliveryRequests.find((item) => item.id === trip.request);
      if (!otpDelivery) throw new BadRequestException('The linked delivery request could not be found');
      if ((otpDelivery.recipientEmail || otpDelivery.recipientPhone) && completion?.recipient?.trim() !== otpDelivery.contact) {
        throw new BadRequestException('Recipient must match the booking');
      }
      const otpResult = checkDeliveryOtp(otpDelivery, completion?.deliveryOtp || '');
      if (!otpResult.valid) {
        this.store.persistDeliveries();
        throw new BadRequestException(otpResult.message);
      }
      if (!completion?.recipient?.trim() || !completion?.proofDocumentId) {
        throw new BadRequestException('Recipient name and uploaded proof document are required to complete a delivery');
      }
      if (!requester) throw new ForbiddenException('Assigned driver is required');
      proofDocument = this.documentsService.findOne(completion.proofDocumentId, requester);
      const expectedDeliveryId = String(trip.request || trip.id);
      if (
        proofDocument.uploadedBy !== requester?.userId || proofDocument.ownerType !== 'delivery' ||
        String(proofDocument.delivery || '') !== expectedDeliveryId ||
        proofDocument.documentType !== 'Proof of Delivery' ||
        !proofDocument.fileUrl
      ) {
        throw new BadRequestException('Proof must contain an uploaded file linked to this delivery');
      }
    }

    if (nextStatus === 'Accepted') {
      const driverName = trip.driver;
      if (!driverName) {
        throw new BadRequestException('This trip must be assigned by a fleet manager before it can be accepted');
      }
      (trip as any).driverRateCard = {...this.payoutsService.getEffectiveRateCard(trip.fleetManagerId)};
      const activeTrip = this.findActiveTripForDriver(trip);

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
    if (nextStatus === 'In Transit') {
      (trip as any).inTransitAt = changedAt;
      const parcel = this.store.deliveryRequests.find(d => d.id === trip.request);
      const route = serviceRoutes.find(r => r.id === (parcel as any)?.routeId);
      if (route?.transitMinutes) {
        const arrival = new Date(Math.max(Date.parse((trip as any).retryAt || changedAt), Date.parse(changedAt)) + route.transitMinutes * 60000);
        (trip as any).eta = arrival.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'}) + ' IST (route estimate)';
        if (parcel) (parcel as any).eta = (trip as any).eta;
      }
    }
    if (nextStatus === 'Completed') (trip as any).completedAt = changedAt;
    if (nextStatus === 'Completed') {
      markDeliveryOtpUsed(otpDelivery, new Date(changedAt));
      (trip as any).proofOfDelivery = {
        recipient: completion!.recipient!.trim(),
        notes: completion?.notes?.trim() || '',
        documentId: proofDocument.id,
        fileUrl: proofDocument.fileUrl || '',
        submittedAt: changedAt,
      };
      this.documentsService.acceptHandoffProof(proofDocument.id, trip.request!, requester!);
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
          if (trip.disputeResolution?.resolvedAmount === 0) this.payoutsService.approveForDelivery(trip.request);
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

    if (driverUserId) this.store.notifications.push({
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

    this.notifyOperations(trip, `Delivery ${nextStatus}`, `Trip ${id} was marked as ${nextStatus}.`);
    this.store.persistNotifications();
    this.syncVehicleStatus(this.store.trips[tripIndex]);

    return this.store.trips[tripIndex];
  }

  reportIssue(
    id: string,
    body: {
      issueType?: string;
      evidenceId?: string;
      description?: string;
      status?: string;
    },
    requester?: { userId: string; role: string },
  ): Trip {
    const tripIndex = this.store.trips.findIndex((t) => t.id === id);

    if (tripIndex < 0) {
      throw new NotFoundException(`Trip "${id}" not found`);
    }

    this.findOne(id, requester);

    const currentStatus = String(this.store.trips[tripIndex].status || '').toLowerCase().trim();
    if (currentStatus === 'issue reported') {
      throw new BadRequestException('This trip already has a saved issue report. View it in History.');
    }
    if (!['accepted', 'picked up', 'in transit'].includes(currentStatus)) {
      throw new BadRequestException('Issues can only be reported after a trip is accepted and before it is completed');
    }

    const issueType = body.issueType || 'General Issue';
    const failedHandoff = issueType === 'Failed delivery attempt';
    if (failedHandoff && (currentStatus !== 'in transit' || !body.description?.trim())) {
      throw new BadRequestException('Report the reason for a failed attempt while the parcel is in transit');
    }
    if (failedHandoff) {
      if (!body.evidenceId) throw new BadRequestException('Attach evidence for the failed handoff');
      const doc = this.documentsService.findOne(body.evidenceId, requester);
      if (doc.delivery !== this.store.trips[tripIndex].request || doc.uploadedBy !== requester?.userId || doc.documentType !== 'Issue Evidence') {
        throw new BadRequestException('Attach evidence from this driver and delivery');
      }
    }
    const issueStatus = failedHandoff ? 'Attempt Failed' : 'Issue Reported';
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
      reason: issueDescription, evidenceId: body.evidenceId,
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
        if (failedHandoff) delete this.store.deliveryRequests[deliveryIndex].deliveryOtpHash;
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
          reason: issueDescription, evidenceId: body.evidenceId,
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
    this.syncVehicleStatus(this.store.trips[tripIndex]);

    return this.store.trips[tripIndex];
  }

  addNote(id: string, text: string, requester?: { userId: string; role: string }): Trip {
    const tripIndex = this.store.trips.findIndex((t) => t.id === id);

    if (tripIndex < 0) {
      throw new NotFoundException(`Trip "${id}" not found`);
    }

    this.findOne(id, requester);

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
    this.findOne(id, requester);
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

    if (!reason?.trim() || !Number.isFinite(resolvedAmount) || Number(resolvedAmount.toFixed(2)) !== resolvedAmount || resolvedAmount < 0 || resolvedAmount > (trip.amount ?? 0)) {
      throw new BadRequestException('Enter a reason and an amount between zero and the original charge, in whole paise');
    }

    if (trip.disputeResolution) {
      if (trip.disputeResolution.resolvedAmount === resolvedAmount && trip.disputeResolution.reason === reason.trim()) return trip;
      throw new BadRequestException('This dispute already has a recorded resolution');
    }
    trip.disputeResolution = {
      resolvedAmount,
      resolvedBy: requester?.userId || 'system',
      resolvedAt: new Date().toISOString(),
      reason: reason.trim(),
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
