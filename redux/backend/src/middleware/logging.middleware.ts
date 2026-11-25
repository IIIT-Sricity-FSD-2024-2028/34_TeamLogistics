import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { logAccess } from './file-logger';

export const requestMetrics = { requests: 0, serverErrors: 0, totalDurationMs: 0 };

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    res.locals.requestId = randomUUID();
    res.setHeader('X-Request-Id', res.locals.requestId);
    const { method, originalUrl } = req;
    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';

    res.on('finish', () => {
      const { userId = '', role = '' } = (req as any).user ?? {};
      const durationMs = Date.now() - start;
      requestMetrics.requests++;
      requestMetrics.serverErrors += Number(res.statusCode >= 500);
      requestMetrics.totalDurationMs += durationMs;
      const entry = {
        requestId: res.locals.requestId,
        timestamp: new Date().toISOString(),
        method,
        url: originalUrl.split('?')[0],
        statusCode: res.statusCode,
        durationMs,
        ip,
        role,
        userId,
      };

      this.logger.log(
        `${method} ${originalUrl.split('?')[0]} ${res.statusCode} ${durationMs}ms role=${role} user=${userId}`,
      );
      logAccess(entry);
    });

    next();
  }
}
