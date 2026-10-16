import { MaintenanceService } from './maintenance.service';
import { MechanicsService } from '../mechanics/mechanics.service';

describe('Maintenance vehicle status synchronization', () => {
  function futureDate(days = 1) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function setup() {
    const store: any = {
      vehicles: [
        {
          id: 'VH-1',
          plate: 'TS-09-QA-2345',
          status: 'Active',
        },
      ],
      mechanics: [
        { id: 'MC-001', name: 'AutoCare Pro', active: true },
        { id: 'MC-002', name: 'SpeedFix Workshop', active: true },
      ],
      maintenanceSchedules: [],
      trips: [],
      persistVehicles: jest.fn(),
      persistMaintenance: jest.fn(),
    };

    return { store, service: new MaintenanceService(store, new MechanicsService(store)) };
  }

  it('marks a vehicle in maintenance as soon as maintenance is scheduled', () => {
    const { store, service } = setup();

    service.create({
      vehicle: 'TS-09-QA-2345',
      issue: 'Engine Oil Change',
      priority: 'Medium',
      date: futureDate(),
      mechanic: 'AutoCare Pro',
    });

    expect(store.vehicles[0]).toEqual(expect.objectContaining({
      status: 'Maintenance',
    }));
    expect(store.persistVehicles).toHaveBeenCalled();
  });

  it('rejects a second active maintenance schedule for the same vehicle', () => {
    const { store, service } = setup();
    service.create({
      vehicle: 'TS-09-QA-2345',
      issue: 'Engine Oil Change',
      priority: 'Medium',
      date: futureDate(),
      mechanic: 'AutoCare Pro',
    });

    expect(() => service.create({
        vehicle: 'TS-09-QA-2345',
        issue: 'Brake Pad Replacement',
        priority: 'High',
        date: futureDate(2),
        mechanic: 'SpeedFix Workshop',
      }),
    ).toThrow('already has active maintenance schedule');
    expect(store.maintenanceSchedules).toHaveLength(1);
  });

  it('restores the vehicle status after the final maintenance record is completed', () => {
    const { store, service } = setup();
    const schedule = service.create({
      vehicle: 'TS-09-QA-2345',
      issue: 'Engine Oil Change',
      priority: 'Medium',
      date: futureDate(),
      mechanic: 'AutoCare Pro',
    });

    service.update(schedule.id, { status: 'Completed' });

    expect(store.vehicles[0]).toEqual(expect.objectContaining({
      status: 'Active',
    }));
  });

  it('reconciles existing scheduled maintenance when the backend starts', () => {
    const { store } = setup();
    store.maintenanceSchedules.push({
      id: 'MT-1',
      vehicle: 'TS-09-QA-2345',
      status: 'Scheduled',
    });

    new MaintenanceService(store, new MechanicsService(store));

    expect(store.vehicles[0].status).toBe('Maintenance');
  });

  it('rejects a new maintenance schedule for today or a past date', () => {
    const { service } = setup();
    const today = new Date();
    const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    expect(() => service.create({
      vehicle: 'TS-09-QA-2345',
      issue: 'Engine Oil Change',
      priority: 'Medium',
      date: todayValue,
      mechanic: 'AutoCare Pro',
    })).toThrow('must be a future date');
  });
});

describe('Maintenance mechanic assignments', () => {
  const fleet = { userId: 'FM-101', role: 'fleet-manager' };
  let store: any;
  let service: MaintenanceService;

  beforeEach(() => {
    store = {
      vehicles: [{ id: 'VH-1', plate: 'TS-09-QA-2345', status: 'Active', fleetManagerId: 'FM-101' }],
      trips: [],
      mechanics: [
        { id: 'MC-001', name: 'Active Workshop', active: true, fleetManagerId: 'FM-101' },
        { id: 'MC-002', name: 'Inactive Workshop', active: false, fleetManagerId: 'FM-101' },
        { id: 'MC-003', name: 'Other Fleet Workshop', active: true, fleetManagerId: 'FM-999' },
      ],
      maintenanceSchedules: [
        {
          id: 'MT-LEGACY',
          vehicle: 'LEGACY-VEHICLE',
          issue: 'Engine Oil Change',
          priority: 'Low',
          status: 'Completed',
          date: '2026-01-01',
          mechanic: 'Active Workshop',
          cost: '--',
          fleetManagerId: 'FM-101',
        },
      ],
      persistVehicles: jest.fn(),
      persistMaintenance: jest.fn(),
    };
    service = new MaintenanceService(store, new MechanicsService(store));
  });

  it('resolves legacy records and creates and edits records using stable mechanic IDs', () => {
    expect(service.findOne('MT-LEGACY', fleet)).toMatchObject({
      mechanicId: 'MC-001',
      mechanic: 'Active Workshop',
    });

    const future = new Date();
    future.setDate(future.getDate() + 2);
    const date = future.toISOString().slice(0, 10);
    const created = service.create({
      vehicle: 'TS-09-QA-2345',
      issue: 'Brake Pad Replacement',
      priority: 'High',
      date,
      mechanicId: 'MC-001',
    }, fleet);

    expect(created).toMatchObject({ mechanicId: 'MC-001', mechanic: 'Active Workshop' });
    expect(service.update(created.id, { mechanic: 'Active Workshop' }, fleet)).toMatchObject({
      mechanicId: 'MC-001',
      mechanic: 'Active Workshop',
    });
  });

  it('rejects missing, invalid, inaccessible, and inactive mechanic selections', () => {
    const future = new Date();
    future.setDate(future.getDate() + 2);
    const base = {
      vehicle: 'TS-09-QA-2345',
      issue: 'Brake Pad Replacement',
      priority: 'High',
      date: future.toISOString().slice(0, 10),
    };

    expect(() => service.create(base, fleet)).toThrow('does not exist');
    expect(() => service.create({ ...base, mechanicId: 'MC-404' }, fleet)).toThrow('does not exist');
    expect(() => service.create({ ...base, mechanicId: 'MC-002' }, fleet)).toThrow('inactive');
    expect(() => service.create({ ...base, mechanicId: 'MC-003' }, fleet)).toThrow('does not exist');
  });
});
