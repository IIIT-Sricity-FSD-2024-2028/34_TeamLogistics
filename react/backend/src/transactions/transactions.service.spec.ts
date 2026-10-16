import { TransactionsService } from './transactions.service';

describe('TransactionsService role scoping', () => {
  const store: any = {
    users: [],
    drivers: [
      { id: 'DR-1', name: 'Owned Driver', fleetManagerId: 'FM-1' },
      { id: 'DR-2', name: 'Other Driver', fleetManagerId: 'FM-2' },
    ],
    trips: [
      { id: 'TRIP-1', request: 'DEL-1', driver: 'Owned Driver' },
      { id: 'TRIP-2', request: 'DEL-2', driver: 'Other Driver' },
    ],
    invoices: [
      { id: 'INV-1', deliveryId: 'DEL-1', client: 'Client One', amount: 100 },
      { id: 'INV-2', deliveryId: 'DEL-2', client: 'Client Two', amount: 200 },
    ],
    transactions: [
      { id: 'TXN-1', invoiceId: 'INV-1', deliveryId: 'DEL-1', amount: 100 },
      { id: 'TXN-2', invoiceId: 'INV-2', deliveryId: 'DEL-2', amount: 200 },
      { id: 'TXN-LEGACY', client: 'Unknown Client', amount: 300 },
    ],
    persistInvoices: jest.fn(),
  };

  const service = new TransactionsService(store, {} as any, {} as any);
  const fleetManager = { userId: 'FM-1', role: 'fleet-manager' };

  it('returns only invoices belonging to drivers in the requesting fleet', () => {
    expect(service.findAllInvoices(undefined, fleetManager).map((item) => item.id)).toEqual(['INV-1']);
  });

  it('returns only attributable payments for the requesting fleet', () => {
    expect(service.findAllTransactions(undefined, fleetManager).map((item) => item.id)).toEqual(['TXN-1']);
  });

  it('does not limit superuser financial records', () => {
    expect(service.findAllInvoices(undefined, { userId: 'SU-1', role: 'superuser' })).toHaveLength(2);
    expect(service.findAllTransactions(undefined, { userId: 'SU-1', role: 'superuser' })).toHaveLength(3);
  });

  it('removes fully and partially refunded records from fleet-manager results', () => {
    const refundStore: any = {
      users: [],
      drivers: [{ id: 'DR-1', name: 'Owned Driver', fleetManagerId: 'FM-1' }],
      trips: [{ id: 'TRIP-1', request: 'DEL-1', driver: 'Owned Driver' }],
      invoices: [
        { id: 'INV-OPEN', deliveryId: 'DEL-1', status: 'Unpaid' },
        { id: 'INV-REFUND', deliveryId: 'DEL-1', status: 'Refunded' },
        { id: 'INV-PARTIAL', deliveryId: 'DEL-1', paymentStatus: 'Partially Refunded' },
      ],
      transactions: [
        { id: 'TXN-PAID', deliveryId: 'DEL-1', status: 'Paid' },
        { id: 'TXN-REFUNDED', deliveryId: 'DEL-1', status: 'Paid', refundedAmount: 100 },
      ],
    };
    const refundService = new TransactionsService(refundStore, {} as any, {} as any);

    expect(refundService.findAllInvoices(undefined, fleetManager).map((item) => item.id)).toEqual(['INV-OPEN']);
    expect(refundService.findAllTransactions(undefined, fleetManager).map((item) => item.id)).toEqual(['TXN-PAID']);
  });

  it('rejects invoice due dates that are not in the future', () => {
    const today = new Date();
    const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    expect(() => service.createInvoice({ client: 'Client One', amount: 100, dueDate: todayValue })).toThrow(
      'Invoice due date must be a future date',
    );
  });

  function paymentReviewSetup() {
    const reviewStore: any = {
      users: [{ id: 'BC-1', role: 'business-client' }],
      drivers: [],
      trips: [],
      invoices: [
        { id: 'INV-10', deliveryId: 'DEL-10', client: 'Client One', amount: 500, status: 'Under Review' },
      ],
      transactions: [
        {
          id: 'TXN-10',
          type: 'Payment',
          invoiceId: 'INV-10',
          deliveryId: 'DEL-10',
          userId: 'BC-1',
          amount: 500,
          reference: 'BANK-10',
          status: 'Pending',
        },
      ],
      notifications: [],
      persistInvoices: jest.fn(),
      persistTransactions: jest.fn(),
      persistNotifications: jest.fn(),
    };
    const settings: any = { getCommissionRate: jest.fn(() => 10) };
    const payouts: any = { approveForDelivery: jest.fn() };
    return {
      service: new TransactionsService(reviewStore, settings, payouts),
      store: reviewStore,
      payouts,
    };
  }

  it('approves a submitted invoice payment and marks its invoice paid', () => {
    const { service, store: reviewStore, payouts } = paymentReviewSetup();

    const result = service.updateTransactionStatus('TXN-10', 'Approved');

    expect(result.status).toBe('Approved');
    expect(reviewStore.invoices[0]).toEqual(expect.objectContaining({ status: 'Paid', paymentStatus: 'Paid' }));
    expect(payouts.approveForDelivery).toHaveBeenCalledWith('DEL-10');
    expect(reviewStore.notifications).toContainEqual(expect.objectContaining({
      to: 'business-client',
      toUserId: 'BC-1',
      title: 'Payment approved',
    }));
  });

  it('rejects a submitted invoice payment and marks its invoice rejected', () => {
    const { service, store: reviewStore, payouts } = paymentReviewSetup();

    const result = service.updateTransactionStatus('TXN-10', 'Rejected');

    expect(result.status).toBe('Rejected');
    expect(reviewStore.invoices[0]).toEqual(expect.objectContaining({ status: 'Rejected', paymentStatus: 'Rejected' }));
    expect(payouts.approveForDelivery).not.toHaveBeenCalled();
  });

  it('does not allow a non-invoice transaction through the payment review endpoint', () => {
    const { service, store: reviewStore } = paymentReviewSetup();
    reviewStore.transactions[0] = { id: 'TXN-10', type: 'Subscription', status: 'Pending' };

    expect(() => service.updateTransactionStatus('TXN-10', 'Approved')).toThrow(
      'Only submitted invoice payments can be approved or rejected',
    );
  });

  it('uses the delivery creation price unchanged when generating its invoice', () => {
    const pricing = {
      currency: 'INR',
      formulaVersion: 'dimensions-weight-v1',
      baseFare: 80,
      perKg: 8,
      actualWeightKg: 5,
      volumetricWeightKg: 40,
      chargeableWeightKg: 40,
      weightCharge: 320,
      serviceMultiplier: 1,
      total: 400,
      rateCardOwnerId: 'PLATFORM',
    };
    const invoiceStore: any = {
      users: [],
      drivers: [],
      trips: [{ id: 'TRP-1', request: 'DEL-1', status: 'Completed', amount: 400, pricing }],
      deliveryRequests: [{
        id: 'DEL-1', customer: 'Client One', status: 'Delivered', amount: 400, pricing,
        pickup: 'Chennai', dropoff: 'Bengaluru', requestTime: new Date().toISOString(),
      }],
      invoices: [],
      notifications: [],
      persistInvoices: jest.fn(),
      persistNotifications: jest.fn(),
    };
    const payouts: any = {
      findFleetManagerIdForDriverName: jest.fn(() => undefined),
      getEffectiveCustomerRateCard: jest.fn(() => ({ ownerId: 'PLATFORM', baseFare: 80, perKm: 13, perKg: 8 })),
    };
    const invoiceService = new TransactionsService(invoiceStore, {} as any, payouts);

    const invoice: any = invoiceService.generateInvoiceForDelivery('DEL-1');

    expect(invoice.totalAmount).toBe(400);
    expect(invoice.pricing).toEqual(pricing);
  });
});
