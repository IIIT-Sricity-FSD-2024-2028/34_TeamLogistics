import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SubscriptionsService, SUBSCRIPTION_PLANS } from './subscriptions.service';
import { PaySubscriptionDto } from './dto/subscription.dto';
import { RolesGuard, Roles, Role } from '../common';

@ApiTags('Subscriptions')
@Controller('subscriptions')
@UseGuards(RolesGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  @Roles(Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'List the available subscription plans (server-side pricing)' })
  getPlans() {
    return SUBSCRIPTION_PLANS;
  }

  @Get('current')
  @Roles(Role.FLEET_MANAGER)
  @ApiOperation({ summary: "Get the current Fleet Manager's subscription and available plans" })
  getCurrent(@Headers('x-user-id') userId?: string) {
    return this.subscriptionsService.getCurrent(userId);
  }

  @Post('pay')
  @Roles(Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Simulate a subscription payment and activate/renew the plan' })
  pay(@Headers('x-user-id') userId: string, @Body() dto: PaySubscriptionDto) {
    return this.subscriptionsService.payAndActivate(userId, dto);
  }
}
