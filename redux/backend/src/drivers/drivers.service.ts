import { driverStatus, reservesDriver } from '../common/dispatch';
import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataStoreService, Driver } from '../data-store/data-store.service';
import { CreateDriverDto, UpdateDriverDto } from './dto/driver.dto';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { assertFutureDateOnly } from '../common/date-validation';

@Injectable()
export class DriversService {
  constructor(
    private readonly store: DataStoreService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  findAll(search?: string, requester?: { userId: string; role: string }) {
    let drivers = [...this.store.drivers];

    if (requester?.role === 'driver') drivers = drivers.filter((driver) => driver.id === requester.userId);
    if (requester?.role === 'business-client') {
      const assigned = new Set(this.store.deliveryRequests.filter((d) => d.clientUserId === requester.userId).map((d) => d.driverId));
      return drivers.filter((d) => assigned.has(d.id) && (!search || d.name.toLowerCase().includes(search.toLowerCase())))
        .map(({ id, name, phone, rating }) => ({ id, name, phone, rating }));
    }

    if (requester && requester.role === 'fleet-manager') {
      const driverAccountIds = new Set(
        this.store.users
          .filter((user) => user.role === 'driver')
          .map((user) => String(user.id || '').trim().toLowerCase()),
      );
      const hiddenStatuses = new Set(['active', 'document review']);

      drivers = drivers.filter(
        (d) =>
          (!d.fleetManagerId || d.fleetManagerId === requester.userId) &&
          driverAccountIds.has(String(d.id || '').trim().toLowerCase()) &&
          !hiddenStatuses.has(String(d.status || '').trim().toLowerCase()),
      );
    }

    const reserved = new Set(this.store.trips.filter(reservesDriver).map(trip => trip.driverId));
    drivers = drivers.map(driver => ({ ...driver, status: driverStatus(driver.status, reserved.has(driver.id)) }));

    if (search) {
      const q = search.toLowerCase();
      drivers = drivers.filter((d) =>
        JSON.stringify(d).toLowerCase().includes(q),
      );
    }

    if (requester?.role === 'fleet-manager') return drivers.map(driver => driver.fleetManagerId ? driver :
      {id:driver.id, name:driver.name, status:driver.status});
    return drivers;
  }

  findOne(id: string, requester?: { userId: string; role: string }) {
    const driver = this.store.drivers.find((d) => d.id === id);

    if (requester?.role === 'business-client') {
      const contact = this.findAll(undefined, requester).find((d) => d.id === id);
      if (contact) return contact;
      throw new NotFoundException('Driver not found');
    }
    if (!driver || (requester?.role === 'driver' && driver.id !== requester.userId)) {
      throw new NotFoundException(`Driver "${id}" not found`);
    }

    if (
      requester &&
      requester.role === 'fleet-manager' &&
      driver.fleetManagerId &&
      driver.fleetManagerId !== requester.userId
    ) {
      throw new NotFoundException(`Driver "${id}" not found`);
    }

    if (requester?.role === 'fleet-manager' && !driver.fleetManagerId) {
      if (!this.store.users.some(u => u.id === id && u.role === 'driver' && u.status === 'Active')) throw new NotFoundException('Driver not found');
      return {id:driver.id, name:driver.name, status:driver.status};
    }
    return { ...driver, status: this.currentStatus(driver) };
  }

  private currentStatus(driver: Driver) {
    const reserved = this.store.trips.some(trip => trip.driverId === driver.id && reservesDriver(trip));
    return driverStatus(driver.status, reserved);
  }

  create(dto: CreateDriverDto, requester?: { userId: string; role: string }): Driver {
    if (dto.password && !dto.licenseExpiry) {
      throw new BadRequestException('License expiry date is required');
    }
    if (dto.licenseExpiry) {
      assertFutureDateOnly(dto.licenseExpiry, 'License expiry date');
    }

    if (dto.password) {
      if (dto.termsAccepted !== true) {
        throw new BadRequestException('The Terms & Conditions must be accepted for the driver account');
      }
      if (!/(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])/.test(dto.password)) {
        throw new BadRequestException('Password must include an uppercase letter, a number, and a special character');
      }

      const accountStatus = ['Suspended', 'Rejected'].includes(dto.status || '') ? dto.status : 'Active';
      const user = this.usersService.create({
        name: dto.name,
        email: dto.email,
        password: dto.password,
        role: 'driver',
        status: accountStatus,
        phone: dto.phone,
        profileDetails: {
          ...(dto.profileDetails || {}),
          licenseNumber: dto.licenseNumber || dto.license || dto.profileDetails?.licenseNumber || '',
          licenseExpiry: dto.licenseExpiry || dto.profileDetails?.licenseExpiry || '',
        },
        termsAcceptedAt: new Date().toISOString(),
        termsVersion: dto.termsVersion,
      } as any);

      const createdDriver = this.store.drivers.find((driver) => driver.id === user.id);
      if (!createdDriver) {
        throw new BadRequestException('Driver account was created without a fleet profile');
      }

      createdDriver.status = dto.status || 'Available';
      createdDriver.zone = dto.zone || 'Unassigned';
      createdDriver.vehicle = dto.vehicle || '--';
      (createdDriver as any).vehicleType = dto.vehicleType || '';
      createdDriver.license = dto.licenseNumber || dto.license || '';
      (createdDriver as any).licenseNumber = dto.licenseNumber || dto.license || '';
      createdDriver.licenseExpiry = dto.licenseExpiry || dto.profileDetails?.licenseExpiry || '';
      createdDriver.fleetManagerId = requester?.role === 'fleet-manager' ? requester.userId : undefined;
      this.store.persistDrivers();

      return createdDriver;
    }

    const driver: Driver = {
      id: 'DRV-' + randomUUID(),
      name: dto.name,
      email: dto.email,
      phone: dto.phone || '',
      status: dto.status || 'Available',

      zone: (dto as any).zone || 'Unassigned',
      rating: (dto as any).rating || '',
      license: dto.licenseNumber || (dto as any).license || '',

      licenseNumber: dto.licenseNumber || (dto as any).license || '',
      licenseExpiry: dto.licenseExpiry || '',
      vehicle: dto.vehicle || '',
      vehicleType: dto.vehicleType || '',
      fleetManagerId: requester?.role === 'fleet-manager' ? requester.userId : undefined,
    } as Driver;

    this.store.drivers.push(driver);
    this.store.persistDrivers();

    return driver;
  }

