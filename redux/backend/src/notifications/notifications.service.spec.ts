import { NotificationsService } from './notifications.service';

describe('Account-scoped notification actions', () => {
  function setup() {
    const store: any = {
      notifications: [
        { id: 'broadcast', title: 'Fleet update', to: 'fleet-manager', read: false, createdAt: '2026-10-08T10:00:00Z' },
        { id: 'private', title: 'Driver update', to: 'driver', toUserId: 'driver-1', read: false, createdAt: '2026-10-08T11:00:00Z' },
      ],
      persistNotifications: jest.fn(),
    };
    return { service: new NotificationsService(store), store };
  }

  it('keeps read and unread state independent for role-wide alerts', () => {
    const { service } = setup();
    service.markOne('broadcast', true, 'fleet-manager', 'manager-1');
    expect(service.findAll('fleet-manager', 'manager-1')[0].read).toBe(true);
    expect(service.findAll('fleet-manager', 'manager-2')[0].read).toBe(false);
    service.markAllRead('fleet-manager', 'manager-2');
    service.markOne('broadcast', false, 'fleet-manager', 'manager-1');
    expect(service.findAll('fleet-manager', 'manager-1')[0].read).toBe(false);
    expect(service.findAll('fleet-manager', 'manager-2')[0].read).toBe(true);
  });

  it('persists dismissal for one recipient without deleting another recipient’s alert', () => {
    const { service, store } = setup();
    service.remove('broadcast', 'fleet-manager', 'manager-1');
    expect(service.findAll('fleet-manager', 'manager-1')).toEqual([]);
    expect(service.findAll('fleet-manager', 'manager-2')).toHaveLength(1);
    expect(store.persistNotifications).toHaveBeenCalled();
  });

  it('blocks other accounts from modifying private notifications', () => {
    const { service } = setup();
    expect(service.findAll('driver', 'driver-2')).toEqual([]);
    expect(() => service.markOne('private', true, 'driver', 'driver-2')).toThrow('your own notifications');
    expect(() => service.remove('private', 'superuser', 'admin')).toThrow('your own notifications');
    service.remove('private', 'driver', 'driver-1');
    expect(service.findAll('driver', 'driver-1')).toEqual([]);
  });
});
