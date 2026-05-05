import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { CreateDriverDto, UpdateDriverDto } from './dto/driver.dto';
import { RolesGuard, Roles, Role } from '../common';

@ApiTags('Drivers')
@Controller('drivers')
@UseGuards(RolesGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  @ApiOperation({
    summary: 'List all drivers',
    description:
      'Returns drivers list. Driver role is allowed so driver portal profile page can load its own driver data.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search driver by name, email, phone, vehicle, or license number',
  })
  findAll(@Query('search') search?: string) {
    return this.driversService.findAll(search);
  }

  @Get(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  @ApiOperation({
    summary: 'Get driver by ID',
    description:
      'Returns one driver profile. Driver role is allowed for driver portal profile view.',
  })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  findOne(@Param('id') id: string) {
    return this.driversService.findOne(id);
  }

  @Post()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({
    summary: 'Add a new driver',
    description: 'Only superuser and fleet manager can create drivers.',
  })
  create(@Body() dto: CreateDriverDto) {
    return this.driversService.create(dto);
  }

  @Put(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.DRIVER)
  @ApiOperation({
    summary: 'Update driver info',
    description:
      'Superuser and fleet manager can update driver data. Driver role is allowed so driver portal profile page can save its own profile.',
  })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  update(@Param('id') id: string, @Body() dto: UpdateDriverDto) {
    return this.driversService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({
    summary: 'Delete a driver',
    description: 'Only superuser and fleet manager can delete drivers.',
  })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  remove(@Param('id') id: string) {
    return this.driversService.remove(id);
  }
}