  notifyCompliance(
    id: string,
    message: string,
    requester?: { userId: string; role: string },
  ) {
    const driver = this.findOne(id, requester);
    if (requester?.role === 'fleet-manager' && !this.store.drivers.some(d => d.id === id && d.fleetManagerId === requester.userId)) throw new NotFoundException('Driver not found');
    const driverUser = this.store.users.find((user) => user.role === 'driver' && user.id === driver.id);

    if (!driverUser) {
      throw new BadRequestException(`Driver "${driver.name}" does not have a linked login account`);
    }

    return this.notificationsService.create({
      title: 'Driver compliance action required',
      message,
      to: 'driver',
      toUserId: driverUser.id,
    });
  }

  update(id: string, dto: UpdateDriverDto, requester?: { userId: string; role: string }): Driver {
  const index = this.store.drivers.findIndex((d) => d.id === id);

  if (index < 0) {
    throw new NotFoundException(`Driver "${id}" not found`);
  }

  const existing = this.store.drivers[index];

  if (dto.licenseExpiry) {
    assertFutureDateOnly(dto.licenseExpiry, 'License expiry date');
  }

  if (requester?.role === 'driver') {
    if (existing.id !== requester.userId) {
      throw new NotFoundException(`Driver "${id}" not found`);
    }
  }

  if (
    requester &&
    requester.role === 'fleet-manager' &&
    existing.fleetManagerId &&
    existing.fleetManagerId !== requester.userId
  ) {
    throw new NotFoundException(`Driver "${id}" not found`);
  }

  if (dto.status) {
    const current = this.currentStatus(existing);
    if (requester?.role === 'driver' && (!['Available', 'Unavailable'].includes(dto.status) ||
        !['Available', 'Unavailable', 'In Work'].includes(current))) {
      throw new BadRequestException('Only available and unavailable can be selected for an approved driver');
    }
    if (current === 'In Work' && ['Active', 'Available', 'Unavailable'].includes(dto.status)) {
      throw new BadRequestException('Finish or release the assigned delivery before changing availability');
    }
  }

  if (requester?.role === 'fleet-manager' && !existing.fleetManagerId) {
    const account = this.store.users.find(user => user.id === id && user.role === 'driver');
    if (!account || account.status.toLowerCase() !== 'active' ||
      Object.entries(dto).some(([key,value]) => value !== undefined && !['vehicle','vehicleType','zone','status'].includes(key)) ||
      (dto.status && !['Active','Available'].includes(dto.status)))
      throw new ForbiddenException('Only approved drivers can be enrolled with operational assignment details');
  }
  if (requester?.role === 'fleet-manager' && dto.email && dto.email.toLowerCase() !== existing.email?.toLowerCase())
    throw new ForbiddenException('Only the account holder or an administrator may change the sign-in email');

  const updatedDriver: Driver = {
    ...existing,

    fleetManagerId:
      existing.fleetManagerId || (requester?.role === 'fleet-manager' ? requester.userId : undefined),

    name: dto.name ?? existing.name,
    email: dto.email ?? existing.email,
    phone: dto.phone ?? existing.phone,
    status: dto.status ?? existing.status,

    license:
      dto.licenseNumber ??
      (dto as any).license ??
      (existing as any).license ??
      '',

    licenseNumber:
      dto.licenseNumber ??
      (existing as any).licenseNumber ??
      (existing as any).license ??
      '',

    licenseExpiry: dto.licenseExpiry ?? existing.licenseExpiry ?? '',

    vehicle: requester?.role === 'driver' ? (existing as any).vehicle ?? '' : dto.vehicle ?? (existing as any).vehicle ?? '',
    vehicleType: requester?.role === 'driver' ? (existing as any).vehicleType ?? '' : dto.vehicleType ?? (existing as any).vehicleType ?? '',
    zone: requester?.role === 'driver' ? (existing as any).zone ?? 'Unassigned' : (dto as any).zone ?? (existing as any).zone ?? 'Unassigned',
    rating: (existing as any).rating ?? '',
  } as Driver;

  this.store.drivers[index] = updatedDriver;
  this.store.persistDrivers();

  const nameChanged = dto.name !== undefined && dto.name !== existing.name;
  const phoneChanged = dto.phone !== undefined && dto.phone !== existing.phone;

  if (nameChanged || phoneChanged) {
    this.propagateDriverIdentityToTrips(existing.id, existing.name, updatedDriver.name, updatedDriver.phone);
  }

  const usersStore = this.store as any;

  if (Array.isArray(usersStore.users)) {
    const userIndex = usersStore.users.findIndex((u: any) => u.role === 'driver' && u.id === existing.id);

    if (userIndex >= 0) {
      const account = usersStore.users[userIndex];
      let accountStatus = account.status;
      if (requester?.role !== 'driver' && dto.status) {
        if (['Suspended', 'Rejected'].includes(dto.status)) accountStatus = dto.status;
        else if (accountStatus === 'Suspended' && existing.status === 'Suspended') accountStatus = 'Active';
      }
      usersStore.users[userIndex] = {
        ...usersStore.users[userIndex],

        name: updatedDriver.name,
        fullName: updatedDriver.name,
        email: updatedDriver.email,
        phone: updatedDriver.phone,
        status: accountStatus,
        sessionVersion: (account.sessionVersion ?? 0) + Number(accountStatus !== account.status),

        licenseNumber: (updatedDriver as any).licenseNumber,
        license: (updatedDriver as any).license,
        licenseExpiry: updatedDriver.licenseExpiry,
        vehicle: (updatedDriver as any).vehicle,
        vehicleType: (updatedDriver as any).vehicleType,

        profileDetails: {
          ...(usersStore.users[userIndex].profileDetails || {}),
          phone: updatedDriver.phone,
          licenseNumber: (updatedDriver as any).licenseNumber,
          license: (updatedDriver as any).license,
          licenseExpiry: updatedDriver.licenseExpiry,
          vehicle: (updatedDriver as any).vehicle,
          vehicleType: (updatedDriver as any).vehicleType,
          status: updatedDriver.status,
        },
      };

      if (typeof usersStore.persistUsers === 'function') {
        usersStore.persistUsers();
      }
    }
  }

  return { ...updatedDriver, status: this.currentStatus(updatedDriver) };
}

