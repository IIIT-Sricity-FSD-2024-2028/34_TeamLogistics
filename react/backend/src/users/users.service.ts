import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DataStoreService, User } from '../data-store/data-store.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { NotificationsService } from '../notifications/notifications.service';

function sanitize(user: User): User {
  const { password, ...rest } = user as any;
  return rest;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly store: DataStoreService,
    private readonly notificationsService: NotificationsService,
  ) {}

  findAll(roleFilter?: string, search?: string): User[] {
    let users = [...this.store.users];

    if (roleFilter && roleFilter !== 'all') {
      users = users.filter((u) => u.role === roleFilter);
    }

    if (search) {
      const q = search.toLowerCase();

      users = users.filter((u: any) =>
        JSON.stringify(sanitize(u)).toLowerCase().includes(q),
      );
    }

    return users.map(sanitize);
  }

  findOne(id: string): User {
    const user = this.store.users.find((u) => u.id === id);

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return sanitize(user);
  }

  findPendingApprovals(): User[] {
    return this.store.users
      .filter((user) => ['pending', 'pending approval'].includes(String(user.status || '').trim().toLowerCase()))
      .map(sanitize)
      .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
  }

  create(dto: CreateUserDto): User {
    const existing = this.store.users.find(
      (u) => u.email.toLowerCase() === dto.email.toLowerCase(),
    );

    if (existing) {
      throw new ConflictException(`Email "${dto.email}" is already registered`);
    }

    const prefixMap: Record<string, string> = {
      'fleet-manager': 'FM',
      'business-client': 'BC',
      driver: 'DR',
      superuser: 'SU',
    };

    const prefix = prefixMap[dto.role] || 'US';
    const id = this.store.generateId(prefix, this.store.users);

    const username = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 14);

    const user: User = {
      id,
      username,
      name: dto.name,
      email: dto.email,
      password: bcrypt.hashSync(dto.password, 10),
      role: dto.role,
      status: dto.status || 'Active',
      phone: dto.phone || '',
      lastLogin: 'Never',
      notifications: ['Email'],
      profileDetails: dto.profileDetails || {},
      createdAt: new Date().toISOString(),
      termsAcceptedAt: (dto as any).termsAcceptedAt,
      termsVersion: (dto as any).termsVersion,

      companyName: (dto as any).companyName || '',
      company: (dto as any).company || (dto as any).companyName || '',
      address: (dto as any).address || '',
    } as User;

    this.store.users.push(user);
    this.store.persistUsers();

    if (dto.role === 'driver') {
      this.store.drivers.push({
        id: user.id,
        name: user.name,
        phone: user.phone || '',
        zone: 'Unassigned',
        vehicle: '--',
        status: dto.status === 'Active' ? 'Available' : 'Document Review',
        license: dto.profileDetails?.licenseNumber || '',
        licenseExpiry: dto.profileDetails?.licenseExpiry || '',
        email: user.email,
      });

      this.store.persistDrivers();
    }

    return sanitize(user);
  }

  update(id: string, dto: UpdateUserDto): User {
    const index = this.store.users.findIndex((u) => u.id === id);

    if (index < 0) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    if (dto.email) {
      const duplicate = this.store.users.find(
        (u) => u.id !== id && u.email.toLowerCase() === dto.email!.toLowerCase(),
      );

      if (duplicate) {
        throw new ConflictException(`Email "${dto.email}" is already registered`);
      }
    }

    const user: any = this.store.users[index];

    const updated: User = {
      ...user,

      name: dto.name ?? user.name,
      email: dto.email ?? user.email,
      password: dto.password ? bcrypt.hashSync(dto.password, 10) : user.password,
      role: dto.role ?? user.role,
      status: dto.status ?? user.status,
      phone: dto.phone ?? user.phone,
      notifications: dto.notifications ?? user.notifications,

      companyName: (dto as any).companyName ?? user.companyName ?? '',
      company: (dto as any).company ?? user.company ?? (dto as any).companyName ?? '',
      address: (dto as any).address ?? user.address ?? '',

      profileDetails: dto.profileDetails
        ? {
            ...(user.profileDetails || {}),
            ...dto.profileDetails,
          }
        : user.profileDetails,
    } as User;

    this.store.users[index] = updated;
    this.store.persistUsers();

    if (updated.role === 'driver') {
      const driverIdx = this.store.drivers.findIndex(
        (d) => d.id === id || d.email === user.email,
      );

      if (driverIdx >= 0) {
        const oldDriverName = this.store.drivers[driverIdx].name;

        this.store.drivers[driverIdx] = {
          ...this.store.drivers[driverIdx],
          name: updated.name,
          phone: updated.phone || this.store.drivers[driverIdx].phone,
          status: updated.status === 'Active' ? 'Available' : updated.status,
          email: updated.email,
        };

        this.store.persistDrivers();

        if (oldDriverName !== updated.name || dto.phone) {
          this.propagateDriverIdentityToTrips(oldDriverName, updated.name, updated.phone || this.store.drivers[driverIdx].phone);
        }
      }
    }

    if (updated.role === 'business-client') {
      const updatedAny = updated as any;
      const oldCompanyName = user.companyName || user.company || user.name;
      const newCompanyName = updatedAny.companyName || updatedAny.company || updated.name;

      if (oldCompanyName && newCompanyName && oldCompanyName !== newCompanyName) {
        this.propagateClientRenameToOpenRecords(id, oldCompanyName, newCompanyName);
      }
    }

    return sanitize(updated);
  }

  private isTerminalTripStatus(status: string): boolean {
    const s = String(status || '').toLowerCase();
    return ['completed', 'delivered', 'rejected', 'cancelled', 'canceled'].includes(s);
  }

  private isTerminalDeliveryStatus(status: string): boolean {
    const s = String(status || '').toLowerCase();
    return ['delivered', 'cancelled', 'canceled', 'rejected'].includes(s);
  }

  private propagateDriverIdentityToTrips(oldName: string, newName: string, newPhone: string): void {
    if (!oldName) return;

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

  private propagateClientRenameToOpenRecords(userId: string, oldName: string, newName: string): void {
    let deliveriesChanged = false;
    let tripsChanged = false;

    this.store.deliveryRequests.forEach((d: any) => {
      const matches = d.customer === oldName || d.client === oldName || d.company === oldName;
      if (matches && !this.isTerminalDeliveryStatus(d.status)) {
        if (d.customer === oldName) d.customer = newName;
        if (d.client === oldName) d.client = newName;
        if (d.company === oldName) d.company = newName;
        deliveriesChanged = true;
      }
    });

    this.store.trips.forEach((t: any) => {
      if (t.customer === oldName && !this.isTerminalTripStatus(t.status)) {
        t.customer = newName;
        tripsChanged = true;
      }
    });

    if (deliveriesChanged) this.store.persistDeliveries();
    if (tripsChanged) this.store.persistTrips();
  }

  updateStatus(id: string, status: string): User {
    const index = this.store.users.findIndex((u) => u.id === id);

    if (index < 0) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    this.store.users[index].status = status;
    this.store.users[index].reviewedAt = new Date().toISOString();
    if (status === 'Active') {
      this.store.users[index].approvedAt = this.store.users[index].reviewedAt;
      delete this.store.users[index].rejectedAt;
    } else if (status === 'Rejected') {
      this.store.users[index].rejectedAt = this.store.users[index].reviewedAt;
      delete this.store.users[index].approvedAt;
    }
    this.store.persistUsers();

    if (this.store.users[index].role === 'driver') {
      const driverIdx = this.store.drivers.findIndex((d) => d.id === id);

      if (driverIdx >= 0) {
        if (status === 'Active') {
          this.store.drivers[driverIdx].status = 'Available';
        } else if (status === 'Rejected') {
          this.store.drivers[driverIdx].status = 'Rejected';
        } else if (status === 'Suspended') {
          this.store.drivers[driverIdx].status = 'Suspended';
        }

        this.store.persistDrivers();
      }
    }

    return sanitize(this.store.users[index]);
  }

  reviewRegistration(id: string, decision: 'approve' | 'reject'): User {
    const user = this.store.users.find((item) => item.id === id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    const pending = ['pending', 'pending approval'].includes(String(user.status || '').trim().toLowerCase());
    if (!pending) {
      throw new BadRequestException(`Registration for "${id}" has already been reviewed`);
    }

    const updated = this.updateStatus(id, decision === 'approve' ? 'Active' : 'Rejected');
    try {
      this.notificationsService.create({
        title: decision === 'approve' ? 'Registration approved' : 'Registration rejected',
        message: decision === 'approve'
          ? 'Your DeliverSync account has been approved. You can now sign in.'
          : 'Your DeliverSync registration was not approved. Contact support if you need assistance.',
        to: user.role,
        toUserId: user.id,
      });
    } catch (error) {
      this.logger.warn(`Registration ${id} was reviewed, but its applicant notification could not be created`);
    }
    return updated;
  }

  remove(id: string): { message: string } {
    const index = this.store.users.findIndex((u) => u.id === id);

    if (index < 0) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    const user = this.store.users[index];

    if (user.role === 'driver') {
      const driver = this.store.drivers.find((d) => d.id === id || d.email === user.email);
      const driverName = driver?.name || user.name;

      const hasActiveTrips = this.store.trips.some(
        (t) => t.driver === driverName && !this.isTerminalTripStatus(t.status),
      );

      if (hasActiveTrips) {
        throw new ForbiddenException(
          `Cannot delete driver "${driverName}" while they have an active trip. Reassign or complete the trip first.`,
        );
      }
    }

    this.store.users.splice(index, 1);
    this.store.persistUsers();

    this.store.drivers = this.store.drivers.filter(
      (d) => d.id !== id && d.email !== user.email,
    );
    this.store.persistDrivers();

    return { message: `User "${id}" deleted successfully` };
  }
}
