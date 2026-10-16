jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));

import { AuthService } from './auth.service';

describe('Self-registration Terms contract', () => {
  function setup() {
    const users: any = {
      create: jest.fn((value) => ({ id: 'BC-999', ...value })),
    };
    const settings: any = {
      getSecuritySettings: jest.fn(() => ({ passwordLength: 8 })),
    };
    const notifications: any = { create: jest.fn() };
    const service = new AuthService({} as any, {} as any, users, settings, notifications);
    return { service, users, notifications };
  }

  const registration: any = {
    name: 'Sync Client',
    email: 'sync@example.com',
    password: 'Password@1',
    role: 'business-client',
    phone: '9876543210',
    profileDetails: { companyName: 'Sync Client' },
  };

  it('rejects registration when the current Terms have not been accepted', () => {
    const { service, users } = setup();
    expect(() => service.register(registration)).toThrow('accept the Terms');
    expect(users.create).not.toHaveBeenCalled();
  });

  it('persists Terms metadata and alerts superusers for an accepted registration', () => {
    const { service, users, notifications } = setup();
    const result = service.register({
      ...registration,
      termsAccepted: true,
      termsVersion: '2026-10-12',
    });
    expect(result.status).toBe('Pending Approval');
    expect(users.create).toHaveBeenCalledWith(expect.objectContaining({
      status: 'Pending Approval',
      termsVersion: '2026-10-12',
      termsAcceptedAt: expect.any(String),
    }));
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ to: 'superuser' }));
  });
});
