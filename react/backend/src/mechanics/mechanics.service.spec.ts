import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MechanicsService } from './mechanics.service';

describe('MechanicsService', () => {
  const fleet = { userId: 'FM-101', role: 'fleet-manager' };
  let store: any;
  let service: MechanicsService;

  beforeEach(() => {
    store = {
      mechanics: [],
      persistMechanics: jest.fn(),
      generateId: jest.fn(() => `MC-${String(store.mechanics.length + 1).padStart(3, '0')}`),
    };
    service = new MechanicsService(store);
  });

  it('creates, retrieves, updates, and deactivates a fleet-scoped mechanic', () => {
    const created = service.create({ name: '  Central Workshop  ' }, fleet);

    expect(created).toEqual({
      id: 'MC-001',
      name: 'Central Workshop',
      active: true,
      fleetManagerId: 'FM-101',
    });
    expect(service.findAll('true', fleet)).toEqual([created]);
    expect(service.update(created.id, { name: 'Central Auto' }, fleet).name).toBe('Central Auto');
    expect(service.deactivate(created.id, fleet).active).toBe(false);
    expect(service.findAll('true', fleet)).toEqual([]);
    expect(service.findAll('false', fleet)).toEqual([created]);
    expect(store.persistMechanics).toHaveBeenCalledTimes(3);
  });

  it('enforces valid unique names and fleet-manager isolation', () => {
    service.create({ name: 'Central Workshop' }, fleet);
    expect(() => service.create({ name: 'central workshop' }, fleet)).toThrow(ConflictException);
    expect(() => service.create({ name: '   ' }, fleet)).toThrow(BadRequestException);
    expect(() => service.findOne('MC-001', { userId: 'FM-999', role: 'fleet-manager' })).toThrow(NotFoundException);
  });
});
