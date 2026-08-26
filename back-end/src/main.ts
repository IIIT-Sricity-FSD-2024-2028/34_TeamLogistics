import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

import * as fs from 'fs';
import * as path from 'path';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // =========================================================
  // SECURITY MIDDLEWARE
  // =========================================================

  // Helmet adds standard security-related HTTP headers.
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  // Rate limiting:
  // Allows at most 200 requests from one IP per 15 minutes.
  const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      statusCode: 429,
      message:
        'Too many requests. Please try again later.',
    },
  });

  app.use(apiRateLimiter);

  // =========================================================
  // CORS
  // =========================================================

  // Allow only your local frontend origins.
  app.enableCors({
    origin: [
      'http://127.0.0.1:5500',
      'http://localhost:5500',
    ],
    methods: [
      'GET',
      'HEAD',
      'PUT',
      'PATCH',
      'POST',
      'DELETE',
      'OPTIONS',
    ],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'x-user-role',
      'x-user-id',
    ],
  });

  // =========================================================
  // GLOBAL EXCEPTION HANDLER
  // =========================================================

  app.useGlobalFilters(
    new HttpExceptionFilter(),
  );

  // =========================================================
  // GLOBAL PREFIX
  // =========================================================

  app.setGlobalPrefix('api');

  // =========================================================
  // GLOBAL VALIDATION
  // =========================================================

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // =========================================================
  // SWAGGER
  // =========================================================

  const config = new DocumentBuilder()
    .setTitle('DeliverSync API')
    .setDescription(
      'REST API for the DeliverSync delivery management platform. ' +
        'Role-based access is controlled via the `x-user-role` request header. ' +
        'Supported roles: superuser, fleet-manager, business-client, driver.',
    )
    .setVersion('1.0')
    .addGlobalParameters({
      name: 'x-user-role',
      in: 'header',
      required: true,
      description:
        'Role of the requesting user (superuser | fleet-manager | business-client | driver)',
      schema: {
        type: 'string',
        enum: [
          'superuser',
          'fleet-manager',
          'business-client',
          'driver',
        ],
      },
    })
    .addGlobalParameters({
      name: 'x-user-id',
      in: 'header',
      required: false,
      description:
        'ID of the requesting user (e.g. SU-001). Used for self-service endpoints.',
      schema: {
        type: 'string',
      },
    })
    .build();

  const document =
    SwaggerModule.createDocument(
      app,
      config,
    );

  SwaggerModule.setup(
    'api/docs',
    app,
    document,
  );

  // =========================================================
  // EXPORT SWAGGER JSON
  // =========================================================

  const docsDir = path.resolve(
    __dirname,
    '..',
    'docs',
  );

  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, {
      recursive: true,
    });
  }

  fs.writeFileSync(
    path.join(
      docsDir,
      'swagger.json',
    ),
    JSON.stringify(
      document,
      null,
      2,
    ),
    'utf-8',
  );

  console.log(
    `📄 Swagger JSON exported to docs/swagger.json`,
  );

  // =========================================================
  // START SERVER
  // =========================================================

  await app.listen(3000);

  console.log(
    `🚀 DeliverSync API running on http://localhost:3000`,
  );

  console.log(
    `📚 Swagger docs at http://localhost:3000/api/docs`,
  );
}

bootstrap();