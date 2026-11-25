import { useRecordPage } from '../../components/useRecordPage';
import Pagination from '../../components/Pagination';
import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useDispatch, useSelector } from 'react-redux';
import { setCompletedSearch } from '../../redux/businessClientSlice';
import { Link, useSearchParams } from 'react-router-dom';
import { useGetDeliveriesQuery } from '../../redux/businessClientApi';
import { formatDate } from './bcUtils';
import { formatDeliveryPrice } from '../../utils/deliveryPricing';

export default function BcCompletedDeliveries() {
  usePageStyleScope('bc-completed-deliveries');
  const [params] = useSearchParams();
  const dispatch = useDispatch();
  const { search } = useSelector((state) => state.businessClient.completed);
  const setSearch = (value) => dispatch(setCompletedSearch(value));
  const pages = useRecordPage(useGetDeliveriesQuery,{view:'completed',search});
  const summary = pages.query.currentData?.summary || {total:0,week:0,month:0};
  const status = pages.query.isLoading ? 'loading' : pages.query.isError ? 'error' : 'ok';
  const pageDeliveries = pages.pageItems;
  return (
    <>
      <h1 className="page-title small">Completed Deliveries</h1>
      <p className="page-subtitle">
        {status === 'loading' ? 'Loading completed deliveries...' : `${summary.total} completed deliveries`}
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
          <div className="stat-label">Last 7 days</div>
          <div className="stat-value" style={{ fontSize: 42 }}>
            {summary.week}
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
          <div className="stat-label">Last 30 days</div>
          <div className="stat-value" style={{ fontSize: 42 }}>
            {summary.month}
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
              <th>Price</th>
              <th>Invoice</th>
              <th>Feedback</th>
            </tr>
          </thead>

          <tbody>
            {status === 'loading' && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: '#8f8f8f', padding: 24 }}>
                  Loading completed deliveries...
                </td>
              </tr>
            )}

            {status === 'error' && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: '#ff8d8d', padding: 24 }}>
                  Could not load completed deliveries.
                </td>
              </tr>
            )}

            {status === 'ok' && pageDeliveries.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: '#8f8f8f', padding: 24 }}>
                  {search.trim() ? 'No deliveries match your search.' : 'No completed deliveries found.'}
                </td>
              </tr>
            )}

            {status === 'ok' &&
              pageDeliveries.map((delivery) => {
                const id = delivery.id || '--';
                const date = formatDate(delivery.completionDate || delivery.requestTime);
                const driver = delivery.driver || '--';
                const pickup = delivery.pickup || '--';
                const dropoff = delivery.dropoff || delivery.destination || '--';
                const statusText = delivery.status || 'Status unavailable';
                const invoiceLink = delivery.invoiceId
                  ? `/business-client/invoice-view?deliveryId=${encodeURIComponent(id)}&id=${encodeURIComponent(delivery.invoiceId)}&from=completed`
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
                    <td>{formatDeliveryPrice(delivery)}</td>
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

        {status === 'ok' && <Pagination {...pages} onPageChange={pages.setPage} itemLabel="deliveries" />}
      </div>
    </>
  );
}
