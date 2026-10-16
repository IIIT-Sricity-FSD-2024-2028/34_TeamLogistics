import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataStoreService, Mechanic } from '../data-store/data-store.service';
import { CreateMechanicDto, UpdateMechanicDto } from './dto/mechanic.dto';

type Requester = { userId: string; role: string };

@Injectable()
export class MechanicsService {
  constructor(private readonly store: DataStoreService) {}

  findAll(activeFilter?: string, requester?: Requester): Mechanic[] {
    let mechanics = this.accessibleMechanics(requester);

    if (activeFilter === 'true' || activeFilter === 'false') {
      const active = activeFilter === 'true';
      mechanics = mechanics.filter((mechanic) => mechanic.active === active);
    }

    return mechanics.sort((a, b) => a.name.localeCompare(b.name));
  }

  findOne(id: string, requester?: Requester): Mechanic {
    const mechanic = this.store.mechanics.find((item) => item.id === id);
    if (!mechanic || !this.isAccessible(mechanic, requester)) {
      throw new NotFoundException(`Mechanic "${id}" not found`);
    }
    return mechanic;
  }

  create(dto: CreateMechanicDto, requester?: Requester): Mechanic {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Mechanic name is required');
    this.assertUniqueName(name, undefined, requester);

    const mechanic: Mechanic = {
      id: this.store.generateId('MC', this.store.mechanics),
      name,
      active: dto.active ?? true,
      fleetManagerId: requester?.role === 'fleet-manager' ? requester.userId : undefined,
    };

    this.store.mechanics.push(mechanic);
    this.store.persistMechanics();
    return mechanic;
  }

  update(id: string, dto: UpdateMechanicDto, requester?: Requester): Mechanic {
    const mechanic = this.findOne(id, requester);
    const name = dto.name === undefined ? mechanic.name : dto.name.trim();
    if (!name) throw new BadRequestException('Mechanic name is required');
    this.assertUniqueName(name, id, requester);

    Object.assign(mechanic, {
      name,
      active: dto.active ?? mechanic.active,
    });
    this.store.persistMechanics();
    return mechanic;
  }

  deactivate(id: string, requester?: Requester): Mechanic {
    return this.update(id, { active: false }, requester);
  }

  resolveActive(mechanicId?: string, legacyName?: string, requester?: Requester): Mechanic {
    const mechanic = mechanicId
      ? this.store.mechanics.find((item) => item.id === mechanicId)
      : this.accessibleMechanics(requester).find(
          (item) => item.name.toLowerCase() === String(legacyName || '').trim().toLowerCase(),
        );

    if (!mechanic || !this.isAccessible(mechanic, requester)) {
      throw new BadRequestException('Selected mechanic does not exist or is not available to this account');
    }
    if (!mechanic.active) {
      throw new BadRequestException(`Mechanic "${mechanic.name}" is inactive`);
    }
    return mechanic;
  }

  private accessibleMechanics(requester?: Requester): Mechanic[] {
    if (requester?.role !== 'fleet-manager') return [...this.store.mechanics];
    return this.store.mechanics.filter(
      (mechanic) => !mechanic.fleetManagerId || mechanic.fleetManagerId === requester.userId,
    );
  }

  private isAccessible(mechanic: Mechanic, requester?: Requester): boolean {
    return requester?.role !== 'fleet-manager' ||
      !mechanic.fleetManagerId ||
      mechanic.fleetManagerId === requester.userId;
  }

  private assertUniqueName(name: string, currentId?: string, requester?: Requester): void {
    const duplicate = this.accessibleMechanics(requester).find(
      (mechanic) => mechanic.id !== currentId && mechanic.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) throw new ConflictException(`Mechanic "${name}" already exists`);
  }
}
