import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  DataStoreService,
  DeliveryRequest,
  Trip,
} from '../data-store/data-store.service';
import { CreateDeliveryDto } from './dto/delivery.dto';

@Injectable()
export class DeliveriesService {
  constructor(private readonly store: DataStoreService) {}

  // --------------------------------------------------
  // GET ALL DELIVERIES
  // --------------------------------------------------
  findAll(search?: string, statusFilter?: string): DeliveryRequest[] {
    let items = [...this.store.deliveryRequests];

    if (statusFilter && statusFilter !== 'all') {
      items = items.filter((r) =>
        String(r.status || '')
          .toLowerCase()
          .includes(statusFilter.toLowerCase()),
      );
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
    }

    return items;
  }

  // --------------------------------------------------
  // GET ONE DELIVERY
  // --------------------------------------------------
  findOne(id: string): DeliveryRequest {
    const item = this.store.deliveryRequests.find((r) => r.id === id);

    if (!item) {
      throw new NotFoundException(`Delivery request "${id}" not found`);
    }

    return item;
  }

  // --------------------------------------------------
  // UNIQUE DELIVERY ID GENERATOR
  // Creates DR-2026-001, DR-2026-002, ...
  // --------------------------------------------------
  private generateDeliveryId(): string {
    const year = new Date().getFullYear();

    const existingNumbers = this.store.deliveryRequests
      .map((d: any) => String(d.id || ''))
      .filter((id) => id.startsWith(`DR-${year}-`))
      .map((id) => Number(id.split('-').pop()))
      .filter((num) => !Number.isNaN(num));

    const nextNumber = existingNumbers.length
      ? Math.max(...existingNumbers) + 1
      : 1;

    return `DR-${year}-${String(nextNumber).padStart(3, '0')}`;
  }

  // --------------------------------------------------
  // UNIQUE TRIP ID FROM DELIVERY ID
  // DR-2026-001 -> TRP-2026-001
  // --------------------------------------------------
  private generateTripIdFromDelivery(deliveryId: string): string {
    return `TRP-${deliveryId.replace('DR-', '')}`;
  }

  // --------------------------------------------------
  // DEFAULT DRIVER FOR NEW FLOW
  // --------------------------------------------------
  private getDefaultDriverName(): string {
    return 'Raghav Reddy';
  }

  private findDefaultDriver() {
    const defaultDriverName = this.getDefaultDriverName();

    return (
      this.store.drivers.find(
        (d: any) =>
          String(d.name || '').toLowerCase() ===
          defaultDriverName.toLowerCase(),
      ) || null
    );
  }

  // --------------------------------------------------
  // NORMALIZE DELIVERY INPUT
  // Supports many frontend field names
  // --------------------------------------------------
  private normalizeDeliveryInput(dto: any) {
    const pickup =
      dto.pickup ||
      dto.from ||
      dto.pickupAddress ||
      dto.source ||
      dto.origin ||
      '';

    const dropoff =
      dto.dropoff ||
      dto.destination ||
      dto.to ||
      dto.dropAddress ||
      dto.drop ||
      '';

    const customer =
      dto.customer ||
      dto.client ||
      dto.customerName ||
      dto.company ||
      dto.businessName ||
      'Customer not available';

    const contact =
      dto.contact ||
      dto.contactPerson ||
      dto.fullName ||
      customer ||
      '--';

    const packageName =
      dto.package ||
      dto.packageType ||
      dto.item ||
      dto.goods ||
      dto.description ||
      'Package';

    const weight =
      dto.weight ||
      dto.estimatedWeight ||
      dto.packageWeight ||
      '';

    const instructions =
      dto.instructions ||
      dto.notes ||
      dto.deliveryNotes ||
      'Handle package carefully.';

    const type = dto.type || dto.deliveryType || 'Standard';
    const priority = dto.priority || 'Medium';
    const items = Number(dto.items || dto.quantity || 1);

    const eta = dto.eta || dto.estimatedTime || '35 mins';
    const distance = dto.distance || 'Distance not available';

    return {
      pickup,
      dropoff,
      customer,
      contact,
      packageName,
      weight,
      instructions,
      type,
      priority,
      items,
      eta,
      distance,
    };
  }

