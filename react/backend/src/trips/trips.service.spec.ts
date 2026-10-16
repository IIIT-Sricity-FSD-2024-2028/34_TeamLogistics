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
