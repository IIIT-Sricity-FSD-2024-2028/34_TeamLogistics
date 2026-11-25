import { requiresEmailVerification } from './email-verification';
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DataStoreService } from '../data-store/data-store.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { assertFutureDateOnly } from '../common/date-validation';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { JWT_SECRET } from '../common/jwt.constants';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { PasswordResetMailerService } from './password-reset-mailer.service';

const CURRENT_TERMS_VERSION = '2026-10-12';
const RESET_CODE_LIFETIME_MS = 10 * 60 * 1000;
const RESET_CODE_MAX_ATTEMPTS = 5;


function passwordMatches(plain: string, stored: string): boolean {
  const isBcryptHash = /^\$2[aby]\$/.test(stored || '');
  return isBcryptHash && bcrypt.compareSync(plain, stored);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly store: DataStoreService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly settingsService: SettingsService,
    private readonly notificationsService: NotificationsService,
    private readonly passwordResetMailer: PasswordResetMailerService,
  ) {}

  private normalizeEmail(email: string): string {
    return String(email || '').toLowerCase().trim();
  }

  private hashResetCode(email: string, code: string): Buffer {
    return createHmac('sha256', JWT_SECRET).update(`${email}:${code}`).digest();
  }

  private validateNewPassword(password: string): void {
    const minimumLength = Math.max(8, Number(this.settingsService.getSecuritySettings().passwordLength || 8));
    if (password.length < minimumLength) {
      throw new BadRequestException(`Password must contain at least ${minimumLength} characters`);
    }
    if (!/(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])/.test(password)) {
      throw new BadRequestException('Password must include an uppercase letter, a number, and a special character');
    }
  }

  async requestPasswordReset(dto: ForgotPasswordDto) {
    const email = this.normalizeEmail(dto.email);
    const user = this.store.users.find((item) => this.normalizeEmail(item.email) === email);
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    if (!this.passwordResetMailer.isConfigured()) {
      throw new ServiceUnavailableException('Password reset email delivery is not configured');
    }

    if (user) {
      const codeHash = this.hashResetCode(email, code).toString('hex');
      user.passwordReset = { codeHash, expiresAt: Date.now() + RESET_CODE_LIFETIME_MS, attemptsRemaining: RESET_CODE_MAX_ATTEMPTS };
      this.store.persistUsers();

      if (this.passwordResetMailer.isConfigured()) {
        try {
          await this.passwordResetMailer.sendCode(email, code, RESET_CODE_LIFETIME_MS / 60000);
        } catch (error) {
          if (user.passwordReset?.codeHash === codeHash) { delete user.passwordReset; this.store.persistUsers(); }
          this.logger.error(`Unable to send a password reset code: ${error}`);
          throw new ServiceUnavailableException('Unable to send the reset email. Please try again later.');
        }
      }
    }

    return {
      message: 'If an account exists for that email, a reset code has been sent.',
      expiresInMinutes: RESET_CODE_LIFETIME_MS / 60000,
    };

  }

  resetPassword(dto: ResetPasswordDto) {
    const email = this.normalizeEmail(dto.email);
    const user = this.store.users.find((item) => this.normalizeEmail(item.email) === email);

    const request = user?.passwordReset;
    if (!request || !user || request.expiresAt <= Date.now()) {
      throw new BadRequestException('Reset code is invalid or has expired. Request a new code.');
    }

    const suppliedHash = this.hashResetCode(email, dto.code);
    if (!timingSafeEqual(Buffer.from(request.codeHash, 'hex'), suppliedHash)) {
      request.attemptsRemaining -= 1;
      if (request.attemptsRemaining <= 0) delete user.passwordReset;
      this.store.persistUsers();
      throw new BadRequestException(
        request.attemptsRemaining > 0
          ? `Reset code is incorrect. ${request.attemptsRemaining} attempt(s) remaining.`
          : 'Reset code is invalid or has expired. Request a new code.',
      );
    }

    this.validateNewPassword(dto.newPassword);
    if (passwordMatches(dto.newPassword, user.password)) {
      throw new BadRequestException('New password must be different from your current password');
    }

    user.password = bcrypt.hashSync(dto.newPassword, 10);
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    (user as any).failedLoginAttempts = 0;
    delete (user as any).lockedUntil;
    (user as any).passwordChangedAt = new Date().toISOString();
    delete user.passwordReset;
    this.store.persistUsers();

    return { message: 'Password reset successfully. You can now sign in with your new password.' };
  }

  register(dto: RegisterDto) {
    const requiresTerms = ['business-client', 'driver'].includes(dto.role);
    if (requiresTerms && dto.termsAccepted !== true) {
      throw new BadRequestException('You must accept the Terms & Conditions before registering');
    }
    if (requiresTerms && dto.termsVersion !== CURRENT_TERMS_VERSION) {
      throw new BadRequestException('Please review and accept the current Terms & Conditions');
    }
    if (dto.role === 'driver') {
      const licenseExpiry = String(dto.profileDetails?.licenseExpiry || '');
      if (!licenseExpiry) {
        throw new BadRequestException('License expiry date is required');
      }
      assertFutureDateOnly(licenseExpiry, 'License expiry date');
    }

    this.validateNewPassword(dto.password);
    const user = this.usersService.create({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      role: dto.role,
      status: 'Pending Approval',
      phone: dto.phone,
      profileDetails: dto.profileDetails,
      termsAcceptedAt: requiresTerms ? new Date().toISOString() : undefined,
      termsVersion: requiresTerms ? CURRENT_TERMS_VERSION : undefined,
    } as any);

    try {
      this.notificationsService.create({
        title: 'New registration awaiting approval',
        message: `${user.name} registered as ${user.role}. Review the application in Registration Approvals.`,
        to: 'superuser',
      });
    } catch (error) {
      this.logger.warn(`Registration ${user.id} was saved, but its superuser notification could not be created`);
    }

    return {
      message: requiresEmailVerification() ? 'Registration submitted. Sign in to verify your email before administrator review.' : 'Registration submitted for administrator approval.',
      userId: user.id,
      status: user.status,
    };
  }

  async login(dto: LoginDto) {
    const email = String(dto.email || '').toLowerCase().trim();
    const user = this.store.users.find((u) => String(u.email || '').toLowerCase().trim() === email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const status = String(user.status || '').toLowerCase();
    const now = Date.now();
    const lockedUntil = new Date((user as any).lockedUntil || 0).getTime();

    if (lockedUntil > now) {
      throw new ForbiddenException(`Account temporarily locked until ${new Date(lockedUntil).toISOString()}`);
    }

    const pending = ['pending','pending approval'].includes(status);

    if (status === 'rejected' || status === 'suspended') {
      throw new ForbiddenException('Your account is not allowed to sign in');
    }

    if (!passwordMatches(dto.password, user.password)) {
      const maximumAttempts = Math.max(1, Number(this.settingsService.getSecuritySettings().failedAttempts || 5));
      const failedAttempts = Number((user as any).failedLoginAttempts || 0) + 1;
      (user as any).failedLoginAttempts = failedAttempts;
      if (failedAttempts >= maximumAttempts) {
        (user as any).lockedUntil = new Date(now + 15 * 60 * 1000).toISOString();
        this.store.persistUsers();
        throw new ForbiddenException('Account temporarily locked for 15 minutes after repeated failed sign-in attempts');
      }
      this.store.persistUsers();
      throw new UnauthorizedException('Invalid email or password');
    }

    (user as any).failedLoginAttempts = 0;
    delete (user as any).lockedUntil;
    let verifiedAt: number | undefined;
    const verifySignIn = requiresEmailVerification();
    if (verifySignIn && (user.verifiedEmail !== email || ['superuser', 'fleet-manager'].includes(user.role))) {
      if (!this.passwordResetMailer.isConfigured()) throw new ServiceUnavailableException('Sign-in email is not configured');
      const challenge = user.loginChallenge;
      if (!dto.code) {
        if (!challenge || challenge.expires <= now || challenge.remaining <= 0 || challenge.expires - now < 9 * 60_000) {
          const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
          user.loginChallenge = { hash: this.hashResetCode('login:' + email, code).toString('hex'), expires: now + 600_000, remaining: 5 };
          this.store.persistUsers();
          try { await this.passwordResetMailer.sendLoginCode(email, code); }
          catch { throw new ServiceUnavailableException('Unable to confirm delivery of the sign-in email'); }
        }
        return { requiresCode: true };
      }
      if (!challenge || challenge.expires <= now || challenge.remaining <= 0) throw new UnauthorizedException('Request a new sign-in code');
      if (!timingSafeEqual(Buffer.from(challenge.hash, 'hex'), this.hashResetCode('login:' + email, dto.code))) {
        challenge.remaining -= 1;
        this.store.persistUsers();
        throw new UnauthorizedException('Incorrect sign-in code');
      }
      delete user.loginChallenge;
      user.verifiedEmail = email;
      verifiedAt = now;
    }
    if (pending) {
      this.store.persistUsers();
      throw new ForbiddenException(verifySignIn ? 'Email verified. Your account is awaiting administrator approval.' : 'Your account is awaiting super user approval');
    }
    user.lastLogin = new Date().toISOString();
    this.store.persistUsers();

    const sessionMinutes = Math.max(5, Number(this.settingsService.getSecuritySettings().sessionTimeout || 30));
    const token = this.jwtService.sign(
      { sub: user.id, role: user.role, verifiedAt, sessionVersion: user.sessionVersion ?? 0 },
      { expiresIn: sessionMinutes * 60 },
    );

    return {
      token,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      expiresInMinutes: sessionMinutes,
    };
  }
}