  // --------------------------------------------------
  // CREATE OR SYNC TRIP FOR DELIVERY
  // --------------------------------------------------
  private createOrSyncTripForDelivery(delivery: DeliveryRequest): Trip {
    const defaultDriverName = this.getDefaultDriverName();
    const driver = this.findDefaultDriver();

    const tripId = this.generateTripIdFromDelivery(delivery.id);

    const existingTripIndex = this.store.trips.findIndex(
      (trip: any) =>
        String(trip.request) === String(delivery.id) ||
        String(trip.id) === String(tripId),
    );

    const tripData: Trip = {
      id: tripId,
      assignment:
        existingTripIndex >= 0
          ? this.store.trips[existingTripIndex].assignment
          : `ASN-${Date.now()}`,

      driver: defaultDriverName,
      phone: driver?.phone || '+91 9440011223',
      vehicle:
        (driver as any)?.vehicle ||
        (driver as any)?.vehicleNumber ||
        (driver as any)?.assignedVehicle ||
        'TN09AB1234',
      vehicleType: (driver as any)?.vehicleType || 'Tempo',

      pickup:
        (delivery as any).pickup ||
        (delivery as any).from ||
        (delivery as any).pickupAddress ||
        'Pickup not available',

      destination:
        (delivery as any).dropoff ||
        (delivery as any).destination ||
        (delivery as any).to ||
        (delivery as any).dropAddress ||
        'Destination not available',

      startTime:
        (delivery as any).requestTime ||
        (delivery as any).createdAt ||
        new Date().toLocaleString(),

      distance:
        (delivery as any).distance ||
        'Distance not available',

      status:
        (delivery as any).status === 'Blocked'
          ? 'Blocked'
          : (delivery as any).status === 'Cancelled'
            ? 'Cancelled'
            : (delivery as any).status === 'Delivered'
              ? 'Completed'
              : (delivery as any).status === 'Completed'
                ? 'Completed'
                : 'Queued',

      request: delivery.id,
    } as Trip;

    // Extra frontend-compatible fields
    (tripData as any).customer =
      (delivery as any).customer ||
      (delivery as any).client ||
      (delivery as any).company ||
      'Customer not available';

    (tripData as any).package =
      (delivery as any).package ||
      (delivery as any).packageType ||
      (delivery as any).item ||
      'Package';

    (tripData as any).weight =
      (delivery as any).weight ||
      (delivery as any).estimatedWeight ||
      '';

    (tripData as any).instructions =
      (delivery as any).instructions ||
      (delivery as any).notes ||
      'Handle package carefully.';

    (tripData as any).eta = (delivery as any).eta || '35 mins';

    (tripData as any).createdAt =
      existingTripIndex >= 0
        ? (this.store.trips[existingTripIndex] as any).createdAt ||
          new Date().toISOString()
        : new Date().toISOString();

    (tripData as any).updatedAt = new Date().toISOString();

    if ((delivery as any).feedback) {
      (tripData as any).feedback = (delivery as any).feedback;
      (tripData as any).feedbackSubmitted = true;
    }

    if (existingTripIndex >= 0) {
      this.store.trips[existingTripIndex] = {
        ...this.store.trips[existingTripIndex],
        ...tripData,
      };
    } else {
      this.store.trips.push(tripData);
    }

    this.store.persistTrips();

    return existingTripIndex >= 0
      ? this.store.trips[existingTripIndex]
      : tripData;
  }

