import { BadRequestException, Body, Controller, Get, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PayoutsService } from './payouts.service';
import { SetRateCardDto } from './dto/rate-card.dto';
import { RolesGuard, Roles, Role } from '../common';

@ApiTags('Payouts')
@Controller('payouts')
@UseGuards(RolesGuard)
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get('rate-card/platform')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Get the platform-wide minimum driver rate card' })
  getPlatformRateCard() {
    return this.payoutsService.getPlatformRateCard();
  }

  @Put('rate-card/platform')
  @Roles(Role.SUPERUSER)
  @ApiOperation({ summary: 'Set the platform-wide minimum driver rate card' })
  setPlatformRateCard(@Body() dto: SetRateCardDto) {
    return this.payoutsService.setPlatformRateCard(dto);
  }

  @Get('rate-card/mine')
  @Roles(Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Get my effective driver rate card (custom or platform default)' })
  getMyRateCard(@Req() req: Request) {
    const requester = (req as any).user as { userId: string; role: string };
    return this.payoutsService.getMyRateCard(requester.userId);
  }

  @Put('rate-card/mine')
  @Roles(Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Set my custom driver rate card (must be at or above the platform minimum)' })
  setMyRateCard(@Body() dto: SetRateCardDto, @Req() req: Request) {
    const requester = (req as any).user as { userId: string; role: string };
    return this.payoutsService.setFleetManagerRateCard(requester.userId, dto);
  }

  @Get('driver/mine')
  @Roles(Role.DRIVER)
  @ApiOperation({ summary: 'Get my persisted per-trip payout records' })
  getMyPayouts(@Req() req: Request) {
    const requester = (req as any).user as { userId: string; role: string };
    const driverName = this.payoutsService.getDriverNameForUser(requester.userId);
    return this.payoutsService.getDriverPayouts(driverName);
  }

  @Get('fleet-manager/statement')
  @Roles(Role.FLEET_MANAGER, Role.SUPERUSER)
  @ApiOperation({ summary: 'Monthly net income statement for a fleet manager' })
  @ApiQuery({ name: 'month', required: false, description: 'YYYY-MM, defaults to current month' })
  @ApiQuery({ name: 'fleetManagerId', required: false, description: 'Superuser only; defaults to self for fleet managers' })
  getFleetManagerStatement(
    @Query('month') month: string | undefined,
    @Query('fleetManagerId') fleetManagerId: string | undefined,
    @Req() req: Request,
  ) {
    const requester = (req as any).user as { userId: string; role: string };
    const targetId = requester.role === 'superuser' && fleetManagerId ? fleetManagerId : requester.userId;

    if (!targetId) {
      throw new BadRequestException('fleetManagerId is required');
    }

    this.payoutsService.assertFleetManagerSelfOrSuperuser(targetId, requester);
    return this.payoutsService.getFleetManagerStatement(targetId, month);
  }

  @Get('fleet-manager/settlements')
  @Roles(Role.FLEET_MANAGER, Role.SUPERUSER)
  @ApiOperation({ summary: 'List settlement periods (own for fleet manager, all or filtered for superuser)' })
  @ApiQuery({ name: 'fleetManagerId', required: false, description: 'Superuser only; omit to list all fleet managers' })
  listSettlements(@Query('fleetManagerId') fleetManagerId: string | undefined, @Req() req: Request) {
    const requester = (req as any).user as { userId: string; role: string };

    if (requester.role === 'fleet-manager') {
      return this.payoutsService.listSettlements(requester.userId);
    }

    return this.payoutsService.listSettlements(fleetManagerId);
  }

  @Post('fleet-manager/settlement/lock')
  @Roles(Role.SUPERUSER)
  @ApiOperation({ summary: 'Lock a fleet manager settlement period, freezing its statement as a snapshot' })
  lockSettlement(
    @Body('fleetManagerId') fleetManagerId: string,
    @Body('month') month: string,
    @Req() req: Request,
  ) {
    const requester = (req as any).user as { userId: string; role: string };

    if (!fleetManagerId || !month) {
      throw new BadRequestException('fleetManagerId and month are required');
    }

    return this.payoutsService.lockSettlement(fleetManagerId, month, requester);
  }
}
