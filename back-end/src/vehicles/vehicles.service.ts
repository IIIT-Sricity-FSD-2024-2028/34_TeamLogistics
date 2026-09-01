import { Injectable, NotFoundException } from '@nestjs/common';
import { DataStoreService, Vehicle } from '../data-store/data-store.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly store: DataStoreService) {}

  findAll(
    search?: string,
    statusFilter?: string,
    requester?: { userId: string; role: string },
  ): Vehicle[] {
    let vehicles = [...this.store.vehicles];

    if (requester && requester.role === 'fleet-manager') {
      vehicles = vehicles.filter(
        (v) => !v.fleetManagerId || v.fleetManagerId === requester.userId,
      );
    }

    if (statusFilter && statusFilter !== 'all') {
      vehicles = vehicles.filter((v) => v.status.toLowerCase() === statusFilter.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      vehicles = vehicles.filter((v) => JSON.stringify(v).toLowerCase().includes(q));
    }

    return vehicles.map((v) => ({
      ...v,
      availability: v.status === 'Active' ? 'Available' : 'Unavailable',
    }));
  }

  findOne(id: string, requester?: { userId: string; role: string }): Vehicle {
    const vehicle = this.store.vehicles.find((v) => v.id === id);

    if (!vehicle) {
      throw new NotFoundException(`Vehicle "${id}" not found`);
    }

    if (
      requester &&
      requester.role === 'fleet-manager' &&
      vehicle.fleetManagerId &&
      vehicle.fleetManagerId !== requester.userId
    ) {
      throw new NotFoundException(`Vehicle "${id}" not found`);
    }

    return {
      ...vehicle,
      availability: vehicle.status === 'Active' ? 'Available' : 'Unavailable',
    };
  }

  create(dto: CreateVehicleDto, requester?: { userId: string; role: string }): Vehicle {
    const id = this.store.generateId('VH', this.store.vehicles);

    const vehicle: Vehicle = {
      id,
      plate: dto.plate,
      type: dto.type,
      capacity: dto.capacity || '--',
      assignedDriver: dto.assignedDriver || '--',
      status: dto.status || 'Active',
      maintenance: dto.maintenance || dto.lastMaintenance || '',
      fleetManagerId: requester?.role === 'fleet-manager' ? requester.userId : undefined,
    };

    this.store.vehicles.push(vehicle);
    this.store.persistVehicles();

    return vehicle;
  }

  update(id: string, dto: UpdateVehicleDto, requester?: { userId: string; role: string }): Vehicle {
    const idx = this.store.vehicles.findIndex((v) => v.id === id);

    if (idx < 0) {
      throw new NotFoundException(`Vehicle "${id}" not found`);
    }

    if (
      requester &&
      requester.role === 'fleet-manager' &&
      this.store.vehicles[idx].fleetManagerId &&
      this.store.vehicles[idx].fleetManagerId !== requester.userId
    ) {
      throw new NotFoundException(`Vehicle "${id}" not found`);
    }

    const updateData: Partial<Vehicle> = {
      ...dto,
      maintenance: dto.maintenance || dto.lastMaintenance || this.store.vehicles[idx].maintenance || '',
    };

    delete (updateData as any).lastMaintenance;

    this.store.vehicles[idx] = {
      ...this.store.vehicles[idx],
      ...updateData,
    };

    this.store.persistVehicles();

    return this.store.vehicles[idx];
  }

  remove(id: string, requester?: { userId: string; role: string }): { message: string } {
    const idx = this.store.vehicles.findIndex((v) => v.id === id);

    if (idx < 0) {
      throw new NotFoundException(`Vehicle "${id}" not found`);
    }

    if (
      requester &&
      requester.role === 'fleet-manager' &&
      this.store.vehicles[idx].fleetManagerId &&
      this.store.vehicles[idx].fleetManagerId !== requester.userId
    ) {
      throw new NotFoundException(`Vehicle "${id}" not found`);
    }

    this.store.vehicles.splice(idx, 1);
    this.store.persistVehicles();

    return { message: `Vehicle "${id}" deleted` };
  }
}