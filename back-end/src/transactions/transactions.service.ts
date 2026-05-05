import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  DataStoreService,
  Transaction,
  Invoice,
} from '../data-store/data-store.service';
import {
  CreateTransactionDto,
  CreateInvoiceDto,
} from './dto/transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly store: DataStoreService) {}

  findAllTransactions(search?: string): Transaction[] {
    let items = [...this.store.transactions];

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((t) => JSON.stringify(t).toLowerCase().includes(q));
    }

    return items;
  }

  findAllInvoices(search?: string): Invoice[] {
    let items = [...this.store.invoices];

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((i) => JSON.stringify(i).toLowerCase().includes(q));
    }

    return items;
  }

  findAll(search?: string): { transactions: Transaction[]; invoices: Invoice[] } {
    return {
      transactions: this.findAllTransactions(search),
      invoices: this.findAllInvoices(search),
    };
  }

  createTransaction(dto: CreateTransactionDto): Transaction {
    const now = new Date();

    const txn: Transaction = {
      id: `TXN-${Date.now()}`,
      type: dto.type || 'Payment',
      client: dto.client || 'Acme Logistics Inc.',
      amount: Number(dto.amount || 0),
      status: dto.status || 'Pending',
      date: (dto as any).date || now.toISOString().split('T')[0],
      createdAt: (dto as any).createdAt || now.toISOString(),

      invoiceId: (dto as any).invoiceId || '',
      deliveryId: (dto as any).deliveryId || '',
      paymentMode: (dto as any).paymentMode || 'Bank Transfer',
      reference: (dto as any).reference || '',
      receiptName: (dto as any).receiptName || 'No receipt uploaded',
    } as Transaction;

    this.store.transactions.push(txn);
    this.store.persistTransactions();

    const invoiceId = (dto as any).invoiceId;

    if (invoiceId) {
      const invoice: any = this.store.invoices.find(
        (inv: any) =>
          inv.id === invoiceId ||
          inv.invoiceId === invoiceId ||
          inv.invoiceNo === invoiceId ||
          inv.invoiceNumber === invoiceId,
      );

      if (invoice) {
        invoice.status = 'Under Review';
        invoice.paymentStatus = 'Under Review';
        this.store.persistInvoices();
      }
    }

    return txn;
  }

  // Alias method: useful if controller calls this.transactionsService.create(dto)
  create(dto: CreateTransactionDto): Transaction {
    return this.createTransaction(dto);
  }

  createInvoice(dto: CreateInvoiceDto): Invoice {
    const now = new Date();

    const inv: any = {
      id: `INV-${String(this.store.invoices.length + 1).padStart(3, '0')}`,
      client: dto.client,
      amount: Number(dto.amount || 0),
      status: dto.status || 'Unpaid',
      dueDate:
        dto.dueDate ||
        new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      createdAt: now.toISOString(),

      // Optional fields for invoice linkage/details
      address: (dto as any).address || '',
      deliveryId: (dto as any).deliveryId || '',
      baseCost: Number((dto as any).baseCost || dto.amount || 0),
      tax: Number((dto as any).tax || 0),
      taxAmount: Number((dto as any).taxAmount || (dto as any).tax || 0),
      total: Number((dto as any).total || dto.amount || 0),
      totalAmount: Number((dto as any).totalAmount || (dto as any).total || dto.amount || 0),
      paymentStatus: (dto as any).paymentStatus || dto.status || 'Unpaid',
    };

    this.store.invoices.push(inv as Invoice);
    this.store.persistInvoices();

    return inv as Invoice;
  }

  generateInvoiceForDelivery(deliveryId: string): Invoice {
    if (!deliveryId) {
      throw new BadRequestException('Delivery ID is required');
    }

    const cleanDeliveryId = String(deliveryId).replace(/^#/, '').trim();

    // 1. If invoice already exists, return it.
    const existingInvoice: any = this.store.invoices.find(
      (invoice: any) =>
        String(invoice.deliveryId || '').replace(/^#/, '').trim() === cleanDeliveryId ||
        String(invoice.request || '').replace(/^#/, '').trim() === cleanDeliveryId ||
        String(invoice.deliveryRequestId || '').replace(/^#/, '').trim() === cleanDeliveryId ||
        String(invoice.delivery || '').replace(/^#/, '').trim() === cleanDeliveryId ||
        String(invoice.requestId || '').replace(/^#/, '').trim() === cleanDeliveryId,
    );

    if (existingInvoice) {
      return existingInvoice as Invoice;
    }

    // 2. Find delivery from backend data.
    const delivery: any = this.store.deliveryRequests.find(
      (d: any) =>
        String(d.id || '').replace(/^#/, '').trim() === cleanDeliveryId ||
        String(d.deliveryId || '').replace(/^#/, '').trim() === cleanDeliveryId ||
        String(d.request || '').replace(/^#/, '').trim() === cleanDeliveryId ||
        String(d.requestId || '').replace(/^#/, '').trim() === cleanDeliveryId ||
        String(d.deliveryRequestId || '').replace(/^#/, '').trim() === cleanDeliveryId,
    );

    if (!delivery) {
      throw new NotFoundException(`Delivery ${cleanDeliveryId} not found`);
    }

    // 3. Find linked trip.
    const trip: any = this.store.trips.find(
      (t: any) =>
        String(t.request || '').replace(/^#/, '').trim() === cleanDeliveryId ||
        String(t.deliveryId || '').replace(/^#/, '').trim() === cleanDeliveryId ||
        String(t.delivery_id || '').replace(/^#/, '').trim() === cleanDeliveryId ||
        String(t.requestId || '').replace(/^#/, '').trim() === cleanDeliveryId ||
        String(t.deliveryRequestId || '').replace(/^#/, '').trim() === cleanDeliveryId ||
        String(t.delivery || '').replace(/^#/, '').trim() === cleanDeliveryId,
    );

    // 4. Invoice should be generated only for delivered/completed delivery.
    const deliveryStatus = String(delivery.status || '').toLowerCase();
    const tripStatus = String(trip?.status || '').toLowerCase();

    const isDelivered =
      deliveryStatus === 'delivered' ||
      deliveryStatus === 'completed' ||
      tripStatus === 'delivered' ||
      tripStatus === 'completed';

    if (!isDelivered) {
      throw new BadRequestException(
        'Invoice can be generated only for delivered deliveries',
      );
    }

    // 5. Decide invoice date.
    const rawInvoiceDate =
      delivery.completedAt ||
      delivery.deliveryDate ||
      delivery.date ||
      delivery.requestTime ||
      trip?.completedAt ||
      trip?.date ||
      new Date().toISOString();

    const parsedInvoiceDate = new Date(rawInvoiceDate);

    const invoiceDate = !Number.isNaN(parsedInvoiceDate.getTime())
      ? parsedInvoiceDate.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const dueDate = new Date(
      new Date(invoiceDate).getTime() + 15 * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .split('T')[0];

    // 6. Calculate amount.
    const distanceRaw =
      trip?.distance ||
      trip?.distanceKm ||
      delivery.distance ||
      delivery.distanceKm ||
      '';

    const distanceNumber = Number(String(distanceRaw).replace(/[^\d.]/g, ''));

    const baseCost =
      !Number.isNaN(distanceNumber) && distanceNumber > 0
        ? Math.round(distanceNumber * 100)
        : 5000;

    const taxAmount = Math.round(baseCost * 0.1);
    const totalAmount = baseCost + taxAmount;

    // 7. Create invoice.
    const invoice: any = {
      id: `INV-${cleanDeliveryId}`,
      invoiceId: `INV-${cleanDeliveryId}`,

      deliveryId: cleanDeliveryId,

      client:
        delivery.customer ||
        delivery.client ||
        delivery.company ||
        'Business Client',

      address:
        delivery.address ||
        delivery.clientAddress ||
        delivery.billingAddress ||
        '123 Business Avenue',

      invoiceDate,
      date: invoiceDate,
      dueDate,

      driver:
        trip?.driver ||
        trip?.driverName ||
        delivery.driver ||
        delivery.driverName ||
        'Not assigned',

      pickup:
        trip?.pickup ||
        trip?.pickupLocation ||
        delivery.pickup ||
        delivery.pickupAddress ||
        delivery.source ||
        '',

      dropoff:
        trip?.destination ||
        trip?.dropoff ||
        trip?.dropLocation ||
        delivery.dropoff ||
        delivery.destination ||
        delivery.drop ||
        delivery.dropAddress ||
        '',

      distance: distanceRaw || 'Distance not available',

      amount: totalAmount,
      baseCost,
      tax: taxAmount,
      taxAmount,
      total: totalAmount,
      totalAmount,

      status: 'Unpaid',
      paymentStatus: 'Pending',

      createdAt: new Date().toISOString(),
    };

    this.store.invoices.push(invoice as Invoice);
    this.store.persistInvoices();

    // 8. Optional notification for business client.
    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Invoice generated',
      message: `Invoice ${invoice.id} has been generated for delivery ${cleanDeliveryId}.`,
      time: 'Just now',
      to: 'business-client',
      read: false,
      createdAt: new Date().toISOString(),
    } as any);

    this.store.persistNotifications();

    return invoice as Invoice;
  }

  updateTransactionStatus(transactionId: string, status: string): Transaction {
    if (!transactionId) {
      throw new BadRequestException('Transaction ID is required');
    }

    if (!status) {
      throw new BadRequestException('Status is required');
    }

    const cleanTransactionId = String(transactionId).replace(/^#/, '').trim();
    const cleanStatus = String(status).trim();

    const allowedStatuses = [
      'Pending',
      'Under Review',
      'Completed',
      'Approved',
      'Paid',
      'Rejected',
      'Failed',
    ];

    if (!allowedStatuses.includes(cleanStatus)) {
      throw new BadRequestException(
        `Invalid status. Allowed statuses: ${allowedStatuses.join(', ')}`,
      );
    }

    const transaction: any = this.store.transactions.find(
      (txn: any) =>
        String(txn.id || '').replace(/^#/, '').trim() === cleanTransactionId ||
        String(txn.transactionId || '').replace(/^#/, '').trim() === cleanTransactionId ||
        String(txn.reference || '').replace(/^#/, '').trim() === cleanTransactionId,
    );

    if (!transaction) {
      throw new NotFoundException(`Transaction ${cleanTransactionId} not found`);
    }

    transaction.status = cleanStatus;
    transaction.updatedAt = new Date().toISOString();

    const invoiceId =
      transaction.invoiceId ||
      transaction.invoice ||
      transaction.invoiceNo ||
      transaction.invoiceNumber;

    if (invoiceId) {
      const cleanInvoiceId = String(invoiceId).replace(/^#/, '').trim();

      const invoice: any = this.store.invoices.find(
        (inv: any) =>
          String(inv.id || '').replace(/^#/, '').trim() === cleanInvoiceId ||
          String(inv.invoiceId || '').replace(/^#/, '').trim() === cleanInvoiceId ||
          String(inv.invoiceNo || '').replace(/^#/, '').trim() === cleanInvoiceId ||
          String(inv.invoiceNumber || '').replace(/^#/, '').trim() === cleanInvoiceId,
      );

      if (invoice) {
        if (
          cleanStatus === 'Completed' ||
          cleanStatus === 'Approved' ||
          cleanStatus === 'Paid'
        ) {
          invoice.status = 'Paid';
          invoice.paymentStatus = 'Paid';
          invoice.paidAt = new Date().toISOString();
        } else if (cleanStatus === 'Rejected' || cleanStatus === 'Failed') {
          invoice.status = 'Rejected';
          invoice.paymentStatus = 'Rejected';
        } else {
          invoice.status = 'Under Review';
          invoice.paymentStatus = 'Under Review';
        }

        invoice.updatedAt = new Date().toISOString();
        this.store.persistInvoices();
      }
    }

    this.store.persistTransactions();

    return transaction as Transaction;
  }
}