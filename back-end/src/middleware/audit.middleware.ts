import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { logAudit } from './file-logger';
import { decodeBearerToken } from '../common/jwt.constants';

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  private readonly logger = new Logger('Audit');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, body } = req;
    const { userId = '', role = '' } = decodeBearerToken(req.headers['authorization']);

    res.on('finish', () => {
      const entry = {
        timestamp: new Date().toISOString(),
        method,
        url: originalUrl,
        statusCode: res.statusCode,
        role,
        userId,
        body: method === 'GET' ? undefined : sanitizeBody(body),
      };

      this.logger.log(`AUDIT ${method} ${originalUrl} ${res.statusCode} role=${role} user=${userId}`);
      logAudit(entry);
    });

    next();
  }
}

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  delete clone.password;
  return clone;
}
