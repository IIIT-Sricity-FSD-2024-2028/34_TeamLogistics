import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { logAccess } from './file-logger';
import { decodeBearerToken } from '../common/jwt.constants';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const { method, originalUrl } = req;
    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
    const { userId = '', role = '' } = decodeBearerToken(req.headers['authorization']);

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const entry = {
        timestamp: new Date().toISOString(),
        method,
        url: originalUrl,
        statusCode: res.statusCode,
        durationMs,
        ip,
        role,
        userId,
      };

      this.logger.log(
        `${method} ${originalUrl} ${res.statusCode} ${durationMs}ms role=${role} user=${userId}`,
      );
      logAccess(entry);
    });

    next();
  }
}
