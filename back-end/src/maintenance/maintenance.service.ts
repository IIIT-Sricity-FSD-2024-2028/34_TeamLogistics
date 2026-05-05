import { Injectable, NotFoundException } from '@nestjs/common';
import { DataStoreService, MaintenanceSchedule } from '../data-store/data-store.service';
import { CreateMaintenanceDto, UpdateMaintenanceDto } from './dto/maintenance.dto';

@Injectable()
export class MaintenanceService {
  constructor(private readonly store: DataStoreService) {}

  findAll(search?: string): MaintenanceSchedule[] {
    let items = [...this.store.maintenanceSchedules];
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((m) => JSON.stringify(m).toLowerCase().includes(q));
    }
    return items;
  }

  findOne(id: string): MaintenanceSchedule {
    const item = this.store.maintenanceSchedules.find((m) => m.id === id);
    if (!item) throw new NotFoundException(`Maintenance schedule "${id}" not found`);
    return item;
  }

  create(dto: CreateMaintenanceDto): MaintenanceSchedule {
    const id = 'MT-2026-' + String(Date.now()).slice(-4);
    const schedule: MaintenanceSchedule = {
      id,
      vehicle: dto.vehicle,
      issue: dto.issue,
      priority: dto.priority,
      status: 'Scheduled',
      date: dto.date,
      mechanic: dto.mechanic,
      cost: dto.cost || '--',
      notes: dto.notes || '',
    };
    this.store.maintenanceSchedules.unshift(schedule);
    this.store.persistMaintenance();
    return schedule;
  }

  update(id: string, dto: UpdateMaintenanceDto): MaintenanceSchedule {
    const idx = this.store.maintenanceSchedules.findIndex((m) => m.id === id);
    if (idx < 0) throw new NotFoundException(`Maintenance schedule "${id}" not found`);
    this.store.maintenanceSchedules[idx] = { ...this.store.maintenanceSchedules[idx], ...dto };
    this.store.persistMaintenance();
    return this.store.maintenanceSchedules[idx];
  }

  remove(id: string): { message: string } {
    const idx = this.store.maintenanceSchedules.findIndex((m) => m.id === id);
    if (idx < 0) throw new NotFoundException(`Maintenance schedule "${id}" not found`);
    this.store.maintenanceSchedules.splice(idx, 1);
    this.store.persistMaintenance();
    return { message: `Maintenance schedule "${id}" deleted` };
  }
}
