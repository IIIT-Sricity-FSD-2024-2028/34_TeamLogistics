import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { ReassignTripDto } from './dto/trip.dto';
import { RolesGuard, Roles, Role } from '../common';

@ApiTags('Trips')
@Controller('trips')
@UseGuards(RolesGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.DRIVER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'List all trips' })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query('search') search?: string) {
    return this.tripsService.findAll(search);
  }

  @Get(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.DRIVER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'Get trip by ID' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.tripsService.findOne(id);
  }

  @Patch(':id/reassign')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Reassign driver for a trip' })
  @ApiParam({ name: 'id' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        driver: {
          type: 'string',
          example: 'Raghav Reddy',
        },
      },
      required: ['driver'],
    },
  })
  reassign(@Param('id') id: string, @Body() dto: ReassignTripDto) {
    if (!dto || !dto.driver) {
      throw new BadRequestException('driver is required');
    }

    return this.tripsService.reassign(id, dto.driver);
  }

  @Patch(':id/status')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.DRIVER, Role.BUSINESS_CLIENT)
  @ApiOperation({
    summary: 'Update trip status',
    description:
      'Updates trip status and syncs the linked delivery request status so other actor portals show the same state.',
  })
  @ApiParam({ name: 'id' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          example: 'Accepted',
          enum: [
            'Assigned',
            'Accepted',
            'Rejected',
            'In Transit',
            'Picked Up',
            'Delivered',
            'Completed',
            'Delayed',
            'Queued',
            'Issue Reported',
          ],
        },
      },
      required: ['status'],
    },
  })
  updateStatus(
    @Param('id') id: string,
    @Body() body?: { status?: string },
  ) {
    console.log('PATCH STATUS ID:', id);
    console.log('PATCH STATUS BODY:', body);

    if (!body || !body.status) {
      throw new BadRequestException('status is required');
    }

    return this.tripsService.updateStatus(id, body.status);
  }

  @Patch(':id/report-issue')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.DRIVER, Role.BUSINESS_CLIENT)
  @ApiOperation({
    summary: 'Report an issue for a trip',
    description:
      'Reports an issue for a trip, updates the linked delivery request, and creates notifications for other portals.',
  })
  @ApiParam({ name: 'id' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        issueType: {
          type: 'string',
          example: 'Vehicle problem',
        },
        description: {
          type: 'string',
          example: 'Vehicle broke down near pickup location.',
        },
        status: {
          type: 'string',
          example: 'Issue Reported',
        },
      },
      required: ['issueType', 'description'],
    },
  })
  reportIssue(
    @Param('id') id: string,
    @Body()
    body?: {
      issueType?: string;
      description?: string;
      status?: string;
    },
  ) {
    console.log('PATCH REPORT ISSUE ID:', id);
    console.log('PATCH REPORT ISSUE BODY:', body);

    if (!body || !body.issueType || !body.description) {
      throw new BadRequestException('issueType and description are required');
    }

    return this.tripsService.reportIssue(id, body);
  }
}