  // --------------------------------------------------
  // CREATE DELIVERY - NEW FLOW
  // --------------------------------------------------
  create(dto: CreateDeliveryDto): DeliveryRequest {
    const id = this.generateDeliveryId();
    const normalized = this.normalizeDeliveryInput(dto as any);
    const defaultDriverName = this.getDefaultDriverName();
    const createdAt = new Date().toISOString();

    const delivery: DeliveryRequest = {
      id,

      customer: normalized.customer,
      contact: normalized.contact,

      pickup: normalized.pickup,
      dropoff: normalized.dropoff,

      package: normalized.packageName,
      type: normalized.type,

      requestTime: new Date().toLocaleString(),

      // Queued means visible in Driver Portal and ready to accept/reject.
      status: 'Queued',

      priority: normalized.priority,
      items: normalized.items,

      // Directly assign to Raghav.
      driver: defaultDriverName,
    } as DeliveryRequest;

    // Extra compatible fields for all portals
    (delivery as any).client = normalized.customer;
    (delivery as any).company = normalized.customer;

    (delivery as any).from = normalized.pickup;
    (delivery as any).source = normalized.pickup;
    (delivery as any).pickupAddress = normalized.pickup;

    (delivery as any).to = normalized.dropoff;
    (delivery as any).destination = normalized.dropoff;
    (delivery as any).dropAddress = normalized.dropoff;

    (delivery as any).packageType = normalized.packageName;
    (delivery as any).item = normalized.packageName;

    (delivery as any).weight = normalized.weight;
    (delivery as any).estimatedWeight = normalized.weight;

    (delivery as any).instructions = normalized.instructions;
    (delivery as any).notes = normalized.instructions;

    (delivery as any).eta = normalized.eta;
    (delivery as any).distance = normalized.distance;

    (delivery as any).assignedDriver = defaultDriverName;
    (delivery as any).createdAt = createdAt;
    (delivery as any).updatedAt = createdAt;

    this.store.deliveryRequests.push(delivery);
    this.store.persistDeliveries();

    const trip = this.createOrSyncTripForDelivery(delivery);

    const now = new Date().toISOString();

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'New delivery created',
      message: `Delivery ${id} has been created and directly assigned to ${defaultDriverName}.`,
      time: 'Just now',
      to: 'superuser',
      read: false,
      createdAt: now,
    });

    this.store.notifications.push({
      id: `N-${Date.now() + 1}`,
      title: 'New delivery assigned',
      message: `Delivery ${id} is now available in your driver dashboard.`,
      time: 'Just now',
      to: 'driver',
      read: false,
      createdAt: now,
    });

    this.store.notifications.push({
      id: `N-${Date.now() + 2}`,
      title: 'Trip auto-created',
      message: `Trip ${trip.id} was automatically created for delivery ${id}.`,
      time: 'Just now',
      to: 'fleet-manager',
      read: false,
      createdAt: now,
    });

    this.store.notifications.push({
      id: `N-${Date.now() + 3}`,
      title: 'Delivery request created',
      message: `Your delivery ${id} has been created and assigned to a driver.`,
      time: 'Just now',
      to: 'business-client',
      read: false,
      createdAt: now,
    });

    this.store.persistNotifications();

    return {
      ...delivery,
      tripId: trip.id,
      message: 'Delivery created and automatically assigned to driver portal',
    } as any;
  }

  // --------------------------------------------------
  // SUBMIT FEEDBACK
  // Syncs deliveries.json + trips.json + notifications.json
  // --------------------------------------------------
  submitFeedback(
    id: string,
    body: {
      rating: number;
      comment?: string;
      deliveryQuality?: string;
      driverBehavior?: string;
      overallExperience?: string;
    },
  ): DeliveryRequest {
    const index = this.store.deliveryRequests.findIndex((d) => d.id === id);

    if (index < 0) {
      throw new NotFoundException(`Delivery request "${id}" not found`);
    }

    const rating = Number(body?.rating);

    if (!rating || rating < 1 || rating > 5) {
      throw new BadRequestException('rating must be between 1 and 5');
    }

    const feedback = {
      rating,
      comment: body.comment || '',
      deliveryQuality: body.deliveryQuality || '',
      driverBehavior: body.driverBehavior || '',
      overallExperience: body.overallExperience || '',
      submittedAt: new Date().toISOString(),
    };

    (this.store.deliveryRequests[index] as any).feedback = feedback;
    (this.store.deliveryRequests[index] as any).feedbackSubmitted = true;
    (this.store.deliveryRequests[index] as any).updatedAt =
      new Date().toISOString();

    this.store.persistDeliveries();

    const linkedTripIndex = this.store.trips.findIndex(
      (trip) => trip.request === id,
    );

    if (linkedTripIndex >= 0) {
      (this.store.trips[linkedTripIndex] as any).feedback = feedback;
      (this.store.trips[linkedTripIndex] as any).feedbackSubmitted = true;
      (this.store.trips[linkedTripIndex] as any).updatedAt =
        new Date().toISOString();

      this.store.persistTrips();
    }

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Feedback submitted',
      message: `Feedback submitted for delivery ${id}. Rating: ${feedback.rating}/5.`,
      time: 'Just now',
      to: 'all',
      read: false,
      createdAt: new Date().toISOString(),
    });

    this.store.persistNotifications();

    return this.store.deliveryRequests[index];
  }

  // --------------------------------------------------
  // BLOCK DELIVERY
  // --------------------------------------------------
  block(id: string, reason: string): DeliveryRequest {
    const idx = this.store.deliveryRequests.findIndex((r) => r.id === id);

    if (idx < 0) {
      throw new NotFoundException(`Delivery request "${id}" not found`);
    }

    if (this.store.deliveryRequests[idx].status === 'Blocked') {
      throw new BadRequestException(`Delivery "${id}" is already blocked`);
    }

    this.store.deliveryRequests[idx].status = 'Blocked';
    this.store.deliveryRequests[idx].blockReason = reason;
    (this.store.deliveryRequests[idx] as any).updatedAt =
      new Date().toISOString();

    this.store.persistDeliveries();

    const trip = this.store.trips.find((t) => t.request === id);

    if (trip) {
      trip.status = 'Blocked';
      (trip as any).blockReason = reason;
      (trip as any).updatedAt = new Date().toISOString();
      this.store.persistTrips();
    }

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Delivery Request Blocked',
      message: `Delivery request ${id} was blocked. Reason: ${reason}`,
      time: 'Just now',
      to: 'all',
      read: false,
      createdAt: new Date().toISOString(),
    });

    this.store.persistNotifications();

    return this.store.deliveryRequests[idx];
  }

  // --------------------------------------------------
  // UNBLOCK DELIVERY
  // --------------------------------------------------
  unblock(id: string, reason: string): DeliveryRequest {
    const idx = this.store.deliveryRequests.findIndex((r) => r.id === id);

    if (idx < 0) {
      throw new NotFoundException(`Delivery request "${id}" not found`);
    }

    if (this.store.deliveryRequests[idx].status !== 'Blocked') {
      throw new BadRequestException(`Delivery "${id}" is not blocked`);
    }

    const defaultDriverName = this.getDefaultDriverName();

    this.store.deliveryRequests[idx].status = 'Queued';
    this.store.deliveryRequests[idx].unblockReason = reason;
    this.store.deliveryRequests[idx].driver = defaultDriverName;
    (this.store.deliveryRequests[idx] as any).assignedDriver =
      defaultDriverName;
    (this.store.deliveryRequests[idx] as any).updatedAt =
      new Date().toISOString();

    this.store.persistDeliveries();

    const trip = this.createOrSyncTripForDelivery(
      this.store.deliveryRequests[idx],
    );

    trip.status = 'Queued';
    trip.driver = defaultDriverName;
    (trip as any).updatedAt = new Date().toISOString();

    this.store.persistTrips();

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Delivery Request Unblocked',
      message: `Delivery request ${id} was unblocked. Reason: ${reason}`,
      time: 'Just now',
      to: 'all',
      read: false,
      createdAt: new Date().toISOString(),
    });

    this.store.persistNotifications();

    return this.store.deliveryRequests[idx];
  }

  // --------------------------------------------------
  // CANCEL DELIVERY
  // --------------------------------------------------
  cancel(id: string, reason?: string): DeliveryRequest {
    const idx = this.store.deliveryRequests.findIndex((r) => r.id === id);

    if (idx < 0) {
      throw new NotFoundException(`Delivery request "${id}" not found`);
    }

    this.store.deliveryRequests[idx].status = 'Cancelled';
    this.store.deliveryRequests[idx].cancelReason = reason || '';
    (this.store.deliveryRequests[idx] as any).updatedAt =
      new Date().toISOString();

    this.store.persistDeliveries();

    const trip = this.store.trips.find((t) => t.request === id);

    if (trip) {
      trip.status = 'Cancelled';
      (trip as any).cancelReason = reason || '';
      (trip as any).updatedAt = new Date().toISOString();
      this.store.persistTrips();
    }

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Delivery Cancelled',
      message: `Delivery ${id} was cancelled. ${
        reason ? `Reason: ${reason}` : ''
      }`,
      time: 'Just now',
      to: 'all',
      read: false,
      createdAt: new Date().toISOString(),
    });

    this.store.persistNotifications();

    return this.store.deliveryRequests[idx];
  }
}