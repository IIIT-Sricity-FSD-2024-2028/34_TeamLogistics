import { useEffect, useState } from 'react';
import { Transactions, Payouts } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { statusClass, Icon } from '../../components/Icon';
import Modal from '../../components/Modal';
import RowActionMenu from '../../components/RowActionMenu';
import { useLiveSync } from '../../hooks/useLiveSync';
import { matchesFilter, matchesSearchFields, uniqueFilterOptions } from '../../utils/search';
import './SuTransactions.css';

function money(value) {
  if (value === undefined || value === null || value === '') return '--';
  const raw = String(value).replace(/[₹,]/g, '').trim();
  if (!raw || isNaN(Number(raw))) return String(value).startsWith('₹') ? String(value) : String(value);
  return `₹${Number(raw).toLocaleString('en-IN')}`;
}

function dateText(value) {
  if (!value) return '--';
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toLocaleDateString('en-IN');
  return String(value);
}

function InvoiceModal({ inv, onClose }) {
  const baseCost = Number(inv.baseCost || 0);
  const tax = Number(inv.tax || inv.taxAmount || 0);
  const total = Number(inv.total || inv.totalAmount || inv.amount || 0);

  return (
    <Modal onClose={onClose}>
      <div className="content-card details-card modal-detail-card standalone-modal">
        <div className="details-top">
          <div className="details-title">Invoice {inv.id || inv.invoiceId}</div>
          <button className="close-icon" onClick={onClose}>×</button>
        </div>
        <div className="details-body modal-detail-body">
          <div className="detail-block full"><div className="detail-label">Client</div><div className="detail-main">{Icon.user}{inv.client || '-'}</div></div>
          <div className="detail-block full"><div className="detail-label">Address</div><div className="detail-main">{Icon.map}{inv.address || '-'}</div></div>
          <div className="detail-block full"><div className="detail-label">Route</div><div className="detail-main">{Icon.map}{inv.pickup || '-'} &rarr; {inv.dropoff || '-'}</div></div>
          <div className="detail-block"><div className="detail-label">Driver</div><div className="detail-main">{Icon.user}{inv.driver || 'Not assigned'}</div></div>
          <div className="detail-block"><div className="detail-label">Status</div><div className="detail-main"><span className={`status-pill ${statusClass(inv.status)}`}>{inv.status || 'Unpaid'}</span></div></div>
          <div className="detail-block"><div className="detail-label">Invoice Date</div><div className="detail-main">{Icon.calendar}{inv.invoiceDate || inv.date || '-'}</div></div>
          <div className="detail-block"><div className="detail-label">Due Date</div><div className="detail-main">{Icon.calendar}{inv.dueDate || '-'}</div></div>
          <div className="detail-block full inv-amount-block">
            <div className="detail-label">Amount Breakdown</div>
            <div className="inv-amount-row"><span>Base Cost</span><span>{money(baseCost)}</span></div>
            <div className="inv-amount-row"><span>Tax</span><span>{money(tax)}</span></div>
            <div className="inv-amount-row inv-amount-total"><span>Total</span><span>{money(total)}</span></div>
          </div>
        </div>
        <div className="detail-footer"><button className="btn-yellow close-wide" onClick={onClose}>Close</button></div>
      </div>
      <style>{`
        .inv-amount-block{background:rgba(255,212,0,.04) !important}
        .inv-amount-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:14px;color:#c9c9c9;font-weight:600}
        .inv-amount-total{margin-top:6px;padding-top:12px;border-top:1px dashed #2f2f2f;font-size:18px;font-weight:900;color:var(--yellow)}
      `}</style>
    </Modal>
  );
}

