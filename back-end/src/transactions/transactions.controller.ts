import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import {
  CreateTransactionDto,
  CreateInvoiceDto,
  PayDeliveryDto,
} from './dto/transaction.dto';
import { RolesGuard, Roles, Role } from '../common';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @Roles(Role.SUPERUSER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'List all transactions and invoices' })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query('search') search?: string) {
    return this.transactionsService.findAll(search);
  }

  @Get('payments')
  @Roles(Role.SUPERUSER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'List transactions only' })
  @ApiQuery({ name: 'search', required: false })
  findTransactions(@Query('search') search?: string) {
    return this.transactionsService.findAllTransactions(search);
  }

  @Get('invoices')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'List invoices only' })
  @ApiQuery({ name: 'search', required: false })
  findInvoices(@Query('search') search?: string) {
    return this.transactionsService.findAllInvoices(search);
  }

  @Post()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'Create transaction' })
  create(@Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(dto);
  }

  @Post('invoices')
  @Roles(Role.SUPERUSER)
  @ApiOperation({ summary: 'Create an invoice' })
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.transactionsService.createInvoice(dto);
  }

  @Post('invoices/generate/:deliveryId')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'Automatically generate invoice for delivered delivery' })
  @ApiParam({ name: 'deliveryId', required: true })
  generateInvoiceForDelivery(@Param('deliveryId') deliveryId: string) {
    return this.transactionsService.generateInvoiceForDelivery(deliveryId);
  }

  @Get('revenue-summary')
  @Roles(Role.SUPERUSER)
  @ApiOperation({ summary: 'Platform revenue summary: delivery commission and total revenue' })
  getRevenueSummary() {
    return this.transactionsService.getRevenueSummary();
  }

  @Post('pay-delivery')
  @Roles(Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'Business Client pays a delivery invoice; backend calculates the platform commission at the current configured rate' })
  payDelivery(@Body() dto: PayDeliveryDto, @Req() req: Request) {
    const requester = (req as any).user as { userId: string; role: string };
    return this.transactionsService.payDelivery(dto, requester.userId);
  }

  @Post(':id/refund')
  @Roles(Role.SUPERUSER)
  @ApiOperation({
    summary: 'Full or partial refund of a completed delivery payment',
    description:
      'Reverses platform commission proportionally to the refund amount. Omit amount for a full refund of the remaining balance. Multiple partial refunds are allowed up to the original amount. Driver keeps their payout.',
  })
  @ApiParam({ name: 'id', required: true })
  refundDelivery(
    @Param('id') id: string,
    @Body('amount') amount: number | undefined,
    @Body('reason') reason: string,
    @Req() req: Request,
  ) {
    const requester = (req as any).user as { userId: string; role: string };

    if (!id) {
      throw new BadRequestException('Transaction id is required');
    }

    return this.transactionsService.refundDelivery(id, amount === undefined ? undefined : Number(amount), reason, requester);
  }

  @Patch('payments/:transactionId/status')
  @Roles(Role.SUPERUSER)
  @ApiOperation({ summary: 'Approve, reject, or update submitted payment transaction status' })
  @ApiParam({ name: 'transactionId', required: true })
  updateTransactionStatus(
    @Param('transactionId') transactionId: string,
    @Body('status') status: string,
  ) {
    return this.transactionsService.updateTransactionStatus(transactionId, status);
  }
}