  remove(id: string, requester?: { userId: string; role: string }): { message: string } {
    const index = this.store.drivers.findIndex((d) => d.id === id);

    if (index < 0) {
      throw new NotFoundException(`Driver "${id}" not found`);
    }

    if (
      requester &&
      requester.role === 'fleet-manager' &&
      this.store.drivers[index].fleetManagerId !== requester.userId
    ) {
      throw new NotFoundException(`Driver "${id}" not found`);
    }

    const hasActiveTrips = this.store.trips.some(
      (t) => t.driverId === id && !this.isTerminalTripStatus(t.status),
    );

    if (hasActiveTrips) {
      throw new ForbiddenException(
        `Cannot delete driver "${this.store.drivers[index].name}" while they have an active trip. Reassign or complete the trip first.`,
      );
    }

    this.store.drivers.splice(index, 1);
    this.store.persistDrivers();

    return { message: 'Driver deleted successfully' };
  }

  private isTerminalTripStatus(status: string): boolean {
    const s = String(status || '').toLowerCase();
    return ['completed', 'delivered', 'returned', 'rejected', 'cancelled', 'canceled'].includes(s);
  }

  private propagateDriverIdentityToTrips(driverId: string, oldName: string, newName: string, newPhone: string): void {
    const matches = (trip: { driverId?: string }) => trip.driverId === driverId;
    if (!oldName || oldName === newName) {
      let phoneOnlyChanged = false;

      this.store.trips.forEach((t) => {
        if (matches(t) && !this.isTerminalTripStatus(t.status)) {
          t.phone = newPhone;
          phoneOnlyChanged = true;
        }
      });

      if (phoneOnlyChanged) this.store.persistTrips();
      return;
    }

    let tripsChanged = false;
    let deliveriesChanged = false;

    this.store.trips.forEach((t) => {
      if (matches(t) && !this.isTerminalTripStatus(t.status)) {
        t.driver = newName;
        t.phone = newPhone;
        tripsChanged = true;

        const requestId = t.request;
        if (requestId) {
          const delivery = this.store.deliveryRequests.find((d) => d.id === requestId);
          if (delivery) {
            (delivery as any).driver = newName;
            (delivery as any).assignedDriver = newName;
            deliveriesChanged = true;
          }
        }
      }
    });

    if (tripsChanged) this.store.persistTrips();
    if (deliveriesChanged) this.store.persistDeliveries();
  }
}
