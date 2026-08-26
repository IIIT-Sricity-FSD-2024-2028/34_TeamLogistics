import { Injectable, NotFoundException } from '@nestjs/common';
import { DataStoreService, Driver } from '../data-store/data-store.service';
import { CreateDriverDto, UpdateDriverDto } from './dto/driver.dto';

@Injectable()
export class DriversService {
  constructor(private readonly store: DataStoreService) {}

  findAll(search?: string): Driver[] {
    let drivers = [...this.store.drivers];

    if (search) {
      const q = search.toLowerCase();
      drivers = drivers.filter((d) =>
        JSON.stringify(d).toLowerCase().includes(q),
      );
    }

    return drivers;
  }

  findOne(id: string): Driver {
    const driver = this.store.drivers.find((d) => d.id === id);

    if (!driver) {
      throw new NotFoundException(`Driver "${id}" not found`);
    }

    return driver;
  }

  create(dto: CreateDriverDto): Driver {
    const driver: Driver = {
      id: `DRV-${String(this.store.drivers.length + 1).padStart(3, '0')}`,
      name: dto.name,
      email: dto.email,
      phone: dto.phone || '',
      status: dto.status || 'Available',

      zone: (dto as any).zone || 'Unassigned',
      rating: (dto as any).rating || 4.5,
      license: dto.licenseNumber || (dto as any).license || '',

      licenseNumber: dto.licenseNumber || (dto as any).license || '',
      vehicle: dto.vehicle || '',
      vehicleType: dto.vehicleType || '',
    } as Driver;

    this.store.drivers.push(driver);
    this.store.persistDrivers();

    return driver;
  }

  update(id: string, dto: UpdateDriverDto): Driver {
  const index = this.store.drivers.findIndex((d) => d.id === id);

  if (index < 0) {
    throw new NotFoundException(`Driver "${id}" not found`);
  }

  const existing = this.store.drivers[index];

  const updatedDriver: Driver = {
    ...existing,

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

    vehicle: dto.vehicle ?? (existing as any).vehicle ?? '',
    vehicleType: dto.vehicleType ?? (existing as any).vehicleType ?? '',
    zone: (dto as any).zone ?? (existing as any).zone ?? 'Unassigned',
    rating: (dto as any).rating ?? (existing as any).rating ?? 4.5,
  } as Driver;

  this.store.drivers[index] = updatedDriver;
  this.store.persistDrivers();

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
        vehicle: (updatedDriver as any).vehicle,
        vehicleType: (updatedDriver as any).vehicleType,

        profileDetails: {
          ...(usersStore.users[userIndex].profileDetails || {}),
          phone: updatedDriver.phone,
          licenseNumber: (updatedDriver as any).licenseNumber,
          license: (updatedDriver as any).license,
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

  remove(id: string): { message: string } {
    const index = this.store.drivers.findIndex((d) => d.id === id);

    if (index < 0) {
      throw new NotFoundException(`Driver "${id}" not found`);
    }

    this.store.drivers.splice(index, 1);
    this.store.persistDrivers();

    return { message: 'Driver deleted successfully' };
  }
}