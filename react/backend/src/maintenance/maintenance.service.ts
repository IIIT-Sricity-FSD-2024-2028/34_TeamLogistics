import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataStoreService, MaintenanceSchedule } from '../data-store/data-store.service';
import { MechanicsService } from '../mechanics/mechanics.service';
import { CreateMaintenanceDto, UpdateMaintenanceDto } from './dto/maintenance.dto';
import { assertFutureDateOnly } from '../common/date-validation';

type Requester = { userId: string; role: string };

@Injectable()
export class MaintenanceService {
  private static readonly ACTIVE_MAINTENANCE_STATUSES = [
    'scheduled',
    'in progress',
    'under maintenance',
    'overdue',
  ];

  constructor(
    private readonly store: DataStoreService,
    private readonly mechanicsService: MechanicsService,
  ) {
    let vehiclesChanged = false;
    for (const vehicle of this.store.vehicles) {
      vehiclesChanged = this.syncVehicleStatus(vehicle.plate, false) || vehiclesChanged;
    }
    if (vehiclesChanged) this.store.persistVehicles();
  }

  private isActiveMaintenanceStatus(status: string): boolean {
    return MaintenanceService.ACTIVE_MAINTENANCE_STATUSES.includes(String(status || '').toLowerCase().trim());
  }

  private assertVehicleCanBeScheduled(vehiclePlate: string, requester?: Requester, excludeId?: string): void {
    const normalizedPlate = String(vehiclePlate || '').toLowerCase().trim();
    const vehicle = this.store.vehicles.find(
      (item) => String(item.plate || '').toLowerCase().trim() === normalizedPlate,
    );

    if (!vehicle || (
      requester?.role === 'fleet-manager' &&
      vehicle.fleetManagerId &&
      vehicle.fleetManagerId !== requester.userId
    )) {
      throw new NotFoundException(`Vehicle "${vehiclePlate}" not found`);
    }

    const existing = this.store.maintenanceSchedules.find(
      (item) =>
        item.id !== excludeId &&
        String(item.vehicle || '').toLowerCase().trim() === normalizedPlate &&
        this.isActiveMaintenanceStatus(item.status),
    );

    if (existing) {
      throw new BadRequestException(
        `Vehicle "${vehiclePlate}" already has active maintenance schedule "${existing.id}"`,
      );
    }
  }

  private syncVehicleStatus(vehiclePlate: string, persist = true): boolean {
    const vehicle = this.store.vehicles.find(
      (item) => String(item.plate || '').toLowerCase().trim() === String(vehiclePlate || '').toLowerCase().trim(),
    );
    if (!vehicle) return false;

    const hasActiveMaintenance = this.store.maintenanceSchedules.some(
      (item) =>
        String(item.vehicle || '').toLowerCase().trim() === String(vehiclePlate || '').toLowerCase().trim() &&
        this.isActiveMaintenanceStatus(item.status),
    );
    const hasActiveTrip = this.store.trips.some(
      (trip) =>
        String(trip.vehicle || '').toLowerCase().trim() === String(vehiclePlate || '').toLowerCase().trim() &&
        ['accepted', 'picked up', 'in transit', 'issue reported'].includes(String(trip.status || '').toLowerCase().trim()),
    );

    const nextStatus = hasActiveMaintenance ? 'Maintenance' : hasActiveTrip ? 'On Trip' : 'Active';
    const changed = vehicle.status !== nextStatus;

    if (changed) {
      vehicle.status = nextStatus;
      if (persist) this.store.persistVehicles();
    }

    return changed;
  }

  findAll(search?: string, requester?: Requester): MaintenanceSchedule[] {
    let items = [...this.store.maintenanceSchedules];

    if (requester && requester.role === 'fleet-manager') {
      items = items.filter(
        (m) => !m.fleetManagerId || m.fleetManagerId === requester.userId,
      );
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((m) => JSON.stringify(m).toLowerCase().includes(q));
    }
    return items.map((item) => this.withResolvedMechanic(item, requester));
  }

  findOne(id: string, requester?: Requester): MaintenanceSchedule {
    const item = this.store.maintenanceSchedules.find((m) => m.id === id);
    if (!item) throw new NotFoundException(`Maintenance schedule "${id}" not found`);

    if (
      requester &&
      requester.role === 'fleet-manager' &&
      item.fleetManagerId &&
      item.fleetManagerId !== requester.userId
    ) {
      throw new NotFoundException(`Maintenance schedule "${id}" not found`);
    }

    return this.withResolvedMechanic(item, requester);
  }

