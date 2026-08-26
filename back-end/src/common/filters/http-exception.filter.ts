import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP_ERROR');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();

    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const timestamp = new Date();

    const date = timestamp.toISOString().split('T')[0];

    const logsDirectory = path.resolve(
      process.cwd(),
      'logs',
    );

    if (!fs.existsSync(logsDirectory)) {
      fs.mkdirSync(logsDirectory, {
        recursive: true,
      });
    }

    const errorLogFile = path.join(
      logsDirectory,
      `error-${date}.log`,
    );

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();

      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseObject =
          exceptionResponse as Record<string, unknown>;

        if (Array.isArray(responseObject.message)) {
          message = responseObject.message.join(', ');
        } else if (typeof responseObject.message === 'string') {
          message = responseObject.message;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const requestIp =
      request.ip ||
      request.headers['x-forwarded-for']?.toString() ||
      'unknown';

    const role =
      request.headers['x-user-role']?.toString() ||
      'anonymous';

    const userId =
      request.headers['x-user-id']?.toString() ||
      'unknown';

    const logLine =
      `${timestamp.toISOString()} | ` +
      `${request.method} | ` +
      `${request.originalUrl} | ` +
      `${statusCode} | ` +
      `IP=${requestIp} | ` +
      `ROLE=${role} | ` +
      `USER=${userId} | ` +
      `MESSAGE=${message}\n`;

    try {
      fs.appendFileSync(
        errorLogFile,
        logLine,
        'utf8',
      );
    } catch (error) {
      this.logger.error(
        'Failed to write error log file',
        error instanceof Error
          ? error.stack
          : String(error),
      );
    }

    this.logger.error(
      `${request.method} ${request.originalUrl} ${statusCode} - ${message}`,
    );

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      path: request.originalUrl,
      timestamp: timestamp.toISOString(),
    });
  }
}