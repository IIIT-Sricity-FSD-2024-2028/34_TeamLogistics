import ReceiptDownload from '../../components/ReceiptDownload';
import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetStatementQuery, useGetInvoicesQuery, useGetPaymentsQuery, useGetDriverPayoutsQuery, useMarkPayoutPaidMutation, EMPTY_LIST } from '../../redux/fleetManagerApi';
import { useFleetManagerFilter } from '../../redux/useFleetManagerFilter';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { isRefundedFinancialRecord, matchesFilter, matchesSearchFields, payoutPaymentStatus, uniqueFilterOptions } from './fmUtils';
import Pagination, { usePagination } from '../../components/Pagination';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function dateText(value) {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-IN');
}

function tone(status) {
  const value = String(status || '').toLowerCase();
  if (['paid', 'completed', 'approved'].includes(value)) return 'good';
  if (['pending', 'under review', 'earned', 'unpaid'].includes(value)) return 'review';
  if (['overdue', 'rejected', 'failed'].includes(value)) return 'danger';
  return 'neutral';
}

export default function FmTransactions() {
  usePageStyleScope('fm-transactions');
  usePageHeader('Transactions', 'Live revenue, customer billing and driver payouts');
  const { showToast } = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [tab, setTab] = useFleetManagerFilter('transactions', 'tab');
  const [search, setSearch] = useFleetManagerFilter('transactions', 'search');
  const [partyFilter, setPartyFilter] = useFleetManagerFilter('transactions', 'partyFilter');
  const [statusFilter, setStatusFilter] = useFleetManagerFilter('transactions', 'statusFilter');
  const statementQuery = useGetStatementQuery(month);
  const invoicesQuery = useGetInvoicesQuery();
  const paymentsQuery = useGetPaymentsQuery();
  const payoutsQuery = useGetDriverPayoutsQuery();
  const statement = statementQuery.data;
  const invoices = (invoicesQuery.data || EMPTY_LIST).filter((item) => !isRefundedFinancialRecord(item));
  const payments = (paymentsQuery.data || EMPTY_LIST).filter((item) => !isRefundedFinancialRecord(item));
  const payouts = payoutsQuery.data || EMPTY_LIST;
  const loading = [statementQuery, invoicesQuery, paymentsQuery, payoutsQuery].some((query) => query.isLoading);
  const failed = [statementQuery, invoicesQuery, paymentsQuery, payoutsQuery].some((query) => query.isError && !query.data);
  const [markPayoutPaid] = useMarkPayoutPaidMutation();

  const openInvoices = invoices.filter(
    (invoice) =>
      !['paid', 'completed', 'approved', 'refunded', 'partially refunded'].includes(
        String(invoice.status || invoice.paymentStatus || '').toLowerCase(),
      ),
  );
  const pendingPayouts = payouts.filter((payout) => String(payout.status || '').toLowerCase() !== 'paid');
  const filteredInvoices = useMemo(
    () => invoices.filter((item) => matchesSearchFields(search, [item.id || item.invoiceId, item.deliveryId]) &&
      matchesFilter(item.client, partyFilter) &&
      matchesFilter(item.status || item.paymentStatus || 'Unpaid', statusFilter)),
    [invoices, search, partyFilter, statusFilter],
  );
  const filteredPayments = useMemo(
    () => payments.filter((item) => {
      const invoice = invoices.find((candidate) => String(candidate.id || candidate.invoiceId) === String(item.invoiceId || item.invoice));
      return matchesSearchFields(search, [item.id, item.invoiceId || item.invoice]) &&
        matchesFilter(invoice?.client, partyFilter) &&
        matchesFilter(item.status || 'Pending', statusFilter);
    }),
    [payments, invoices, search, partyFilter, statusFilter],
  );
  const filteredPayouts = useMemo(
    () => payouts.filter((item) => matchesSearchFields(search, [item.id, item.tripId]) &&
      matchesFilter(item.driverName, partyFilter) &&
      matchesFilter(payoutPaymentStatus(item.status), statusFilter)),
    [payouts, search, partyFilter, statusFilter],
  );
  const partyOptions = tab === 'payouts'
    ? uniqueFilterOptions(payouts, (item) => item.driverName)
    : uniqueFilterOptions(invoices, (item) => item.client);
  const statusOptions = tab === 'payouts'
    ? uniqueFilterOptions(payouts, (item) => payoutPaymentStatus(item.status))
    : uniqueFilterOptions([...invoices, ...payments], (item) => item.status || item.paymentStatus || 'Unpaid');
  const resetKey = `${search}|${partyFilter}|${statusFilter}`;
  const invoicePages = usePagination(filteredInvoices, { resetKey });
  const paymentPages = usePagination(filteredPayments, { resetKey });
  const payoutPages = usePagination(filteredPayouts, { resetKey });

  function selectTab(nextTab) {
    setTab(nextTab);
    setSearch('');
    setPartyFilter('');
    setStatusFilter('');
  }

  async function markPaid(id) {
    try {
      await markPayoutPaid(id).unwrap();
      showToast('Driver payout marked paid');
    } catch (error) {
      alert(error.message || 'Could not update this payout.');
    }
  }

  return (
    <div className="fm-finance">
      <section className="fm-finance-summary">
        <article className="fm-money-card highlight">
          <span>Net income</span><strong>{money(statement?.netIncome)}</strong><small>Live monthly total</small>
        </article>
        <article className="fm-money-card">
          <span>Fleet share</span><strong>{money(statement?.tripRevenue)}</strong><small>{statement?.completedTrips || 0} completed trips</small>
        </article>
        <article className="fm-money-card">
          <span>Driver liability</span><strong>{money(statement?.pendingDriverEarnings)}</strong><small>{pendingPayouts.length} payout{pendingPayouts.length === 1 ? '' : 's'} outstanding</small>
        </article>
        <article className="fm-money-card">
          <span>Client receivables</span><strong>{money(openInvoices.reduce((sum, item) => sum + Number(item.total || item.totalAmount || item.amount || 0), 0))}</strong><small>{openInvoices.length} invoice{openInvoices.length === 1 ? '' : 's'} awaiting payment</small>
        </article>
      </section>

      <section className="panel fm-finance-panel">
        <div className="fm-finance-bar">
          <div className="fm-finance-tabs">
            <button className={tab === 'statement' ? 'active' : ''} onClick={() => selectTab('statement')}>Revenue</button>
            <button className={tab === 'billing' ? 'active' : ''} onClick={() => selectTab('billing')}>Client billing</button>
            <button className={tab === 'payouts' ? 'active' : ''} onClick={() => selectTab('payouts')}>Driver payouts</button>
          </div>
          {tab === 'statement' ? (
            <label className="month-control"><span>Month</span><input type="month" max={currentMonth()} value={month} onChange={(event) => setMonth(event.target.value)} /></label>
          ) : (
            <div className="fm-finance-filters">
              <input
                className="finance-filter"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={tab === 'billing' ? 'Search invoice, payment, or delivery ID…' : 'Search payout or trip ID…'}
              />
              <select className="finance-filter" aria-label={tab === 'payouts' ? 'Filter by driver' : 'Filter by client'} value={partyFilter} onChange={(event) => setPartyFilter(event.target.value)}>
                <option value="">{tab === 'payouts' ? 'All drivers' : 'All clients'}</option>
                {partyOptions.map((party) => <option key={party} value={party}>{party}</option>)}
              </select>
              <select className="finance-filter" aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
          )}
        </div>

        {loading && <div className="finance-state">Loading financial records…</div>}
        {!loading && failed && <div className="finance-state error">Financial records could not be loaded.</div>}

        {!loading && !failed && tab === 'statement' && statement && (
          <div className="statement-layout">
            <div className="statement-card">
              <div className="statement-heading">
                <div><span>Monthly revenue</span><h2>{new Date(`${month}-02`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2></div>
                <span className={`fm-state ${statement.status === 'locked' ? 'good' : 'neutral'}`}>{statement.status === 'locked' ? 'Locked' : 'Open'}</span>
              </div>
              <div className="statement-line"><span>Approved customer revenue</span><strong>{money(statement.grossRevenue)}</strong></div>
              <div className="statement-line"><span>Platform commission</span><strong className="deduction">− {money(statement.platformCommission)}</strong></div>
              <div className="statement-line"><span>Fleet share</span><strong>{money(statement.fleetManagerGross)}</strong></div>
              <div className="statement-line"><span>Driver payouts</span><strong className="deduction">− {money(statement.driverPayoutsTotal)}</strong></div>
              <div className="statement-line"><span>Maintenance costs</span><strong className="deduction">− {money(statement.maintenanceCosts)}</strong></div>
              <div className="statement-total"><span>Net income</span><strong>{money(statement.netIncome)}</strong></div>
              <p className="statement-note">{statement.status === 'locked' ? `Locked ${dateText(statement.lockedAt)}. This statement is an immutable settlement snapshot.` : 'Only approved post-paid customer payments are included. This open monthly view updates automatically.'}</p>
            </div>
          </div>
        )}

        {!loading && !failed && tab === 'billing' && (
          <div className="finance-tables">
            <div className="table-section">
              <h2>Fleet invoices</h2><p>Invoices for deliveries completed by drivers in your fleet.</p>
              <div className="table-scroll"><table><thead><tr><th>Invoice</th><th>Client</th><th>Delivery</th><th>Amount</th><th>Due date</th><th>Status</th><th>Action</th></tr></thead><tbody>
                {filteredInvoices.length === 0 && <tr><td colSpan={7} className="empty-cell">No matching invoices.</td></tr>}
                {invoicePages.pageItems.map((item) => (
                  <tr key={item.id || item.invoiceId}>
                    <td><strong>{item.id || item.invoiceId}</strong></td><td>{item.client || '--'}</td><td>{item.deliveryId || '--'}</td>
                    <td className="amount-cell">{money(item.total || item.totalAmount || item.amount)}</td><td>{dateText(item.dueDate)}</td>
                    <td><span className={`fm-state ${tone(item.status || item.paymentStatus)}`}>{item.status || item.paymentStatus || 'Unpaid'}</span></td>
                    <td><Link className="record-action" to={`/fleet-manager/trips?deliveryId=${encodeURIComponent(item.deliveryId || '')}`}>View trip</Link></td>
                  </tr>
                ))}
              </tbody></table></div>
              <Pagination {...invoicePages} onPageChange={invoicePages.setPage} itemLabel="invoices" />
            </div>
            <div className="table-section">
              <h2>Customer payment activity</h2><p>Read-only verification history for those invoices.</p>
              <div className="table-scroll"><table><thead><tr><th>Transaction</th><th>Invoice</th><th>Date</th><th>Amount</th><th>Reference</th><th>Status</th><th>Action</th></tr></thead><tbody>
                {filteredPayments.length === 0 && <tr><td colSpan={7} className="empty-cell">No matching payment activity.</td></tr>}
                {paymentPages.pageItems.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.id}</strong></td><td>{item.invoiceId || '--'}</td><td>{dateText(item.date || item.createdAt)}</td>
                    <td className="amount-cell">{money(item.amount)}</td><td>{item.reference || '--'}</td>
                    <td><span className={`fm-state ${tone(item.status)}`}>{item.status || 'Pending'}</span></td>
                    <td>{item.receiptUrl ? <ReceiptDownload className="record-action" payment={item} /> : <span className="action-note">No receipt attached</span>}</td>
                  </tr>
                ))}
              </tbody></table></div>
              <Pagination {...paymentPages} onPageChange={paymentPages.setPage} itemLabel="payments" />
            </div>
          </div>
        )}

        {!loading && !failed && tab === 'payouts' && (
          <div className="table-section payouts-table">
            <h2>Driver payout ledger</h2><p>Approved payouts can be marked paid after funds are sent to the driver.</p>
            <div className="table-scroll"><table><thead><tr><th>Payout</th><th>Driver</th><th>Trip</th><th>Earned</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>
              {filteredPayouts.length === 0 && <tr><td colSpan={7} className="empty-cell">No matching driver payouts.</td></tr>}
              {payoutPages.pageItems.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.id}</strong></td><td>{item.driverName}</td><td>{item.tripId}</td><td>{dateText(item.earnedAt || item.createdAt)}</td>
                  <td className="amount-cell">{money(item.totalAmount)}</td><td><span className={`fm-state ${tone(payoutPaymentStatus(item.status))}`}>{payoutPaymentStatus(item.status)}</span></td>
                  <td>{item.status === 'Approved' ? <button className="pay-driver" onClick={() => markPaid(item.id)}>Mark paid</button> : <span className="action-note">{item.status === 'Paid' ? `Paid ${dateText(item.paidAt)}` : 'Awaiting payment approval'}</span>}</td>
                </tr>
              ))}
            </tbody></table></div>
            <Pagination {...payoutPages} onPageChange={payoutPages.setPage} itemLabel="payouts" />
          </div>
        )}
      </section>

    </div>
  );
}
