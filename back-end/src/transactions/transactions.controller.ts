import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto, CreateInvoiceDto } from './dto/transaction.dto';
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