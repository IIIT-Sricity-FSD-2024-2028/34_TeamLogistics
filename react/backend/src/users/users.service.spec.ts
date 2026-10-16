import { UsersService } from './users.service';

describe('Registration approvals', () => {
  function setup() {
    const store: any = {
      users: [
        {
          id: 'DR-900',
          name: 'Pending Driver',
          email: 'pending@example.com',
          password: 'secret',
          role: 'driver',
          status: 'Pending Approval',
          createdAt: '2026-10-12T10:00:00.000Z',
        },
        {
          id: 'BC-901',
          name: 'Active Client',
          email: 'active@example.com',
          password: 'secret',
          role: 'business-client',
          status: 'Active',
        },
      ],
      drivers: [{ id: 'DR-900', name: 'Pending Driver', status: 'Document Review' }],
      persistUsers: jest.fn(),
      persistDrivers: jest.fn(),
    };
    const notifications: any = { create: jest.fn() };
    return { service: new UsersService(store, notifications), store, notifications };
  }

  it('returns only pending registrations without exposing passwords', () => {
    const { service } = setup();
    const pending = service.findPendingApprovals();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('DR-900');
    expect((pending[0] as any).password).toBeUndefined();
  });

  it('approves a pending registration, activates its driver record and records the decision', () => {
    const { service, store, notifications } = setup();
    const approved = service.reviewRegistration('DR-900', 'approve');
    expect(approved.status).toBe('Active');
    expect(approved.reviewedAt).toBeDefined();
    expect(approved.approvedAt).toBeDefined();
    expect(store.drivers[0].status).toBe('Available');
    expect(store.persistUsers).toHaveBeenCalled();
    expect(store.persistDrivers).toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ toUserId: 'DR-900' }));
    expect(() => service.reviewRegistration('DR-900', 'approve')).toThrow('already been reviewed');
  });
});
