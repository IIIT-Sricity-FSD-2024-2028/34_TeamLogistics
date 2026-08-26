import {
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const startTime = Date.now();

    const timestamp = new Date();

    const date = timestamp
      .toISOString()
      .split('T')[0];

    const logsDirectory = path.resolve(
      process.cwd(),
      'logs',
    );

    if (!fs.existsSync(logsDirectory)) {
      fs.mkdirSync(logsDirectory, {
        recursive: true,
      });
    }

    const logFile = path.join(
      logsDirectory,
      `application-${date}.log`,
    );

    const requestTime = timestamp
      .toISOString()
      .replace('T', ' ')
      .replace('Z', '');

    const method = req.method;
    const url = req.originalUrl;
    const ip =
      req.ip ||
      req.headers['x-forwarded-for']?.toString() ||
      'unknown';

    const role =
      req.headers['x-user-role']?.toString() ||
      'anonymous';

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      const statusCode = res.statusCode;

      const logLine =
        `${requestTime} | ` +
        `${method} | ` +
        `${url} | ` +
        `${statusCode} | ` +
        `${duration}ms | ` +
        `IP=${ip} | ` +
        `ROLE=${role}` +
        '\n';

      try {
        fs.appendFileSync(
          logFile,
          logLine,
          'utf8',
        );
      } catch (error) {
        this.logger.error(
          'Failed to write request log file',
          error instanceof Error
            ? error.stack
            : String(error),
        );
      }

      this.logger.log(
        `${method} ${url} ${statusCode} - ${duration}ms`,
      );
    });

    next();
  }
}