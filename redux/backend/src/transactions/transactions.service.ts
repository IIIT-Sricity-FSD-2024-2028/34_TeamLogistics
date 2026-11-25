import { paise, rupees } from '../common/money';
import { ownsFleetAssignment } from '../common/fleet-ownership';
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
} from './dto/transaction.dto';
import { SettingsService } from '../settings/settings.service';
import { PayoutsService } from '../payouts/payouts.service';
import { assertFutureDateOnly } from '../common/date-validation';
import { createHash, randomUUID } from 'crypto';

const SUCCESS_STATUSES = ['completed', 'approved', 'paid'];

@Injectable()
export class TransactionsService {
  constructor(
    private readonly store: DataStoreService,
    private readonly settingsService: SettingsService,
    private readonly payoutsService: PayoutsService,
  ) {}

  private isRefundedRecord(record: any): boolean {
    const labels = [record.status, record.paymentStatus, record.transactionType, record.type]
      .map((value) => String(value || '').trim().toLowerCase());
    return labels.some((value) => value.includes('refund')) ||
      record.refunded === true ||
      Boolean(record.refundedAt) ||
      Number(record.refundedAmount || 0) > 0 ||
      Number(record.refundAmount || 0) > 0;
  }

  private belongsToBusinessClient(record: any, requester?: { userId: string; role: string }): boolean {
    if (!requester || requester.role !== 'business-client') return true;
    if (record.userId) return record.userId === requester.userId;
    const linked = this.store.deliveryRequests?.find((item) => item.id === record.deliveryId);
    if (linked?.clientUserId) return linked.clientUserId === requester.userId;
    return false;
  }

  private deliveryBelongsToFleetManager(deliveryId: string | undefined, userId: string): boolean {
    if (!deliveryId) return false;
    const trip: any = this.store.trips.find(
      (item: any) => String(item.request || item.deliveryId || '') === String(deliveryId),
    );
    if (!trip) return false;
    return ownsFleetAssignment(trip, userId);
  }

  private invoiceBelongsToFleetManager(invoice: any, userId: string): boolean {
    if (invoice.fleetManagerId) return invoice.fleetManagerId === userId;
    return this.deliveryBelongsToFleetManager(
      invoice.deliveryId || invoice.delivery || invoice.deliveryRequestId,
      userId,
    );
  }

  private belongsToFleetManager(record: any, requester?: { userId: string; role: string }): boolean {
    if (!requester || requester.role !== 'fleet-manager') return true;
    if (record.fleetManagerId) return record.fleetManagerId === requester.userId;

    if (
      this.deliveryBelongsToFleetManager(
        record.deliveryId || record.delivery || record.deliveryRequestId,
        requester.userId,
      )
    ) {
      return true;
    }

    const invoiceId = record.invoiceId || record.invoice;
    if (!invoiceId) return this.invoiceBelongsToFleetManager(record, requester.userId);
    const invoice: any = this.store.invoices.find(
      (item: any) => String(item.id || item.invoiceId || '') === String(invoiceId),
    );
    return Boolean(invoice && this.invoiceBelongsToFleetManager(invoice, requester.userId));
  }

  findAllTransactions(search?: string, requester?: { userId: string; role: string }): Transaction[] {
    let items = [...this.store.transactions];

    items = items.filter((item) => this.belongsToBusinessClient(item, requester));
    items = items.filter((item) => this.belongsToFleetManager(item, requester));
    if (requester?.role === 'fleet-manager') {
      items = items.filter((item) => !this.isRefundedRecord(item));
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((t) => JSON.stringify(t).toLowerCase().includes(q));
    }

    return items;
  }

  findAllInvoices(search?: string, requester?: { userId: string; role: string }): Invoice[] {
    let items = [...this.store.invoices];

    items = items.filter((item) => this.belongsToBusinessClient(item, requester));
    items = items.filter((item) => this.belongsToFleetManager(item, requester));
    if (requester?.role === 'fleet-manager') {
      items = items.filter((item) => !this.isRefundedRecord(item));
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((i) => JSON.stringify(i).toLowerCase().includes(q));
    }

    return items;
  }

