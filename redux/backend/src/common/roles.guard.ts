import { requiresEmailVerification } from '../auth/email-verification';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ROLES_KEY } from './roles.decorator';
import { Role } from './roles.enum';
import { JWT_SECRET } from './jwt.constants';
import { SettingsService } from '../settings/settings.service';
import { DataStoreService } from '../data-store/data-store.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private settingsService: SettingsService,
    private store: DataStoreService,
  ) {}

  private requiredPermission(role: string, requestUrl: string): string | null {
    const path = String(requestUrl || '').split('?')[0].toLowerCase();

    if (path.includes('/settings/permissions')) return 'Role & Permissions Access';
    if (path.includes('/settings/')) return 'System Configuration Access';
    if (path.includes('/dashboard/') && path.includes('/analytics')) return 'Reports Access';
    if (path.includes('/dashboard/')) return 'Dashboard Access';

    if (role === Role.FLEET_MANAGER) {
      if (/\/(drivers|vehicles|maintenance|documents|trips|payouts)(\/|$)/.test(path)) return 'Fleet Management Access';
      if (/\/users(\/|$)/.test(path)) return 'User Management Access';
    }

    if (role === Role.BUSINESS_CLIENT) {
      if (/\/(deliveries|trips)(\/|$)/.test(path)) return 'Track Requests';
      if (/\/(transactions|payouts)(\/|$)/.test(path)) return 'Reports Access';
      if (/\/users(\/|$)/.test(path)) return 'Manage Contacts';
    }

    if (role === Role.DRIVER) {
      if (/\/(trips|deliveries|documents)(\/|$)/.test(path)) return 'Trip Monitoring';
      if (/\/payouts(\/|$)/.test(path)) return 'Reports Access';
    }

    return null;
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;
    const sessionId = String(request.headers['x-session-id'] || '');
    const cookiePrefix = 'ds-' + sessionId + '=';
    const cookieToken = /^[\w-]{1,100}$/.test(sessionId) ? String(request.headers.cookie || '').split(';')
      .map((part) => part.trim()).find((part) => part.startsWith(cookiePrefix))?.slice(cookiePrefix.length) : undefined;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

    if (token) {
      try {
        const payload = this.jwtService.verify(token, { secret: JWT_SECRET });
        if (!authHeader && payload.sub !== sessionId) throw new UnauthorizedException();
        const account = this.store.users.find((user) => user.id === payload.sub);
        const active = account && (account.status.toLowerCase() === 'active' ||
          (account.role === 'driver' && ['available', 'on duty'].includes(account.status.toLowerCase())));
        request.user = active && account.role === payload.role &&
          (account.sessionVersion ?? 0) === (payload.sessionVersion ?? 0)
          ? { userId: account.id, role: account.role, verifiedAt: payload.verifiedAt } : undefined;
      } catch {
        request.user = undefined;
      }
    }

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (!request.user) {
      throw new UnauthorizedException('Missing or invalid authentication token');
    }

    const validRoles = Object.values(Role) as string[];
    if (!validRoles.includes(request.user.role)) {
      throw new UnauthorizedException('Invalid role in token');
    }

    if (!requiredRoles.includes(request.user.role as Role)) {
      throw new ForbiddenException(
        `Role "${request.user.role}" does not have access to this resource. Required: ${requiredRoles.join(', ')}`,
      );
    }

    const financialWrite = request.method !== 'GET' && /\/(payments\/[^/]+\/(status|reversal)|payouts\/(driver\/[^/]+\/paid|fleet-manager\/settlement(?:\/lock)?))\/?$/.test(request.path);
    if (financialWrite && requiresEmailVerification() &&
        !(request.user.verifiedAt > Date.now() - 15 * 60000)) {
      throw new UnauthorizedException('Sign in again and verify your email to authorise this financial action');
    }
    if (request.user.role !== Role.SUPERUSER) {
      const permission = this.requiredPermission(request.user.role, request.originalUrl || request.url);
      if (permission && !this.settingsService.isPermissionEnabled(request.user.role, permission)) {
        throw new ForbiddenException(`Permission "${permission}" is disabled for role "${request.user.role}"`);
      }
    }

    return true;
  }
}
