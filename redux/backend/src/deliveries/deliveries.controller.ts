import { operationalPage } from '../common/page';
import { Throttle } from '@nestjs/throttler';
import { RecipientSmsService } from './recipient-sms.service';
import { DataStoreService } from '../data-store/data-store.service';
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
  DeliveryQuoteDto,
  BlockDeliveryDto,
  UnblockDeliveryDto,
  CancelDeliveryDto,
  HandoffRecipientDto,
} from './dto/delivery.dto';
import { RolesGuard, Roles, Role } from '../common';
import { serviceRoutes } from '../common/service-routes';

@ApiTags('Deliveries')
@Controller('deliveries')
@UseGuards(RolesGuard)
export class DeliveriesController {
  constructor(private readonly sms: RecipientSmsService, private readonly deliveriesService: DeliveriesService, private readonly store: DataStoreService) {}

  @Post('recipient/start')
  @Roles(Role.BUSINESS_CLIENT, Role.SUPERUSER)
  @Throttle({ default: {limit: 5, ttl: 3600000} })
  startVerification(@Body('phone') phone: string, @Req() req: Request) {
    return this.sms.start(phone, (req as any).user.userId);
  }

  @Post('recipient/confirm')
  @Roles(Role.BUSINESS_CLIENT, Role.SUPERUSER)
  @Throttle({ default: {limit: 12, ttl: 600000} })
  confirmVerification(@Body('challenge') challenge: string, @Body('code') code: string, @Req() req: Request) {
    return this.sms.confirm(challenge, code, (req as any).user.userId);
  }

  @Get('routes')
  @Roles(Role.BUSINESS_CLIENT, Role.FLEET_MANAGER, Role.SUPERUSER)
  routes() { return serviceRoutes; }

  @Post('quote')
  @Roles(Role.BUSINESS_CLIENT, Role.SUPERUSER)
  @ApiOperation({
    summary: 'Quote a delivery from its weight and dimensions',
    description: 'Uses the same persisted pricing calculation as delivery creation.',
  })
  quote(@Body() dto: DeliveryQuoteDto) {
    return this.deliveriesService.quote(dto);
  }

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
    if (req?.query.page !== undefined || req?.query.limit !== undefined) {
      const rows = this.deliveriesService.findAll(undefined, undefined, requester);
      if (req.query.view !== 'completed' || requester?.role !== 'business-client') return operationalPage(rows, req.query);
      const trips = new Map(this.store.trips.map(t => [t.request,t.id]));
      const invoices = new Map(this.store.invoices.filter((i:any) => i.userId === requester.userId).map((i:any) => [i.deliveryId,i.id]));
      const completed = rows.filter(d => ['completed','delivered'].includes(d.status.toLowerCase())).map(d =>
        ({...d,tripId:trips.get(d.id),invoiceId:invoices.get(d.id),completionDate:(d as any).completedAt || d.requestTime}));
      completed.sort((a,b) => String(b.completionDate).localeCompare(String(a.completionDate)));
      const now = Date.now();
      const since = (days:number) => completed.filter(d => Date.parse(d.completionDate) >= now-days*86400000 && Date.parse(d.completionDate) <= now).length;
      return {...operationalPage(completed,req.query),summary:{total:completed.length,week:since(7),month:since(30)}};
    }
    return this.deliveriesService.findAll(search, status, requester);
  }

  @Get(':id/tracking')
  @Roles(Role.BUSINESS_CLIENT)
  tracking(@Param('id') id: string, @Req() req: Request) {
    const delivery = this.deliveriesService.findOne(id, (req as any).user);
    const trip = this.store.trips.find(t => t.request === delivery.id);
    const driver = this.store.drivers.find(d => d.id === (trip?.driverId || delivery.driverId));
    const vehicle = trip && this.store.vehicles.find(v => v.fleetManagerId === trip.fleetManagerId && v.plate === trip.vehicle);
    return {delivery, trip: trip && {id:trip.id, driver:trip.driver, phone:trip.phone, status:trip.status, vehicle:trip.vehicle,
      pickup:trip.pickup, destination:trip.destination, distance:trip.distance, eta:(trip as any).eta, statusHistory:(trip as any).statusHistory,
      lastPosition:(trip as any).lastPosition}, driver:driver && {name:driver.name,phone:driver.phone,rating:driver.rating},
      vehicle:vehicle && {plate:vehicle.plate,type:vehicle.type}};
  }

  @Get(':id/label')
  @Roles(Role.BUSINESS_CLIENT, Role.SUPERUSER)
  parcelLabel(@Param('id') id: string, @Req() req: Request) {
    return this.deliveriesService.parcelLabel(id, (req as any).user);
  }

  @Get(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  @ApiOperation({
    summary: 'Get delivery request by ID',
    description:
      'Returns one persisted delivery request by ID for status tracking, feedback, driver details, and completed delivery pages.',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID, e.g. DR-2026-001' })
  findOne(@Param('id') id: string, @Req() req?: Request) {
    const requester = (req as any)?.user as { userId: string; role: string } | undefined;
    return this.deliveriesService.findOne(id, requester);
  }

  @Patch(':id/recipient')
  @Roles(Role.BUSINESS_CLIENT)
  setRecipient(@Param('id') id: string, @Body() dto: HandoffRecipientDto, @Req() req: Request) {
    return this.deliveriesService.setMissingRecipient(id, dto, (req as any).user);
  }

  @Post(':id/delivery-otp')
  @Roles(Role.DRIVER, Role.BUSINESS_CLIENT)
  @ApiOperation({
    summary: 'Generate a delivery confirmation OTP',
    description: 'Creates a new six-digit OTP for an in-transit delivery. The assigned driver or booking client can request a code for the recipient.',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  issueDeliveryOtp(@Param('id') id: string, @Req() req?: Request) {
    const requester = (req as any)?.user as { userId: string; role: string } | undefined;
    return this.deliveriesService.issueDeliveryOtp(id, requester);
  }

  @Post()
  @Roles(Role.BUSINESS_CLIENT, Role.SUPERUSER)
  @ApiOperation({
    summary: 'Create a new delivery request',
    description:
      'Creates a delivery and linked trip. Eligible vehicles and drivers are considered for automatic dispatch.',
  })
  create(@Body() dto: CreateDeliveryDto, @Req() req?: Request) {
    const requester = (req as any)?.user as { userId: string; role: string } | undefined;
    return this.store.atomic(() => this.deliveriesService.create(dto, requester));
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
    return this.store.atomic(() => this.deliveriesService.block(id, dto.reason));
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
    return this.store.atomic(() => this.deliveriesService.unblock(id, dto.reason));
  }

  @Patch(':id/cancel')
  @Roles(Role.BUSINESS_CLIENT, Role.SUPERUSER)
  @ApiOperation({
    summary: 'Cancel a delivery request',
    description:
      'Business client or superuser cancels a delivery request and syncs the linked trip.',
  })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  cancel(@Param('id') id: string, @Body() dto: CancelDeliveryDto, @Req() req?: Request) {
    const requester = (req as any)?.user as { userId: string; role: string } | undefined;
    return this.store.atomic(() => this.deliveriesService.cancel(id, dto.reason, requester));
  }

  @Patch(':id/feedback')
  @Roles(Role.BUSINESS_CLIENT)
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
      required: ['rating', 'deliveryQuality', 'driverBehavior', 'overallExperience'],
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
    @Req() req?: Request,
  ) {
    const requester = (req as any)?.user as { userId: string; role: string } | undefined;
    return this.store.atomic(() => this.deliveriesService.submitFeedback(id, body, requester));
  }
}