  findAll(search?: string, requester?: { userId: string; role: string }): { transactions: Transaction[]; invoices: Invoice[] } {
    return {
      transactions: this.findAllTransactions(search, requester),
      invoices: this.findAllInvoices(search, requester),
    };
  }

  createTransaction(dto: CreateTransactionDto, requester?: { userId: string; role: string }): Transaction {
    const now = new Date();
    let client = dto.client;
    let amount = Number(dto.amount || 0);
    let status = dto.status || 'Pending';
    let deliveryId = dto.deliveryId;

    if (requester?.role === 'business-client') {
      const invoice: any = this.store.invoices.find((item: any) => item.id === dto.invoiceId || item.invoiceId === dto.invoiceId);
      if (!invoice || !this.belongsToBusinessClient(invoice, requester)) {
        throw new ForbiddenException('You can only submit payment proof for your own invoice');
      }
      if (!dto.reference?.trim()) throw new BadRequestException('Enter a payment reference');
      deliveryId = invoice.deliveryId;
      if (dto.deliveryId && dto.deliveryId !== invoice.deliveryId) throw new BadRequestException('Invoice and delivery do not match');
      const previous = this.store.transactions.find((txn) => txn.userId === requester.userId &&
        txn.invoiceId === dto.invoiceId && txn.reference?.trim().toUpperCase() === dto.reference?.trim().toUpperCase());
      if (previous && previous.amount === amount && previous.receiptUrl === (dto.receiptUrl || '') &&
          previous.paymentMode === (dto.paymentMode || 'Bank Transfer')) return previous;
      if (!dto.receiptUrl) throw new BadRequestException('Attach a payment receipt');
      if (['paid', 'refunded', 'reversed'].includes(String(invoice.status || '').toLowerCase())) {
        throw new BadRequestException('This invoice is not awaiting payment');
      }
      const linkedTrip: any = this.store.trips.find((trip: any) => String(trip.request || '') === String(invoice.deliveryId || ''));
      const expectedAmount = Number(
        linkedTrip?.disputeResolution?.resolvedAmount ?? invoice.total ?? invoice.totalAmount ?? invoice.amount ?? 0,
      );
      if (amount !== expectedAmount) {
        throw new BadRequestException(`Submitted amount must match the payable invoice amount (${expectedAmount})`);
      }
      const pendingExists = this.store.transactions.some(
        (item: any) =>
          item.invoiceId === dto.invoiceId &&
          item.userId === requester.userId &&
          ['pending', 'under review'].includes(String(item.status || '').toLowerCase()),
      );
      if (pendingExists) {
        throw new BadRequestException('A payment submission for this invoice is already under review');
      }
      client = invoice.client;
      amount = expectedAmount;
      status = 'Pending';
    }

    const reference = dto.reference?.trim();
    if (reference && this.store.transactions.some((txn) => txn.reference?.trim().toUpperCase() === reference.toUpperCase())) {
      throw new BadRequestException('This payment reference has already been submitted');
    }
    const txn: Transaction = {
      id: `TXN-${randomUUID()}`,
      type: requester?.role === 'business-client' ? 'Payment' : dto.type || 'Payment',
      client,
      amount,
      status,
      date: (dto as any).date || now.toISOString().split('T')[0],
      createdAt: now.toISOString(),

      invoiceId: (dto as any).invoiceId || '',
      deliveryId: deliveryId || '',
      paymentMode: (dto as any).paymentMode || 'Bank Transfer',
      reference: (dto as any).reference || '',
      receiptName: (dto as any).receiptName || 'No receipt uploaded',
      receiptUrl: (dto as any).receiptUrl || '',
      userId: requester?.role === 'business-client' ? requester.userId : undefined,
    } as Transaction;

    this.store.transactions.push(txn);
    this.store.persistTransactions();

    if (requester?.role === 'business-client') {
      this.store.notifications.unshift({
        id: `N-${Date.now()}`,
        title: 'Payment proof submitted',
        message: `Payment reference ${txn.reference} for invoice ${txn.invoiceId} is awaiting review.`,
        time: 'Just now',
        to: 'superuser',
        read: false,
        createdAt: now.toISOString(),
      } as any);
      this.store.persistNotifications();
    }

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

  create(dto: CreateTransactionDto, requester?: { userId: string; role: string }): Transaction {
    return this.createTransaction(dto, requester);
  }

  createInvoice(dto: CreateInvoiceDto, key?: string, actorId?: string): Invoice {
    const now = new Date();

    if (dto.dueDate) {
      assertFutureDateOnly(dto.dueDate, 'Invoice due date');
    }

    const linkedOwner = this.store.deliveryRequests?.find((d) => d.id === dto.deliveryId)?.clientUserId;
    const owner = this.store.users.find((u) => u.id === (linkedOwner || dto.clientUserId) && u.role === 'business-client');
    if (!owner) throw new BadRequestException('Select a business client account for the invoice');
    if (key !== undefined && !/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw new BadRequestException('Invalid invoice request key');
    const invoiceId = 'INV-' + (key && actorId ? createHash('sha256').update(actorId+'|'+key).digest('hex') : randomUUID());
    const fingerprint = key && createHash('sha256').update(JSON.stringify(Object.entries(dto).sort(([a],[b]) => a.localeCompare(b)))).digest('hex');
    const prior: any = key && this.store.invoices.find(i => i.id === invoiceId);
    if (prior) {
      if (prior.requestFingerprint !== fingerprint) throw new BadRequestException('This request key already identifies another invoice');
      return prior;
    }
    if (dto.deliveryId && this.store.invoices.some((i:any) => i.deliveryId === dto.deliveryId)) throw new BadRequestException('This delivery already has an invoice');
    const inv: any = {
      id: invoiceId, requestFingerprint:fingerprint,
      userId: owner.id,
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

  assertFleetDelivery(id: string, actor: { role: string; userId: string }) {
    if (actor.role === 'fleet-manager' && !this.deliveryBelongsToFleetManager(id, actor.userId)) {
      throw new NotFoundException('Delivery not found');
    }
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

    const fleetManagerId = trip?.fleetManagerId || delivery.fleetManagerId;
    const rateCard = this.payoutsService.getEffectiveCustomerRateCard(fleetManagerId);
    const storedPricing = delivery.pricing || trip?.pricing;
    const storedTotal = Number(trip?.disputeResolution?.resolvedAmount ?? storedPricing?.total ?? delivery.amount ?? trip?.amount);
    const distanceNumber = Number(String(distanceRaw).replace(/[^\d.]/g, ''));
    const weightNumber = Number(String(delivery.weight || delivery.estimatedWeight || '').replace(/[^\d.]/g, ''));
    const legacyTotal = rupees(paise(rateCard.baseFare) + paise(rateCard.perKm, distanceNumber || 0) + paise(rateCard.perKg, weightNumber || 0));
    const baseCost = Number((Number.isFinite(storedTotal) ? storedTotal : legacyTotal).toFixed(2));
    const taxAmount = 0;
    const totalAmount = baseCost + taxAmount;

    const invoice: any = {
      id: `INV-${cleanDeliveryId}`,
      invoiceId: `INV-${cleanDeliveryId}`,

      deliveryId: cleanDeliveryId,
      fleetManagerId,
      userId: delivery.clientUserId,

      client:
        delivery.customer ||
        delivery.client ||
        delivery.company ||
        'Business Client',

      address:
        delivery.address ||
        delivery.clientAddress ||
        delivery.billingAddress ||
        '',

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
      rateCardSnapshot: {
        type: storedPricing?.formulaVersion || 'customer-pricing',
        ownerId: storedPricing?.rateCardOwnerId || rateCard.ownerId,
        baseFare: storedPricing?.baseFare ?? rateCard.baseFare,
        perKm: storedPricing?.perKm ?? (storedPricing ? 0 : rateCard.perKm),
        perKg: storedPricing?.perKg ?? rateCard.perKg,
      },
      pricing: storedPricing,

      status: totalAmount === 0 ? 'Paid' : 'Unpaid',
      paymentStatus: totalAmount === 0 ? 'Paid' : 'Pending',

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

    const allowedStatuses = ['Approved', 'Rejected'];

    if (!allowedStatuses.includes(cleanStatus)) {
      throw new BadRequestException(
        'A submitted invoice payment can only be approved or rejected',
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

    const invoiceId =
      transaction.invoiceId ||
      transaction.invoice ||
      transaction.invoiceNo ||
      transaction.invoiceNumber;

    if (!invoiceId || String(transaction.type || 'Payment').toLowerCase() !== 'payment') {
      throw new BadRequestException('Only submitted invoice payments can be approved or rejected');
    }

    const currentStatus = String(transaction.status || 'Pending').toLowerCase();
    const nextStatus = cleanStatus.toLowerCase();
    if (currentStatus === nextStatus) return transaction as Transaction;
    if (SUCCESS_STATUSES.includes(currentStatus) || ['rejected', 'failed'].includes(currentStatus)) {
      throw new BadRequestException(
        `Payment status ${transaction.status} is final and cannot be changed.`,
      );
    }
    const permitted = ['pending', 'under review'].includes(currentStatus) &&
      ['approved', 'rejected'].includes(nextStatus);
    if (!permitted) {
      throw new BadRequestException(`Invalid payment transition from ${transaction.status} to ${cleanStatus}`);
    }

    transaction.status = cleanStatus;
    transaction.updatedAt = new Date().toISOString();
    if (SUCCESS_STATUSES.includes(nextStatus)) transaction.approvedAt = transaction.updatedAt;

    if (invoiceId) {
      const cleanInvoiceId = String(invoiceId).replace(/^#/, '').trim();

      const invoice: any = this.store.invoices.find(
        (inv: any) =>
          String(inv.id || '').replace(/^#/, '').trim() === cleanInvoiceId ||
          String(inv.invoiceId || '').replace(/^#/, '').trim() === cleanInvoiceId ||
          String(inv.invoiceNo || '').replace(/^#/, '').trim() === cleanInvoiceId ||
          String(inv.invoiceNumber || '').replace(/^#/, '').trim() === cleanInvoiceId,
      );

      if (!invoice) throw new BadRequestException('Payment has no linked invoice');
      if (['paid','refunded','reversed'].includes(String(invoice.status || '').toLowerCase()))
        throw new BadRequestException('Invoice is already settled');
      const owner = invoice.fleetManagerId || this.store.driverPayouts?.find(p => p.deliveryId === transaction.deliveryId)?.fleetManagerId;
      if (nextStatus === 'approved' && this.store.settlements?.some(s => s.fleetManagerId === owner && s.status === 'locked' && s.month === transaction.updatedAt.slice(0,7)))
        throw new BadRequestException('Current settlement period is locked');
      transaction.fleetManagerId = owner;
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
            const grossAmount = Number(transaction.amount ?? invoice.total ?? invoice.totalAmount ?? invoice.amount ?? 0);
            const commissionRatePercent = this.settingsService.getCommissionRate();
            const platformCommission = rupees(paise(grossAmount, commissionRatePercent, 100));
            const fleetManagerAmount = rupees(paise(grossAmount) - paise(platformCommission));

            transaction.transactionType = 'delivery-payment';
            Object.assign(transaction, {grossPaise: paise(grossAmount), commissionPaise: paise(platformCommission), fleetPaise: paise(fleetManagerAmount)});
            transaction.grossAmount = grossAmount;
            transaction.platformCommission = platformCommission;
            transaction.fleetManagerAmount = fleetManagerAmount;
            transaction.commissionRatePercent = commissionRatePercent;
          }

          this.payoutsService.approveForDelivery(transaction.deliveryId);
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

    if ((transaction as any).userId) {
      this.store.notifications.unshift({
        id: `N-${Date.now()}`,
        title: `Payment ${cleanStatus.toLowerCase()}`,
        message: `Payment reference ${(transaction as any).reference || transaction.id} is now ${cleanStatus}.`,
        time: 'Just now',
        to: 'business-client',
        toUserId: (transaction as any).userId,
        read: false,
        createdAt: new Date().toISOString(),
      } as any);
      this.store.persistNotifications();
    }

    return transaction as Transaction;
  }

  recordReversal(id: string, kind: string, reason: string, actor: string) {
    if (!['refund', 'chargeback'].includes(kind) || typeof reason !== 'string' || !reason.trim() || reason.length > 500) {
      throw new BadRequestException('Select a reversal type and enter a reason of up to 500 characters');
    }
    const original = this.store.transactions.find((t) => t.id === id);
    if (!original || original.transactionType !== 'delivery-payment' || !SUCCESS_STATUSES.includes(original.status.toLowerCase())) {
      throw new BadRequestException('Only an approved payment can be reversed');
    }
    const previous = this.store.transactions.find((t) => t.relatedTransactionId === id && t.transactionType === 'payment-reversal');
    if (previous) {
      if (previous.type === kind && previous.refundReason === reason.trim()) return previous;
      throw new BadRequestException('Payment already reversed');
    }
    const invoice: any = this.store.invoices.find((i) => i.id === original.invoiceId);
    if (!invoice || this.isRefundedRecord(invoice)) throw new BadRequestException('Invoice unavailable for reversal');
    const now = new Date().toISOString();
    const managerId = this.store.driverPayouts.find((p) => p.deliveryId === original.deliveryId)?.fleetManagerId || invoice.fleetManagerId;
    if (this.store.settlements.some((s) => s.fleetManagerId === managerId && s.month === now.slice(0, 7) && s.status === 'locked')) {
      throw new BadRequestException('Current settlement period is locked');
    }
    const gross = paise(original.grossAmount ?? original.amount);
    const commission = paise(original.platformCommission ?? 0);
    const reversal = {id: 'REV-' + randomUUID(), relatedTransactionId: id, type: kind, transactionType: 'payment-reversal',
      status: 'Approved', date: now.slice(0,10), createdAt: now, approvedAt: now, recordedBy: actor, refundReason: reason.trim(),
      invoiceId: invoice.id, deliveryId: original.deliveryId, userId: original.userId, client: original.client, fleetManagerId: managerId,
      amount: rupees(-gross), grossAmount: rupees(-gross), fleetManagerAmount: rupees(commission-gross), platformCommission: rupees(-commission),
      grossPaise: -gross, commissionPaise: -commission, fleetPaise: commission-gross};
    this.store.transactions.push(reversal);
    invoice.status = kind === 'refund' ? 'Refunded' : 'Reversed';
    invoice.paymentStatus = invoice.status;
    invoice.updatedAt = now;
    this.store.persistInvoices();
    this.store.persistTransactions();
    return reversal;
  }

  getRevenueSummary() {
    const isSuccess = (t: Transaction) =>
      SUCCESS_STATUSES.includes(String(t.status || '').toLowerCase());

    const successfulPayments = this.store.transactions
      .filter(isSuccess)
      .filter((t) => ['delivery-payment', 'payment-reversal'].includes(t.transactionType || ''));
    const netProcessed = successfulPayments
      .reduce((sum, t) => sum + paise(t.grossAmount || 0), 0);
    const grossBookingValue = successfulPayments.filter(t => t.transactionType === 'delivery-payment')
      .reduce((sum, t) => sum + paise(t.grossAmount ?? t.amount), 0);
    const deliveryCommission = successfulPayments
      .reduce((sum, t) => sum + paise(t.platformCommission || 0), 0);

    const totalRevenue = deliveryCommission;

    return {
      deliveryCommission: rupees(deliveryCommission),
      totalRevenue: rupees(totalRevenue),
      grossBookingValue: rupees(grossBookingValue),
      postPaidCollections: rupees(grossBookingValue),
      netProcessedValue: rupees(netProcessed),
    };
  }
}
