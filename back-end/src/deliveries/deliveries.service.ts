import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  DataStoreService,
  DeliveryRequest,
  Trip,
} from '../data-store/data-store.service';
import { CreateDeliveryDto, PACKAGE_TYPES } from './dto/delivery.dto';

@Injectable()
export class DeliveriesService {
  constructor(private readonly store: DataStoreService) {}

  findAll(
    search?: string,
    statusFilter?: string,
    requester?: { userId: string; role: string },
  ): DeliveryRequest[] {
    let items = [...this.store.deliveryRequests];

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

      items = items.filter((r: any) => {
        const field =
          requester.role === 'driver'
            ? String(r.driver || r.assignedDriver || '')
            : String(r.customer || r.client || r.company || '');
        const normalized = field.toLowerCase().trim();
        return ownNames.some((name) => normalized === name || normalized.includes(name) || name.includes(normalized));
      });
    }

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

  findOne(id: string): DeliveryRequest {
    const item = this.store.deliveryRequests.find((r) => r.id === id);

    if (!item) {
      throw new NotFoundException(`Delivery request "${id}" not found`);
    }

    return item;
  }

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

  private generateTripIdFromDelivery(deliveryId: string): string {
    return `TRP-${deliveryId.replace('DR-', '')}`;
  }

  private getDefaultDriverName(): string {
    return 'Raghav Reddy';
  }

