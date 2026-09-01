import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  DataStoreService,
  Transaction,
  Invoice,
} from '../data-store/data-store.service';
import {
  CreateTransactionDto,
  CreateInvoiceDto,
  PayDeliveryDto,
} from './dto/transaction.dto';
import { SettingsService } from '../settings/settings.service';
import { PayoutsService } from '../payouts/payouts.service';

const SUCCESS_STATUSES = ['completed', 'approved', 'paid'];

@Injectable()
export class TransactionsService {
  constructor(
    private readonly store: DataStoreService,
    private readonly settingsService: SettingsService,
    private readonly payoutsService: PayoutsService,
  ) {}

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
      client: dto.client,
      amount: Number(dto.amount || 0),
      status: dto.status || 'Pending',
      date: (dto as any).date || now.toISOString().split('T')[0],
      createdAt: (dto as any).createdAt || now.toISOString(),

      invoiceId: (dto as any).invoiceId || '',
      deliveryId: (dto as any).deliveryId || '',
      paymentMode: (dto as any).paymentMode || 'Bank Transfer',
      reference: (dto as any).reference || '',
      receiptName: (dto as any).receiptName || 'No receipt uploaded',
      receiptUrl: (dto as any).receiptUrl || '',
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

    const trip: any = this.store.trips.find(
      (t: any) =>
        String(t.request || '').replace(/^#/, '').trim() === cleanDeliveryId ||
        String(t.deliveryId || '').replace(/^#/, '').trim() === cleanDeliveryId ||
        String(t.delivery_id || '').replace(/^#/, '').trim() === cleanDeliveryId ||
        String(t.requestId || '').replace(/^#/, '').trim() === cleanDeliveryId ||
        String(t.deliveryRequestId || '').replace(/^#/, '').trim() === cleanDeliveryId ||
        String(t.delivery || '').replace(/^#/, '').trim() === cleanDeliveryId,
    );

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

    const owningClientUser: any = this.store.users.find((u: any) => {
      if (u.role !== 'business-client') return false;
      const names = [u.name, u.companyName, u.company, u.profileDetails?.companyName]
        .filter(Boolean)
        .map((v: string) => String(v).toLowerCase().trim());
      return names.includes(String((invoice as any).client || '').toLowerCase().trim());
    });

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Invoice generated',
      message: `Invoice ${invoice.id} has been generated for delivery ${cleanDeliveryId}.`,
      time: 'Just now',
      to: 'business-client',
      toUserId: owningClientUser?.id,
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

          if (!transaction.transactionType) {
            const grossAmount = Number(invoice.total ?? invoice.totalAmount ?? invoice.amount ?? transaction.amount ?? 0);
            const commissionRatePercent = this.settingsService.getCommissionRate();
            const platformCommission = Number((grossAmount * (commissionRatePercent / 100)).toFixed(2));
            const fleetManagerAmount = Number((grossAmount - platformCommission).toFixed(2));

            transaction.transactionType = 'delivery-payment';
            transaction.grossAmount = grossAmount;
            transaction.platformCommission = platformCommission;
            transaction.fleetManagerAmount = fleetManagerAmount;
            transaction.commissionRatePercent = commissionRatePercent;
          }
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

  payDelivery(dto: PayDeliveryDto, userId?: string): Transaction {
    const identifier = dto.invoiceId || dto.deliveryId;

    if (!identifier) {
      throw new BadRequestException('invoiceId or deliveryId is required');
    }

    const cleanIdentifier = String(identifier).replace(/^#/, '').trim();

    const invoice: any = this.store.invoices.find(
      (inv: any) =>
        String(inv.id || '').replace(/^#/, '').trim() === cleanIdentifier ||
        String(inv.invoiceId || '').replace(/^#/, '').trim() === cleanIdentifier ||
        String(inv.deliveryId || '').replace(/^#/, '').trim() === cleanIdentifier ||
        String(inv.request || '').replace(/^#/, '').trim() === cleanIdentifier,
    );

    if (!invoice) {
      throw new NotFoundException(`Invoice for "${identifier}" not found`);
    }

    if (userId) {
      const user: any = this.store.users.find((u: any) => u.id === userId);

      if (user) {
        const ownerNames = [
          user.name,
          user.username,
          user.companyName,
          user.company,
          user.profileDetails?.companyName,
          user.profileDetails?.fullName,
        ]
          .filter(Boolean)
          .map((v: string) => String(v).toLowerCase().trim());

        const invoiceClient = String(invoice.client || '').toLowerCase().trim();

        const isOwner = ownerNames.some(
          (name) => invoiceClient === name || invoiceClient.includes(name) || name.includes(invoiceClient),
        );

        if (!isOwner) {
          throw new ForbiddenException('You are not authorized to pay this invoice');
        }
      }
    }

    if (String(invoice.status || '').toLowerCase() === 'paid') {
      throw new BadRequestException('This invoice has already been paid');
    }

    const deliveryIdForLookup = invoice.deliveryId || dto.deliveryId || cleanIdentifier;

    const linkedTrip: any = this.store.trips.find(
      (t: any) => String(t.request || '') === String(deliveryIdForLookup || ''),
    );

    const disputeResolvedAmount = linkedTrip?.disputeResolution?.resolvedAmount;

    const grossAmount =
      disputeResolvedAmount !== undefined && disputeResolvedAmount !== null
        ? Number(disputeResolvedAmount)
        : Number(invoice.total ?? invoice.totalAmount ?? invoice.amount ?? 0);

    if (grossAmount < 0 || (grossAmount === 0 && disputeResolvedAmount === undefined)) {
      throw new BadRequestException('Invoice does not have a valid payable amount');
    }

    const now = new Date();
    const simulateFailure = dto.simulate === 'fail';

    if (simulateFailure) {
      const failedTxn: Transaction = {
        id: `TXN-${Date.now()}`,
        type: 'Payment',
        client: invoice.client,
        amount: grossAmount,
        status: 'Failed',
        date: now.toISOString().split('T')[0],
        createdAt: now.toISOString(),
        invoiceId: invoice.id,
        deliveryId: invoice.deliveryId || dto.deliveryId || '',
        paymentMode: dto.paymentMode || 'Demo Payment',
        reference: dto.reference || `PAY-${Date.now()}`,
        transactionType: 'delivery-payment',
        grossAmount,
        platformCommission: 0,
        fleetManagerAmount: 0,
        userId,
      };

      this.store.transactions.push(failedTxn);
      this.store.persistTransactions();

      return failedTxn;
    }

    const commissionRatePercent = this.settingsService.getCommissionRate();
    const platformCommission = Number((grossAmount * (commissionRatePercent / 100)).toFixed(2));
    const fleetManagerAmount = Number((grossAmount - platformCommission).toFixed(2));

    const transaction: Transaction = {
      id: `TXN-${Date.now()}`,
      type: 'Payment',
      client: invoice.client,
      amount: grossAmount,
      status: 'Completed',
      date: now.toISOString().split('T')[0],
      createdAt: now.toISOString(),
      invoiceId: invoice.id,
      deliveryId: invoice.deliveryId || dto.deliveryId || '',
      paymentMode: dto.paymentMode || 'Demo Payment',
      reference: dto.reference || `PAY-${Date.now()}`,
      transactionType: 'delivery-payment',
      grossAmount,
      platformCommission,
      fleetManagerAmount,
      commissionRatePercent,
      refundedAmount: 0,
      resolvedAmount: disputeResolvedAmount !== undefined ? Number(disputeResolvedAmount) : undefined,
      userId,
    };

    this.store.transactions.push(transaction);
    this.store.persistTransactions();

    invoice.status = 'Paid';
    invoice.paymentStatus = 'Paid';
    invoice.paidAt = now.toISOString();
    this.store.persistInvoices();

    this.store.notifications.unshift({
      id: `N-${Date.now()}`,
      title: 'Payment successful',
      message: `Payment of ₹${grossAmount.toLocaleString('en-IN')} received for invoice ${invoice.id}.`,
      time: 'Just now',
      to: 'business-client',
      toUserId: userId,
      read: false,
      createdAt: now.toISOString(),
    } as any);
    this.store.persistNotifications();

    return transaction;
  }

  refundDelivery(
    transactionId: string,
    amount: number | undefined,
    reason: string,
    requester?: { userId: string; role: string },
  ): Transaction {
    if (!transactionId) {
      throw new BadRequestException('Transaction ID is required');
    }

    const original: any = this.store.transactions.find((t: any) => t.id === transactionId);

    if (!original) {
      throw new NotFoundException(`Transaction "${transactionId}" not found`);
    }

    if (original.transactionType !== 'delivery-payment') {
      throw new BadRequestException('Only a delivery-payment transaction can be refunded');
    }

    if (!SUCCESS_STATUSES.includes(String(original.status || '').toLowerCase())) {
      throw new BadRequestException('Only a completed payment can be refunded');
    }

    const originalAmount = Number(original.amount || 0);
    const alreadyRefunded = Number(original.refundedAmount || 0);
    const remaining = Number((originalAmount - alreadyRefunded).toFixed(2));

    if (remaining <= 0) {
      throw new BadRequestException('This transaction has already been fully refunded');
    }

    const refundAmount = amount === undefined || amount === null ? remaining : Number(amount);

    if (typeof refundAmount !== 'number' || Number.isNaN(refundAmount) || refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be a number greater than zero');
    }

    if (refundAmount > remaining + 0.01) {
      throw new BadRequestException(
        `Refund amount (₹${refundAmount.toFixed(2)}) exceeds the remaining refundable amount (₹${remaining.toFixed(2)})`,
      );
    }

    const grossAmount = Number(original.grossAmount || originalAmount || 0);
    const commissionRatio =
      grossAmount > 0
        ? Number(original.platformCommission || 0) / grossAmount
        : this.settingsService.getCommissionRate() / 100;

    const commissionReversal = Number((refundAmount * commissionRatio).toFixed(2));
    const fleetReversal = Number((refundAmount - commissionReversal).toFixed(2));

    const now = new Date();

    const refundTxn: Transaction = {
      id: `TXN-${Date.now()}`,
      type: 'Refund',
      client: original.client,
      amount: -refundAmount,
      status: 'Completed',
      date: now.toISOString().split('T')[0],
      createdAt: now.toISOString(),
      invoiceId: original.invoiceId,
      deliveryId: original.deliveryId,
      paymentMode: original.paymentMode,
      reference: `REFUND-${original.id}-${Date.now()}`,
      transactionType: 'refund',
      refundAmount,
      grossAmount: -refundAmount,
      platformCommission: -commissionReversal,
      fleetManagerAmount: -fleetReversal,
      relatedTransactionId: original.id,
      userId: original.userId,
    };

    original.refundedAmount = Number((alreadyRefunded + refundAmount).toFixed(2));
    original.refunded = original.refundedAmount >= originalAmount - 0.01;
    original.refundReason = reason || original.refundReason || '';
    original.refundedAt = now.toISOString();

    this.store.transactions.push(refundTxn);
    this.store.persistTransactions();

    const invoiceId = original.invoiceId;

    if (invoiceId) {
      const invoice: any = this.store.invoices.find((inv: any) => inv.id === invoiceId);

      if (invoice) {
        invoice.status = original.refunded ? 'Refunded' : 'Partially Refunded';
        invoice.paymentStatus = invoice.status;
        invoice.refundedAt = now.toISOString();
        this.store.persistInvoices();
      }
    }

    const linkedTrip: any = original.deliveryId
      ? this.store.trips.find((t: any) => String(t.request || '') === String(original.deliveryId))
      : null;

    const driverRecord: any = linkedTrip
      ? this.store.drivers.find(
          (d: any) => String(d.name || '').toLowerCase().trim() === String(linkedTrip.driver || '').toLowerCase().trim(),
        )
      : null;

    const fleetManagerId = driverRecord?.fleetManagerId;

    if (fleetManagerId) {
      const originalMonth = String(original.createdAt || '').slice(0, 7);
      this.payoutsService.applyRefundAdjustment(fleetManagerId, originalMonth, fleetReversal, refundTxn.id, reason || '');
    }

    const remainingAfter = Number((originalAmount - original.refundedAmount).toFixed(2));

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: original.refunded ? 'Payment refunded' : 'Partial refund issued',
      message: original.refunded
        ? `Payment for invoice ${invoiceId || original.deliveryId} was fully refunded. Reason: ${reason || 'Not specified'}.`
        : `₹${refundAmount.toLocaleString('en-IN')} refunded for invoice ${invoiceId || original.deliveryId} (₹${remainingAfter.toLocaleString('en-IN')} remains paid). Reason: ${reason || 'Not specified'}.`,
      time: 'Just now',
      to: 'business-client',
      toUserId: original.userId,
      read: false,
      createdAt: now.toISOString(),
    } as any);
    this.store.persistNotifications();

    return refundTxn;
  }

  getRevenueSummary() {
    const isSuccess = (t: Transaction) =>
      SUCCESS_STATUSES.includes(String(t.status || '').toLowerCase());

    const deliveryCommission = this.store.transactions
      .filter(
        (t) =>
          (t.transactionType === 'delivery-payment' || t.transactionType === 'refund') &&
          isSuccess(t),
      )
      .reduce((sum, t) => sum + Number(t.platformCommission || 0), 0);

    const totalRevenue = deliveryCommission;

    return {
      deliveryCommission: Number(deliveryCommission.toFixed(2)),
      totalRevenue: Number(totalRevenue.toFixed(2)),
    };
  }
}