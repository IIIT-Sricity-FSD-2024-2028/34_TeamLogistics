import { dispatchVehicle, driverStatus, onShift, rankDrivers, reservesDriver } from '../common/dispatch';
import { RecipientSmsService } from './recipient-sms.service';
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  DataStoreService,
  DeliveryRequest,
  Trip,
} from '../data-store/data-store.service';
import { CreateDeliveryDto, DeliveryQuoteDto, PACKAGE_TYPES } from './dto/delivery.dto';
import { createHash, randomInt, randomUUID } from 'crypto';
import { ownsFleetAssignment, ownsDriverAssignment } from '../common/fleet-ownership';
import { fitsVehicle, type Cargo } from '../common/vehicle-capacity';
import { deliveryForResponse } from '../common/delivery-response';
import { serviceRoute } from '../common/service-routes';
import { PasswordResetMailerService } from '../auth/password-reset-mailer.service';
import { ServiceUnavailableException } from '@nestjs/common';
import { PayoutsService } from '../payouts/payouts.service';
import { calculateDeliveryPricing, DeliveryPricing } from '../common/delivery-pricing';
import { deliveryOtpForResponse, issueDeliveryOtp as createDeliveryOtp } from '../common/delivery-otp';

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly store: DataStoreService,
    private readonly payoutsService: PayoutsService,
    private readonly mailer: PasswordResetMailerService,
    private readonly sms: RecipientSmsService = new RecipientSmsService(),
  ) {}


  private selectAssignment(load: Cargo) {
    const reserved = this.store.trips.filter(reservesDriver);
    const busyDrivers = new Set(reserved.map(trip => trip.driverId));
    const occupied = new Set(reserved.map(trip => trip.fleetManagerId + '|' + trip.vehicle));
    const activeAccounts = new Set(this.store.users.filter(user => user.role === 'driver' &&
      ['active','available','on duty'].includes(user.status.toLowerCase())).map(user => user.id));
    const eligible = this.store.drivers.filter(driver => driver.fleetManagerId && onShift(driver.id) && activeAccounts.has(driver.id) &&
      driverStatus(driver.status, busyDrivers.has(driver.id)) === 'Available');
    const vehicles = this.store.vehicles.filter(v => v.status.toLowerCase() === 'active' &&
      !occupied.has(v.fleetManagerId+'|'+v.plate) && fitsVehicle(v,load));
    const pickup = load.routeId ? serviceRoute(load.routeId).pickupPoint : undefined;
    for (const driver of rankDrivers(eligible,this.store.trips,pickup)) {
      const vehicle = dispatchVehicle(driver, vehicles, this.store.drivers);
      if (vehicle) return {driver,vehicle};
    }
  }

  quote(dto: DeliveryQuoteDto): DeliveryPricing {
    const fleetManagerId = this.selectAssignment(dto)?.driver.fleetManagerId;
    const rateCard = this.payoutsService.getEffectiveCustomerRateCard(fleetManagerId);
    return calculateDeliveryPricing({ ...dto, distanceKm: serviceRoute(dto.routeId).km }, rateCard);
  }

  private businessClientOwnsDelivery(user: any, delivery: DeliveryRequest): boolean {
    return !!user && delivery.clientUserId === user.id;
  }

  private notifyOperations(delivery: DeliveryRequest, title: string, message: string): void {
    const { fleetManagerUserId } = this.findDeliveryNotificationRecipients(delivery);
    for (const role of ['superuser', 'fleet-manager']) {
      if (role === 'fleet-manager' && !fleetManagerUserId) continue;
      this.store.notifications.push({
        id: `N-${randomUUID()}`, title, message, time: 'Just now', to: role,
        toUserId: role === 'fleet-manager' ? fleetManagerUserId : undefined,
        read: false, createdAt: new Date().toISOString(),
      });
    }
  }

  private assertBusinessClientOwnsDelivery(
    delivery: DeliveryRequest,
    requester?: { userId: string; role: string },
  ): void {
    if (!requester || requester.role !== 'business-client') return;
    const user: any = this.store.users.find((item) => item.id === requester.userId);
    if (!this.businessClientOwnsDelivery(user, delivery)) {
      throw new NotFoundException(`Delivery request "${delivery.id}" not found`);
    }
  }

  private assertRequesterCanAccessDelivery(
    delivery: DeliveryRequest,
    requester?: { userId: string; role: string },
  ): void {
    this.assertBusinessClientOwnsDelivery(delivery, requester);
    if (requester?.role === 'fleet-manager' && !ownsFleetAssignment(delivery, requester.userId)) {
      throw new NotFoundException(`Delivery request "${delivery.id}" not found`);
    }
    if (requester?.role === 'driver' && !ownsDriverAssignment(delivery, requester.userId)) {
      throw new NotFoundException(`Delivery request "${delivery.id}" not found`);
    }
  }

  findAll(
    search?: string,
    statusFilter?: string,
    requester?: { userId: string; role: string },
  ): DeliveryRequest[] {
    let items = [...this.store.deliveryRequests];
    if (requester?.role === 'fleet-manager') {
      items = items.filter((delivery) => ownsFleetAssignment(delivery, requester.userId));
    }

    if (requester?.role === 'business-client') {
      const user: any = this.store.users.find((u) => u.id === requester.userId);
      items = items.filter((delivery) => this.businessClientOwnsDelivery(user, delivery));
    } else if (requester?.role === 'driver') {
      items = items.filter((delivery) => ownsDriverAssignment(delivery, requester.userId));
    }

    if (statusFilter && statusFilter !== 'all') {
      items = items.filter((r) =>
        String(r.status || '')
          .toLowerCase()
          .includes(statusFilter.toLowerCase()),
      );
    }

    items = items.map((delivery) => deliveryForResponse(delivery));

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
    }

    return items;
  }

  findOne(id: string, requester?: { userId: string; role: string }): DeliveryRequest {
    const item = this.store.deliveryRequests.find((r) => r.id === id);

    if (!item) {
      throw new NotFoundException(`Delivery request "${id}" not found`);
    }

    this.assertRequesterCanAccessDelivery(item, requester);

    return deliveryForResponse(item);
  }

  setMissingRecipient(id: string, dto: { recipientName: string; recipientEmail: string }, actor: { userId: string; role: string }) {
    const delivery = this.store.deliveryRequests.find((item) => item.id === id);
    if (!delivery || actor.role !== 'business-client') throw new NotFoundException('Delivery not found');
    this.assertBusinessClientOwnsDelivery(delivery, actor);
    if (delivery.recipientEmail || /completed|delivered|cancelled|rejected/i.test(delivery.status)) {
      throw new BadRequestException('Recipient details are locked');
    }
    delivery.recipientEmail = dto.recipientEmail.trim();
    delivery.contact = dto.recipientName.trim();
    delete delivery.deliveryOtpHash;
    this.store.persistDeliveries();
    return deliveryForResponse(delivery);
  }

  async issueDeliveryOtp(id: string, requester?: { userId: string; role: string }) {
    if (!requester || !['driver', 'business-client'].includes(requester.role)) {
      throw new ForbiddenException('Only the assigned driver or booking client can request a code');
    }
    const delivery = this.store.deliveryRequests.find((item) => item.id === id);
    if (!delivery) throw new NotFoundException(`Delivery request "${id}" not found`);
    this.assertRequesterCanAccessDelivery(delivery, requester);

    const trip = this.store.trips.find((item) => item.request === id);
    if (Date.parse((trip as any)?.retryAt) > Date.now()) throw new BadRequestException('The second attempt is scheduled for later');
    const tripStatus = String(trip?.status || '').toLowerCase().trim();
    if (!trip || !['in transit', 'issue reported'].includes(tripStatus)) {
      throw new BadRequestException('A delivery OTP can only be generated after the package is in transit');
    }
    if (tripStatus === 'issue reported' && String((trip as any).statusBeforeIssue || '').toLowerCase().trim() !== 'in transit') {
      throw new BadRequestException('A delivery OTP can only be generated after the package is in transit');
    }

    if (!delivery.recipientPhone && !delivery.recipientEmail) throw new BadRequestException('This booking needs a recipient email before handoff.');
    if (!delivery.recipientPhone && !this.mailer.isConfigured()) throw new ServiceUnavailableException('Delivery email is unavailable. Contact dispatch.');
    const now = Date.now();
    const sends = (delivery.otpSendTimes || []).filter((at) => now - at < 86_400_000);
    if (sends.some((at) => now - at < 60_000) || sends.length >= 5) {
      throw new BadRequestException('Wait at least one minute between codes. Each delivery allows five sends per day.');
    }
    const otp = createDeliveryOtp(delivery);
    delivery.otpSendTimes = [...sends, now];
    this.store.persistDeliveries();
    try {
      if (delivery.recipientPhone) await this.sms.sendDeliveryCode(delivery.recipientPhone, delivery.id, otp.code);
      else await this.mailer.sendDeliveryCode(delivery.recipientEmail!, delivery.id, otp.code);
    } catch {
      throw new ServiceUnavailableException('Code delivery could not be confirmed. Retry after one minute.');
    }
    return { deliveryId: id, expiresAt: otp.expiresAt, message: delivery.recipientPhone ? 'Code submitted for SMS delivery.' : 'Code sent to the recipient by email.' };
  }

  parcelLabel(id: string, actor: {userId: string; role: string}) {
    const delivery = this.store.deliveryRequests.find((d) => d.id === id);
    if (!delivery || (actor.role !== 'superuser' && delivery.clientUserId !== actor.userId)) throw new NotFoundException('Parcel label unavailable');
    return {barcode: delivery.parcelBarcode || null};
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

  private findLinkedTrip(deliveryId: string): Trip | undefined {
    return this.store.trips.find((trip: any) =>
      [trip.request, trip.deliveryId, trip.delivery_id, trip.requestId, trip.deliveryRequestId]
        .some((value) => String(value || '') === String(deliveryId)),
    );
  }

  private findDeliveryNotificationRecipients(delivery: DeliveryRequest): {
    clientUserId?: string;
    driverUserId?: string;
    fleetManagerUserId?: string;
  } {
    const clientUser: any = this.store.users.find(
      (u: any) =>
        u.role === 'business-client' &&
        this.businessClientOwnsDelivery(u, delivery),
    );

    const linkedTrip = this.findLinkedTrip(delivery.id);
    const assignment = linkedTrip || delivery;
    const driverRecord = this.store.drivers.find((driver) => ownsDriverAssignment(assignment, driver.id));
    const fleetManagerId = assignment.fleetManagerId || driverRecord?.fleetManagerId;
    return {
      clientUserId: clientUser?.id,
      driverUserId: this.store.users.find((u) => u.role === 'driver' && u.id === driverRecord?.id)?.id,
      fleetManagerUserId: fleetManagerId,
    };
  }

  private releaseTripResources(trip: Trip): void {
    const activeStatuses = ['accepted', 'picked up', 'in transit', 'issue reported', 'attempt failed', 'returning'];
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
      if (!hasOtherActiveTrip) {
        vehicle.status = 'Active';
        this.store.persistVehicles();
      }
    }
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
      '';

    const type = dto.type || dto.deliveryType || 'Standard';
    const priority = dto.priority || 'Medium';
    const items = Number(dto.items || dto.quantity || 1);

    const eta = '';
    const distance = dto.distance || 'Distance not available';
    let preferredDeliveryAt = '';
    if (dto.preferredDeliveryAt) {
      const preferredDate = new Date(dto.preferredDeliveryAt);
      if (Number.isNaN(preferredDate.getTime()) || preferredDate <= new Date()) {
        throw new BadRequestException('Preferred delivery date and time must be in the future');
      }
      preferredDeliveryAt = preferredDate.toISOString();
    }

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
      preferredDeliveryAt,
    };
  }

  private createOrSyncTripForDelivery(delivery: DeliveryRequest): Trip {
    const driver = this.store.drivers.find(item => item.id === delivery.driverId);

    const tripId = this.generateTripIdFromDelivery(delivery.id);

    const existingTripIndex = this.store.trips.findIndex(
      (trip: any) =>
        String(trip.request) === String(delivery.id) ||
        String(trip.id) === String(tripId),
    );

    const tripData: Trip = {
      id: tripId,
      fleetManagerId: driver?.fleetManagerId,
      driverId: driver?.id,
      assignment:
        existingTripIndex >= 0
          ? this.store.trips[existingTripIndex].assignment
          : `ASN-${Date.now()}`,

      driver: driver?.name || '',
      phone: driver?.phone || '',
      vehicle:
        (driver as any)?.vehicle ||
        (driver as any)?.vehicleNumber ||
        (driver as any)?.assignedVehicle ||
        '',
      vehicleType: (driver as any)?.vehicleType || '',

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
              : (delivery as any).status || 'Queued',

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

    (tripData as any).pricing = (delivery as any).pricing;
    (tripData as any).amount = (delivery as any).amount;

    (tripData as any).weight =
      (delivery as any).weight ||
      (delivery as any).estimatedWeight ||
      '';

    (tripData as any).instructions =
      (delivery as any).instructions ||
      (delivery as any).notes ||
      '';

    (tripData as any).eta = (delivery as any).eta || '';

    (tripData as any).createdAt =
      existingTripIndex >= 0
        ? (this.store.trips[existingTripIndex] as any).createdAt ||
          new Date().toISOString()
        : new Date().toISOString();

    (tripData as any).updatedAt = new Date().toISOString();

    if (existingTripIndex < 0) {
      (tripData as any).statusHistory = [
        {
          status: tripData.status,
          at: (tripData as any).createdAt,
          actor: (delivery as any).customer || 'business-client',
          source: 'business-client',
        },
      ];
    }

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

  create(dto: CreateDeliveryDto, requester?: { userId: string; role: string }): DeliveryRequest {
    const clientId = requester?.role === 'business-client' ? requester.userId : dto.clientUserId;
    const requestingUser = this.store.users.find(u => u.role === 'business-client' && u.id === clientId);
    if (requester && !requestingUser) throw new BadRequestException('Select a business client account for the booking');
    const bookingKey = dto.bookingKey;
    const fingerprint = bookingKey && createHash('sha256').update(JSON.stringify([
      dto.package, dto.pickup, dto.dropoff, dto.routeId, dto.recipientEmail, dto.recipientName, dto.type, dto.packageType,
      dto.packageDimensions.length, dto.packageDimensions.width, dto.packageDimensions.height, dto.weight,
      dto.refrigerated === true, dto.recipientPhone, dto.alternatePhone, dto.items, dto.preferredDeliveryAt, dto.priority, dto.instructions,
    ])).digest('hex');
    if (bookingKey && clientId) {
      const previous = this.store.deliveryRequests.find((item) => item.bookingKey === bookingKey && item.clientUserId === clientId);
      if (previous) {
        if (previous.bookingFingerprint !== fingerprint) throw new BadRequestException('Booking details changed. Submit as a new booking.');
        return { ...deliveryForResponse(previous), tripId: this.findLinkedTrip(previous.id)?.id } as DeliveryRequest;
      }
    }
    if (requester) this.sms.assertVerified(dto.phoneVerification, dto.recipientPhone, requester.userId);
    const id = this.generateDeliveryId();
    const trustedCustomer = requestingUser
      ? (requestingUser as any).companyName || (requestingUser as any).company || requestingUser.profileDetails?.companyName || requestingUser.name
      : undefined;
    const normalized = this.normalizeDeliveryInput({
      ...(dto as any),
      ...(trustedCustomer ? { customer: trustedCustomer } : {}),
      contact: dto.recipientName,
    });
    const createdAt = new Date().toISOString();
    const assignment = this.selectAssignment(dto);
    const assignedDriver = assignment?.driver;
    const pricing = calculateDeliveryPricing({
      packageDimensions: normalized.packageDimensions,
      weight: Number(normalized.weight),
      type: normalized.type,
      distanceKm: serviceRoute(dto.routeId).km,
    }, this.payoutsService.getEffectiveCustomerRateCard(assignedDriver?.fleetManagerId));
    if (dto.quotedTotal !== undefined && dto.quotedTotal !== pricing.total)
      throw new BadRequestException('The rate changed. Review the refreshed quote before submitting.');

    const delivery: DeliveryRequest = {
      id,

      customer: normalized.customer,
      contact: normalized.contact,
      recipientEmail: dto.recipientEmail?.trim(),
      parcelBarcode: String(randomInt(10000000, 100000000)) + String(randomInt(10000000, 100000000)),
      recipientPhone: dto.recipientPhone, alternatePhone: dto.alternatePhone,
      refrigerated: dto.refrigerated === true,
      bookingKey, bookingFingerprint: fingerprint,

      pickup: normalized.pickup,
      dropoff: normalized.dropoff,

      package: normalized.packageName,
      packageType: normalized.packageType,
      packageDimensions: normalized.packageDimensions,
      type: normalized.type,

      requestTime: new Date().toLocaleString(),

      status: assignedDriver ? 'Assigned' : 'Requested',

      priority: normalized.priority,
      items: normalized.items,

      driver: assignedDriver?.name || '',
      fleetManagerId: assignedDriver?.fleetManagerId,
      driverId: assignedDriver?.id,
      preferredDeliveryAt: normalized.preferredDeliveryAt || undefined,
      amount: pricing.total,
      pricing,
    } as DeliveryRequest;

    (delivery as any).client = normalized.customer;
    (delivery as any).company = normalized.customer;
    if (requestingUser?.id) {
      (delivery as any).clientUserId = requestingUser.id;
    }

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
    (delivery as any).distance = `${pricing.distanceKm} km`;
    (delivery as any).routeId = dto.routeId;

    (delivery as any).assignedDriver = assignedDriver?.name || '';
    (delivery as any).createdAt = createdAt;
    (delivery as any).updatedAt = createdAt;
    (delivery as any).statusHistory = [
      { status: 'Requested', at: createdAt, actor: normalized.customer, source: 'business-client' },
    ];
    if (assignedDriver) {
      (delivery as any).statusHistory.push({ status: 'Assigned', at: createdAt, actor: 'system', source: 'default-assignment' });
    }

    this.store.deliveryRequests.push(delivery);
    this.store.persistDeliveries();

    const trip = this.createOrSyncTripForDelivery(delivery);
    if (assignedDriver) {
      (trip as any).statusHistory = [...(delivery as any).statusHistory];
      assignedDriver.lastAssignedAt = createdAt;
      this.store.persistDrivers();
      trip.vehicle = assignment!.vehicle.plate;
      trip.vehicleType = assignment!.vehicle.type;
      this.store.persistTrips();
    }

    const now = new Date().toISOString();

    const owningClientUser: any = requestingUser || this.store.users.find(
      (u: any) =>
        u.role === 'business-client' &&
        this.businessClientOwnsDelivery(u, delivery),
    );

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'New delivery request',
      message: assignedDriver ? `Delivery ${id} was automatically assigned to ${assignedDriver.name}.` : `Delivery ${id} needs manual dispatch because no eligible driver and vehicle are available.`,
      time: 'Just now',
      to: 'superuser',
      read: false,
      createdAt: now,
    });

    if (assignedDriver?.fleetManagerId) this.store.notifications.push({
      id: `N-${Date.now() + 2}`,
      title: assignedDriver ? 'Delivery assigned automatically' : 'Dispatch required',
      message: assignedDriver ? `Delivery ${id} in trip ${trip.id} is assigned to ${assignedDriver.name}. You can change the driver.` : `Delivery ${id} is awaiting driver assignment in trip ${trip.id}.`,
      time: 'Just now',
      to: 'fleet-manager',
      toUserId: assignedDriver?.fleetManagerId,
      read: false,
      createdAt: now,
    });

    if (owningClientUser?.id) this.store.notifications.push({
      id: `N-${Date.now() + 3}`,
      title: 'Delivery request created',
      message: assignedDriver ? `Your delivery ${id} was assigned to ${assignedDriver.name} and is awaiting driver acceptance.` : `Your delivery ${id} was submitted and is waiting for dispatch.`,
      time: 'Just now',
      to: 'business-client',
      toUserId: owningClientUser?.id,
      read: false,
      createdAt: now,
    });

    if (assignedDriver) {
      this.store.notifications.push({
        id: `N-${randomUUID()}`, title: 'New delivery assigned',
        message: `Delivery ${id} in trip ${trip.id} was assigned to you. Accept it when you are ready.`,
        time: 'Just now', to: 'driver', toUserId: assignedDriver.id,
        read: false, createdAt: now,
      });
    }
    this.store.persistNotifications();

    return {
      ...deliveryForResponse(delivery),
      tripId: trip.id,
      message: assignedDriver ? `Delivery assigned to ${assignedDriver.name} and awaiting acceptance` : 'Delivery request created and awaiting manual driver assignment',
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
    requester?: { userId: string; role: string },
  ): DeliveryRequest {
    const index = this.store.deliveryRequests.findIndex((d) => d.id === id);

    if (index < 0) {
      throw new NotFoundException(`Delivery request "${id}" not found`);
    }

    this.assertBusinessClientOwnsDelivery(this.store.deliveryRequests[index], requester);

    if (!['delivered', 'completed'].includes(String(this.store.deliveryRequests[index].status || '').toLowerCase())) {
      throw new BadRequestException('Feedback can only be submitted after delivery completion');
    }

    const rating = Number(body?.rating);

    if (!rating || rating < 1 || rating > 5) {
      throw new BadRequestException('rating must be between 1 and 5');
    }

    const deliveryQuality = String(body?.deliveryQuality || '').trim();
    const driverBehavior = String(body?.driverBehavior || '').trim();
    const overallExperience = String(body?.overallExperience || '').trim();

    if (!['Excellent', 'Good', 'Average', 'Poor'].includes(deliveryQuality)) {
      throw new BadRequestException('Please select a valid delivery quality');
    }

    if (!['Excellent', 'Good', 'Average', 'Poor'].includes(driverBehavior)) {
      throw new BadRequestException('Please select a valid driver behavior');
    }

    if (!['Very satisfied', 'Satisfied', 'Neutral', 'Unsatisfied'].includes(overallExperience)) {
      throw new BadRequestException('Please select a valid overall experience');
    }

    const prior = this.store.deliveryRequests[index].feedback;
    if (prior && prior.rating === rating && prior.comment === (body.comment || '') &&
        prior.deliveryQuality === deliveryQuality && prior.driverBehavior === driverBehavior && prior.overallExperience === overallExperience)
      return deliveryForResponse(this.store.deliveryRequests[index]);
    const feedback = {
      rating,
      comment: body.comment || '',
      deliveryQuality,
      driverBehavior,
      overallExperience,
      submittedAt: new Date().toISOString(),
    };

    (this.store.deliveryRequests[index] as any).feedback = feedback;
    (this.store.deliveryRequests[index] as any).feedbackSubmitted = true;
    (this.store.deliveryRequests[index] as any).updatedAt =
      new Date().toISOString();

    this.store.persistDeliveries();

    const linkedTrip = this.findLinkedTrip(id);
    const linkedTripIndex = linkedTrip
      ? this.store.trips.findIndex((trip) => trip === linkedTrip)
      : -1;

    if (linkedTripIndex >= 0) {
      (this.store.trips[linkedTripIndex] as any).feedback = feedback;
      (this.store.trips[linkedTripIndex] as any).feedbackSubmitted = true;
      (this.store.trips[linkedTripIndex] as any).updatedAt =
        new Date().toISOString();

      this.store.persistTrips();

      const feedbackDriverName = String(this.store.trips[linkedTripIndex].driver || '').toLowerCase().trim();
      const driverIndex = this.store.drivers.findIndex(
        (driver) => String(driver.name || '').toLowerCase().trim() === feedbackDriverName,
      );
      if (driverIndex >= 0) {
        const driverRatings = this.store.trips
          .filter((trip) => String(trip.driver || '').toLowerCase().trim() === feedbackDriverName)
          .map((trip: any) => Number(trip.feedback?.rating))
          .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);
        if (driverRatings.length) {
          this.store.drivers[driverIndex].rating = (
            driverRatings.reduce((sum, value) => sum + value, 0) / driverRatings.length
          ).toFixed(1);
          this.store.persistDrivers();
        }
      }
    }

    const {
      clientUserId: feedbackClientId,
      driverUserId: feedbackDriverId,
      fleetManagerUserId: feedbackFleetManagerId,
    } = this.findDeliveryNotificationRecipients(this.store.deliveryRequests[index]);

    if (feedbackClientId) {
      this.store.notifications.push({
        id: `N-${randomUUID()}`,
        title: 'Feedback submitted',
        message: `Your ${feedback.rating}/5 feedback for delivery ${id} was shared with the delivery team.`,
        time: 'Just now',
        to: 'business-client',
        toUserId: feedbackClientId,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    if (feedbackFleetManagerId) {
      this.store.notifications.push({
        id: `N-${randomUUID()}`,
        title: 'Customer feedback received',
        message: `Delivery ${id} received a ${feedback.rating}/5 customer rating.`,
        time: 'Just now',
        to: 'fleet-manager',
        toUserId: feedbackFleetManagerId,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    this.store.notifications.push({
      id: `N-${randomUUID()}`,
      title: 'Customer feedback received',
      message: `Delivery ${id} received a ${feedback.rating}/5 customer rating.`,
      time: 'Just now',
      to: 'superuser',
      read: false,
      createdAt: new Date().toISOString(),
    });

    if (feedbackDriverId) {
      this.store.notifications.push({
        id: `N-${randomUUID()}`,
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

    return deliveryForResponse(this.store.deliveryRequests[index]);
  }

  block(id: string, reason: string): DeliveryRequest {
    const idx = this.store.deliveryRequests.findIndex((r) => r.id === id);

    if (idx < 0) {
      throw new NotFoundException(`Delivery request "${id}" not found`);
    }

    if (this.store.deliveryRequests[idx].status === 'Blocked') {
      throw new BadRequestException(`Delivery "${id}" is already blocked`);
    }

    const dispatchable = ['requested','pending','queued','assigned','accepted','rejected'];
    const linked = this.findLinkedTrip(id);
    if (!dispatchable.includes(this.store.deliveryRequests[idx].status.toLowerCase()) ||
        (linked && !dispatchable.includes(linked.status.toLowerCase()))) throw new BadRequestException('Only a pre-pickup delivery can be blocked');
    const blockedAt = new Date().toISOString();
    (this.store.deliveryRequests[idx] as any).statusBeforeBlock = this.store.deliveryRequests[idx].status;
    this.store.deliveryRequests[idx].status = 'Blocked';
    this.store.deliveryRequests[idx].blockReason = reason;
    (this.store.deliveryRequests[idx] as any).updatedAt = blockedAt;
    (this.store.deliveryRequests[idx] as any).statusHistory = Array.isArray((this.store.deliveryRequests[idx] as any).statusHistory)
      ? (this.store.deliveryRequests[idx] as any).statusHistory
      : [];
    (this.store.deliveryRequests[idx] as any).statusHistory.push({ status: 'Blocked', at: blockedAt, actor: 'superuser', source: 'superuser' });

    this.store.persistDeliveries();

    const trip = this.store.trips.find((t) => t.request === id);

    if (trip) {
      (trip as any).statusBeforeBlock = trip.status;
      trip.status = 'Blocked';
      (trip as any).blockReason = reason;
      (trip as any).updatedAt = new Date().toISOString();
      (trip as any).statusHistory = Array.isArray((trip as any).statusHistory) ? (trip as any).statusHistory : [];
      (trip as any).statusHistory.push({ status: 'Blocked', at: blockedAt, actor: 'superuser', source: 'superuser' });
      this.store.persistTrips();
      this.releaseTripResources(trip);
    }

    const { clientUserId: blockClientId, driverUserId: blockDriverId } = this.findDeliveryNotificationRecipients(this.store.deliveryRequests[idx]);
    this.notifyOperations(this.store.deliveryRequests[idx], 'Delivery blocked', `Delivery ${id} was blocked. ${reason}`);

    if (blockClientId) this.store.notifications.push({
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

    return deliveryForResponse(this.store.deliveryRequests[idx]);
  }

  unblock(id: string, reason: string): DeliveryRequest {
    const idx = this.store.deliveryRequests.findIndex((r) => r.id === id);

    if (idx < 0) {
      throw new NotFoundException(`Delivery request "${id}" not found`);
    }

    if (this.store.deliveryRequests[idx].status !== 'Blocked') {
      throw new BadRequestException(`Delivery "${id}" is not blocked`);
    }

    // A driver released while the request was blocked may already have a different parcel.
    const order = this.store.deliveryRequests[idx];
    const assignedDriverName = '';
    order.driverId = undefined;

    const unblockedAt = new Date().toISOString();
    this.store.deliveryRequests[idx].status = assignedDriverName ? 'Assigned' : 'Requested';
    this.store.deliveryRequests[idx].unblockReason = reason;
    this.store.deliveryRequests[idx].driver = assignedDriverName;
    (this.store.deliveryRequests[idx] as any).assignedDriver = assignedDriverName;
    (this.store.deliveryRequests[idx] as any).updatedAt = unblockedAt;
    (this.store.deliveryRequests[idx] as any).statusHistory = Array.isArray((this.store.deliveryRequests[idx] as any).statusHistory)
      ? (this.store.deliveryRequests[idx] as any).statusHistory
      : [];
    (this.store.deliveryRequests[idx] as any).statusHistory.push({
      status: this.store.deliveryRequests[idx].status,
      at: unblockedAt,
      actor: 'superuser',
      source: 'superuser',
    });

    this.store.persistDeliveries();

    const trip = this.createOrSyncTripForDelivery(
      this.store.deliveryRequests[idx],
    );

    trip.status = 'Requested';
    trip.fleetManagerId = order.fleetManagerId;
    trip.driverId = undefined;
    trip.driver = assignedDriverName;
    const assignedDriver = this.store.drivers.find(driver => driver.id === this.store.deliveryRequests[idx].driverId);
    trip.phone = assignedDriver?.phone || '';
    trip.vehicle = assignedDriver?.vehicle || '';
    (trip as any).updatedAt = new Date().toISOString();
    (trip as any).statusHistory = Array.isArray((trip as any).statusHistory) ? (trip as any).statusHistory : [];
    (trip as any).statusHistory.push({ status: trip.status, at: unblockedAt, actor: 'superuser', source: 'superuser' });

    this.store.persistTrips();

    const { clientUserId: unblockClientId, driverUserId: unblockDriverId } = this.findDeliveryNotificationRecipients(this.store.deliveryRequests[idx]);
    this.notifyOperations(this.store.deliveryRequests[idx], 'Delivery unblocked', `Delivery ${id} is available for dispatch again. ${reason}`);

    if (unblockClientId) this.store.notifications.push({
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
        message: `Trip for delivery ${id} was unblocked and requires acceptance again. Reason: ${reason}`,
        time: 'Just now',
        to: 'driver',
        toUserId: unblockDriverId,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    this.store.persistNotifications();

    return deliveryForResponse(this.store.deliveryRequests[idx]);
  }

  cancel(id: string, reason?: string, requester?: { userId: string; role: string }): DeliveryRequest {
    const idx = this.store.deliveryRequests.findIndex((r) => r.id === id);

    if (idx < 0) {
      throw new NotFoundException(`Delivery request "${id}" not found`);
    }

    this.assertBusinessClientOwnsDelivery(this.store.deliveryRequests[idx], requester);

    const order = this.store.deliveryRequests[idx];
    if (order.status === 'Cancelled') return deliveryForResponse(order);
    const linkedTrip = this.store.trips.find((item) => item.request === id);
    const cancellable = ['requested', 'pending', 'queued', 'assigned', 'accepted'];
    if ([order.status, ...(linkedTrip ? [linkedTrip.status] : [])].some((status) => !cancellable.includes(status.toLowerCase()))) {
      throw new BadRequestException('A delivery can only be cancelled before pickup.');
    }
    const paidInvoice = (this.store.invoices as any[]).find(
      (inv) =>
        (inv.deliveryId === id || inv.request === id) &&
        String(inv.status || inv.paymentStatus || '').toLowerCase() === 'paid',
    );

    if (paidInvoice) {
      throw new BadRequestException(
        `Delivery "${id}" cannot be cancelled because post-paid invoice ${paidInvoice.id} has already been paid.`,
      );
    }

    const cancelledAt = new Date().toISOString();
    this.store.deliveryRequests[idx].status = 'Cancelled';
    this.store.deliveryRequests[idx].cancelReason = reason || '';
    (this.store.deliveryRequests[idx] as any).updatedAt = cancelledAt;
    (this.store.deliveryRequests[idx] as any).statusHistory = Array.isArray((this.store.deliveryRequests[idx] as any).statusHistory)
      ? (this.store.deliveryRequests[idx] as any).statusHistory
      : [];
    (this.store.deliveryRequests[idx] as any).statusHistory.push({ status: 'Cancelled', at: cancelledAt, actor: 'business-client', source: 'business-client' });

    this.store.persistDeliveries();

    const trip = this.store.trips.find((t) => t.request === id);

    if (trip) {
      trip.status = 'Cancelled';
      (trip as any).cancelReason = reason || '';
      (trip as any).updatedAt = new Date().toISOString();
      (trip as any).statusHistory = Array.isArray((trip as any).statusHistory) ? (trip as any).statusHistory : [];
      (trip as any).statusHistory.push({ status: 'Cancelled', at: cancelledAt, actor: 'business-client', source: 'business-client' });
      this.store.persistTrips();
      this.releaseTripResources(trip);
    }

    const { clientUserId: cancelClientId, driverUserId: cancelDriverId } = this.findDeliveryNotificationRecipients(this.store.deliveryRequests[idx]);
    this.notifyOperations(this.store.deliveryRequests[idx], 'Delivery cancelled', `Delivery ${id} was cancelled. ${reason || ''}`);

    if (cancelClientId) this.store.notifications.push({
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

    return deliveryForResponse(this.store.deliveryRequests[idx]);
  }
}
