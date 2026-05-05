import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiParam } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';
import { RolesGuard, Roles, Role } from '../common';

@ApiTags('Vehicles')
@Controller('vehicles')
@UseGuards(RolesGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'List all vehicles' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (active, maintenance, blocked, on trip)' })
  @ApiResponse({ status: 200, description: 'List of vehicles' })
  findAll(@Query('search') search?: string, @Query('status') status?: string) {
    return this.vehiclesService.findAll(search, status);
  }

  @Get(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'Get vehicle by ID' })
  @ApiParam({ name: 'id', description: 'Vehicle ID' })
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findOne(id);
  }

  @Post()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Add a new vehicle' })
  @ApiResponse({ status: 201, description: 'Vehicle created' })
  create(@Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(dto);
  }

  @Put(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Update a vehicle' })
  @ApiParam({ name: 'id', description: 'Vehicle ID' })
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Delete a vehicle' })
  @ApiParam({ name: 'id', description: 'Vehicle ID' })
  remove(@Param('id') id: string) {
    return this.vehiclesService.remove(id);
  }
}