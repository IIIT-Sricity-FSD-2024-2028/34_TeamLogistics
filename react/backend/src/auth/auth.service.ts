import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DataStoreService } from '../data-store/data-store.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { assertFutureDateOnly } from '../common/date-validation';

const CURRENT_TERMS_VERSION = '2026-10-12';

function passwordMatches(plain: string, stored: string): boolean {
  const isBcryptHash = /^\$2[aby]\$/.test(stored || '');
  return isBcryptHash ? bcrypt.compareSync(plain, stored) : plain === stored;
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
  ) {}

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

    const minimumLength = Math.max(8, Number(this.settingsService.getSecuritySettings().passwordLength || 8));
    if (dto.password.length < minimumLength) {
      throw new BadRequestException(`Password must contain at least ${minimumLength} characters`);
    }
    if (!/(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])/.test(dto.password)) {
      throw new BadRequestException('Password must include an uppercase letter, a number, and a special character');
    }
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
      message: 'Registration submitted. An administrator must approve your account before you can sign in.',
      userId: user.id,
      status: user.status,
    };
  }

  login(dto: LoginDto) {
    const email = String(dto.email || '').toLowerCase().trim();
    const user = this.store.users.find((u) => String(u.email || '').toLowerCase().trim() === email);

    if (!user) {
      throw new NotFoundException('No account found for this email');
    }

    const status = String(user.status || '').toLowerCase();
    const now = Date.now();
    const lockedUntil = new Date((user as any).lockedUntil || 0).getTime();

    if (lockedUntil > now) {
      throw new ForbiddenException(`Account temporarily locked until ${new Date(lockedUntil).toISOString()}`);
    }

    if (status === 'pending approval') {
      throw new ForbiddenException('Your account is awaiting super user approval');
    }

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
      throw new UnauthorizedException(`Incorrect password. ${maximumAttempts - failedAttempts} attempt(s) remaining`);
    }

    (user as any).failedLoginAttempts = 0;
    delete (user as any).lockedUntil;
    user.lastLogin = new Date().toISOString();
    this.store.persistUsers();

    const sessionMinutes = Math.max(5, Number(this.settingsService.getSecuritySettings().sessionTimeout || 30));
    const token = this.jwtService.sign(
      { sub: user.id, role: user.role },
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
