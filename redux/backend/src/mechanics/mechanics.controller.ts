import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles, RolesGuard, Role } from '../common';
import { CreateMechanicDto, UpdateMechanicDto } from './dto/mechanic.dto';
import { MechanicsService } from './mechanics.service';

@ApiTags('Mechanics')
@Controller('mechanics')
@UseGuards(RolesGuard)
export class MechanicsController {
  constructor(private readonly mechanicsService: MechanicsService) {}

  @Get()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'List mechanics available to the current user' })
  @ApiQuery({ name: 'active', required: false, enum: ['true', 'false'] })
  findAll(@Query('active') active?: string, @Req() req?: Request) {
    const requester = (req as any)?.user as { userId: string; role: string } | undefined;
    return this.mechanicsService.findAll(active, requester);
  }

  @Get(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Get a mechanic by ID' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.mechanicsService.findOne(id, (req as any).user);
  }

  @Post()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Create a mechanic' })
  create(@Body() dto: CreateMechanicDto, @Req() req: Request) {
    return this.mechanicsService.create(dto, (req as any).user);
  }

  @Put(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Update a mechanic' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateMechanicDto, @Req() req: Request) {
    return this.mechanicsService.update(id, dto, (req as any).user);
  }

  @Patch(':id/deactivate')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Deactivate a mechanic without removing historical references' })
  @ApiParam({ name: 'id' })
  deactivate(@Param('id') id: string, @Req() req: Request) {
    return this.mechanicsService.deactivate(id, (req as any).user);
  }
}
