import { recoverUploads } from './documents/upload-journal';
import { DataStoreService } from './data-store/data-store.service';
import { NestFactory } from '@nestjs/core';
import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common';
import { getUploadRoot } from './common/upload-path';
import { startLogMaintenance } from './middleware';
import * as fs from 'fs';
import * as path from 'path';
import { acquireWriterLock } from './data-store/writer-lock';

async function bootstrap() {
  const release = acquireWriterLock(process.env.DATA_DIR || path.resolve(__dirname, '..', 'runtime-data'));
  process.once('exit', release);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  recoverUploads(app.get(DataStoreService).documents);
  let closing = false;
  async function shutdown() {
    if (closing) return;
    closing = true;
    try { await app.close(); } finally { release(); }
  }
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  const configuredOrigins = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      const normalizedOrigin = String(origin || '').replace(/\/$/, '');
      if (
        !origin ||
        (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) ||
        configuredOrigins.includes(normalizedOrigin)
      ) {
        callback(null, true);
        return;
      }
      callback(new ForbiddenException(`Origin ${origin} is not allowed by CORS`), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type,Accept,Authorization,X-Session-Id,Idempotency-Key',
  });

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );

  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 1200,
      skip: (request) => request.path === '/api/changes',
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        statusCode: 429,
        message: 'Too many requests. Please try again later.',
      },
    }),
  );

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  startLogMaintenance();

  const uploadsDir = getUploadRoot();
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    const config = new DocumentBuilder()
      .setTitle('DeliverSync API')
      .setDescription(
        'REST API for the DeliverSync delivery management platform. ' +
        'Authentication is via a signed JWT returned from POST /api/auth/login, sent as ' +
        '`Authorization: Bearer <token>` on every subsequent request. ' +
        'Supported roles: superuser, fleet-manager, business-client, driver.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    const docsDir = path.resolve(__dirname, '..', 'docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(docsDir, 'swagger.json'),
      JSON.stringify(document, null, 2),
      'utf-8',
    );
    console.log(`📄 Swagger JSON exported to docs/swagger.json`);
  }

  // Keep the API separate from other common local web apps that use 3000.
  // PORT can still override this in hosted environments.
  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  console.log(`🚀 DeliverSync API running on port ${port}`);
}
bootstrap();




