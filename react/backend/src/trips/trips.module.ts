import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { PayoutsModule } from '../payouts/payouts.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [PayoutsModule, DocumentsModule],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
