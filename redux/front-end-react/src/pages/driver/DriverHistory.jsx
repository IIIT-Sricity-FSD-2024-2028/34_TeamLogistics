import { useRecordPage } from '../../components/useRecordPage';
import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useGetTripsQuery, queryError } from '../../redux/driverApi';
import { setHistorySearch } from '../../redux/driverSlice';
import { usePageHeader } from '../../hooks/usePageHeader';
import Pagination from '../../components/Pagination';

function formatDateTime(value) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}



export default function DriverHistory() {
  usePageStyleScope('driver-history');
  usePageHeader('History', 'Completed orders and issue reports');
  const navigate = useNavigate();

  const dispatch = useDispatch();
  const { search } = useSelector((state) => state.driver.history);
  const setSearch = (value) => dispatch(setHistorySearch(value));
  const history = useRecordPage(useGetTripsQuery, {view: 'history', search});
  const issuePages = useRecordPage(useGetTripsQuery, {view: 'issues'});
  const loading = history.query.isLoading || issuePages.query.isLoading;
  const loadError = queryError(history.query, issuePages.query);
  const pageRows = history.pageItems.map(trip => {
      const delivery = trip.delivery;
      const requestId = trip.request || trip.deliveryId || trip.deliveryRequestId || 'N/A';
      const customer = trip.customer || trip.client || delivery?.customer || delivery?.client || 'Customer not available';
      const pickup = trip.pickup || delivery?.pickup || 'Pickup not available';
      const drop = trip.destination || trip.dropoff || delivery?.dropoff || delivery?.destination || 'Drop not available';
      const status = trip.status || delivery?.status || 'Status unavailable';
      const time = trip.completedAt || trip.updatedAt || trip.issueReportedAt || trip.createdAt || 'Recently';
      const feedback = trip.feedback || delivery?.feedback;
      return { trip, requestId, customer, pickup, drop, status, time, feedback };
  });

  if (loadError) return <section className="content" role="alert">{loadError}</section>;
  if (loading) return <section className="content">Loading...</section>;

  return (
    <section className="content">
      <div className="history-grid">
        <div className="history-card">
          <div className="card-head">
            <div>
              <h2>Order History</h2>
              <p>Delivered and returned parcels</p>
            </div>
            <span className="count-pill">{history.totalItems}</span>
          </div>

          <div className="driver-history-filters">
            <input
              className="driver-filter-control driver-filter-search"
              placeholder="Search trip or delivery ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
            />
          </div>

          <div className="timeline-list">
            {pageRows.length === 0 ? (
              <div className="empty-state">{search.trim() ? 'No orders match your search.' : 'No completed orders found.'}</div>
            ) : (
              pageRows.map((r) => (
                <div className="timeline-item" key={r.trip.id}>
                  <div className="timeline-dot" />
                  <div className="timeline-title">Order {r.status}</div>
                  <div className="timeline-meta">
                    <strong>{r.trip.id}</strong> → {r.requestId}
                    <br />
                    {r.customer}
                    <br />
                    {r.pickup} → {r.drop}
                  </div>
                  <div className="timeline-time">{formatDateTime(r.time)}</div>
                  {r.feedback && (
                    <div style={{ marginTop: 9, color: '#ffd400', fontWeight: 800 }}>
                      Customer rating: ★ {r.feedback.rating}/5
                      {r.feedback.comment && <span style={{ display: 'block', color: '#b9b9b9', fontWeight: 500, marginTop: 4 }}>{r.feedback.comment}</span>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <Pagination {...history} onPageChange={history.setPage} itemLabel="orders" />
        </div>

        <div className="history-card">
          <div className="card-head">
            <div>
              <h2>Issue Reports</h2>
              <p>Issues reported by the driver</p>
            </div>
            <button className="small-btn" onClick={() => navigate('/driver/report-issue')}>
              New Issue
            </button>
          </div>

          <div className="issue-list">
            {issuePages.totalItems === 0 ? (
              <div className="empty-state">No issue reports found.</div>
            ) : (
              issuePages.pageItems.map((trip) => {
                const delivery = trip.delivery;
                const requestId = trip.request || trip.deliveryId || trip.deliveryRequestId || 'N/A';
                const issueType = trip.issueType || delivery?.issueType || 'Issue Reported';
                const description = trip.issueDescription || delivery?.issueDescription || 'No issue description available.';
                const reportedAt = trip.issueReportedAt || delivery?.issueReportedAt || trip.updatedAt || 'Recently';

                return (
                  <div className="issue-card" key={trip.id}>
                    <div className="issue-top">
                      <div>
                        <div className="issue-title">{issueType}</div>
                        <div className="issue-meta">
                          {trip.id} → {requestId}
                        </div>
                      </div>
                      <div className="issue-id">{requestId}</div>
                    </div>
                    <div className="issue-desc">{description}</div>
                    <div className="issue-meta">
                      {formatDateTime(reportedAt)} • {trip.status || 'Issue Reported'}
                    </div>
                    <div className="issue-actions">
                      <button className="view-btn" onClick={() => navigate(`/driver/task-details?id=${encodeURIComponent(trip.id)}`)}>
                        View
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <Pagination {...issuePages} onPageChange={issuePages.setPage} itemLabel="issues" />
        </div>
      </div>

    </section>
  );
}
