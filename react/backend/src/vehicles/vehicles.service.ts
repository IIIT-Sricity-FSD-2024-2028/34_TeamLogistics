import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

    return vehicles;
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

    return vehicle;
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

    const oldPlate = this.store.vehicles[idx].plate;
    const oldAssignedDriver = this.store.vehicles[idx].assignedDriver;

    const updateData: Partial<Vehicle> = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );

    if (dto.maintenance !== undefined || dto.lastMaintenance !== undefined) {
      updateData.maintenance = dto.maintenance ?? dto.lastMaintenance ?? '';
    }

    delete (updateData as any).lastMaintenance;

    this.store.vehicles[idx] = {
      ...this.store.vehicles[idx],
      ...updateData,
    };

    this.store.persistVehicles();

    const updated = this.store.vehicles[idx];

    if (oldPlate && updated.plate && oldPlate !== updated.plate) {
      this.propagateVehicleIdentityToTrips(oldPlate, updated.plate, updated.type);
    }

    if (dto.assignedDriver !== undefined && oldAssignedDriver !== updated.assignedDriver) {
      this.syncDriverVehicleAssignment(oldAssignedDriver, updated.assignedDriver, updated.plate);
    }

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

    const plate = this.store.vehicles[idx].plate;
    const hasActiveTrips = this.store.trips.some(
      (t) => t.vehicle === plate && !this.isTerminalTripStatus(t.status),
    );

    if (hasActiveTrips) {
      throw new ForbiddenException(
        `Cannot delete vehicle "${plate}" while it is assigned to an active trip.`,
      );
    }

    this.store.vehicles.splice(idx, 1);
    this.store.persistVehicles();

    return { message: `Vehicle "${id}" deleted` };
  }

  private isTerminalTripStatus(status: string): boolean {
    const s = String(status || '').toLowerCase();
    return ['completed', 'delivered', 'rejected', 'cancelled', 'canceled'].includes(s);
  }

  private propagateVehicleIdentityToTrips(oldPlate: string, newPlate: string, newType?: string): void {
    let changed = false;

    this.store.trips.forEach((t: any) => {
      if (t.vehicle === oldPlate && !this.isTerminalTripStatus(t.status)) {
        t.vehicle = newPlate;
        if (newType) t.vehicleType = newType;
        changed = true;
      }
    });

    if (changed) this.store.persistTrips();
  }

  private syncDriverVehicleAssignment(oldDriverName: string | undefined, newDriverName: string | undefined, plate: string): void {
    let changed = false;

    if (oldDriverName && oldDriverName !== '--') {
      const oldDriver = this.store.drivers.find((d) => d.name === oldDriverName && d.vehicle === plate);
      if (oldDriver) {
        oldDriver.vehicle = '--';
        changed = true;
      }
    }

    if (newDriverName && newDriverName !== '--') {
      const newDriver = this.store.drivers.find((d) => d.name === newDriverName);
      if (newDriver) {
        newDriver.vehicle = plate;
        changed = true;
      }
    }

    if (changed) this.store.persistDrivers();
  }
}
