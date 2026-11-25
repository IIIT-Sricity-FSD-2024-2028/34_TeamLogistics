import { useRecordPage } from '../../components/useRecordPage';
import ReceiptDownload from '../../components/ReceiptDownload';
import { useDispatch, useSelector } from 'react-redux';
import { setTransactionFilters } from '../../redux/businessClientSlice';
import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { Link } from 'react-router-dom';
import { useGetInvoicesQuery, useGetPaymentsQuery } from '../../redux/businessClientApi';
import { normalize, cleanId, formatDate } from './bcUtils';
import RowActionMenu from '../../components/RowActionMenu';
import Pagination from '../../components/Pagination';

const PAID = ['paid', 'completed', 'approved', 'payment received', 'received'];
const REVIEW = ['pending', 'under review', 'review'];

function invoiceId(item) {
  return item.id || item.invoiceId || item.invoiceNo || item.invoiceNumber || '--';
}

function amount(item) {
  return Number(item.totalAmount || item.total || item.amount || item.baseCost || 0);
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
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
  usePageStyleScope('bc-invoices');
  const dispatch = useDispatch();
  const { search, tab, statusFilter } = useSelector((state) => state.businessClient.transactions);
  const setSearch = (search) => dispatch(setTransactionFilters({ search }));
  const setTab = (tab) => dispatch(setTransactionFilters({ tab }));
  const setStatusFilter = (statusFilter) => dispatch(setTransactionFilters({ statusFilter }));
  const invoicePages = useRecordPage(useGetInvoicesQuery, {search: tab === 'invoices' ? search : '', status: tab === 'invoices' ? statusFilter : ''});
  const paymentPages = useRecordPage(useGetPaymentsQuery, {search: tab === 'payments' ? search : '', status: tab === 'payments' ? statusFilter : ''});
  const loading = invoicePages.query.isLoading || paymentPages.query.isLoading;
  const failed = invoicePages.query.isError || paymentPages.query.isError;
  const empty = {count:0,amount:0};
  const summary = invoicePages.query.currentData?.summary || {count:0,open:empty,review:empty,paid:empty};
  const paymentCount = paymentPages.query.currentData?.summary?.count || 0;
  const statusOptions = (tab === 'invoices' ? invoicePages : paymentPages).options.status || [];

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
        {summary.open.count > 0 && (
          <Link className="primary-action" to={`/business-client/submit-transaction?invoiceId=${encodeURIComponent(summary.firstOpenId)}`}>
            Submit payment proof
          </Link>
        )}
      </div>

      <section className="finance-stats" aria-label="Billing summary">
        <article className="finance-stat accent"><span>Amount due</span><strong>{money(summary.open.amount)}</strong><small>{summary.open.count} open invoice{summary.open.count === 1 ? '' : 's'}</small></article>
        <article className="finance-stat"><span>Under review</span><strong>{money(summary.review.amount)}</strong><small>{summary.review.count} payment{summary.review.count === 1 ? '' : 's'} being verified</small></article>
        <article className="finance-stat"><span>Paid to date</span><strong>{money(summary.paid.amount)}</strong><small>{summary.paid.count} settled invoice{summary.paid.count === 1 ? '' : 's'}</small></article>
        <article className="finance-stat"><span>Total invoices</span><strong>{summary.count}</strong><small>Complete billing history</small></article>
      </section>

      <section className="finance-panel">
        <div className="finance-toolbar">
          <div className="finance-tabs" role="tablist">
            <button className={tab === 'invoices' ? 'active' : ''} onClick={() => selectTab('invoices')}>Invoices <b>{summary.count}</b></button>
            <button className={tab === 'payments' ? 'active' : ''} onClick={() => selectTab('payments')}>Payment history <b>{paymentCount}</b></button>
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
                {(loading || failed || invoicePages.totalItems === 0) && <tr><td colSpan={6} className="empty">{loading ? 'Loading billing records…' : failed ? 'Billing records could not be loaded.' : 'No invoices match your search.'}</td></tr>}
                {!loading && !failed && invoicePages.pageItems.map((item) => {
                  const id = invoiceId(item);
                  const deliveryId = item.deliveryId || item.delivery || '--';
                  const waiting = isReview(item);
                  const payable = !isPaid(item) && !waiting && !['reversed','refunded','cancelled','partially refunded'].includes(normalize(statusOf(item)));
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
                {(loading || failed || paymentPages.totalItems === 0) && <tr><td colSpan={7} className="empty">{loading ? 'Loading payment history…' : failed ? 'Payment history could not be loaded.' : 'No payments match your search.'}</td></tr>}
                {!loading && !failed && paymentPages.pageItems.map((item) => (
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
                        <ReceiptDownload className="row-action-item" payment={item} />
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
        {!loading && !failed && (tab === 'invoices'
          ? <Pagination {...invoicePages} onPageChange={invoicePages.setPage} itemLabel="invoices" />
          : <Pagination {...paymentPages} onPageChange={paymentPages.setPage} itemLabel="payments" />)}
      </section>

    </div>
  );
}
