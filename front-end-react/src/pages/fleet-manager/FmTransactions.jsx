import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Payouts, Transactions } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { useLiveSync } from '../../hooks/useLiveSync';
import { isRefundedFinancialRecord, matchesFilter, matchesSearchFields, payoutPaymentStatus, uniqueFilterOptions } from './fmUtils';

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
  usePageHeader('Transactions', 'Live revenue, customer billing and driver payouts');
  const { showToast } = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [tab, setTab] = useState('statement');
  const [search, setSearch] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [statement, setStatement] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  async function load({ background = false } = {}) {
    if (!background) setLoading(true);
    try {
      const [nextStatement, nextInvoices, nextPayments, nextPayouts] = await Promise.all([
        Payouts.getFleetManagerStatement(month),
        Transactions.getInvoices(),
        Transactions.getPayments(),
        Payouts.listDriverPayouts(),
      ]);
      setStatement(nextStatement);
      setInvoices((nextInvoices || []).filter((item) => !isRefundedFinancialRecord(item)));
      setPayments((nextPayments || []).filter((item) => !isRefundedFinancialRecord(item)));
      setPayouts(nextPayouts || []);
      setFailed(false);
    } catch (error) {
      console.error('Fleet finance sync failed:', error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [month]);
  useLiveSync(() => load({ background: true }));

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

  function selectTab(nextTab) {
    setTab(nextTab);
    setSearch('');
    setPartyFilter('');
    setStatusFilter('');
  }

  async function markPaid(id) {
    try {
      await Payouts.markPayoutPaid(id);
      showToast('Driver payout marked paid');
      await load({ background: true });
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
                <span className="fm-state neutral">Live</span>
              </div>
              <div className="statement-line"><span>Approved customer revenue</span><strong>{money(statement.grossRevenue)}</strong></div>
              <div className="statement-line"><span>Platform commission</span><strong className="deduction">− {money(statement.platformCommission)}</strong></div>
              <div className="statement-line"><span>Fleet share</span><strong>{money(statement.fleetManagerGross)}</strong></div>
              <div className="statement-line"><span>Driver payouts</span><strong className="deduction">− {money(statement.driverPayoutsTotal)}</strong></div>
              <div className="statement-line"><span>Maintenance costs</span><strong className="deduction">− {money(statement.maintenanceCosts)}</strong></div>
              <div className="statement-total"><span>Net income</span><strong>{money(statement.netIncome)}</strong></div>
              <p className="statement-note">Only approved post-paid customer payments are included. This monthly view updates automatically.</p>
            </div>
          </div>
        )}

        {!loading && !failed && tab === 'billing' && (
          <div className="finance-tables">
            <div className="table-section">
              <h2>Fleet invoices</h2><p>Invoices for deliveries completed by drivers in your fleet.</p>
              <div className="table-scroll"><table><thead><tr><th>Invoice</th><th>Client</th><th>Delivery</th><th>Amount</th><th>Due date</th><th>Status</th><th>Action</th></tr></thead><tbody>
                {filteredInvoices.length === 0 && <tr><td colSpan={7} className="empty-cell">No matching invoices.</td></tr>}
                {filteredInvoices.map((item) => (
                  <tr key={item.id || item.invoiceId}>
                    <td><strong>{item.id || item.invoiceId}</strong></td><td>{item.client || '--'}</td><td>{item.deliveryId || '--'}</td>
                    <td className="amount-cell">{money(item.total || item.totalAmount || item.amount)}</td><td>{dateText(item.dueDate)}</td>
                    <td><span className={`fm-state ${tone(item.status || item.paymentStatus)}`}>{item.status || item.paymentStatus || 'Unpaid'}</span></td>
                    <td><Link className="record-action" to={`/fleet-manager/trips?deliveryId=${encodeURIComponent(item.deliveryId || '')}`}>View trip</Link></td>
                  </tr>
                ))}
              </tbody></table></div>
            </div>
            <div className="table-section">
              <h2>Customer payment activity</h2><p>Read-only verification history for those invoices.</p>
              <div className="table-scroll"><table><thead><tr><th>Transaction</th><th>Invoice</th><th>Date</th><th>Amount</th><th>Reference</th><th>Status</th><th>Action</th></tr></thead><tbody>
                {filteredPayments.length === 0 && <tr><td colSpan={7} className="empty-cell">No matching payment activity.</td></tr>}
                {filteredPayments.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.id}</strong></td><td>{item.invoiceId || '--'}</td><td>{dateText(item.date || item.createdAt)}</td>
                    <td className="amount-cell">{money(item.amount)}</td><td>{item.reference || '--'}</td>
                    <td><span className={`fm-state ${tone(item.status)}`}>{item.status || 'Pending'}</span></td>
                    <td>{item.receiptUrl ? <a className="record-action" href={item.receiptUrl} target="_blank" rel="noreferrer">View receipt</a> : <span className="action-note">No receipt attached</span>}</td>
                  </tr>
                ))}
              </tbody></table></div>
            </div>
          </div>
        )}

        {!loading && !failed && tab === 'payouts' && (
          <div className="table-section payouts-table">
            <h2>Driver payout ledger</h2><p>Approved payouts can be marked paid after funds are sent to the driver.</p>
            <div className="table-scroll"><table><thead><tr><th>Payout</th><th>Driver</th><th>Trip</th><th>Earned</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>
              {filteredPayouts.length === 0 && <tr><td colSpan={7} className="empty-cell">No matching driver payouts.</td></tr>}
              {filteredPayouts.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.id}</strong></td><td>{item.driverName}</td><td>{item.tripId}</td><td>{dateText(item.earnedAt || item.createdAt)}</td>
                  <td className="amount-cell">{money(item.totalAmount)}</td><td><span className={`fm-state ${tone(payoutPaymentStatus(item.status))}`}>{payoutPaymentStatus(item.status)}</span></td>
                  <td>{item.status === 'Approved' ? <button className="pay-driver" onClick={() => markPaid(item.id)}>Mark paid</button> : <span className="action-note">{item.status === 'Paid' ? `Paid ${dateText(item.paidAt)}` : 'Awaiting payment approval'}</span>}</td>
                </tr>
              ))}
            </tbody></table></div>
          </div>
        )}
      </section>

      <style>{`
        .fm-finance-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:20px}.fm-money-card{background:#171717;border:1px solid #292929;border-radius:16px;padding:19px}.fm-money-card.highlight{background:#f4cf12;color:#0b0b0b;border-color:#f4cf12}.fm-money-card span,.fm-money-card small{display:block;color:#949494}.fm-money-card.highlight span,.fm-money-card.highlight small{color:#4d450b}.fm-money-card span{text-transform:uppercase;font-size:11px;font-weight:900;letter-spacing:.09em}.fm-money-card strong{display:block;font-size:27px;margin:13px 0 8px}.fm-finance-panel{overflow:hidden}.fm-finance-bar{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:17px 20px;border-bottom:1px solid #292929}.fm-finance-tabs{display:flex;gap:7px}.fm-finance-tabs button{background:transparent;border:0;color:#969696;font-weight:800;padding:10px 13px;border-radius:9px;cursor:pointer}.fm-finance-tabs button.active{background:#2a2a2a;color:#fff}.fm-finance-filters{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}.month-control{display:flex;align-items:center;gap:9px;color:#999;font-size:12px;font-weight:800}.month-control input,.finance-filter{background:#0b0b0b;border:1px solid #333;color:#fff;border-radius:9px;padding:9px 11px}.finance-filter{min-width:170px}.fm-finance-filters input.finance-filter{min-width:260px}.finance-state{text-align:center;color:#999;padding:55px}.finance-state.error{color:#ff8d8d}.statement-layout{padding:20px}.statement-card{max-width:760px;background:#101010;border:1px solid #282828;border-radius:15px;padding:20px}.statement-heading{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;border-bottom:1px solid #292929;padding-bottom:16px;margin-bottom:5px}.statement-heading span,.statement-note{color:#8f8f8f}.statement-heading h2{margin:5px 0 0}.statement-line,.statement-total{display:flex;justify-content:space-between;gap:16px;padding:13px 2px}.statement-line{border-bottom:1px solid #232323;color:#bbb}.statement-line strong{color:#fff}.statement-line .deduction{color:#fca5a5}.statement-total{font-size:20px;margin-top:7px}.statement-total strong{color:#f4cf12}.statement-note{font-size:12px;line-height:1.55;margin:13px 0 0}.fm-state{display:inline-flex;width:max-content;border-radius:999px;padding:5px 9px;text-transform:capitalize;font-size:11px;font-weight:900}.fm-state.good{background:#123722;color:#86efac}.fm-state.review{background:#372f0b;color:#fde047}.fm-state.danger{background:#3a1717;color:#fca5a5}.fm-state.neutral{background:#292929;color:#d1d5db}.finance-tables{padding:0 20px 20px}.table-section{padding-top:20px}.table-section h2{font-size:17px;margin:0}.table-section>p{color:#8f8f8f;margin:7px 0 15px;font-size:13px}.table-scroll{overflow-x:auto;border:1px solid #292929;border-radius:12px}.table-section table{width:100%;min-width:920px;border-collapse:collapse}.table-section th{text-align:left;color:#858585;text-transform:uppercase;font-size:11px;letter-spacing:.07em;padding:12px 15px}.table-section td{padding:14px 15px;border-top:1px solid #252525;font-size:13px}.amount-cell{font-weight:900;color:#fff}.payouts-table{padding:20px}.empty-cell{text-align:center;color:#888;padding:30px!important}.pay-driver,.record-action{display:inline-flex;background:#f4cf12;color:#090909;border:0;border-radius:8px;padding:8px 11px;font-weight:900;text-decoration:none;cursor:pointer;white-space:nowrap}.record-action{background:transparent;color:#f4cf12;border:1px solid #f4cf12}.action-note{color:#8f8f8f;font-size:12px;white-space:nowrap}@media(max-width:1100px){.fm-finance-summary{grid-template-columns:repeat(2,1fr)}}@media(max-width:780px){.fm-finance-summary{grid-template-columns:1fr}.fm-finance-bar{display:flex;flex-direction:column;align-items:stretch}.fm-finance-tabs{overflow-x:auto}.fm-finance-filters{align-items:stretch;flex-direction:column}.finance-filter,.fm-finance-filters input.finance-filter{min-width:0;width:100%}}
      `}</style>
    </div>
  );
}
