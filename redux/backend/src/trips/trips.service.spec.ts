import { TripsService } from './trips.service';

describe('TripsService status normalization', () => {
  function createService() {
    const store = {
      trips: [
        { id: 'TRIP-101', status: 'Delivered' },
        { id: 'TRIP-102', status: 'Completed' },
        { id: 'TRIP-103', status: 'In Transit' },
      ],
      users: [],
      deliveryRequests: [],
    } as any;
    return new TripsService(store, {} as any, {} as any);
  }

  it('returns Completed for legacy Delivered trip records', () => {
    const service = createService();

    expect(service.findAll()).toEqual([
      { id: 'TRIP-101', status: 'Completed' },
      { id: 'TRIP-102', status: 'Completed' },
      { id: 'TRIP-103', status: 'In Transit' },
    ]);
    expect(service.findOne('TRIP-101').status).toBe('Completed');
  });
});

it('scopes trips with duplicate driver names by immutable fleet and driver IDs', () => {
  const store: any = {trips:[{id:'one',driver:'Alex',driverId:'D1',fleetManagerId:'F1',status:'Assigned'},
    {id:'two',driver:'Alex',driverId:'D2',fleetManagerId:'F2',status:'Assigned'},
    {id:'unknown',driver:'Alex',status:'Assigned'}],drivers:[{id:'D1',name:'Alex',fleetManagerId:'F1'}]};
  const service = new TripsService(store,{} as any,{} as any);
  expect(service.findAll(undefined,{userId:'F1',role:'fleet-manager'}).map(t=>t.id)).toEqual(['one']);
  expect(service.findAll(undefined,{userId:'D2',role:'driver'}).map(t=>t.id)).toEqual(['two']);
  expect(() => service.findOne('unknown',{userId:'D1',role:'driver'})).toThrow('not found');
});
