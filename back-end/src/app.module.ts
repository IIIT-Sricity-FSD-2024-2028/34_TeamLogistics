import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DataStoreModule } from './data-store/data-store.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { DocumentsModule } from './documents/documents.module';
import { DriversModule } from './drivers/drivers.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { TripsModule } from './trips/trips.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TransactionsModule } from './transactions/transactions.module';
import { TransactionsController } from './transactions/transactions.controller';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SubscriptionsController } from './subscriptions/subscriptions.controller';
import { SettingsModule } from './settings/settings.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RolesGuard } from './common';
import { LoggingMiddleware, AuditMiddleware } from './middleware';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    DataStoreModule,
    AuthModule,
    UsersModule,
    VehiclesModule,
    DriversModule,
    DeliveriesModule,
    DocumentsModule,
    TripsModule,
    MaintenanceModule,
    NotificationsModule,
    TransactionsModule,
    SubscriptionsModule,
    SettingsModule,
    DashboardModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggingMiddleware).forRoutes('*');
    consumer.apply(AuditMiddleware).forRoutes(TransactionsController, SubscriptionsController);
  }
}
