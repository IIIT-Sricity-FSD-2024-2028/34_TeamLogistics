import { operationalPage } from '../common/page';
import { DataStoreService } from '../data-store/data-store.service';
import { DocumentUpload, stageDocument } from '../documents/document-upload';
import { DocumentsService } from '../documents/documents.service';
import {finishUpload} from '../documents/upload-journal';
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
  UseInterceptors,
  UploadedFile,
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
  constructor(private readonly tripsService: TripsService, private readonly store: DataStoreService, private readonly documents: DocumentsService) {}

  @Patch(':id/location')
  @Roles(Role.DRIVER)
  updateLocation(@Param('id') id: string, @Body() location: TripLocationDto, @Req() req: Request) {
    return this.store.atomic(() => this.tripsService.updateLocation(id, location, (req as any).user));
  }

  @Get()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.DRIVER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'List all trips' })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query('search') search?: string, @Req() req?: Request) {
    const requester = (req as any)?.user as { userId: string; role: string } | undefined;
    if (req?.query.page !== undefined || req?.query.limit !== undefined) {
      const page = operationalPage(this.tripsService.findAll(undefined, requester), req.query);
      if (requester?.role !== 'driver') return page;
      const wanted = new Set(page.items.map(t => t.request));
      const parcels = new Map(this.store.deliveryRequests.filter(d => wanted.has(d.id)).map(d => [d.id, d]));
      return {...page, items: page.items.map(trip => {
        const parcel = parcels.get(trip.request || '');
        if (!parcel) return trip;
        const {customer, pickup, dropoff, weight, packageType, packageDimensions, instructions, distance, eta, feedback} = parcel as any;
        return {...trip, delivery: {customer, pickup, dropoff, weight, packageType, packageDimensions, instructions, distance, eta, feedback}};
      })};
    }
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

    return this.store.atomic(() => this.tripsService.reassign(id, dto.driver, (req as any).user));
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
        deliveryOtp: {
          type: 'string',
          example: '123456',
          description: 'Required with recipient and proofDocumentId when completing a delivery.',
        },
      },
      required: ['status'],
    },
  })
  updateStatus(
    @Param('id') id: string,
    @Body() body?: { status?: string; parcelBarcode?: string; recipient?: string; notes?: string; proofDocumentId?: string; deliveryOtp?: string },
    @Req() req?: Request,
  ) {
    if (!body || !body.status) {
      throw new BadRequestException('status is required');
    }

    const requester = (req as any)?.user as { userId: string; role: string } | undefined;
    const status = body.status;
    if (['completed', 'delivered'].includes(status.trim().toLowerCase()) &&
        this.tripsService.findOne(id, requester).status !== 'Completed') {
      this.tripsService.verifyDeliveryOtp(id, body.deliveryOtp || '', requester);
    }
    return this.store.atomic(() => this.tripsService.updateStatus(id, status, requester, {
      parcelBarcode: body.parcelBarcode, recipient: body.recipient,
      notes: body.notes,
      proofDocumentId: body.proofDocumentId,
      deliveryOtp: body.deliveryOtp,
    }));
  }

  @Patch(':id/failed-attempt')
  @Roles(Role.FLEET_MANAGER)
  decideFailedAttempt(@Param('id') id: string, @Body('decision') decision: string, @Req() req: Request, @Body('retryAt') retryAt?: string) {
    const actor = (req as any).user;
    const trip = this.tripsService.findOne(id, actor);
    if (trip.status !== 'Attempt Failed' || !['retry', 'return'].includes(decision)) {
      throw new BadRequestException('Choose retry or return for a failed delivery attempt');
    }
    if (retryAt !== undefined && (decision !== 'retry' || typeof retryAt !== 'string' ||
        !Number.isFinite(Date.parse(retryAt)) || Date.parse(retryAt) < Date.now())) {
      throw new BadRequestException('Choose a future second-attempt time');
    }
    return this.store.atomic(() => {
      const parcel = this.store.deliveryRequests.find(d => d.id === trip.request);
      const scheduled = retryAt ? new Date(retryAt).toISOString() : undefined;
      (trip as any).retryAt = scheduled;
      if (parcel) (parcel as any).retryAt = scheduled;
      return this.tripsService.updateStatus(id, decision === 'retry' ? 'In Transit' : 'Returning', actor);
    });
  }

  @Post(':id/complete')
  @Roles(Role.DRIVER)
  @UseInterceptors(DocumentUpload)
  async complete(@Param('id') id: string, @Body() body: { parcelBarcode?: string; deliveryOtp: string; recipient: string; notes?: string },
    @UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) throw new BadRequestException('A proof file is required');
    const actor = (req as any).user;
    await stageDocument(file);
    try {
      const trip = this.tripsService.findOne(id, actor);
      if (trip.status === 'Completed') return trip;
      this.tripsService.verifyDeliveryOtp(id, body.deliveryOtp, actor);
      const result = this.store.atomic(() => {
        const proof = this.documents.create({ ownerType: 'delivery', delivery: trip.request, documentType: 'Proof of Delivery' }, file, actor);
        return this.tripsService.updateStatus(id, 'Completed', actor, { ...body, proofDocumentId: proof.id });
      });
      return result;
    } finally {
      finishUpload(file.filename, this.store.documents.some(doc => doc.fileUrl?.endsWith('/'+file.filename)));
    }
  }

  @Post(':id/verify-delivery-otp')
  @Roles(Role.DRIVER)
  @ApiOperation({
    summary: 'Verify the delivery confirmation OTP',
    description: 'Verifies the six-digit OTP before the driver uploads proof and completes an in-transit delivery.',
  })
  @ApiParam({ name: 'id' })
  @ApiBody({ schema: { type: 'object', properties: { deliveryOtp: { type: 'string', example: '123456' } }, required: ['deliveryOtp'] } })
  verifyDeliveryOtp(
    @Param('id') id: string,
    @Body() body?: { deliveryOtp?: string },
    @Req() req?: Request,
  ) {
    if (!body?.deliveryOtp) throw new BadRequestException('deliveryOtp is required');
    const requester = (req as any)?.user as { userId: string; role: string } | undefined;
    return this.tripsService.verifyDeliveryOtp(id, body.deliveryOtp, requester);
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
      evidenceId?: string;
      description?: string;
      status?: string;
    },
    @Req() req?: Request,
  ) {
    if (!body || !body.issueType || !body.description) {
      throw new BadRequestException('issueType and description are required');
    }

    const requester = (req as any)?.user as { userId: string; role: string } | undefined;
    return this.store.atomic(() => this.tripsService.reportIssue(id, body, requester));
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
      'Sets the amount the business client should actually be charged for a disputed/damaged delivery. The invoice uses the resolved charge. Driver earnings follow the accepted rate card.',
  })
  @ApiParam({ name: 'id' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        resolvedAmount: { type: 'number', example: 2500 },
        reason: { type: 'string', example: 'Parcel arrived damaged.' },
      },
      required: ['resolvedAmount','reason'],
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
    return this.store.atomic(() => this.tripsService.resolveDispute(id, Number(body.resolvedAmount), body.reason || '', requester));
  }
}
