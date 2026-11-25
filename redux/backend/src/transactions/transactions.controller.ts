import { billingPage } from './billing-page';
import { DataStoreService } from '../data-store/data-store.service';
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
import type { Request, Response } from 'express';
import { NotFoundException, Res } from '@nestjs/common';
import { DocumentsService } from '../documents/documents.service';
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
  constructor(private readonly transactionsService: TransactionsService, private readonly documents: DocumentsService, private readonly store: DataStoreService) {}

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
    const paged = req.query.page !== undefined || req.query.limit !== undefined;
    const rows = this.transactionsService.findAllTransactions(paged ? undefined : search, (req as any).user);
    return paged ? billingPage(rows, req.query) : rows;
  }

  @Get('payments/:id/receipt')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT)
  downloadReceipt(@Param('id') id: string, @Req() req: Request, @Res() response: Response) {
    const txn = this.transactionsService.findAllTransactions(undefined, (req as any).user).find((item) => item.id === id);
    if (!txn?.receiptUrl) throw new NotFoundException('Receipt not found');
    const { filePath, document } = this.documents.getReceiptFile(txn.receiptUrl, txn.userId);
    response.setHeader('Cache-Control', 'private, no-store');
    return response.download(filePath, document.fileName || 'receipt');
  }

  @Get('invoices')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'List invoices only' })
  @ApiQuery({ name: 'search', required: false })
  findInvoices(@Query('search') search: string | undefined, @Req() req: Request) {
    const paged = req.query.page !== undefined || req.query.limit !== undefined;
    const rows = this.transactionsService.findAllInvoices(paged ? undefined : search, (req as any).user);
    return paged ? billingPage(rows, req.query) : rows;
  }

  @Post()
  @Roles(Role.SUPERUSER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'Create transaction' })
  create(@Body() dto: CreateTransactionDto, @Req() req: Request) {
    const actor = (req as any).user;
    if (dto.receiptUrl) {
      const { document } = this.documents.getReceiptFile(dto.receiptUrl, actor.userId);
      if (document.uploadedBy !== actor.userId) throw new NotFoundException('Receipt not found');
    }
    return this.store.atomic(() => this.transactionsService.create(dto, actor));
  }

  @Post('invoices')
  @Roles(Role.SUPERUSER)
  @ApiOperation({ summary: 'Create an invoice' })
  createInvoice(@Body() dto: CreateInvoiceDto, @Req() req: Request) {
    return this.store.atomic(() => this.transactionsService.createInvoice(dto, req.get('Idempotency-Key'), (req as any).user.userId));
  }

  @Post('invoices/generate/:deliveryId')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Generate an invoice from a completed delivery and the configured rate card' })
  @ApiParam({ name: 'deliveryId', required: true })
  generateInvoiceForDelivery(@Param('deliveryId') deliveryId: string, @Req() req: Request) {
    this.transactionsService.assertFleetDelivery(deliveryId, (req as any).user);
    return this.store.atomic(() => this.transactionsService.generateInvoiceForDelivery(deliveryId));
  }

  @Post('payments/:id/reversal')
  @Roles(Role.SUPERUSER)
  recordReversal(@Param('id') id: string, @Body('kind') kind: string, @Body('reason') reason: string, @Req() req: Request) {
    return this.store.atomic(() => this.transactionsService.recordReversal(id, kind, reason, (req as any).user.userId));
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
    return this.store.atomic(() => this.transactionsService.updateTransactionStatus(transactionId, status));
  }
}
