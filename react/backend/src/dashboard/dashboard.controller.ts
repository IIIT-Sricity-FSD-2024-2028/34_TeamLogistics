import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { SettingsService } from '../settings/settings.service';
import { RolesGuard, Roles, Role } from '../common';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(RolesGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get('superuser')
  @Roles(Role.SUPERUSER)
  @ApiOperation({ summary: 'Get superuser dashboard stats' })
  getSuperuserDashboard() {
    return this.dashboardService.getSuperuserDashboard();
  }

  @Get('business-client')
  @Roles(Role.BUSINESS_CLIENT, Role.SUPERUSER)
  @ApiOperation({ summary: "Get the current business client's dashboard stats" })
  getBusinessClientDashboard(@Req() req: Request) {
    const requester = (req as any).user as { userId: string; role: string };
    return this.dashboardService.getBusinessClientDashboard(requester.userId);
  }

  @Get('fleet-manager')
  @Roles(Role.FLEET_MANAGER, Role.SUPERUSER)
  @ApiOperation({ summary: 'Get fleet manager dashboard stats' })
  getFleetManagerDashboard() {
    return this.dashboardService.getFleetManagerDashboard();
  }

  @Get('fleet-manager/analytics')
  @Roles(Role.FLEET_MANAGER, Role.SUPERUSER)
  @ApiOperation({
    summary: "Get the current fleet manager's analytics",
    description: 'Gated by the "Reports Access" permission configured for the fleet-manager role.',
  })
  getFleetManagerAnalytics(@Req() req: Request) {
    const requester = (req as any).user as { userId: string; role: string };

    if (
      requester.role === 'fleet-manager' &&
      !this.settingsService.isPermissionEnabled('fleet-manager', 'Reports Access')
    ) {
      throw new ForbiddenException('Reports access is disabled for your account. Contact your Super User administrator.');
    }

    return this.dashboardService.getFleetManagerAnalytics(requester);
  }

  @Get('driver')
  @Roles(Role.DRIVER, Role.SUPERUSER)
  @ApiOperation({ summary: "Get the current driver's dashboard stats" })
  getDriverDashboard(@Req() req: Request) {
    const requester = (req as any).user as { userId: string; role: string };
    return this.dashboardService.getDriverDashboard(requester.userId);
  }
}
