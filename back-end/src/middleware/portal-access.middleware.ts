import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { Request, Response, NextFunction } from 'express';

@Injectable()
export class PortalAccessMiddleware
  implements NestMiddleware
{
  use(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const role =
      req.headers['x-user-role']?.toString().trim();

    const userId =
      req.headers['x-user-id']?.toString().trim();

    const allowedRoles = [
      'superuser',
      'fleet-manager',
      'business-client',
      'driver',
    ];

    // Allow Swagger and non-API requests to continue.
    if (
      !req.originalUrl.startsWith('/api/')
    ) {
      next();
      return;
    }

    // Swagger-related routes do not require portal access validation.
    if (
      req.originalUrl.startsWith('/api/docs') ||
      req.originalUrl.startsWith('/api-json')
    ) {
      next();
      return;
    }

    // x-user-role is required for protected API requests.
    if (!role) {
      throw new BadRequestException(
        'Missing x-user-role header.',
      );
    }

    // Check whether the supplied role is valid.
    if (!allowedRoles.includes(role)) {
      throw new BadRequestException(
        `Invalid x-user-role "${role}". ` +
          `Valid roles: ${allowedRoles.join(', ')}`,
      );
    }

    /*
     * Store the validated information on the request.
     * Controllers/guards can use this later if needed.
     */
    (req as Request & {
      portalRole?: string;
      portalUserId?: string;
    }).portalRole = role;

    if (userId) {
      (
        req as Request & {
          portalRole?: string;
          portalUserId?: string;
        }
      ).portalUserId = userId;
    }

    /*
     * Router-level access rules.
     *
     * These rules are intentionally based on the
     * existing DeliverSync API structure.
     */

    const url = req.originalUrl;

    // Super User-only API areas
    if (
      (
        url.startsWith('/api/settings') ||
        url.startsWith('/api/users')
      ) &&
      role !== 'superuser'
    ) {
      throw new ForbiddenException(
        'Only the superuser can access this API area.',
      );
    }

    // Fleet-management API areas
    if (
      (
        url.startsWith('/api/vehicles') ||
        url.startsWith('/api/maintenance')
      ) &&
      role !== 'superuser' &&
      role !== 'fleet-manager'
    ) {
      throw new ForbiddenException(
        'Only superuser or fleet-manager can access this API area.',
      );
    }

    // Driver-specific trip access
    if (
      url.startsWith('/api/trips') &&
      role === 'business-client'
    ) {
      /*
       * Business clients should not directly
       * manage trip operations.
       */
      throw new ForbiddenException(
        'Business clients cannot perform trip management operations.',
      );
    }

    next();
  }
}