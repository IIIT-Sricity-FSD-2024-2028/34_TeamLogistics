import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Role } from './roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request.headers['x-user-role'] as string;

    if (!userRole) {
      throw new BadRequestException(
        'Missing x-user-role header. Provide one of: superuser, fleet-manager, business-client, driver',
      );
    }

    const validRoles = Object.values(Role) as string[];
    if (!validRoles.includes(userRole)) {
      throw new BadRequestException(
        `Invalid role "${userRole}". Valid roles: ${validRoles.join(', ')}`,
      );
    }

    if (!requiredRoles.includes(userRole as Role)) {
      throw new ForbiddenException(
        `Role "${userRole}" does not have access to this resource. Required: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
