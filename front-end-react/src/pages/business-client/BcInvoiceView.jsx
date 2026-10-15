import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Transactions, Deliveries, Trips } from '../../api/namespaces';
import { getArray, cleanId, normalize } from './bcUtils';
import { useLiveSync } from '../../hooks/useLiveSync';

function same(a, b) {
  return String(a || '').trim() === String(b || '').trim();
}

function money(value) {
  if (typeof value === 'string' && value.includes('₹')) return value;
  const num = Number(value || 0);
  if (Number.isNaN(num)) return value || '₹0.00';
  return `₹${num.toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return String(value);
}

function getInvoiceDeliveryId(invoice) {
  if (!invoice) return null;
  return invoice.deliveryId || invoice.request || invoice.deliveryRequestId || invoice.delivery || invoice.delivery_id || invoice.requestId || null;
}

function findInvoiceById(invoices, invoiceId) {
  if (!invoiceId) return null;
  return (
    invoices.find((inv) => same(inv.id, invoiceId)) ||
    invoices.find((inv) => same(inv.invoiceId, invoiceId)) ||
    invoices.find((inv) => same(inv.invoiceNo, invoiceId)) ||
    invoices.find((inv) => same(inv.invoiceNumber, invoiceId)) ||
    null
  );
}

function findInvoiceByDeliveryId(invoices, deliveryId) {
  if (!deliveryId) return null;
  const target = cleanId(deliveryId);
  return (
    invoices.find((inv) => same(cleanId(inv.deliveryId), target)) ||
    invoices.find((inv) => same(cleanId(inv.request), target)) ||
    invoices.find((inv) => same(cleanId(inv.deliveryRequestId), target)) ||
    invoices.find((inv) => same(cleanId(inv.delivery), target)) ||
    invoices.find((inv) => same(cleanId(inv.delivery_id), target)) ||
    invoices.find((inv) => same(cleanId(inv.requestId), target)) ||
    null
  );
}

function findDeliveryById(deliveries, deliveryId) {
  if (!deliveryId) return null;
  const target = cleanId(deliveryId);
  return (
    deliveries.find((d) => same(cleanId(d.id), target)) ||
    deliveries.find((d) => same(cleanId(d.deliveryId), target)) ||
    deliveries.find((d) => same(cleanId(d.request), target)) ||
    deliveries.find((d) => same(cleanId(d.requestId), target)) ||
    deliveries.find((d) => same(cleanId(d.deliveryRequestId), target)) ||
    null
  );
}

function findTripForDelivery(delivery, trips, deliveryIdFromInvoiceOrUrl) {
  const targetDeliveryId = cleanId(delivery?.id) || cleanId(delivery?.deliveryId) || cleanId(deliveryIdFromInvoiceOrUrl);
  if (!targetDeliveryId) return null;
  return (
    trips.find((t) => same(cleanId(t.request), targetDeliveryId)) ||
    trips.find((t) => same(cleanId(t.deliveryId), targetDeliveryId)) ||
    trips.find((t) => same(cleanId(t.delivery_id), targetDeliveryId)) ||
    trips.find((t) => same(cleanId(t.requestId), targetDeliveryId)) ||
    trips.find((t) => same(cleanId(t.deliveryRequestId), targetDeliveryId)) ||
    trips.find((t) => same(cleanId(t.delivery), targetDeliveryId)) ||
    null
  );
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
}

export default function BcInvoiceView() {
  const [params] = useSearchParams();
  const invoiceIdFromUrl = params.get('id');
  const deliveryIdFromUrl = params.get('deliveryId');

  const [vm, setVm] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [syncTick, setSyncTick] = useState(0);
  useLiveSync(() => setSyncTick((value) => value + 1));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        let invoicesResult = await Transactions.getInvoices();
        const deliveriesResult = await Deliveries.getAll();
        const tripsResult = await Trips.getAll();

        let invoices = getArray(invoicesResult);
        const deliveries = getArray(deliveriesResult);
        const trips = getArray(tripsResult);

        let invoice = null;
        let delivery = null;

        if (deliveryIdFromUrl) {
          delivery = findDeliveryById(deliveries, deliveryIdFromUrl);
          invoice = findInvoiceByDeliveryId(invoices, deliveryIdFromUrl);

        }

        if (!invoice && invoiceIdFromUrl) {
          invoice = findInvoiceById(invoices, invoiceIdFromUrl);
        }

        if (!delivery && invoice) {
          const linkedDeliveryId = getInvoiceDeliveryId(invoice);
          delivery = findDeliveryById(deliveries, linkedDeliveryId);
        }

        const finalLinkedDeliveryId = delivery?.id || delivery?.deliveryId || getInvoiceDeliveryId(invoice) || deliveryIdFromUrl || null;
        const trip = findTripForDelivery(delivery, trips, finalLinkedDeliveryId);

        if (!invoice && !delivery) {
          throw new Error('No matching invoice or delivery found.');
        }

        if (cancelled) return;

        const invoiceExists = Boolean(invoice);

        const linkedDeliveryId = delivery?.id || delivery?.deliveryId || getInvoiceDeliveryId(invoice) || deliveryIdFromUrl || null;

        const invoiceNumber =
          invoice?.id || invoice?.invoiceId || invoice?.invoiceNo || invoice?.invoiceNumber || (linkedDeliveryId ? `INV-${linkedDeliveryId}` : 'Invoice not generated');

        const clientName = invoice?.client || invoice?.billedTo || invoice?.customer || delivery?.customer || delivery?.client || 'Not available';

        const clientAddress = invoice?.address || invoice?.clientAddress || invoice?.billingAddress || delivery?.address || delivery?.clientAddress || 'Address not provided';

        const invoiceDate = invoice?.date || invoice?.invoiceDate || invoice?.createdAt || delivery?.completedAt || delivery?.deliveryDate || delivery?.requestTime || 'Not available';

        const dueDate = invoice?.dueDate || invoice?.paymentDueDate || invoice?.paymentDue || 'Not available';

        const driver = trip?.driver || trip?.driverName || invoice?.driver || invoice?.driverName || delivery?.driver || delivery?.driverName || 'Not assigned';

        const pickup = trip?.pickup || trip?.pickupLocation || delivery?.pickup || delivery?.pickupAddress || delivery?.source || invoice?.pickup || invoice?.pickupLocation || '--';

        const drop =
          trip?.destination ||
          trip?.dropoff ||
          trip?.dropLocation ||
          delivery?.dropoff ||
          delivery?.destination ||
          delivery?.drop ||
          delivery?.dropAddress ||
          invoice?.dropoff ||
          invoice?.dropLocation ||
          invoice?.destination ||
          '--';

        const distance =
          trip?.distance || trip?.distanceKm || invoice?.distance || invoice?.distanceTravelled || invoice?.distanceTraveled || delivery?.distance || delivery?.distanceKm || 'Distance not available';

        const baseCost = safeNumber(invoice?.baseCost || invoice?.subtotal || invoice?.amount || invoice?.baseAmount || 0);
        const tax = safeNumber(invoice?.tax || invoice?.taxAmount || 0);
        const total = safeNumber(invoice?.total || invoice?.totalAmount || invoice?.grandTotal || 0);

        const paymentStatus = invoice?.status || invoice?.paymentStatus || (invoiceExists ? 'Status unavailable' : 'Invoice Not Generated');

        const paymentInfo = invoiceExists
          ? `Invoice status loaded for ${invoiceNumber}`
          : 'This delivery exists, but its invoice has not been generated yet.';

        const paymentReference = invoiceExists ? invoiceNumber : linkedDeliveryId || 'Not available';

        setVm({
          invoiceNumber: String(invoiceNumber),
          clientName: String(clientName),
          clientAddress: String(clientAddress),
          invoiceDate: formatDate(invoiceDate),
          dueDate: formatDate(dueDate),
          linkedDeliveryId: linkedDeliveryId ? `#${cleanId(linkedDeliveryId)}` : null,
          driver: String(driver),
          pickup: String(pickup),
          drop: String(drop),
          distance: String(distance),
          baseCost,
          tax,
          total,
          paymentStatus: String(paymentStatus),
          paymentInfo,
          paymentReference: String(paymentReference),
          invoiceExists,
          invoice,
        });
      } catch (error) {
        console.error('Invoice view backend sync failed:', error);
        if (!cancelled) setLoadError(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceIdFromUrl, deliveryIdFromUrl, syncTick]);

  const na = (v) => v || 'Not available';

  const normalizedStatus = normalize(vm?.paymentStatus);
  const isPaid = normalizedStatus.includes('paid') || normalizedStatus.includes('received') || normalizedStatus.includes('completed');
  const isPaymentClosed = isPaid;
  const isAwaitingReview = normalizedStatus.includes('pending') || normalizedStatus.includes('under review');
  const statusColor = normalizedStatus.includes('pending') || normalizedStatus.includes('unpaid') || normalizedStatus.includes('due') ? '#ffd400' : '#69e38f';
  const statusIcon = normalizedStatus.includes('pending') || normalizedStatus.includes('unpaid') || normalizedStatus.includes('due') ? '!' : '✓';

  return (
    <div className="invoice-wrap">
      <div className="invoice-shell">
        <div className="invoice-top">
          <div>
            <div className="invoice-logo">DeliverSync</div>
            <div className="invoice-sub">Logistics Technology Platform</div>

            <div style={{ height: 36 }}></div>

            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>Billed To</div>

            <div className="invoice-mini">
              <div className="value" style={{ fontSize: 28 }}>
                {loadError ? 'Not available' : !vm ? 'Loading...' : na(vm.clientName)}
              </div>
              <div style={{ marginTop: 12, fontSize: 18 }}>{loadError ? 'Not available' : !vm ? 'Loading...' : na(vm.clientAddress)}</div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div></div>
              <div>
                <div className="invoice-chip">
                  <svg viewBox="0 0 24 24">
                    <path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1V3z"></path>
                    <path d="M9 8h6"></path>
                    <path d="M9 12h6"></path>
                  </svg>
                  INVOICE
                </div>
                <div className="invoice-number">{loadError ? 'Unavailable' : !vm ? 'Loading...' : vm.invoiceNumber}</div>
              </div>
            </div>

            <div className="invoice-grid-top">
              <div className="invoice-mini">
                <div className="label">Invoice Date</div>
                <div className="value">{loadError ? 'Not available' : !vm ? 'Loading...' : vm.invoiceDate}</div>
              </div>

              <div className="invoice-mini">
                <div className="label">Due Date</div>
                <div className="value">{loadError ? 'Not available' : !vm ? 'Loading...' : vm.dueDate}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="invoice-section">
          <h2>Delivery Details</h2>

          <div className="detail-card">
            <div className="detail-row">
              <div className="left">Delivery ID</div>
              <div className="right yellow">{loadError ? 'Not available' : !vm ? 'Loading...' : na(vm.linkedDeliveryId || undefined)}</div>
            </div>
            <div className="detail-row">
              <div className="left">Driver</div>
              <div className="right">{loadError ? 'Not available' : !vm ? 'Loading...' : na(vm.driver)}</div>
            </div>
            <div className="detail-row">
              <div className="left">Pickup Location</div>
              <div className="right">{loadError ? 'Not available' : !vm ? 'Loading...' : na(vm.pickup)}</div>
            </div>
            <div className="detail-row">
              <div className="left">Drop Location</div>
              <div className="right">{loadError ? 'Not available' : !vm ? 'Loading...' : na(vm.drop)}</div>
            </div>
            <div className="detail-row">
              <div className="left">Distance Traveled</div>
              <div className="right yellow">{loadError ? 'Not available' : !vm ? 'Loading...' : na(vm.distance)}</div>
            </div>
          </div>
        </div>

        <div className="invoice-section">
          <h2>Cost Breakdown</h2>

          <div className="detail-card">
            <div className="detail-row">
              <div className="left">Base Cost</div>
              <div className="right">{loadError ? 'Not available' : !vm ? 'Loading...' : money(vm.baseCost)}</div>
            </div>
            <div className="detail-row">
              <div className="left">Tax (10%)</div>
              <div className="right">{loadError ? 'Not available' : !vm ? 'Loading...' : money(vm.tax)}</div>
            </div>
            <div className="total-row">
              <span>Total Amount</span>
              <span>{loadError ? 'Not available' : !vm ? 'Loading...' : money(vm.total)}</span>
            </div>
          </div>
        </div>

        <div className="invoice-section">
          <h2>Payment Status</h2>

          <div className="status-card">
            <div className="status-ico">{!vm ? '✓' : statusIcon}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: !vm ? '#69e38f' : statusColor }}>
                {loadError ? 'Not available' : !vm ? 'Loading...' : vm.paymentStatus}
              </div>
              <div style={{ marginTop: 8, color: '#d4f5db' }}>{loadError ? 'Could not load payment information' : !vm ? 'Loading...' : vm.paymentInfo}</div>
            </div>
          </div>

          {vm && vm.invoiceExists && !isPaymentClosed && !isAwaitingReview && (
            <div style={{ marginTop: 16 }}>
              <Link className="btn yellow" style={{ width: '100%', justifyContent: 'center' }} to={`/business-client/submit-transaction?invoiceId=${encodeURIComponent(cleanId(vm.invoiceNumber))}`}>
                Submit payment reference for {money(vm.total)}
              </Link>
            </div>
          )}
        </div>

        <div className="invoice-section">
          <h2>Payment Instructions</h2>

          <div className="detail-card">
            <div style={{ padding: '18px 0', color: '#a8a8a8' }}>For future payments, please make transfers to the following account:</div>
            <div className="detail-row">
              <div className="left">Bank Name</div>
              <div className="right">First National Bank</div>
            </div>
            <div className="detail-row">
              <div className="left">Account Name</div>
              <div className="right">DeliverSync Inc.</div>
            </div>
            <div className="detail-row">
              <div className="left">Account Number</div>
              <div className="right">1234567890</div>
            </div>
            <div className="detail-row">
              <div className="left">Reference</div>
              <div className="right yellow">{loadError ? 'Not available' : !vm ? 'Loading...' : vm.paymentReference}</div>
            </div>
          </div>

          <div className="invoice-actions">
            <a
              href="#"
              className="btn yellow"
              onClick={(e) => {
                e.preventDefault();
                window.print();
              }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 3v12"></path>
                <path d="M7 10l5 5 5-5"></path>
                <path d="M5 21h14"></path>
              </svg>
              Download PDF
            </a>

            <a
              href="#"
              className="btn outline-yellow"
              onClick={(e) => {
                e.preventDefault();
                window.print();
              }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1V3z"></path>
                <path d="M9 8h6"></path>
                <path d="M9 12h6"></path>
              </svg>
              Print Invoice
            </a>
          </div>

          <div className="footer-note">
            For questions about this invoice, please contact <a href="#">billing@deliverysync.com</a>
          </div>
        </div>
      </div>

      <style>{`
        .invoice-wrap{max-width:1180px;margin:0 auto;padding:28px 30px 40px}
        .bc-content .invoice-wrap{max-width:1180px}
        @media (max-width:900px){
          .bc-topbar{padding:0 18px}
          .bc-content{padding:20px}
          .invoice-top{grid-template-columns:1fr}
          .invoice-number{text-align:left}
          .invoice-actions{grid-template-columns:1fr}
        }
      `}</style>
    </div>
  );
}
