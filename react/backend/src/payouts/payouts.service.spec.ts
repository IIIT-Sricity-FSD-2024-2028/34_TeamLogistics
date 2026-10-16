import { PayoutsService } from './payouts.service';

describe('PayoutsService payment statuses', () => {
  it('returns legacy Earned payouts as Unpaid in fleet and driver ledgers', () => {
    const store = {
      driverPayouts: [
        { id: 'PAYOUT-1', driverName: 'Asha Rao', fleetManagerId: 'FM-101', status: 'Earned' },
        { id: 'PAYOUT-2', driverName: 'Asha Rao', fleetManagerId: 'FM-101', status: 'Paid' },
      ],
    } as any;
    const service = new PayoutsService(store);

    expect(service.listDriverPayouts({ userId: 'FM-101', role: 'fleet-manager' }).map((payout) => payout.status))
      .toEqual(['Unpaid', 'Paid']);
    expect(service.getDriverPayouts('Asha Rao').map((payout) => payout.status))
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