function TransactionModal({ transaction, onClose }) {
  return (
    <Modal onClose={onClose}>
      <div className="content-card details-card modal-detail-card standalone-modal">
        <div className="details-top">
          <div className="details-title">Transaction {transaction.transactionId || transaction.id}</div>
          <button className="close-icon" onClick={onClose}>×</button>
        </div>
        <div className="details-body modal-detail-body">
          <div className="detail-block"><div className="detail-label">Invoice</div><div className="detail-main">{transaction.invoice || transaction.invoiceId || 'Not linked'}</div></div>
          <div className="detail-block"><div className="detail-label">Client</div><div className="detail-main">{Icon.user}{transaction.client || transaction.customer || transaction.businessClient || 'Not provided'}</div></div>
          <div className="detail-block"><div className="detail-label">Payment Date</div><div className="detail-main">{Icon.calendar}{transaction.date || dateText(transaction.createdAt)}</div></div>
          <div className="detail-block"><div className="detail-label">Payment Mode</div><div className="detail-main">{transaction.mode || transaction.paymentMode || 'Payment'}</div></div>
          <div className="detail-block"><div className="detail-label">Amount</div><div className="detail-main">{money(transaction.amount)}</div></div>
          <div className="detail-block"><div className="detail-label">Status</div><div className="detail-main"><span className={`status-pill ${statusClass(transaction.status)}`}>{transaction.status || 'Status unavailable'}</span></div></div>
          <div className="detail-block full"><div className="detail-label">Reference</div><div className="detail-main">{transaction.reference || transaction.transactionId || transaction.id || 'Not provided'}</div></div>
          <div className="detail-block full"><div className="detail-label">Payment Proof</div><div className="detail-main">{transaction.receiptName || (transaction.receiptUrl ? 'Receipt attached' : 'No receipt attached')}</div></div>
        </div>
        <div className="detail-footer"><button className="btn-yellow close-wide" onClick={onClose}>Close</button></div>
      </div>
    </Modal>
  );
}

