import { PayoutsService } from './payouts.service';

describe('PayoutsService payment statuses', () => {
  it('returns legacy Earned payouts as Unpaid in fleet and driver ledgers', () => {
    const store = {
      drivers: [{ id: 'DR-1', name: 'Asha Rao' }],
      driverPayouts: [
        { id: 'PAYOUT-1', driverId: 'DR-1', driverName: 'Asha Rao', fleetManagerId: 'FM-101', status: 'Earned' },
        { id: 'PAYOUT-2', driverId: 'DR-1', driverName: 'Asha Rao', fleetManagerId: 'FM-101', status: 'Paid' },
      ],
    } as any;
    const service = new PayoutsService(store);

    expect(service.listDriverPayouts({ userId: 'FM-101', role: 'fleet-manager' }).map((payout) => payout.status))
      .toEqual(['Unpaid', 'Paid']);
    expect(service.getDriverPayouts('DR-1').map((payout) => payout.status))
      .toEqual(['Unpaid', 'Paid']);
  });

  it('approves both legacy Earned and canonical Unpaid payouts', () => {
    const store = {
      driverPayouts: [
        { id: 'PAYOUT-1', deliveryId: 'DEL-1', driverName: 'Asha Rao', status: 'Earned' },
        { id: 'PAYOUT-2', deliveryId: 'DEL-2', driverName: 'Asha Rao', status: 'Unpaid' },
      ],
      users: [],
      notifications: [],
      persistDriverPayouts: jest.fn(),
      persistNotifications: jest.fn(),
    } as any;
    const service = new PayoutsService(store);

    expect(service.approveForDelivery('DEL-1')?.status).toBe('Approved');
    expect(service.approveForDelivery('DEL-2')?.status).toBe('Approved');
  });
});

describe('PayoutsService fleet-manager settlements', () => {
  function setup() {
    const store = {
      users: [
        { id: 'SU-001', name: 'Admin', role: 'superuser' },
        { id: 'FM-101', name: 'Fleet One', role: 'fleet-manager' },
        { id: 'FM-202', name: 'Fleet Two', role: 'fleet-manager' },
      ],
      settlements: [],
      driverPayouts: [
        {
          id: 'PAYOUT-1',
          tripId: 'TRIP-1',
          deliveryId: 'DEL-1',
          fleetManagerId: 'FM-101',
          totalAmount: 100,
          status: 'Approved',
          earnedAt: '2026-10-12T10:00:00.000Z',
          createdAt: '2026-10-12T10:00:00.000Z',
        },
      ],
      transactions: [],
      maintenanceSchedules: [],
      trips: [],
      persistSettlements: jest.fn(),
      generateId: jest.fn(() => 'STL-001'),
    } as any;
    return { store, service: new PayoutsService(store) };
  }

  const superuser = { userId: 'SU-001', role: 'superuser' };

  it('creates an open settlement period once and exposes its statement status', () => {
    const { store, service } = setup();
    const first = service.createSettlement(
      { fleetManagerId: 'FM-101', month: '2026-10' },
      superuser,
    );
    const duplicate = service.createSettlement(
      { fleetManagerId: 'FM-101', month: '2026-10' },
      superuser,
    );

    expect(first).toBe(duplicate);
    expect(store.settlements).toHaveLength(1);
    expect(first).toMatchObject({
      id: 'STL-001',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      status: 'open',
    });
    expect(service.getFleetManagerStatement('FM-101', '2026-10').status).toBe('open');
  });

  it('blocks fleet managers from locking settlement periods', () => {
    const { service } = setup();
    expect(() => service.lockSettlement(
      { fleetManagerId: 'FM-101', month: '2026-10' },
      { userId: 'FM-101', role: 'fleet-manager' },
    )).toThrow('Only a superuser');
  });

  it('refuses to lock while payouts remain unpaid', () => {
    const { service } = setup();
    expect(() => service.lockSettlement(
      { fleetManagerId: 'FM-101', month: '2026-10' },
      superuser,
    )).toThrow('payouts remain unpaid');
  });

  it('locks a fully paid period and serves its immutable financial snapshot', () => {
    const { store, service } = setup();
    store.driverPayouts[0].status = 'Paid';

    const locked = service.lockSettlement(
      { fleetManagerId: 'FM-101', month: '2026-10' },
      superuser,
    );
    expect(locked.status).toBe('locked');
    expect(locked.lockedBy).toBe('SU-001');
    expect(locked.snapshot).toBeDefined();
    expect(store.persistSettlements).toHaveBeenCalledTimes(1);

    store.driverPayouts[0].totalAmount = 9999;
    const statement = service.getFleetManagerStatement('FM-101', '2026-10');
    expect(statement.status).toBe('locked');
    expect(statement.driverEarnings).toBe(100);
  });

  it('scopes fleet-manager settlement lists to the authenticated fleet', () => {
    const { store, service } = setup();
    store.settlements.push(
      { id: 'STL-1', fleetManagerId: 'FM-101', month: '2026-10', status: 'open' },
      { id: 'STL-2', fleetManagerId: 'FM-202', month: '2026-10', status: 'open' },
    );

    const visible = service.listSettlements({ userId: 'FM-101', role: 'fleet-manager' });
    expect(visible).toHaveLength(1);
    expect(visible[0].fleetManagerId).toBe('FM-101');
  });
});