  private findDeliveryNotificationRecipients(delivery: DeliveryRequest): { clientUserId?: string; driverUserId?: string } {
    const customerName = String((delivery as any).customer || (delivery as any).client || '').toLowerCase().trim();

    const clientUser: any = this.store.users.find((u: any) => {
      if (u.role !== 'business-client') return false;
      const names = [u.name, u.companyName, u.company, u.profileDetails?.companyName]
        .filter(Boolean)
        .map((v: string) => String(v).toLowerCase().trim());
      return names.includes(customerName);
    });

    const driverName = String((delivery as any).driver || (delivery as any).assignedDriver || '').toLowerCase().trim();

    const driverUser: any = driverName
      ? this.store.users.find(
          (u: any) => u.role === 'driver' && String(u.name || '').toLowerCase().trim() === driverName,
        )
      : null;

    return { clientUserId: clientUser?.id, driverUserId: driverUser?.id };
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

    const packageType = dto.packageType || '';
    if (!packageType || !(PACKAGE_TYPES as readonly string[]).includes(packageType)) {
      throw new BadRequestException(
        `Invalid packageType "${packageType}". Allowed: ${PACKAGE_TYPES.join(', ')}`,
      );
    }

    const rawDims = dto.packageDimensions;
    if (!rawDims || typeof rawDims !== 'object') {
      throw new BadRequestException('packageDimensions is required');
    }

    const length = Number(rawDims.length);
    const width = Number(rawDims.width);
    const height = Number(rawDims.height);
    const unit = rawDims.unit || 'cm';

    if (!length || length <= 0 || length > 1000 || Number.isNaN(length)) {
      throw new BadRequestException('packageDimensions.length must be > 0 and <= 1000');
    }
    if (!width || width <= 0 || width > 1000 || Number.isNaN(width)) {
      throw new BadRequestException('packageDimensions.width must be > 0 and <= 1000');
    }
    if (!height || height <= 0 || height > 1000 || Number.isNaN(height)) {
      throw new BadRequestException('packageDimensions.height must be > 0 and <= 1000');
    }
    if (unit !== 'cm') {
      throw new BadRequestException('packageDimensions.unit must be "cm"');
    }

    const packageDimensions = { length, width, height, unit };

    const packageName =
      `${packageType} — ${length} × ${width} × ${height} ${unit}`;

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
      packageType,
      packageDimensions,
      weight,
      instructions,
      type,
      priority,
      items,
      eta,
      distance,
    };
  }

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

    (tripData as any).customer =
      (delivery as any).customer ||
      (delivery as any).client ||
      (delivery as any).company ||
      'Customer not available';

    (tripData as any).package =
      (delivery as any).package ||
      (delivery as any).item ||
      'Package';

    if ((delivery as any).packageType) {
      (tripData as any).packageType = (delivery as any).packageType;
    }
    if ((delivery as any).packageDimensions) {
      (tripData as any).packageDimensions = (delivery as any).packageDimensions;
    }

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
      packageType: normalized.packageType,
      packageDimensions: normalized.packageDimensions,
      type: normalized.type,

      requestTime: new Date().toLocaleString(),

      status: 'Queued',

      priority: normalized.priority,
      items: normalized.items,

      driver: defaultDriverName,
    } as DeliveryRequest;

    (delivery as any).client = normalized.customer;
    (delivery as any).company = normalized.customer;

    (delivery as any).from = normalized.pickup;
    (delivery as any).source = normalized.pickup;
    (delivery as any).pickupAddress = normalized.pickup;

    (delivery as any).to = normalized.dropoff;
    (delivery as any).destination = normalized.dropoff;
    (delivery as any).dropAddress = normalized.dropoff;

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

    const assignedDriverUser: any = this.store.users.find(
      (u: any) => u.role === 'driver' && String(u.name || '').toLowerCase() === defaultDriverName.toLowerCase(),
    );
    const owningClientUser: any = this.store.users.find((u: any) => {
      if (u.role !== 'business-client') return false;
      const names = [u.name, u.companyName, u.company, u.profileDetails?.companyName]
        .filter(Boolean)
        .map((v: string) => String(v).toLowerCase().trim());
      return names.includes(String(normalized.customer || '').toLowerCase().trim());
    });

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
      toUserId: assignedDriverUser?.id,
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
      toUserId: owningClientUser?.id,
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

    const { driverUserId: feedbackDriverId } = this.findDeliveryNotificationRecipients(this.store.deliveryRequests[index]);

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Feedback submitted',
      message: `Feedback submitted for delivery ${id}. Rating: ${feedback.rating}/5.`,
      time: 'Just now',
      to: 'fleet-manager',
      read: false,
      createdAt: new Date().toISOString(),
    });

    if (feedbackDriverId) {
      this.store.notifications.push({
        id: `N-${Date.now() + 1}`,
        title: 'You received feedback',
        message: `A customer left feedback for delivery ${id}. Rating: ${feedback.rating}/5.`,
        time: 'Just now',
        to: 'driver',
        toUserId: feedbackDriverId,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    this.store.persistNotifications();

    return this.store.deliveryRequests[index];
  }

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

    const { clientUserId: blockClientId, driverUserId: blockDriverId } = this.findDeliveryNotificationRecipients(this.store.deliveryRequests[idx]);

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Delivery Request Blocked',
      message: `Delivery request ${id} was blocked. Reason: ${reason}`,
      time: 'Just now',
      to: 'business-client',
      toUserId: blockClientId,
      read: false,
      createdAt: new Date().toISOString(),
    });

    if (blockDriverId) {
      this.store.notifications.push({
        id: `N-${Date.now() + 1}`,
        title: 'Trip Blocked',
        message: `Trip for delivery ${id} was blocked. Reason: ${reason}`,
        time: 'Just now',
        to: 'driver',
        toUserId: blockDriverId,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    this.store.persistNotifications();

    return this.store.deliveryRequests[idx];
  }

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

    const { clientUserId: unblockClientId, driverUserId: unblockDriverId } = this.findDeliveryNotificationRecipients(this.store.deliveryRequests[idx]);

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Delivery Request Unblocked',
      message: `Delivery request ${id} was unblocked. Reason: ${reason}`,
      time: 'Just now',
      to: 'business-client',
      toUserId: unblockClientId,
      read: false,
      createdAt: new Date().toISOString(),
    });

    if (unblockDriverId) {
      this.store.notifications.push({
        id: `N-${Date.now() + 1}`,
        title: 'Trip Unblocked',
        message: `Trip for delivery ${id} was unblocked and is queued again. Reason: ${reason}`,
        time: 'Just now',
        to: 'driver',
        toUserId: unblockDriverId,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    this.store.persistNotifications();

    return this.store.deliveryRequests[idx];
  }

  cancel(id: string, reason?: string): DeliveryRequest {
    const idx = this.store.deliveryRequests.findIndex((r) => r.id === id);

    if (idx < 0) {
      throw new NotFoundException(`Delivery request "${id}" not found`);
    }

    const paidInvoice = (this.store.invoices as any[]).find(
      (inv) =>
        (inv.deliveryId === id || inv.request === id) &&
        String(inv.status || inv.paymentStatus || '').toLowerCase() === 'paid',
    );

    if (paidInvoice) {
      throw new BadRequestException(
        `Delivery "${id}" cannot be cancelled because invoice ${paidInvoice.id} has already been paid. Process a refund before cancelling.`,
      );
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

    const { clientUserId: cancelClientId, driverUserId: cancelDriverId } = this.findDeliveryNotificationRecipients(this.store.deliveryRequests[idx]);

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Delivery Cancelled',
      message: `Delivery ${id} was cancelled. ${
        reason ? `Reason: ${reason}` : ''
      }`,
      time: 'Just now',
      to: 'business-client',
      toUserId: cancelClientId,
      read: false,
      createdAt: new Date().toISOString(),
    });

    if (cancelDriverId) {
      this.store.notifications.push({
        id: `N-${Date.now() + 1}`,
        title: 'Trip Cancelled',
        message: `Trip for delivery ${id} was cancelled. ${reason ? `Reason: ${reason}` : ''}`,
        time: 'Just now',
        to: 'driver',
        toUserId: cancelDriverId,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    this.store.persistNotifications();

    return this.store.deliveryRequests[idx];
  }
}