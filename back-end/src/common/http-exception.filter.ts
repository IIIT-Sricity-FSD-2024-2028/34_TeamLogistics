import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { logError } from '../middleware';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string;
    if (isHttpException) {
      const body = exception.getResponse();
      const bodyMessage =
        typeof body === 'string' ? body : (body as { message?: string | string[] })?.message;
      message = Array.isArray(bodyMessage) ? bodyMessage.join('; ') : bodyMessage || exception.message;
    } else {
      message = 'Internal server error';
    }

    const errorName = isHttpException
      ? exception.constructor.name
      : exception instanceof Error
        ? exception.name
        : 'Error';

    const timestamp = new Date().toISOString();

    const logEntry = {
      timestamp,
      method: request.method,
      url: request.originalUrl,
      statusCode: status,
      error: errorName,
      message,
      ip: request.ip || request.headers['x-forwarded-for']?.toString() || 'unknown',
      role: request.headers['x-user-role'],
      userId: request.headers['x-user-id'],
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    this.logger.error(`${request.method} ${request.originalUrl} -> ${status}: ${message}`);
    logError(logEntry);

    response.status(status).json({
      statusCode: status,
      message,
      error: errorName,
      path: request.originalUrl,
      timestamp,
    });
  }
}
