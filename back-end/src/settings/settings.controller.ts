import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdatePlatformSettingsDto, UpdateSecuritySettingsDto, UpdatePermissionsDto } from './dto/settings.dto';
import { RolesGuard, Roles, Role } from '../common';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('platform')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  @ApiOperation({ summary: 'Get platform settings' })
  getPlatform() {
    return this.settingsService.getPlatformSettings();
  }

  @Put('platform')
  @Roles(Role.SUPERUSER)
  @ApiOperation({ summary: 'Update platform settings' })
  updatePlatform(@Body() dto: UpdatePlatformSettingsDto) {
    return this.settingsService.updatePlatformSettings(dto);
  }

  @Get('security')
  @Roles(Role.SUPERUSER)
  @ApiOperation({ summary: 'Get security settings' })
  getSecurity() {
    return this.settingsService.getSecuritySettings();
  }

  @Put('security')
  @Roles(Role.SUPERUSER)
  @ApiOperation({ summary: 'Update security settings' })
  updateSecurity(@Body() dto: UpdateSecuritySettingsDto) {
    return this.settingsService.updateSecuritySettings(dto);
  }

  @Get('permissions')
  @Roles(Role.SUPERUSER)
  @ApiOperation({ summary: 'Get all role permissions' })
  getAllPermissions() {
    return this.settingsService.getAllPermissions();
  }

  @Get('permissions/:role')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Get permissions for a specific role' })
  @ApiParam({ name: 'role', description: 'Role key (fleet-manager, business-client, driver)' })
  getPermissions(@Param('role') role: string) {
    return this.settingsService.getPermissions(role);
  }

  @Put('permissions/:role')
  @Roles(Role.SUPERUSER)
  @ApiOperation({ summary: 'Update permissions for a specific role' })
  @ApiParam({ name: 'role' })
  updatePermissions(@Param('role') role: string, @Body() dto: UpdatePermissionsDto) {
    return this.settingsService.updatePermissions(role, dto.permissions);
  }
}
