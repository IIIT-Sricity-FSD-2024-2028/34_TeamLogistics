import { RecipientSmsService } from './recipient-sms.service';
import { Module } from '@nestjs/common';
import { PasswordResetMailerService } from '../auth/password-reset-mailer.service';
import { DeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';
import { PayoutsModule } from '../payouts/payouts.module';

@Module({
  imports: [PayoutsModule],
  controllers: [DeliveriesController],
  providers: [RecipientSmsService, DeliveriesService, PasswordResetMailerService],
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
