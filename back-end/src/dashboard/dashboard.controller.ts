import { Controller, Get, Headers, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { RolesGuard, Roles, Role } from '../common';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('superuser')
  @Roles(Role.SUPERUSER)
  @ApiOperation({ summary: 'Get superuser dashboard stats' })
  getSuperuserDashboard() {
    return this.dashboardService.getSuperuserDashboard();
  }

  @Get('business-client')
  @Roles(Role.BUSINESS_CLIENT, Role.SUPERUSER)
  @ApiOperation({ summary: "Get the current business client's dashboard stats" })
  getBusinessClientDashboard(@Headers('x-user-id') userId?: string) {
    return this.dashboardService.getBusinessClientDashboard(userId);
  }

  @Get('fleet-manager')
  @Roles(Role.FLEET_MANAGER, Role.SUPERUSER)
  @ApiOperation({ summary: 'Get fleet manager dashboard stats' })
  getFleetManagerDashboard() {
    return this.dashboardService.getFleetManagerDashboard();
  }

  @Get('driver')
  @Roles(Role.DRIVER, Role.SUPERUSER)
  @ApiOperation({ summary: "Get the current driver's dashboard stats" })
  getDriverDashboard(@Headers('x-user-id') userId?: string) {
    return this.dashboardService.getDriverDashboard(userId);
  }
}