export default function SuTransactions() {
  usePageHeader('Financial Operations', 'Manage post-paid billing, payment approvals and driver payouts');
  const { showToast } = useToast();

  const [revenue, setRevenue] = useState(null);
  const [revenueFailed, setRevenueFailed] = useState(false);

  const [invoices, setInvoices] = useState([]);
  const [txns, setTxns] = useState([]);
  const [driverPayouts, setDriverPayouts] = useState([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [txnSearch, setTxnSearch] = useState('');
  const [invoiceClientFilter, setInvoiceClientFilter] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('');
  const [txnClientFilter, setTxnClientFilter] = useState('');
  const [txnModeFilter, setTxnModeFilter] = useState('');
  const [txnStatusFilter, setTxnStatusFilter] = useState('');
  const [invoicePage, setInvoicePage] = useState(1);
  const [txnPage, setTxnPage] = useState(1);
  const pageSize = 10;
  const [invoiceModal, setInvoiceModal] = useState(null);
  const [transactionModal, setTransactionModal] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);

  async function loadRevenue() {
    try {
      setRevenue(await Transactions.getRevenueSummary());
      setRevenueFailed(false);
    } catch {
      setRevenueFailed(true);
    }
  }

  async function loadMain() {
    try {
      const [transactions, invs, payouts] = await Promise.all([
        Transactions.getPayments(),
        Transactions.getInvoices(),
        Payouts.listDriverPayouts(),
      ]);
      setTxns(transactions || []);
      setInvoices(invs || []);
      setDriverPayouts(payouts || []);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }

  useEffect(() => {
    loadRevenue();
    loadMain();
  }, []);
  useLiveSync(async () => {
    await Promise.all([loadRevenue(), loadMain()]);
  });

  const invQ = invoiceSearch.trim();
  const filteredInvoices = invoices.filter((invoice) => matchesSearchFields(invoiceSearch, [
    invoice.id || invoice.invoiceId,
  ]) &&
    matchesFilter(invoice.client || invoice.customer || invoice.businessClient, invoiceClientFilter) &&
    matchesFilter(invoice.status || invoice.paymentStatus || 'Unpaid', invoiceStatusFilter));
  const invoiceClientOptions = uniqueFilterOptions(invoices, (invoice) => invoice.client || invoice.customer || invoice.businessClient);
  const invoiceStatusOptions = uniqueFilterOptions(invoices, (invoice) => invoice.status || invoice.paymentStatus || 'Unpaid');
  const totalInvoicePages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const curInvoicePage = Math.min(invoicePage, totalInvoicePages);
  const pageInvoices = filteredInvoices.slice((curInvoicePage - 1) * pageSize, curInvoicePage * pageSize);

  const txnQ = txnSearch.trim();
  const filteredTxns = txns.filter((transaction) => matchesSearchFields(txnSearch, [
    transaction.transactionId || transaction.id,
    transaction.invoice || transaction.invoiceId,
  ]) &&
    matchesFilter(transaction.client || transaction.customer || transaction.businessClient, txnClientFilter) &&
    matchesFilter(transaction.mode || transaction.paymentMode || 'Payment', txnModeFilter) &&
    matchesFilter(transaction.status, txnStatusFilter));
  const txnClientOptions = uniqueFilterOptions(txns, (transaction) => transaction.client || transaction.customer || transaction.businessClient);
  const txnModeOptions = uniqueFilterOptions(txns, (transaction) => transaction.mode || transaction.paymentMode || 'Payment');
  const txnStatusOptions = uniqueFilterOptions(txns, (transaction) => transaction.status);
  const totalTxnPages = Math.max(1, Math.ceil(filteredTxns.length / pageSize));
  const curTxnPage = Math.min(txnPage, totalTxnPages);
  const pageTxns = filteredTxns.slice((curTxnPage - 1) * pageSize, curTxnPage * pageSize);

  function openInvoiceById(id) {
    const inv = invoices.find((i) => String(i.id || i.invoiceId) === String(id));
    if (inv) setInvoiceModal(inv);
  }

  async function reviewPayment(transaction, status) {
    const transactionId = transaction.id || transaction.transactionId;
    setReviewingId(transactionId);
    try {
      await Transactions.updatePaymentStatus(transactionId, status);
      showToast(`Payment ${status.toLowerCase()}`);
      await Promise.all([loadMain(), loadRevenue()]);
    } catch (error) {
      alert(error.message || `Failed to mark payment ${status.toLowerCase()}.`);
    } finally {
      setReviewingId(null);
    }
  }

  async function markPayoutPaid(id) {
    try {
      await Payouts.markPayoutPaid(id);
      showToast('Driver payout marked paid');
      loadMain();
    } catch (e) {
      alert(e.message || 'Failed to mark payout paid.');
    }
  }

  const outstandingInvoiceValue = invoices
    .filter((invoice) => !['paid', 'completed', 'approved'].includes(String(invoice.status || invoice.paymentStatus || '').toLowerCase()))
    .reduce((sum, invoice) => sum + Number(invoice.total || invoice.totalAmount || invoice.amount || 0), 0);
  const pendingPayments = txns.filter((transaction) =>
    ['pending', 'under review'].includes(String(transaction.status || '').toLowerCase()),
  );

  return (
    <div className="su-finance-page">
      <div className="content-card table-card finance-overview-card">
        <div className="table-head">
          <div>
            <h3>Finance Overview</h3>
            <div className="subdued" style={{ marginTop: 6 }}>Post-paid revenue is recognized only after a submitted customer payment is approved.</div>
          </div>
        </div>
        <div className="kpi-grid" style={{ marginTop: 16 }}>
          {revenueFailed && <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#ff6b6b', padding: 18 }}>Failed to load revenue summary.</div>}
          {!revenueFailed && !revenue && <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#b9b9b9', padding: 18 }}>Loading revenue...</div>}
          {!revenueFailed && revenue && (
            <>
              <div className="content-card kpi finance-kpi collections"><div className="finance-kpi-icon">₹</div><div className="label">Post-paid Collections</div><div className="value">{money(revenue.postPaidCollections ?? revenue.grossBookingValue)}</div><div className="delta">Approved customer payments</div></div>
              <div className="content-card kpi finance-kpi outstanding"><div className="finance-kpi-icon">▤</div><div className="label">Outstanding Invoices</div><div className="value">{money(outstandingInvoiceValue)}</div><div className="delta">Awaiting payment</div></div>
              <div className="content-card kpi finance-kpi pending"><div className="finance-kpi-icon">⌛</div><div className="label">Pending Verification</div><div className="value">{pendingPayments.length}</div><div className="delta">Payment proofs require review</div></div>
              <div className="content-card kpi finance-kpi commission"><div className="finance-kpi-icon">%</div><div className="label">Platform Commission</div><div className="value">{money(revenue.deliveryCommission)}</div><div className="delta">Recognized revenue</div></div>
            </>
          )}
        </div>
      </div>

      <div className="content-card table-card finance-operations-card">
        <div className="table-head">
          <div>
            <h3>Invoice & Payment Operations</h3>
            <div className="subdued" style={{ marginTop: 6 }}>Review every invoice and approve or reject submitted payment proof.</div>
          </div>
        </div>

        <div className="finance-section">
          <div className="finance-section-toolbar">
            <div className="finance-section-title"><span>01</span><div><h3>Invoices</h3><small>{filteredInvoices.length} records</small></div></div>
            <div className="filters" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="mini-input" placeholder="Search invoice ID" value={invoiceSearch} onChange={(e) => { setInvoiceSearch(e.target.value); setInvoicePage(1); }} />
              <select className="mini-input" aria-label="Filter invoices by client" value={invoiceClientFilter} onChange={(e) => { setInvoiceClientFilter(e.target.value); setInvoicePage(1); }}><option value="">All clients</option>{invoiceClientOptions.map((client) => <option key={client} value={client}>{client}</option>)}</select>
              <select className="mini-input" aria-label="Filter invoices by status" value={invoiceStatusFilter} onChange={(e) => { setInvoiceStatusFilter(e.target.value); setInvoicePage(1); }}><option value="">All statuses</option>{invoiceStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>Invoice</th><th>Client</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {loadFailed && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#ff6b6b', padding: 18 }}>Failed to load invoices.</td></tr>}
                {!loadFailed && pageInvoices.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#b9b9b9', padding: 18 }}>{invQ || invoiceClientFilter || invoiceStatusFilter ? 'No invoices match the selected search and filters.' : 'No invoices found.'}</td></tr>}
                {!loadFailed && pageInvoices.map((inv) => {
                  const invId = inv.id || inv.invoiceId || '-';
                  return (
                    <tr key={invId}>
                      <td>{invId}</td>
                      <td>{inv.client || inv.customer || inv.businessClient || '-'}</td>
                      <td>{money(inv.total || inv.totalAmount || inv.amount)}</td>
                      <td>{inv.dueDate || dateText(inv.createdAt) || '-'}</td>
                      <td><span className={`status-pill ${statusClass(inv.status)}`}>{inv.status || 'Unpaid'}</span></td>
                      <td><RowActionMenu label={`Open actions for invoice ${invId}`}>
                        <button className="row-action-item" onClick={() => openInvoiceById(invId)}>View invoice</button>
                      </RowActionMenu></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loadFailed && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
              <div className="subdued">Showing <strong>{pageInvoices.length}</strong> of <strong>{filteredInvoices.length}</strong> invoices</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="btn-yellow" disabled={curInvoicePage <= 1} style={{ padding: '6px 14px', opacity: curInvoicePage <= 1 ? 0.5 : 1 }} onClick={() => setInvoicePage((p) => p - 1)}>Prev</button>
                <span className="subdued">Page {curInvoicePage} of {totalInvoicePages}</span>
                <button className="btn-yellow" disabled={curInvoicePage >= totalInvoicePages} style={{ padding: '6px 14px', opacity: curInvoicePage >= totalInvoicePages ? 0.5 : 1 }} onClick={() => setInvoicePage((p) => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </div>

        <div className="finance-section finance-section-bordered">
          <div className="finance-section-toolbar">
            <div className="finance-section-title"><span>02</span><div><h3>Submitted payments</h3><small>{pendingPayments.length} awaiting review</small></div></div>
            <div className="filters" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="mini-input" placeholder="Search transaction or invoice ID" value={txnSearch} onChange={(e) => { setTxnSearch(e.target.value); setTxnPage(1); }} />
              <select className="mini-input" aria-label="Filter transactions by client" value={txnClientFilter} onChange={(e) => { setTxnClientFilter(e.target.value); setTxnPage(1); }}><option value="">All clients</option>{txnClientOptions.map((client) => <option key={client} value={client}>{client}</option>)}</select>
              <select className="mini-input" aria-label="Filter transactions by mode" value={txnModeFilter} onChange={(e) => { setTxnModeFilter(e.target.value); setTxnPage(1); }}><option value="">All payment modes</option>{txnModeOptions.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select>
              <select className="mini-input" aria-label="Filter transactions by status" value={txnStatusFilter} onChange={(e) => { setTxnStatusFilter(e.target.value); setTxnPage(1); }}><option value="">All statuses</option>{txnStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>Invoice</th><th>Date</th><th>Mode</th><th>Transaction ID</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loadFailed && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#ff6b6b', padding: 18 }}>Failed to load transactions.</td></tr>}
                {!loadFailed && pageTxns.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#b9b9b9', padding: 18 }}>{txnQ || txnClientFilter || txnModeFilter || txnStatusFilter ? 'No transactions match the selected search and filters.' : 'No transactions submitted yet.'}</td></tr>}
                {!loadFailed && pageTxns.map((t) => {
                  const transactionId = t.id || t.transactionId;
                  const canReview = Boolean(t.invoiceId || t.invoice) &&
                    String(t.type || 'Payment').toLowerCase() === 'payment' &&
                    ['pending', 'under review'].includes(String(t.status || '').toLowerCase());
                  const isReviewing = reviewingId === transactionId;
                  return (
                    <tr key={transactionId}>
                      <td>{t.invoice || t.invoiceId || '-'}</td>
                      <td>{t.date || dateText(t.createdAt)}</td>
                      <td>{t.mode || t.paymentMode || 'Payment'}</td>
                      <td>{t.transactionId || t.id || '-'}</td>
                      <td>{money(t.amount)}</td>
                      <td><span className={`status-pill ${statusClass(t.status)}`}>{t.status || 'Status unavailable'}</span></td>
                      <td><RowActionMenu label={`Open actions for transaction ${transactionId}`}>
                        <button className="row-action-item" onClick={() => setTransactionModal(t)}>View details</button>
                        {(t.invoiceId || t.invoice) && <button className="row-action-item" onClick={() => openInvoiceById(t.invoiceId || t.invoice)}>View invoice</button>}
                        {t.receiptUrl && <a className="row-action-item" href={t.receiptUrl} target="_blank" rel="noopener noreferrer">View receipt</a>}
                        {canReview && <button className="row-action-item" disabled={isReviewing} onClick={() => reviewPayment(t, 'Approved')}>{isReviewing ? 'Reviewing...' : 'Approve payment'}</button>}
                        {canReview && <button className="row-action-item danger" disabled={isReviewing} onClick={() => reviewPayment(t, 'Rejected')}>{isReviewing ? 'Reviewing...' : 'Reject payment'}</button>}
                      </RowActionMenu></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loadFailed && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
              <div className="subdued">Showing <strong>{pageTxns.length}</strong> of <strong>{filteredTxns.length}</strong> transactions</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="btn-yellow" disabled={curTxnPage <= 1} style={{ padding: '6px 14px', opacity: curTxnPage <= 1 ? 0.5 : 1 }} onClick={() => setTxnPage((p) => p - 1)}>Prev</button>
                <span className="subdued">Page {curTxnPage} of {totalTxnPages}</span>
                <button className="btn-yellow" disabled={curTxnPage >= totalTxnPages} style={{ padding: '6px 14px', opacity: curTxnPage >= totalTxnPages ? 0.5 : 1 }} onClick={() => setTxnPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="content-card table-card finance-payout-card">
        <div className="table-head">
          <div>
            <h3>Driver Payouts</h3>
            <div className="subdued" style={{ marginTop: 6 }}>Earned payouts become approved only after the customer payment is verified.</div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Payout</th><th>Driver</th><th>Trip</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {driverPayouts.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#b9b9b9', padding: 18 }}>No driver payouts recorded.</td></tr>}
              {driverPayouts.map((payout) => (
                <tr key={payout.id}>
                  <td>{payout.id}</td><td>{payout.driverName}</td><td>{payout.tripId}</td>
                  <td>{money(payout.totalAmount)}</td>
                  <td><span className={`status-pill ${statusClass(payout.status)}`}>{payout.status || 'Paid'}</span></td>
                  <td>{payout.status === 'Approved' ? (
                    <RowActionMenu label={`Open actions for payout ${payout.id}`}>
                      <button className="row-action-item" onClick={() => markPayoutPaid(payout.id)}>Mark paid</button>
                    </RowActionMenu>
                  ) : payout.status === 'Paid' ? `Paid ${dateText(payout.paidAt)}` : 'Awaiting customer payment'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {invoiceModal && <InvoiceModal inv={invoiceModal} onClose={() => setInvoiceModal(null)} />}
      {transactionModal && <TransactionModal transaction={transactionModal} onClose={() => setTransactionModal(null)} />}
    </div>
  );
}
