import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceDto, UpdateMaintenanceDto } from './dto/maintenance.dto';
import { RolesGuard, Roles, Role } from '../common';

@ApiTags('Maintenance')
@Controller('maintenance')
@UseGuards(RolesGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'List all maintenance schedules' })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query('search') search?: string) {
    return this.maintenanceService.findAll(search);
  }

  @Get(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Get maintenance schedule by ID' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.maintenanceService.findOne(id);
  }

  @Post()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Schedule a maintenance' })
  create(@Body() dto: CreateMaintenanceDto) {
    return this.maintenanceService.create(dto);
  }

  @Put(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Update a maintenance schedule' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceDto) {
    return this.maintenanceService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Delete a maintenance schedule' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.maintenanceService.remove(id);
  }
}
