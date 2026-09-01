import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { DeliveriesService } from './deliveries.service';
import {
  CreateDeliveryDto,
  BlockDeliveryDto,
  UnblockDeliveryDto,
  CancelDeliveryDto,
} from './dto/delivery.dto';
import { RolesGuard, Roles, Role } from '../common';

@ApiTags('Deliveries')
@Controller('deliveries')
@UseGuards(RolesGuard)
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Get()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  @ApiOperation({
    summary: 'List all delivery requests',
    description:
      'Returns delivery requests. Used by business client, driver, fleet manager, and superuser portals.',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Req() req?: Request,
  ) {
    const requester = (req as any)?.user as { userId: string; role: string } | undefined;
    return this.deliveriesService.findAll(search, status, requester);
  }

  @Get(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  @ApiOperation({
    summary: 'Get delivery request by ID',
    description:
      'Returns one delivery request by ID. Used for live tracking, feedback, driver details, and completed delivery pages.',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID, e.g. DR-2026-001' })
  findOne(@Param('id') id: string) {
    return this.deliveriesService.findOne(id);
  }

  @Post()
  @Roles(Role.BUSINESS_CLIENT, Role.SUPERUSER)
  @ApiOperation({
    summary: 'Create a new delivery request',
    description:
      'Business client creates a delivery request. New flow: backend automatically creates a linked trip and directly assigns it to the default driver.',
  })
  create(@Body() dto: CreateDeliveryDto) {
    return this.deliveriesService.create(dto);
  }

  @Patch(':id/block')
  @Roles(Role.SUPERUSER)
  @ApiOperation({
    summary: 'Block a delivery request',
    description:
      'Superuser blocks a delivery request and syncs the linked trip status.',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  block(@Param('id') id: string, @Body() dto: BlockDeliveryDto) {
    return this.deliveriesService.block(id, dto.reason);
  }

  @Patch(':id/unblock')
  @Roles(Role.SUPERUSER)
  @ApiOperation({
    summary: 'Unblock a delivery request',
    description:
      'Superuser unblocks a delivery request and makes the linked trip visible again in the driver portal.',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  unblock(@Param('id') id: string, @Body() dto: UnblockDeliveryDto) {
    return this.deliveriesService.unblock(id, dto.reason);
  }

  @Patch(':id/cancel')
  @Roles(Role.BUSINESS_CLIENT, Role.SUPERUSER)
  @ApiOperation({
    summary: 'Cancel a delivery request',
    description:
      'Business client or superuser cancels a delivery request and syncs the linked trip.',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  cancel(@Param('id') id: string, @Body() dto: CancelDeliveryDto) {
    return this.deliveriesService.cancel(id, dto.reason);
  }

  @Patch(':id/feedback')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  @ApiOperation({
    summary: 'Submit feedback for completed delivery',
    description:
      'Stores feedback in deliveries.json, syncs feedback into the linked trip in trips.json, and creates a notification.',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID, e.g. DR-2026-001' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        rating: {
          type: 'number',
          example: 4,
        },
        comment: {
          type: 'string',
          example: 'Delivery was smooth and driver was polite.',
        },
        deliveryQuality: {
          type: 'string',
          example: 'Excellent',
        },
        driverBehavior: {
          type: 'string',
          example: 'Good',
        },
        overallExperience: {
          type: 'string',
          example: 'Very satisfied',
        },
      },
      required: ['rating'],
    },
  })
  submitFeedback(
    @Param('id') id: string,
    @Body()
    body: {
      rating: number;
      comment?: string;
      deliveryQuality?: string;
      driverBehavior?: string;
      overallExperience?: string;
    },
  ) {
    return this.deliveriesService.submitFeedback(id, body);
  }
}