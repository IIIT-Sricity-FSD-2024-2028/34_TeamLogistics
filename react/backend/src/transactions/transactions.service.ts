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

  private ownerNames(userId?: string): string[] {
    const user: any = userId ? this.store.users.find((item) => item.id === userId) : null;
    return [user?.name, user?.username, user?.companyName, user?.company, user?.profileDetails?.companyName]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase().trim());
  }

  private belongsToBusinessClient(record: any, requester?: { userId: string; role: string }): boolean {
    if (!requester || requester.role !== 'business-client') return true;
    if (record.userId) return record.userId === requester.userId;
    const client = String(record.client || record.customer || '').toLowerCase().trim();
    return this.ownerNames(requester.userId).some(
      (name) => client === name || client.includes(name) || name.includes(client),
    );
  }

  private fleetManagerDriverNames(userId: string): string[] {
    return this.store.drivers
      .filter((driver) => driver.fleetManagerId === userId)
      .map((driver) => String(driver.name || '').toLowerCase().trim())
      .filter(Boolean);
  }

  private deliveryBelongsToFleetManager(deliveryId: string | undefined, userId: string): boolean {
    if (!deliveryId) return false;
    const trip: any = this.store.trips.find(
      (item: any) => String(item.request || item.deliveryId || '') === String(deliveryId),
    );
    if (!trip) return false;
    return this.fleetManagerDriverNames(userId).includes(String(trip.driver || '').toLowerCase().trim());
  }

  private invoiceBelongsToFleetManager(invoice: any, userId: string): boolean {
    if (invoice.fleetManagerId) return invoice.fleetManagerId === userId;
    const driverName = String(invoice.driver || '').toLowerCase().trim();
    if (driverName && this.fleetManagerDriverNames(userId).includes(driverName)) return true;
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

    if (requester?.role === 'business-client') {
      const invoice: any = this.store.invoices.find((item: any) => item.id === dto.invoiceId || item.invoiceId === dto.invoiceId);
      if (!invoice || !this.belongsToBusinessClient(invoice, requester)) {
        throw new ForbiddenException('You can only submit payment proof for your own invoice');
      }
      if (!String(dto.reference || '').trim()) {
        throw new BadRequestException('A real bank, UPI, cheque, or card reference is required');
      }
      if (String(invoice.status || '').toLowerCase() === 'paid') {
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

    const txn: Transaction = {
      id: `TXN-${Date.now()}`,
      type: dto.type || 'Payment',
      client,
      amount,
      status,
      date: (dto as any).date || now.toISOString().split('T')[0],
      createdAt: (dto as any).createdAt || now.toISOString(),

      invoiceId: (dto as any).invoiceId || '',
      deliveryId: (dto as any).deliveryId || '',
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

  createInvoice(dto: CreateInvoiceDto): Invoice {
    const now = new Date();

    if (dto.dueDate) {
      assertFutureDateOnly(dto.dueDate, 'Invoice due date');
    }

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

    const fleetManagerId = this.payoutsService.findFleetManagerIdForDriverName(trip?.driver || delivery.driver || '');
    const rateCard = this.payoutsService.getEffectiveCustomerRateCard(fleetManagerId);
    const storedPricing = delivery.pricing || trip?.pricing;
    const storedTotal = Number(storedPricing?.total ?? delivery.amount ?? trip?.amount);
    const distanceNumber = Number(String(distanceRaw).replace(/[^\d.]/g, ''));
    const weightNumber = Number(String(delivery.weight || delivery.estimatedWeight || '').replace(/[^\d.]/g, ''));
    const legacyTotal =
      Number(rateCard?.baseFare || 0) +
      (Number.isFinite(distanceNumber) ? distanceNumber : 0) * Number(rateCard?.perKm || 0) +
      (Number.isFinite(weightNumber) ? weightNumber : 0) * Number(rateCard?.perKg || 0);
    const baseCost = Number((Number.isFinite(storedTotal) ? storedTotal : legacyTotal).toFixed(2));
    const taxAmount = 0;
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
        perKm: 0,
        perKg: storedPricing?.perKg ?? rateCard.perKg,
      },
      pricing: storedPricing,

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
            const platformCommission = Number((grossAmount * (commissionRatePercent / 100)).toFixed(2));
            const fleetManagerAmount = Number((grossAmount - platformCommission).toFixed(2));

            transaction.transactionType = 'delivery-payment';
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

  getRevenueSummary() {
    const isSuccess = (t: Transaction) =>
      SUCCESS_STATUSES.includes(String(t.status || '').toLowerCase());

    const successfulPayments = this.store.transactions
      .filter(isSuccess)
      .filter((t) => t.transactionType === 'delivery-payment');
    const grossBookingValue = successfulPayments
      .reduce((sum, t) => sum + Number(t.grossAmount || 0), 0);
    const deliveryCommission = successfulPayments
      .reduce((sum, t) => sum + Number(t.platformCommission || 0), 0);

    const totalRevenue = deliveryCommission;

    return {
      deliveryCommission: Number(deliveryCommission.toFixed(2)),
      totalRevenue: Number(totalRevenue.toFixed(2)),
      grossBookingValue: Number(grossBookingValue.toFixed(2)),
      postPaidCollections: Number(grossBookingValue.toFixed(2)),
      netProcessedValue: Number(grossBookingValue.toFixed(2)),
    };
  }
}
