import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { SettingsModule } from '../settings/settings.module';
import { PayoutsModule } from '../payouts/payouts.module';

@Module({
  imports: [SettingsModule, PayoutsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
