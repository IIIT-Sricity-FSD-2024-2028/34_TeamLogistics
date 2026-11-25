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

    return new DeliveriesService(store, {} as any, {} as any);
  }

  it('withholds unresolved legacy records from list and detail until ownership is assigned', () => {
    const delivery = {
      id: 'DR-2026-001',
      customer: 'Acme Logistics Inc.',
      status: 'Delivered',
    };
    const service = setup([delivery]);

    expect(service.findAll(undefined, undefined, requester)).toEqual([]);
    expect(() => service.findOne(delivery.id, requester)).toThrow('not found');
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

  it('returns OTP state without exposing the stored hash or attempt counter', () => {
    const delivery = {
      id: 'DR-2026-OTP',
      clientUserId: 'BC-1',
      customer: 'Acme Logistics',
      status: 'In Transit',
      deliveryOtpHash: 'secret-hash',
      deliveryOtpAttemptsRemaining: 4,
      deliveryOtpIssuedAt: '2026-11-23T10:00:00.000Z',
      deliveryOtpExpiresAt: '2026-11-24T10:00:00.000Z',
    };
    const service = setup([delivery]);

    const response: any = service.findOne(delivery.id, requester);
    expect(response.deliveryOtpHash).toBeUndefined();
    expect(response.deliveryOtpAttemptsRemaining).toBeUndefined();
    expect(response.deliveryOtp).toEqual({
      issued: true,
      issuedAt: delivery.deliveryOtpIssuedAt,
      expiresAt: delivery.deliveryOtpExpiresAt,
      verifiedAt: undefined,
    });
    expect(delivery.deliveryOtpHash).toBe('secret-hash');
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
    const service = new DeliveriesService(store, payouts, {} as any, {assertVerified: jest.fn()} as any);

    const delivery: any = service.create({
      customer: 'Untrusted name',
      recipientName: 'Recipient', recipientPhone: '+12025550123', phoneVerification: 'test', recipientEmail: 'receiver@example.test',
      routeId: 'chennai-local',
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

describe('availability-aware dispatch', () => {
  function setupDispatch() {
    const store:any = {
      users: [{id:'client',role:'business-client',name:'Client'}, {id:'d',role:'driver',name:'Driver',status:'Active'}],
      drivers:[{id:'d',name:'Driver',status:'Available',vehicle:'--',fleetManagerId:'f'}],
      vehicles:[{id:'v',plate:'DEMO',status:'Active',assignedDriver:'--',fleetManagerId:'f',capacity:'1 t',cargoCm:[100,100,100]}],
      trips:[], deliveryRequests:[], notifications:[],persistDrivers:jest.fn(),persistTrips:jest.fn(),persistDeliveries:jest.fn(),persistNotifications:jest.fn()
    };
    const rates:any = {getEffectiveCustomerRateCard:()=>({ownerId:'f',baseFare:30,perKm:5,perKg:3})};
    const service = new DeliveriesService(store,rates,{} as any,{assertVerified:jest.fn()} as any);
    const dto:any = {customer:'Client',recipientName:'Recipient',recipientEmail:'recipient@example.test',recipientPhone:'+12025550123',
      routeId:'chennai-local',pickup:'Depot',dropoff:'Destination',packageType:'Electronics',weight:1,type:'Standard',
      packageDimensions:{length:10,width:10,height:10,unit:'cm'}};
    const actor = {userId:'client',role:'business-client'};
    return {store, service, dto, actor};
  }

  it('reserves shared vehicles and drivers only when a booking is committed', () => {
    const {store, service, dto, actor} = setupDispatch();
    const quote = service.quote(dto);
    expect(store.trips).toHaveLength(0);
    expect(service.create({...dto,quotedTotal:quote.total},actor).status).toBe('Assigned');
    expect(store.trips[0]).toMatchObject({driverId:'d',vehicle:'DEMO',fleetManagerId:'f'});
    expect(service.create(dto,actor).status).toBe('Requested');
  });

  it('skips unavailable drivers, rotates freed drivers and queues bookings when everyone is reserved', () => {
    const {store, service, dto, actor} = setupDispatch();
    for (const id of ['a', 'b']) {
      store.users.push({...store.users[1], id, name:id});
      store.drivers.push({...store.drivers[0], id, name:id});
      store.vehicles.push({...store.vehicles[0], id, plate:id});
    }
    store.drivers.find((d: {id: string}) => d.id === 'a').status = 'Unavailable';
    expect(service.create(dto, actor).driverId).toBe('b');
    store.trips[0].status = 'Completed';
    expect(service.create(dto, actor).driverId).toBe('d');
    expect(service.create(dto, actor).driverId).toBe('b');
    expect(service.create(dto, actor).status).toBe('Requested');
    store.drivers.find((d: {id: string}) => d.id === 'a').status = 'Available';
    expect(service.create(dto, actor).driverId).toBe('a');
  });
});
