import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DataStoreService, User } from '../data-store/data-store.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly store: DataStoreService) {}

  findAll(roleFilter?: string, search?: string): User[] {
    let users = [...this.store.users];

    if (roleFilter && roleFilter !== 'all') {
      users = users.filter((u) => u.role === roleFilter);
    }

    if (search) {
      const q = search.toLowerCase();

      users = users.filter((u: any) =>
        JSON.stringify(u).toLowerCase().includes(q),
      );
    }

    return users;
  }

  findOne(id: string): User {
    const user = this.store.users.find((u) => u.id === id);

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return user;
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
      password: dto.password,
      role: dto.role,
      status: dto.status || 'Active',
      phone: dto.phone || '',
      lastLogin: 'Never',
      notifications: ['Email'],
      profileDetails: dto.profileDetails || {},

      // Business Client profile fields
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
        email: user.email,
      });

      this.store.persistDrivers();
    }

    return user;
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

      // Normal allowed user fields
      name: dto.name ?? user.name,
      email: dto.email ?? user.email,
      password: dto.password ?? user.password,
      role: dto.role ?? user.role,
      status: dto.status ?? user.status,
      phone: dto.phone ?? user.phone,
      notifications: dto.notifications ?? user.notifications,

      // Business Client profile fields
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
        this.store.drivers[driverIdx] = {
          ...this.store.drivers[driverIdx],
          name: updated.name,
          phone: updated.phone || this.store.drivers[driverIdx].phone,
          status: updated.status === 'Active' ? 'Available' : updated.status,
          email: updated.email,
        };

        this.store.persistDrivers();
      }
    }

    return updated;
  }

  updateStatus(id: string, status: string): User {
    const index = this.store.users.findIndex((u) => u.id === id);

    if (index < 0) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    this.store.users[index].status = status;
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

    return this.store.users[index];
  }

  remove(id: string): { message: string } {
    const index = this.store.users.findIndex((u) => u.id === id);

    if (index < 0) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    const user = this.store.users[index];

    this.store.users.splice(index, 1);
    this.store.persistUsers();

    this.store.drivers = this.store.drivers.filter(
      (d) => d.id !== id && d.email !== user.email,
    );
    this.store.persistDrivers();

    return { message: `User "${id}" deleted successfully` };
  }
}