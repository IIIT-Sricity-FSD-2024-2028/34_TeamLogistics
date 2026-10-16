import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Transactions } from '../../api/namespaces';
import { getArray, normalize, cleanId, formatDate, resolveClientName, belongsToClient } from './bcUtils';
import { useLiveSync } from '../../hooks/useLiveSync';
import { matchesFilter, matchesSearchFields, uniqueFilterOptions } from '../../utils/search';
import RowActionMenu from '../../components/RowActionMenu';

const PAID = ['paid', 'completed', 'approved', 'payment received', 'received'];
const REVIEW = ['pending', 'under review', 'review'];

function invoiceId(item) {
  return item.id || item.invoiceId || item.invoiceNo || item.invoiceNumber || '--';
}

function amount(item) {
  return Number(item.totalAmount || item.total || item.amount || item.baseCost || 0);
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function statusOf(item) {
  return item.status || item.paymentStatus || 'Unpaid';
}

function statusTone(status) {
  const value = normalize(status);
  if (PAID.includes(value)) return 'good';
  if (REVIEW.includes(value)) return 'review';
  if (value === 'overdue' || value === 'rejected' || value === 'failed') return 'danger';
  return 'open';
}

function isPaid(item) {
  return PAID.includes(normalize(statusOf(item)));
}

function isReview(item) {
  return REVIEW.includes(normalize(statusOf(item)));
}

export default function BcInvoices() {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('invoices');
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    try {
      const [{ clientName }, invoiceResult, paymentResult] = await Promise.all([
        resolveClientName(),
        Transactions.getInvoices(),
        Transactions.getPayments(),
      ]);
      const mine = getArray(invoiceResult)
        .filter((item) => belongsToClient(item.client || item.customer || item.billedTo, clientName))
        .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
      setInvoices(mine);
      setPayments(
        getArray(paymentResult).sort(
          (a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0),
        ),
      );
      setFailed(false);
    } catch (error) {
      console.error('Billing sync failed:', error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);
  useLiveSync(() => load());

  const pendingInvoiceIds = useMemo(
    () => new Set(payments.filter(isReview).map((item) => String(item.invoiceId || item.invoice || ''))),
    [payments],
  );
  const outstanding = invoices.filter((item) => !isPaid(item) && !isReview(item));
  const underReview = invoices.filter(isReview);
  const paid = invoices.filter(isPaid);
  const visibleInvoices = invoices.filter((item) => matchesSearchFields(search, [
    invoiceId(item),
    item.deliveryId || item.delivery,
  ]) && matchesFilter(statusOf(item), statusFilter));
  const visiblePayments = payments.filter((item) => matchesSearchFields(search, [
    item.id || item.transactionId,
    item.invoiceId || item.invoice,
  ]) && matchesFilter(statusOf(item), statusFilter));
  const statusOptions = tab === 'invoices'
    ? uniqueFilterOptions(invoices, statusOf)
    : uniqueFilterOptions(payments, statusOf);

  function selectTab(nextTab) {
    setTab(nextTab);
    setSearch('');
    setStatusFilter('');
  }

  function downloadInvoice(item) {
    const id = cleanId(invoiceId(item));
    const text = [
      'DeliverSync Invoice',
      `Invoice: ${id}`,
      `Delivery: ${cleanId(item.deliveryId || '--')}`,
      `Issued: ${formatDate(item.invoiceDate || item.date || item.createdAt)}`,
      `Due: ${formatDate(item.dueDate)}`,
      `Amount: ${money(amount(item))}`,
      `Status: ${statusOf(item)}`,
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${id}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bc-finance">
      <div className="finance-hero">
        <div>
          <span className="eyebrow">Post-paid billing</span>
          <h1>Transactions</h1>
          <p>Review invoices, submit payment proof, and track verification in one place.</p>
        </div>
        {outstanding.length > 0 && (
          <Link className="primary-action" to={`/business-client/submit-transaction?invoiceId=${encodeURIComponent(invoiceId(outstanding[0]))}`}>
            Submit payment proof
          </Link>
        )}
      </div>

      <section className="finance-stats" aria-label="Billing summary">
        <article className="finance-stat accent"><span>Amount due</span><strong>{money(outstanding.reduce((sum, item) => sum + amount(item), 0))}</strong><small>{outstanding.length} open invoice{outstanding.length === 1 ? '' : 's'}</small></article>
        <article className="finance-stat"><span>Under review</span><strong>{money(underReview.reduce((sum, item) => sum + amount(item), 0))}</strong><small>{underReview.length} payment{underReview.length === 1 ? '' : 's'} being verified</small></article>
        <article className="finance-stat"><span>Paid to date</span><strong>{money(paid.reduce((sum, item) => sum + amount(item), 0))}</strong><small>{paid.length} settled invoice{paid.length === 1 ? '' : 's'}</small></article>
        <article className="finance-stat"><span>Total invoices</span><strong>{invoices.length}</strong><small>Complete billing history</small></article>
      </section>

      <section className="finance-panel">
        <div className="finance-toolbar">
          <div className="finance-tabs" role="tablist">
            <button className={tab === 'invoices' ? 'active' : ''} onClick={() => selectTab('invoices')}>Invoices <b>{invoices.length}</b></button>
            <button className={tab === 'payments' ? 'active' : ''} onClick={() => selectTab('payments')}>Payment history <b>{payments.length}</b></button>
          </div>
          <label className="finance-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tab === 'invoices' ? 'Search invoice or delivery ID…' : 'Search transaction or invoice ID…'}
            />
          </label>
          <select className="finance-status-filter" aria-label="Filter billing records by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>

        <div className="finance-table-wrap">
          {tab === 'invoices' ? (
            <table className="finance-table">
              <thead><tr><th>Invoice</th><th>Delivery</th><th>Issued / due</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {(loading || failed || visibleInvoices.length === 0) && <tr><td colSpan={6} className="empty">{loading ? 'Loading billing records…' : failed ? 'Billing records could not be loaded.' : 'No invoices match your search.'}</td></tr>}
                {!loading && !failed && visibleInvoices.map((item) => {
                  const id = invoiceId(item);
                  const deliveryId = item.deliveryId || item.delivery || '--';
                  const waiting = isReview(item) || pendingInvoiceIds.has(String(id));
                  const payable = !isPaid(item) && !waiting;
                  return (
                    <tr key={id}>
                      <td><strong>#{cleanId(id)}</strong><small>{item.client || item.customer || ''}</small></td>
                      <td>{cleanId(deliveryId)}</td>
                      <td><span>{formatDate(item.invoiceDate || item.date || item.createdAt)}</span><small>Due {formatDate(item.dueDate)}</small></td>
                      <td className="money">{money(amount(item))}</td>
                      <td><span className={`finance-status ${statusTone(statusOf(item))}`}>{statusOf(item)}</span></td>
                      <td><RowActionMenu label={`Open actions for invoice ${cleanId(id)}`}>
                        <Link className="row-action-item" to={`/business-client/invoice-view?id=${encodeURIComponent(cleanId(id))}&deliveryId=${encodeURIComponent(cleanId(deliveryId))}&from=transactions`}>View invoice</Link>
                        {payable && <Link className="row-action-item" to={`/business-client/submit-transaction?invoiceId=${encodeURIComponent(cleanId(id))}`}>Pay invoice</Link>}
                        <button className="row-action-item" onClick={() => downloadInvoice(item)}>Download invoice</button>
                      </RowActionMenu></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="finance-table">
              <thead><tr><th>Transaction</th><th>Invoice</th><th>Date</th><th>Method / reference</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {(loading || failed || visiblePayments.length === 0) && <tr><td colSpan={7} className="empty">{loading ? 'Loading payment history…' : failed ? 'Payment history could not be loaded.' : 'No payments match your search.'}</td></tr>}
                {!loading && !failed && visiblePayments.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.id}</strong></td>
                    <td>{item.invoiceId || '--'}</td>
                    <td>{formatDate(item.date || item.createdAt)}</td>
                    <td><span>{item.paymentMode || 'Payment'}</span><small>{item.reference || 'No reference'}</small></td>
                    <td className="money">{money(item.amount)}</td>
                    <td><span className={`finance-status ${statusTone(statusOf(item))}`}>{statusOf(item)}</span></td>
                    <td><RowActionMenu label={`Open actions for transaction ${item.id}`}>
                      {(item.invoiceId || item.invoice) && (
                        <Link className="row-action-item" to={`/business-client/invoice-view?id=${encodeURIComponent(cleanId(item.invoiceId || item.invoice))}&from=transactions`}>View invoice</Link>
                      )}
                      {item.receiptUrl ? (
                        <a className="row-action-item" href={item.receiptUrl} target="_blank" rel="noopener noreferrer">View receipt</a>
                      ) : (
                        <span className="row-action-item disabled">No receipt attached</span>
                      )}
                    </RowActionMenu></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <style>{`
        .bc-finance{color:#fff}.finance-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:26px}.finance-hero h1{font-size:38px;line-height:1;margin:8px 0 10px}.finance-hero p{margin:0;color:#9ca3af}.eyebrow{color:#ffd400;text-transform:uppercase;font-size:12px;font-weight:900;letter-spacing:.16em}.primary-action{background:#ffd400;color:#080808;text-decoration:none;font-weight:900;padding:13px 18px;border-radius:12px;white-space:nowrap}.finance-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:22px}.finance-stat{background:linear-gradient(145deg,#1d1d1d,#111);border:1px solid #2c2c2c;border-radius:18px;padding:20px;min-height:128px}.finance-stat.accent{background:#ffd400;color:#080808;border-color:#ffd400}.finance-stat span,.finance-stat small{display:block;color:#9ca3af;font-weight:700}.finance-stat.accent span,.finance-stat.accent small{color:#3f3a10}.finance-stat span{font-size:12px;text-transform:uppercase;letter-spacing:.09em}.finance-stat strong{display:block;font-size:30px;margin:15px 0 9px;letter-spacing:-.03em}.finance-panel{background:#121212;border:1px solid #292929;border-radius:20px;overflow:hidden}.finance-toolbar{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:18px 20px;border-bottom:1px solid #292929;flex-wrap:wrap}.finance-tabs{display:flex;gap:6px;margin-right:auto}.finance-tabs button{border:0;background:transparent;color:#9ca3af;border-radius:10px;padding:10px 13px;font-weight:800;cursor:pointer}.finance-tabs button.active{background:#292929;color:#fff}.finance-tabs b{margin-left:6px;background:#383838;border-radius:20px;padding:2px 7px;font-size:11px}.finance-tabs .active b{background:#ffd400;color:#111}.finance-search{display:flex;align-items:center;gap:8px;background:#090909;border:1px solid #303030;border-radius:11px;padding:9px 12px;min-width:290px}.finance-search input{background:transparent;border:0;outline:0;color:#fff;width:100%;font-weight:650}.finance-status-filter{height:40px;min-width:160px;border:1px solid #303030;border-radius:11px;background:#090909;color:#fff;padding:0 12px}.finance-table-wrap{overflow-x:auto}.finance-table{width:100%;border-collapse:collapse;min-width:900px}.finance-table th{padding:14px 20px;text-align:left;color:#8e95a3;font-size:12px;text-transform:uppercase;letter-spacing:.06em}.finance-table td{padding:17px 20px;border-top:1px solid #242424;font-size:14px}.finance-table td small{display:block;color:#858b96;margin-top:5px}.finance-table .money{font-size:15px;font-weight:900}.finance-status{display:inline-flex;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900;text-transform:capitalize}.finance-status.good{color:#86efac;background:#113222}.finance-status.review{color:#fde047;background:#352f0d}.finance-status.danger{color:#fca5a5;background:#3b1717}.finance-status.open{color:#bfdbfe;background:#172a43}.empty{text-align:center;color:#9ca3af;padding:36px!important}@media(max-width:1050px){.finance-stats{grid-template-columns:repeat(2,1fr)}}@media(max-width:720px){.finance-hero,.finance-toolbar{align-items:stretch;flex-direction:column}.finance-stats{grid-template-columns:1fr}.finance-search{min-width:0}.finance-tabs{overflow-x:auto;margin-right:0}.finance-status-filter{width:100%}}
      `}</style>
    </div>
  );
}
