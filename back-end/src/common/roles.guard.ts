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

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (token) {
      try {
        const payload = this.jwtService.verify(token, { secret: JWT_SECRET });
        request.user = { userId: payload.sub, role: payload.role };
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

    return true;
  }
}
