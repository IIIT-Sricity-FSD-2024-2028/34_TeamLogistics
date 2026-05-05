import { Module } from '@nestjs/common';
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
    // Apply RolesGuard globally as a fallback
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
