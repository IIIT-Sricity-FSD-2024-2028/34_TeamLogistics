import ReceiptDownload from '../../components/ReceiptDownload';
import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useEffect, useState } from 'react';
import { useGetRevenueQuery, useGetInvoicesQuery, useGetPaymentsQuery, useGetPayoutsQuery, useGetSettlementsQuery, useGetUsersQuery, useReviewPaymentMutation, useReversePaymentMutation, useMarkPayoutPaidMutation, useCreateSettlementMutation, useLockSettlementMutation, EMPTY_LIST } from '../../redux/superuserApi';
import { useSuperuserFilter } from '../../redux/useSuperuserFilter';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { statusClass, Icon } from '../../components/Icon';
import Modal from '../../components/Modal';
import RowActionMenu from '../../components/RowActionMenu';
import { matchesFilter, matchesSearchFields, uniqueFilterOptions } from '../../utils/search';
import Pagination, { usePagination } from '../../components/Pagination';
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
  usePageStyleScope('su-transactions');
  usePageHeader('Financial Operations', 'Manage post-paid billing, payment approvals and driver payouts');
  const { showToast } = useToast();

  const revenueQuery = useGetRevenueQuery();
  const invoicesQuery = useGetInvoicesQuery();
  const paymentsQuery = useGetPaymentsQuery();
  const payoutsQuery = useGetPayoutsQuery();
  const settlementsQuery = useGetSettlementsQuery();
  const usersQuery = useGetUsersQuery();
  const revenue = revenueQuery.data;
  const revenueFailed = revenueQuery.isError;
  const invoices = invoicesQuery.data || EMPTY_LIST;
  const txns = paymentsQuery.data || EMPTY_LIST;
  const driverPayouts = payoutsQuery.data || EMPTY_LIST;
  const settlements = settlementsQuery.data || EMPTY_LIST;
  const fleetManagers = (usersQuery.data || EMPTY_LIST).filter((user) => user.role === 'fleet-manager');
  const loadFailed = [invoicesQuery, paymentsQuery, payoutsQuery, settlementsQuery, usersQuery].some((query) => query.isError);
  const [reversePayment] = useReversePaymentMutation();
  async function reverse(payment, kind) {
    const reason = window.prompt('Reason for recording a full ' + kind + ' of ' + money(payment.amount));
    if (!reason?.trim()) return;
    try { await reversePayment({id: payment.id, kind, reason}).unwrap(); showToast('Reversal recorded'); }
    catch (error) { showToast(error.message || 'Unable to record reversal'); }
  }
  const [updatePaymentStatus] = useReviewPaymentMutation();
  const [payDriver] = useMarkPayoutPaidMutation();
  const [createSettlementRecord] = useCreateSettlementMutation();
  const [lockSettlementRecord] = useLockSettlementMutation();
  const [settlementManagerId, setSettlementManagerId] = useState('');
  const [settlementMonth, setSettlementMonth] = useState(new Date().toISOString().slice(0, 7));
  const [settlementBusy, setSettlementBusy] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useSuperuserFilter('transactions', 'invoiceSearch');
  const [txnSearch, setTxnSearch] = useSuperuserFilter('transactions', 'txnSearch');
  const [invoiceClientFilter, setInvoiceClientFilter] = useSuperuserFilter('transactions', 'invoiceClientFilter');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useSuperuserFilter('transactions', 'invoiceStatusFilter');
  const [txnClientFilter, setTxnClientFilter] = useSuperuserFilter('transactions', 'txnClientFilter');
  const [txnModeFilter, setTxnModeFilter] = useSuperuserFilter('transactions', 'txnModeFilter');
  const [txnStatusFilter, setTxnStatusFilter] = useSuperuserFilter('transactions', 'txnStatusFilter');
  const [invoicePage, setInvoicePage] = useSuperuserFilter('transactions', 'invoicePage');
  const [txnPage, setTxnPage] = useSuperuserFilter('transactions', 'txnPage');
  const pageSize = 10;
  const [invoiceModalId, setInvoiceModal] = useState(null);
  const invoiceModal = invoices.find((item) => String(item.id || item.invoiceId) === String(invoiceModalId));
  const [transactionModalId, setTransactionModal] = useState(null);
  const transactionModal = txns.find((item) => String(item.id || item.transactionId) === String(transactionModalId));
  const [reviewingId, setReviewingId] = useState(null);
  const settlementPages = usePagination(settlements);
  const payoutPages = usePagination(driverPayouts);

  const firstManagerId = fleetManagers[0]?.id || '';
  useEffect(() => {
    setSettlementManagerId((current) => current || firstManagerId);
  }, [firstManagerId]);

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
    if (inv) setInvoiceModal(inv.id || inv.invoiceId);
  }

  async function reviewPayment(transaction, status) {
    const transactionId = transaction.id || transaction.transactionId;
    setReviewingId(transactionId);
    try {
      await updatePaymentStatus({ id: transactionId, status }).unwrap();
      showToast(`Payment ${status.toLowerCase()}`);
    } catch (error) {
      alert(error.message || `Failed to mark payment ${status.toLowerCase()}.`);
    } finally {
      setReviewingId(null);
    }
  }

  async function markPayoutPaid(id) {
    try {
      await payDriver(id).unwrap();
      showToast('Driver payout marked paid');
    } catch (e) {
      alert(e.message || 'Failed to mark payout paid.');
    }
  }

  async function createSettlement() {
    if (!settlementManagerId || !settlementMonth) return;
    setSettlementBusy(true);
    try {
      await createSettlementRecord({ fleetManagerId: settlementManagerId, month: settlementMonth }).unwrap();
      showToast('Settlement period created');
    } catch (error) {
      alert(error.message || 'Failed to create the settlement period.');
    } finally {
      setSettlementBusy(false);
    }
  }

  async function lockSettlement() {
    if (!settlementManagerId || !settlementMonth) return;
    const manager = fleetManagers.find((item) => item.id === settlementManagerId);
    if (!window.confirm(`Lock ${settlementMonth} for ${manager?.name || settlementManagerId}? This snapshot cannot be edited later.`)) return;
    setSettlementBusy(true);
    try {
      await lockSettlementRecord({ fleetManagerId: settlementManagerId, month: settlementMonth }).unwrap();
      showToast('Settlement period locked');
    } catch (error) {
      alert(error.message || 'Failed to lock the settlement period.');
    } finally {
      setSettlementBusy(false);
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
                        <button className="row-action-item" onClick={() => setTransactionModal(t.id || t.transactionId)}>View details</button>
                        {(t.invoiceId || t.invoice) && <button className="row-action-item" onClick={() => openInvoiceById(t.invoiceId || t.invoice)}>View invoice</button>}
                        {t.receiptUrl && <ReceiptDownload className="row-action-item" payment={t} />}
                        {t.transactionType === 'delivery-payment' && !txns.some((entry) => entry.relatedTransactionId === t.id) && <>
                          <button className="row-action-item" onClick={() => reverse(t, 'refund')}>Record full refund</button>
                          <button className="row-action-item" onClick={() => reverse(t, 'chargeback')}>Record chargeback</button>
                        </>}
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

      <div className="content-card table-card finance-settlement-card">
        <div className="table-head settlement-toolbar">
          <div>
            <h3>Fleet Manager Settlements</h3>
            <div className="subdued" style={{ marginTop: 6 }}>Create a monthly period, pay every driver payout, then lock its financial snapshot.</div>
          </div>
          <div className="settlement-controls">
            <select className="mini-input" aria-label="Fleet manager" value={settlementManagerId} onChange={(event) => setSettlementManagerId(event.target.value)}>
              <option value="">Select fleet manager</option>
              {fleetManagers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name} ({manager.id})</option>)}
            </select>
            <input className="mini-input" aria-label="Settlement month" type="month" max={new Date().toISOString().slice(0, 7)} value={settlementMonth} onChange={(event) => setSettlementMonth(event.target.value)} />
            <button className="btn-yellow" type="button" disabled={settlementBusy || !settlementManagerId} onClick={createSettlement}>Create period</button>
            <button className="btn-yellow settlement-lock" type="button" disabled={settlementBusy || !settlementManagerId} onClick={lockSettlement}>{settlementBusy ? 'Working...' : 'Lock period'}</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Period</th><th>Fleet manager</th><th>Start</th><th>End</th><th>Status</th><th>Locked</th></tr></thead>
            <tbody>
              {settlements.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#b9b9b9', padding: 18 }}>No settlement periods created.</td></tr>}
              {settlementPages.pageItems.map((settlement) => (
                <tr key={settlement.id}>
                  <td><strong>{settlement.month}</strong><div className="subdued">{settlement.id}</div></td>
                  <td>{settlement.fleetManagerName || settlement.fleetManagerId}<div className="subdued">{settlement.fleetManagerId}</div></td>
                  <td>{settlement.startDate}</td>
                  <td>{settlement.endDate}</td>
                  <td><span className={`status-pill ${statusClass(settlement.status)}`}>{settlement.status}</span></td>
                  <td>{settlement.lockedAt ? `${dateText(settlement.lockedAt)} by ${settlement.lockedBy}` : 'Not locked'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...settlementPages} onPageChange={settlementPages.setPage} itemLabel="settlements" />
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
              {payoutPages.pageItems.map((payout) => (
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
        <Pagination {...payoutPages} onPageChange={payoutPages.setPage} itemLabel="payouts" />
      </div>

      {invoiceModal && <InvoiceModal inv={invoiceModal} onClose={() => setInvoiceModal(null)} />}
      {transactionModal && <TransactionModal transaction={transactionModal} onClose={() => setTransactionModal(null)} />}
    </div>
  );
}
