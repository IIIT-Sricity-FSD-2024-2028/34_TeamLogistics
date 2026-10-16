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

  findAll(search?: string, requester?: { userId: string; role: string }): Driver[] {
    let drivers = [...this.store.drivers];

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

    if (search) {
      const q = search.toLowerCase();
      drivers = drivers.filter((d) =>
        JSON.stringify(d).toLowerCase().includes(q),
      );
    }

    return drivers;
  }

  findOne(id: string, requester?: { userId: string; role: string }): Driver {
    const driver = this.store.drivers.find((d) => d.id === id);

    if (!driver) {
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

    return driver;
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
      id: `DRV-${String(this.store.drivers.length + 1).padStart(3, '0')}`,
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
    const normalize = (value: unknown) => String(value || '').trim().toLowerCase();
    const driverUser = this.store.users.find((user) =>
      user.role === 'driver' && (
        user.id === driver.id ||
        (driver.email && normalize(user.email) === normalize(driver.email)) ||
        normalize(user.name) === normalize(driver.name)
      ),
    );

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
    const user: any = this.store.users.find((item) => item.id === requester.userId);
    const isOwnProfile =
      String(user?.email || '').toLowerCase().trim() === String(existing.email || '').toLowerCase().trim() ||
      String(user?.name || '').toLowerCase().trim() === String(existing.name || '').toLowerCase().trim();
    if (!isOwnProfile) {
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
    this.propagateDriverIdentityToTrips(existing.name, updatedDriver.name, updatedDriver.phone);
  }

  const usersStore = this.store as any;

  if (Array.isArray(usersStore.users)) {
    const userIndex = usersStore.users.findIndex((u: any) => {
      return (
        String(u.email || '').toLowerCase() ===
          String(existing.email || '').toLowerCase() ||
        String(u.email || '').toLowerCase() ===
          String(updatedDriver.email || '').toLowerCase() ||
        String(u.name || '').toLowerCase() ===
          String(existing.name || '').toLowerCase() ||
        String(u.fullName || '').toLowerCase() ===
          String(existing.name || '').toLowerCase()
      );
    });

    if (userIndex >= 0) {
      usersStore.users[userIndex] = {
        ...usersStore.users[userIndex],

        name: updatedDriver.name,
        fullName: updatedDriver.name,
        email: updatedDriver.email,
        phone: updatedDriver.phone,
        status: updatedDriver.status,

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

  return updatedDriver;
}

  remove(id: string, requester?: { userId: string; role: string }): { message: string } {
    const index = this.store.drivers.findIndex((d) => d.id === id);

    if (index < 0) {
      throw new NotFoundException(`Driver "${id}" not found`);
    }

    if (
      requester &&
      requester.role === 'fleet-manager' &&
      this.store.drivers[index].fleetManagerId &&
      this.store.drivers[index].fleetManagerId !== requester.userId
    ) {
      throw new NotFoundException(`Driver "${id}" not found`);
    }

    const hasActiveTrips = this.store.trips.some(
      (t) => t.driver === this.store.drivers[index].name && !this.isTerminalTripStatus(t.status),
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
    return ['completed', 'delivered', 'rejected', 'cancelled', 'canceled'].includes(s);
  }

  private propagateDriverIdentityToTrips(oldName: string, newName: string, newPhone: string): void {
    if (!oldName || oldName === newName) {
      let phoneOnlyChanged = false;

      this.store.trips.forEach((t) => {
        if (t.driver === oldName && !this.isTerminalTripStatus(t.status)) {
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
      if (t.driver === oldName && !this.isTerminalTripStatus(t.status)) {
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
