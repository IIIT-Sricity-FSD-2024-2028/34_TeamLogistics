import { DeliveriesService } from './deliveries.service';

describe('DeliveriesService business-client access', () => {
  const requester = { userId: 'BC-1', role: 'business-client' };

  function setup(deliveries: any[]) {
    const store: any = {
      users: [
        {
          id: 'BC-1',
          role: 'business-client',
          name: 'Acm',
          username: 'acme-client',
          profileDetails: { companyName: 'Acme Logistics' },
        },
      ],
      deliveryRequests: deliveries,
      trips: [],
      drivers: [],
      notifications: [],
    };

    return new DeliveriesService(store, {} as any);
  }

  it('uses the same legacy company-name match for the list and detail endpoints', () => {
    const delivery = {
      id: 'DR-2026-001',
      customer: 'Acme Logistics Inc.',
      status: 'Delivered',
    };
    const service = setup([delivery]);

    expect(service.findAll(undefined, undefined, requester)).toEqual([delivery]);
    expect(service.findOne(delivery.id, requester)).toBe(delivery);
  });

  it('does not treat a longer, different company name as the same client', () => {
    const delivery = {
      id: 'DR-2026-002',
      customer: 'Acme Logistics Services',
      status: 'Delivered',
    };
    const service = setup([delivery]);

    expect(service.findAll(undefined, undefined, requester)).toEqual([]);
    expect(() => service.findOne(delivery.id, requester)).toThrow('not found');
  });

  it('uses the stored client ID when a company changes its name', () => {
    const delivery = {
      id: 'DR-2026-003',
      clientUserId: 'BC-1',
      customer: 'Previous Company Name',
      status: 'Delivered',
    };
    const service = setup([delivery]);

    expect(service.findOne(delivery.id, requester)).toBe(delivery);
  });

  it.each([
    [{ rating: 5, driverBehavior: 'Excellent', overallExperience: 'Very satisfied' }, 'delivery quality'],
    [{ rating: 5, deliveryQuality: 'Excellent', overallExperience: 'Very satisfied' }, 'driver behavior'],
    [{ rating: 5, deliveryQuality: 'Excellent', driverBehavior: 'Excellent' }, 'overall experience'],
  ])('rejects feedback when a required selection is missing', (feedback, expectedMessage) => {
    const delivery = {
      id: 'DR-2026-004',
      clientUserId: 'BC-1',
      customer: 'Acme Logistics',
      status: 'Delivered',
    };
    const service = setup([delivery]);

    expect(() => service.submitFeedback(delivery.id, feedback as any, requester))
      .toThrow(expectedMessage);
  });
});

describe('DeliveriesService package pricing sync', () => {
  it('stores the same dimensions-and-weight price on the delivery and linked trip', () => {
    const store: any = {
      users: [{ id: 'BC-1', role: 'business-client', name: 'Acme', phone: '9876543210' }],
      deliveryRequests: [],
      trips: [],
      drivers: [],
      vehicles: [],
      notifications: [],
      persistDeliveries: jest.fn(),
      persistTrips: jest.fn(),
      persistNotifications: jest.fn(),
    };
    const payouts: any = {
      findFleetManagerIdForDriverName: jest.fn(() => undefined),
      getEffectiveCustomerRateCard: jest.fn(() => ({ ownerId: 'PLATFORM', baseFare: 80, perKg: 8 })),
    };
    const service = new DeliveriesService(store, payouts);

    const delivery: any = service.create({
      customer: 'Untrusted name',
      pickup: 'Chennai',
      dropoff: 'Bengaluru',
      packageType: 'Electronics',
      packageDimensions: { length: 100, width: 50, height: 40, unit: 'cm' },
      weight: 5,
      type: 'Standard',
    }, { userId: 'BC-1', role: 'business-client' });

    expect(delivery.pricing).toEqual(expect.objectContaining({
      actualWeightKg: 5,
      volumetricWeightKg: 40,
      chargeableWeightKg: 40,
      total: 400,
    }));
    expect(delivery.amount).toBe(400);
    expect(store.trips[0].pricing).toEqual(delivery.pricing);
    expect(store.trips[0].amount).toBe(delivery.amount);
  });
});
