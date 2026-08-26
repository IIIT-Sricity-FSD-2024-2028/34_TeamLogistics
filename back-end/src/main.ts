import { NestFactory } from '@nestjs/core';
import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common';
import { startLogMaintenance } from './middleware';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      contentSecurityPolicy: false,
    }),
  );

  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        statusCode: 429,
        message: 'Too many requests. Please try again later.',
      },
    }),
  );

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new ForbiddenException(`Origin ${origin} is not allowed by CORS`), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Accept,x-user-role,x-user-id',
  });

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

  const uploadsDir = path.resolve(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });

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
      description: 'Role of the requesting user (superuser | fleet-manager | business-client | driver)',
      schema: { type: 'string', enum: ['superuser', 'fleet-manager', 'business-client', 'driver'] },
    })
    .addGlobalParameters({
      name: 'x-user-id',
      in: 'header',
      required: false,
      description: 'ID of the requesting user (e.g. SU-001). Used for self-service endpoints.',
      schema: { type: 'string' },
    })
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

  await app.listen(3000);
  console.log(`🚀 DeliverSync API running on http://localhost:3000`);
  console.log(`📚 Swagger docs at http://localhost:3000/api/docs`);
}
bootstrap();
