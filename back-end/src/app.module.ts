import {
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';

import { APP_GUARD } from '@nestjs/core';

import { DataStoreModule } from './data-store/data-store.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { DocumentsModule } from './documents/documents.module';
import { DriversModule } from './drivers/drivers.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { TripsModule } from './trips/trips.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TransactionsModule } from './transactions/transactions.module';
import { SettingsModule } from './settings/settings.module';
import { DashboardModule } from './dashboard/dashboard.module';

import { RolesGuard } from './common';

import { LoggingMiddleware } from './middleware/logging.middleware';
import { PortalAccessMiddleware } from './middleware/portal-access.middleware';

@Module({
  imports: [
    DataStoreModule,
    UsersModule,
    VehiclesModule,
    DriversModule,
    DeliveriesModule,
    DocumentsModule,
    TripsModule,
    MaintenanceModule,
    NotificationsModule,
    TransactionsModule,
    SettingsModule,
    DashboardModule,
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(
    consumer: MiddlewareConsumer,
  ): void {
    consumer

      // Global request logging middleware
      .apply(LoggingMiddleware)
      .forRoutes('*');

    consumer

      // Router-level portal access middleware
      .apply(PortalAccessMiddleware)
      .forRoutes(
        'users',
        'vehicles',
        'drivers',
        'deliveries',
        'documents',
        'trips',
        'maintenance',
        'notifications',
        'transactions',
        'settings',
        'dashboard',
      );
  }
}