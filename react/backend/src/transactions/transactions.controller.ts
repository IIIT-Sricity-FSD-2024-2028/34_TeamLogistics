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
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import {
  CreateTransactionDto,
  CreateInvoiceDto,
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
  findAll(@Query('search') search: string | undefined, @Req() req: Request) {
    return this.transactionsService.findAll(search, (req as any).user);
  }

  @Get('payments')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'List transactions only' })
  @ApiQuery({ name: 'search', required: false })
  findTransactions(@Query('search') search: string | undefined, @Req() req: Request) {
    return this.transactionsService.findAllTransactions(search, (req as any).user);
  }

  @Get('invoices')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'List invoices only' })
  @ApiQuery({ name: 'search', required: false })
  findInvoices(@Query('search') search: string | undefined, @Req() req: Request) {
    return this.transactionsService.findAllInvoices(search, (req as any).user);
  }

  @Post()
  @Roles(Role.SUPERUSER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'Create transaction' })
  create(@Body() dto: CreateTransactionDto, @Req() req: Request) {
    return this.transactionsService.create(dto, (req as any).user);
  }

  @Post('invoices')
  @Roles(Role.SUPERUSER)
  @ApiOperation({ summary: 'Create an invoice' })
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.transactionsService.createInvoice(dto);
  }

  @Post('invoices/generate/:deliveryId')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Generate an invoice from a completed delivery and the configured rate card' })
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
