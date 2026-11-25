import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { logAudit } from './file-logger';

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  private readonly logger = new Logger('Audit');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();

    res.on('finish', () => {
      const { userId = '', role = '' } = (req as any).user ?? {};
      const entry = {
        requestId: res.locals.requestId,
        timestamp: new Date().toISOString(),
        method,
        url: originalUrl.split('?')[0],
        statusCode: res.statusCode,
        role,
        userId,
      };

      this.logger.log(`AUDIT ${method} ${originalUrl.split('?')[0]} ${res.statusCode} role=${role} user=${userId}`);
      logAudit(entry);
    });

    next();
  }
}
