import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { ReassignTripDto, TripLocationDto } from './dto/trip.dto';
import { RolesGuard, Roles, Role } from '../common';

@ApiTags('Trips')
@Controller('trips')
@UseGuards(RolesGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Patch(':id/location')
  @Roles(Role.DRIVER)
  updateLocation(@Param('id') id: string, @Body() location: TripLocationDto, @Req() req: Request) {
    return this.tripsService.updateLocation(id, location, (req as any).user);
  }

  @Get()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.DRIVER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'List all trips' })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query('search') search?: string, @Req() req?: Request) {
    const requester = (req as any)?.user as { userId: string; role: string } | undefined;
    return this.tripsService.findAll(search, requester);
  }

  @Get(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.DRIVER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'Get trip by ID' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string, @Req() req?: Request) {
    const requester = (req as any)?.user as { userId: string; role: string } | undefined;
    return this.tripsService.findOne(id, requester);
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
  reassign(@Param('id') id: string, @Body() dto: ReassignTripDto, @Req() req: Request) {
    if (!dto || !dto.driver) {
      throw new BadRequestException('driver is required');
    }

    return this.tripsService.reassign(id, dto.driver, (req as any).user);
  }

  @Patch(':id/status')
  @Roles(Role.DRIVER)
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
            'Accepted',
            'Rejected',
            'Picked Up',
            'In Transit',
            'Completed',
          ],
        },
      },
      required: ['status'],
    },
  })
  updateStatus(
    @Param('id') id: string,
    @Body() body?: { status?: string; recipient?: string; notes?: string; proofDocumentId?: string },
    @Req() req?: Request,
  ) {
    if (!body || !body.status) {
      throw new BadRequestException('status is required');
    }

    const requester = (req as any)?.user as { userId: string; role: string } | undefined;
    return this.tripsService.updateStatus(id, body.status, requester, {
      recipient: body.recipient,
      notes: body.notes,
      proofDocumentId: body.proofDocumentId,
    });
  }

  @Patch(':id/report-issue')
  @Roles(Role.DRIVER)
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
    @Req() req?: Request,
  ) {
    if (!body || !body.issueType || !body.description) {
      throw new BadRequestException('issueType and description are required');
    }

    const requester = (req as any)?.user as { userId: string; role: string } | undefined;
    return this.tripsService.reportIssue(id, body, requester);
  }

  @Patch(':id/notes')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.DRIVER)
  @ApiOperation({ summary: 'Add a driver note to a trip' })
  @ApiParam({ name: 'id' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { text: { type: 'string', example: 'Customer asked to leave at gate.' } },
      required: ['text'],
    },
  })
  addNote(@Param('id') id: string, @Body() body?: { text?: string }, @Req() req?: Request) {
    if (!body || !body.text || !body.text.trim()) {
      throw new BadRequestException('text is required');
    }

    const requester = (req as any)?.user as { userId: string; role: string } | undefined;
    return this.tripsService.addNote(id, body.text.trim(), requester);
  }

  @Patch(':id/resolve-dispute')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({
    summary: 'Resolve a reported issue with a billable amount',
    description:
      'Sets the amount the business client should actually be charged for a disputed/damaged delivery. Commission and driver payout use this amount instead of the original invoice total.',
  })
  @ApiParam({ name: 'id' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        resolvedAmount: { type: 'number', example: 2500 },
        reason: { type: 'string', example: 'Partial delivery — 2 of 5 items damaged.' },
      },
      required: ['resolvedAmount'],
    },
  })
  resolveDispute(
    @Param('id') id: string,
    @Body() body?: { resolvedAmount?: number; reason?: string },
    @Req() req?: Request,
  ) {
    if (!body || body.resolvedAmount === undefined || body.resolvedAmount === null) {
      throw new BadRequestException('resolvedAmount is required');
    }

    const requester = (req as any)?.user as { userId: string; role: string } | undefined;
    return this.tripsService.resolveDispute(id, Number(body.resolvedAmount), body.reason || '', requester);
  }
}
