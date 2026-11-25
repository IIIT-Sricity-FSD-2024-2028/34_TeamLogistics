jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));

import { AuthService } from './auth.service';
import * as bcrypt from 'bcryptjs';

describe('Self-registration Terms contract', () => {
  function setup() {
    const users: any = {
      create: jest.fn((value) => ({ id: 'BC-999', ...value })),
    };
    const settings: any = {
      getSecuritySettings: jest.fn(() => ({ passwordLength: 8 })),
    };
    const notifications: any = { create: jest.fn() };
    const mailer: any = { isConfigured: jest.fn(() => true), sendCode: jest.fn() };
    const service = new AuthService({} as any, {} as any, users, settings, notifications, mailer);
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

describe('Password reset flow', () => {
  function setup() {
    const user: any = {
      id: 'BC-100',
      name: 'Reset User',
      email: 'reset@example.com',
      password: bcrypt.hashSync('Current@123', 4),
      role: 'business-client',
      status: 'Active',
      failedLoginAttempts: 4,
      lockedUntil: new Date(Date.now() + 60000).toISOString(),
    };
    const store: any = {
      users: [user],
      persistUsers: jest.fn(),
    };
    const settings: any = {
      getSecuritySettings: jest.fn(() => ({ passwordLength: 8 })),
    };
    const mailer: any = { isConfigured: jest.fn(() => true), sendCode: jest.fn() };
    const service = new AuthService(store, {} as any, {} as any, settings, {} as any, mailer);
    return { service, store, user, mailer };
  }

  it('returns the same response for known and unknown accounts without a reset code', async () => {
    const { service } = setup();
    const existing = await service.requestPasswordReset({ email: ' RESET@example.com ' });
    const missing = await service.requestPasswordReset({ email: 'missing@example.com' });

    expect(existing.message).toBe(missing.message);
    expect(existing).toEqual(missing);
    expect(existing).not.toHaveProperty('developmentCode');
  });

  it('delivers the code through the configured mailer', async () => {
    const { service, mailer } = setup();
    mailer.isConfigured.mockReturnValue(true);

    await service.requestPasswordReset({ email: 'reset@example.com' });

    expect(mailer.sendCode).toHaveBeenCalledWith(
      'reset@example.com',
      mailer.sendCode.mock.calls[0][1],
      10,
    );
  });

  it('rejects an incorrect code and reports the remaining attempts', async () => {
    const { service, mailer } = setup();
    await service.requestPasswordReset({ email: 'reset@example.com' });
    const wrongCode = mailer.sendCode.mock.calls[0][1] === '000000' ? '000001' : '000000';

    expect(() => service.resetPassword({
      email: 'reset@example.com',
      code: wrongCode!,
      newPassword: 'Changed@123',
    })).toThrow('4 attempt(s) remaining');
  });

  it('hashes the new password, clears login locks, and consumes the code', async () => {
    const { service, store, user, mailer } = setup();
    await service.requestPasswordReset({ email: 'reset@example.com' });
    const payload = {
      email: 'reset@example.com',
      code: mailer.sendCode.mock.calls[0][1],
      newPassword: 'Changed@123',
    };

    expect(service.resetPassword(payload).message).toMatch(/successfully/i);
    expect(bcrypt.compareSync(payload.newPassword, user.password)).toBe(true);
    expect(user.password).not.toBe(payload.newPassword);
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockedUntil).toBeUndefined();
    expect(user.passwordChangedAt).toEqual(expect.any(String));
    expect(store.persistUsers).toHaveBeenCalledTimes(2);
    expect(() => service.resetPassword(payload)).toThrow('invalid or has expired');
  });

  it('enforces the password policy and keeps the valid code available for correction', async () => {
    const { service, mailer } = setup();
    await service.requestPasswordReset({ email: 'reset@example.com' });

    expect(() => service.resetPassword({
      email: 'reset@example.com',
      code: mailer.sendCode.mock.calls[0][1],
      newPassword: 'alllowercase',
    })).toThrow('uppercase letter');

    expect(service.resetPassword({
      email: 'reset@example.com',
      code: mailer.sendCode.mock.calls[0][1],
      newPassword: 'Corrected@123',
    }).message).toMatch(/successfully/i);
  });
});

it('verifies a pending applicant by email before granting any session', async () => {
  const original = process.env.VERIFY_LOGIN_EMAIL;
  process.env.VERIFY_LOGIN_EMAIL = 'true';
  try {
    const user:any = {id:'applicant',role:'driver',status:'Pending Approval',email:'applicant@example.test',password:bcrypt.hashSync('Demo@123',4)};
    const store:any = {users:[user],persistUsers:jest.fn()};
    const jwt:any = {sign:jest.fn()};
    const mail:any = {isConfigured:()=>true, sendLoginCode:jest.fn()};
    const service = new AuthService(store,jwt,{} as any,{} as any,{} as any,mail);
    const login = {email:user.email,password:'Demo@123'};
    expect(await service.login(login)).toEqual({requiresCode:true});
    await expect(service.login({...login,code:mail.sendLoginCode.mock.calls[0][1]})).rejects.toThrow('awaiting administrator approval');
    expect(user.verifiedEmail).toBe(user.email);
    expect(jwt.sign).not.toHaveBeenCalled();
  } finally {
    if (original === undefined) delete process.env.VERIFY_LOGIN_EMAIL;
    else process.env.VERIFY_LOGIN_EMAIL = original;
  }
});
