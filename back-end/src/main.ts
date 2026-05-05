import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend integration
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Accept,x-user-role,x-user-id',
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Global validation pipe using class-validator DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger API documentation
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

  // Export swagger.json to docs/ directory
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

