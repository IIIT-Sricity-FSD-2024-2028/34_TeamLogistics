import { NotFoundException } from '@nestjs/common';
import { DriversService } from './drivers.service';

describe('DriversService compliance notifications', () => {
  function setup() {
    const store = {
      trips: [],
      drivers: [{
        id: 'DR-101',
        name: 'Asha Rao',
        email: 'asha@example.com',
        fleetManagerId: 'FM-101',
      }],
      users: [{
        id: 'DR-101',
        name: 'Asha Rao',
        email: 'asha@example.com',
        role: 'driver',
      }],
    } as any;
    const notificationsService = { create: jest.fn((payload) => payload) } as any;
    const service = new DriversService(store, {} as any, notificationsService);
    return { service, notificationsService };
  }

  it('targets the linked driver account', () => {
    const { service, notificationsService } = setup();

    service.notifyCompliance(
      'DR-101',
      'Your Driver License has expired. Please renew it.',
      { userId: 'FM-101', role: 'fleet-manager' },
    );

    expect(notificationsService.create).toHaveBeenCalledWith({
      title: 'Driver compliance action required',
      message: 'Your Driver License has expired. Please renew it.',
      to: 'driver',
      toUserId: 'DR-101',
    });
  });

  it('does not let a fleet manager notify another fleet manager\'s driver', () => {
    const { service } = setup();

    expect(() => service.notifyCompliance(
      'DR-101',
      'Your Driver License has expired. Please renew it.',
      { userId: 'FM-999', role: 'fleet-manager' },
    )).toThrow(NotFoundException);
  });
});

describe('DriversService fleet-manager list', () => {
  it('excludes unlinked, Document Review, and legacy Active driver profiles', () => {
    const store = {
      trips: [],
      drivers: [
        { id: 'DR-101', status: 'Available', fleetManagerId: 'FM-101' },
        { id: 'DR-102', status: 'Document Review', fleetManagerId: 'FM-101' },
        { id: 'DR-103', status: 'Active', fleetManagerId: 'FM-101' },
        { id: 'DR-999', status: 'Available', fleetManagerId: 'FM-101' },
        { id: 'DR-201', status: 'Available', fleetManagerId: 'FM-202' },
      ],
      users: [
        { id: 'DR-101', role: 'driver', status: 'Active' },
        { id: 'DR-102', role: 'driver', status: 'Document Review' },
        { id: 'DR-103', role: 'driver', status: 'Active' },
        { id: 'DR-201', role: 'driver', status: 'Active' },
      ],
    } as any;
    const service = new DriversService(store, {} as any, {} as any);

    expect(service.findAll(undefined, { userId: 'FM-101', role: 'fleet-manager' }))
      .toEqual([{ id: 'DR-101', status: 'Available', fleetManagerId: 'FM-101' }]);
  });
});

describe('driver availability', () => {
  it('keeps the idle choice independent of account access and derives work from the assignment', () => {
    const driver = {id: 'a', name: 'Driver A', status: 'Available'};
    const account = {...driver, role: 'driver', status: 'Active'};
    const store: any = {drivers: [driver], users: [account], trips: [],
      persistDrivers: jest.fn(), persistUsers: jest.fn()};
    const service = new DriversService(store, {} as any, {} as any);
    const actor = {userId: driver.id, role: 'driver'};
    expect(() => service.update('a', {status: 'Unavailable'}, {...actor, userId:'b'})).toThrow(NotFoundException);
    service.update('a', {status: 'Unavailable'}, actor);
    expect(service.findOne('a', actor).status).toBe('Unavailable');
    expect(store.users[0].status).toBe('Active');
    service.update('a', {status: 'Available'}, actor);
    store.trips.push({driverId:'a', status:'Assigned'});
    for (const status of ['Assigned', 'Accepted', 'In Transit', 'Attempt Failed', 'Returning']) {
      store.trips[0].status = status;
      expect(service.findOne('a', actor).status).toBe('In Work');
      expect(() => service.update('a', {status:'Available'}, actor)).toThrow('assigned delivery');
    }
    store.trips[0].status = 'Returned';
    expect(service.findOne('a', actor).status).toBe('Available');
  });
});
