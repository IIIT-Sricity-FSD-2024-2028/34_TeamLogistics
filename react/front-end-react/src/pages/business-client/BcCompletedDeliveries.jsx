import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Deliveries, Trips, Transactions } from '../../api/namespaces';
import { getArray, normalize, formatDate, resolveClientName, belongsToClient } from './bcUtils';
import { useLiveSync } from '../../hooks/useLiveSync';
import { matchesSearchFields } from '../../utils/search';

function isCompleted(item) {
  const status = normalize(item.status);
  return status === 'delivered' || status === 'completed' || status.includes('delivered') || status.includes('completed');
}

function getLinkedTrip(delivery, trips) {
  return (
    trips.find((t) => String(t.request) === String(delivery.id)) ||
    trips.find((t) => String(t.deliveryId) === String(delivery.id)) ||
    trips.find((t) => String(t.delivery_id) === String(delivery.id)) ||
    trips.find((t) => String(t.requestId) === String(delivery.id)) ||
    trips.find((t) => String(t.deliveryRequestId) === String(delivery.id)) ||
    null
  );
}

function getLinkedInvoice(delivery, invoices) {
  return (
    invoices.find((inv) => String(inv.deliveryId) === String(delivery.id)) ||
    invoices.find((inv) => String(inv.request) === String(delivery.id)) ||
    invoices.find((inv) => String(inv.deliveryRequestId) === String(delivery.id)) ||
    null
  );
}

const PAGE_SIZE = 8;

