import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataStoreService, Vehicle } from '../data-store/data-store.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly store: DataStoreService) {}

  findAll(
    search?: string,
    statusFilter?: string,
    requester?: { userId: string; role: string },
  ) {
    let vehicles = [...this.store.vehicles];

    if (requester && requester.role === 'fleet-manager') {
      vehicles = vehicles.filter(
        (v) => v.fleetManagerId === requester.userId,
      );
    }

    if (requester?.role === 'business-client') {
      const deliveryIds = new Set(this.store.deliveryRequests.filter((d) => d.clientUserId === requester.userId).map((d) => d.id));
      const plates = new Set(this.store.trips.filter((trip) => trip.request && deliveryIds.has(trip.request)).map((trip) => trip.vehicle));
      return vehicles.filter((v) => plates.has(v.plate))
        .filter((v) => !search || v.plate.toLowerCase().includes(search.toLowerCase()))
        .map(({ id, plate, type }) => ({ id, plate, type }));
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

  findOne(id: string, requester?: { userId: string; role: string }) {
    const vehicle = this.store.vehicles.find((v) => v.id === id);

    if (requester?.role === 'business-client') {
      const assignedVehicle = this.findAll(undefined, undefined, requester).find((v) => v.id === id);
      if (assignedVehicle) return assignedVehicle;
      throw new NotFoundException('Vehicle not found');
    }
    if (!vehicle) {
      throw new NotFoundException(`Vehicle "${id}" not found`);
    }

    if (
      requester &&
      requester.role === 'fleet-manager' &&

      vehicle.fleetManagerId !== requester.userId
    ) {
      throw new NotFoundException(`Vehicle "${id}" not found`);
    }

    return vehicle;
  }

  create(dto: CreateVehicleDto, requester?: { userId: string; role: string }): Vehicle {
    const owner = requester?.role === 'fleet-manager' ? requester.userId : undefined;
    this.validateIdentity(dto.plate, dto.assignedDriver, owner);
    const id = 'VH-' + randomUUID();

    const vehicle: Vehicle = {
      id,
      plate: dto.plate,
      type: dto.type,
      capacity: dto.capacity || '--',
      cargoCm: dto.cargoCm, handling: dto.handling, routeIds: dto.routeIds,
      assignedDriver: dto.assignedDriver || '--',
      status: dto.status || 'Active',
      maintenance: dto.maintenance || dto.lastMaintenance || '',
      fleetManagerId: requester?.role === 'fleet-manager' ? requester.userId : undefined,
    };

    this.store.vehicles.push(vehicle);
    this.syncDriverVehicleAssignment(undefined, vehicle.assignedDriver, vehicle.plate, vehicle.plate, owner);
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

      this.store.vehicles[idx].fleetManagerId !== requester.userId
    ) {
      throw new NotFoundException(`Vehicle "${id}" not found`);
    }

    const owner = this.store.vehicles[idx].fleetManagerId;
    this.validateIdentity(dto.plate, dto.assignedDriver, owner, id);
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
      this.propagateVehicleIdentityToTrips(oldPlate, updated.plate, owner, updated.type);
    }

    if (oldPlate !== updated.plate || oldAssignedDriver !== updated.assignedDriver) {
      this.syncDriverVehicleAssignment(oldAssignedDriver, updated.assignedDriver, oldPlate, updated.plate, owner);
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

  private validateIdentity(plate?: string, driverName?: string, owner?: string, excludeId?: string) {
    const normalize = (p: string) => p.replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (plate !== undefined && (!normalize(plate) || this.store.vehicles.some(v => v.id !== excludeId && normalize(v.plate) === normalize(plate))))
      throw new BadRequestException('Enter a unique vehicle registration');
    if (driverName && driverName !== '--' &&
        this.store.drivers.filter(d => d.name === driverName && d.fleetManagerId === owner).length !== 1)
      throw new BadRequestException('Select an identifiable driver from this fleet');
  }

  private isTerminalTripStatus(status: string): boolean {
    const s = String(status || '').toLowerCase();
    return ['completed', 'delivered', 'rejected', 'cancelled', 'canceled', 'returned'].includes(s);
  }

  private propagateVehicleIdentityToTrips(oldPlate: string, newPlate: string, owner?: string, newType?: string): void {
    let changed = false;

    this.store.trips.forEach((t: any) => {
      if (t.fleetManagerId === owner && t.vehicle === oldPlate && !this.isTerminalTripStatus(t.status)) {
        t.vehicle = newPlate;
        if (newType) t.vehicleType = newType;
        changed = true;
      }
    });

    if (changed) this.store.persistTrips();
  }

  private syncDriverVehicleAssignment(oldDriverName: string | undefined, newDriverName: string | undefined, oldPlate: string, plate: string, owner?: string): void {
    let changed = false;

    if (oldDriverName && oldDriverName !== '--') {
      const oldDriver = this.store.drivers.find((d) => d.fleetManagerId === owner && d.name === oldDriverName && d.vehicle === oldPlate);
      if (oldDriver) {
        oldDriver.vehicle = '--';
        changed = true;
      }
    }

    if (newDriverName && newDriverName !== '--') {
      const newDriver = this.store.drivers.find((d) => d.fleetManagerId === owner && d.name === newDriverName);
      if (newDriver) {
        newDriver.vehicle = plate;
        changed = true;
      }
    }

    if (changed) this.store.persistDrivers();
  }
}