  create(dto: CreateMaintenanceDto, requester?: Requester): MaintenanceSchedule {
    assertFutureDateOnly(dto.date, 'Scheduled maintenance date');
    const mechanic = this.mechanicsService.resolveActive(dto.mechanicId, dto.mechanic, requester);
    this.assertVehicleCanBeScheduled(dto.vehicle, requester);
    const id = 'MT-2026-' + String(Date.now()).slice(-4);
    const schedule: MaintenanceSchedule = {
      id,
      vehicle: dto.vehicle,
      issue: dto.issue,
      priority: dto.priority,
      status: 'Scheduled',
      date: dto.date,
      mechanicId: mechanic.id,
      mechanic: mechanic.name,
      cost: dto.cost || '--',
      notes: dto.notes || '',
      fleetManagerId: requester?.role === 'fleet-manager' ? requester.userId : undefined,
    };
    this.store.maintenanceSchedules.unshift(schedule);
    this.store.persistMaintenance();
    this.syncVehicleStatus(schedule.vehicle);
    return schedule;
  }

  update(id: string, dto: UpdateMaintenanceDto, requester?: Requester): MaintenanceSchedule {
    const idx = this.store.maintenanceSchedules.findIndex((m) => m.id === id);
    if (idx < 0) throw new NotFoundException(`Maintenance schedule "${id}" not found`);

    if (
      requester &&
      requester.role === 'fleet-manager' &&
      this.store.maintenanceSchedules[idx].fleetManagerId &&
      this.store.maintenanceSchedules[idx].fleetManagerId !== requester.userId
    ) {
      throw new NotFoundException(`Maintenance schedule "${id}" not found`);
    }

    const previousVehicle = this.store.maintenanceSchedules[idx].vehicle;
    const previousDate = this.store.maintenanceSchedules[idx].date;
    if (dto.date && dto.date !== previousDate) {
      assertFutureDateOnly(dto.date, 'Scheduled maintenance date');
    }
    const nextVehicle = dto.vehicle ?? previousVehicle;
    const nextStatus = dto.status ?? this.store.maintenanceSchedules[idx].status;
    if (this.isActiveMaintenanceStatus(nextStatus)) {
      this.assertVehicleCanBeScheduled(nextVehicle, requester, id);
    }
    const definedUpdates: UpdateMaintenanceDto & { mechanic?: string; mechanicId?: string } =
      Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined));
    if (dto.mechanicId !== undefined || dto.mechanic !== undefined) {
      const mechanic = this.mechanicsService.resolveActive(dto.mechanicId, dto.mechanic, requester);
      definedUpdates.mechanicId = mechanic.id;
      definedUpdates.mechanic = mechanic.name;
    }
    this.store.maintenanceSchedules[idx] = { ...this.store.maintenanceSchedules[idx], ...definedUpdates };
    this.store.persistMaintenance();
    this.syncVehicleStatus(previousVehicle);
    this.syncVehicleStatus(this.store.maintenanceSchedules[idx].vehicle);
    return this.withResolvedMechanic(this.store.maintenanceSchedules[idx], requester);
  }

  remove(id: string, requester?: Requester): { message: string } {
    const idx = this.store.maintenanceSchedules.findIndex((m) => m.id === id);
    if (idx < 0) throw new NotFoundException(`Maintenance schedule "${id}" not found`);

    if (
      requester &&
      requester.role === 'fleet-manager' &&
      this.store.maintenanceSchedules[idx].fleetManagerId &&
      this.store.maintenanceSchedules[idx].fleetManagerId !== requester.userId
    ) {
      throw new NotFoundException(`Maintenance schedule "${id}" not found`);
    }

    const vehicle = this.store.maintenanceSchedules[idx].vehicle;
    this.store.maintenanceSchedules.splice(idx, 1);
    this.store.persistMaintenance();
    this.syncVehicleStatus(vehicle);
    return { message: `Maintenance schedule "${id}" deleted` };
  }

  private withResolvedMechanic(schedule: MaintenanceSchedule, requester?: Requester): MaintenanceSchedule {
    const accessibleMechanics = requester?.role === 'fleet-manager'
      ? this.store.mechanics.filter(
          (item) => !item.fleetManagerId || item.fleetManagerId === requester.userId,
        )
      : this.store.mechanics;
    const mechanic = schedule.mechanicId
      ? accessibleMechanics.find((item) => item.id === schedule.mechanicId)
      : accessibleMechanics.find(
          (item) => item.name.toLowerCase() === String(schedule.mechanic || '').trim().toLowerCase(),
        );

    if (!mechanic) return { ...schedule };
    return { ...schedule, mechanicId: mechanic.id, mechanic: mechanic.name };
  }
}