export default function BcCompletedDeliveries() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [completedDeliveries, setCompletedDeliveries] = useState([]);
  const [trips, setTrips] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  async function load() {
    try {
      const { clientName } = await resolveClientName();
      const [deliveriesResult, tripsResult, invoicesResult] = await Promise.all([
        Deliveries.getAll(),
        Trips.getAll(),
        Transactions.getInvoices().catch((error) => {
          console.warn('Invoices could not be loaded:', error);
          return [];
        }),
      ]);
      const deliveries = getArray(deliveriesResult);
      const completed = deliveries
        .filter((d) => belongsToClient(d.customer || d.client || d.company, clientName))
        .filter(isCompleted)
        .sort((a, b) => new Date(b.requestTime || b.createdAt || 0).getTime() - new Date(a.requestTime || a.createdAt || 0).getTime());
      setCompletedDeliveries(completed);
      setTrips(getArray(tripsResult));
      setInvoices(getArray(invoicesResult));
      setStatus('ok');
    } catch (error) {
      console.error('Completed deliveries backend sync failed:', error);
      setStatus('error');
    }
  }

  useEffect(() => {
    load();
  }, []);
  useLiveSync(load);

  const filtered = completedDeliveries.filter((delivery) => {
    const trip = getLinkedTrip(delivery, trips);
    return matchesSearchFields(search, [
      delivery.id,
      delivery.deliveryId,
      trip?.id,
    ]);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageDeliveries = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <h1 className="page-title small">Completed Deliveries</h1>
      <p className="page-subtitle">
        {status === 'loading' ? 'Loading completed deliveries...' : `${completedDeliveries.length} most recent deliveries`}
      </p>

      {params.get('feedback') === 'submitted' && (
        <div className="feedback-confirmation" role="status">
          Feedback submitted. The assigned driver, their fleet manager, and operations team can now review it.
        </div>
      )}

      <div className="stats-row">
        <div className="card" style={{ padding: 24 }}>
          <div className="icon-badge">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M8 12l2.5 2.5L16 9"></path>
            </svg>
          </div>
          <div className="stat-label">This Week</div>
          <div className="stat-value" style={{ fontSize: 42 }}>
            {status === 'ok' ? completedDeliveries.length : 0}
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div className="icon-badge">
            <svg viewBox="0 0 24 24">
              <path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1V3z"></path>
              <path d="M9 8h6"></path>
              <path d="M9 12h6"></path>
            </svg>
          </div>
          <div className="stat-label">This Month</div>
          <div className="stat-value" style={{ fontSize: 42 }}>
            {status === 'ok' ? completedDeliveries.length : 0}
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span>Recent Completions</span>
          <div className="bc-filter-bar">
            <input
              className="bc-filter-control bc-filter-search"
              placeholder="Search delivery or trip ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Delivery ID</th>
              <th>Date</th>
              <th>Driver</th>
              <th>Route</th>
              <th>Status</th>
              <th>Invoice</th>
              <th>Feedback</th>
            </tr>
          </thead>

          <tbody>
            {status === 'loading' && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#8f8f8f', padding: 24 }}>
                  Loading completed deliveries...
                </td>
              </tr>
            )}

            {status === 'error' && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#ff8d8d', padding: 24 }}>
                  Could not load completed deliveries.
                </td>
              </tr>
            )}

            {status === 'ok' && pageDeliveries.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#8f8f8f', padding: 24 }}>
                  {search.trim() ? 'No deliveries match your search.' : 'No completed deliveries found.'}
                </td>
              </tr>
            )}

            {status === 'ok' &&
              pageDeliveries.map((delivery) => {
                const trip = getLinkedTrip(delivery, trips);
                const invoice = getLinkedInvoice(delivery, invoices);
                const id = delivery.id || '--';
                const date = formatDate(delivery.requestTime || delivery.createdAt);
                const driver = trip?.driver || delivery.driver || '--';
                const pickup = delivery.pickup || trip?.pickup || '--';
                const dropoff = delivery.dropoff || delivery.destination || trip?.destination || '--';
                const statusText = delivery.status || trip?.status || 'Status unavailable';
                const invoiceLink = invoice
                  ? `/business-client/invoice-view?deliveryId=${encodeURIComponent(id)}&id=${encodeURIComponent(invoice.id)}&from=completed`
                  : `/business-client/invoice-view?deliveryId=${encodeURIComponent(id)}&from=completed`;

                return (
                  <tr key={id}>
                    <td>#{id}</td>
                    <td>{date}</td>
                    <td>{driver}</td>
                    <td>
                      {pickup} → {dropoff}
                    </td>
                    <td>
                      <span className="pill yellow">{statusText}</span>
                    </td>
                    <td>
                      <Link className="btn sm outline-yellow" to={invoiceLink}>
                        <svg viewBox="0 0 24 24">
                          <path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1V3z"></path>
                          <path d="M9 8h6"></path>
                          <path d="M9 12h6"></path>
                        </svg>
                        View
                      </Link>
                    </td>
                    <td>
                      {delivery.feedback ? (
                        <Link className="feedback-link" to={`/business-client/feedback?id=${encodeURIComponent(id)}`}>
                          <span className="feedback-submitted">★ {delivery.feedback.rating}/5 · View feedback</span>
                        </Link>
                      ) : (
                        <Link className="btn sm yellow" to={`/business-client/feedback?id=${encodeURIComponent(id)}`}>
                          Provide Feedback
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {status === 'ok' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 14, padding: '0 16px 16px' }}>
            <span style={{ color: '#8f8f8f', fontSize: 12 }}>
              Showing {pageDeliveries.length} of {filtered.length}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={currentPage <= 1}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #262626', background: '#111', color: '#fff', cursor: 'pointer' }}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span style={{ color: '#8f8f8f', fontSize: 12, alignSelf: 'center' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #262626', background: '#111', color: '#fff', cursor: 'pointer' }}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`
        .feedback-confirmation{margin:0 0 18px;padding:13px 16px;border:1px solid #1f9d68;border-radius:12px;background:rgba(16,185,129,.12);color:#d1fae5;font-weight:800}
        .feedback-link{color:#ffd400;text-decoration:none}.feedback-link:hover{text-decoration:underline}
      `}</style>
    </>
  );
}
