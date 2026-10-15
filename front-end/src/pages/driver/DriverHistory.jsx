import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trips, Deliveries } from '../../api/namespaces';
import { useSession } from '../../auth/SessionContext';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useLiveSync } from '../../hooks/useLiveSync';
import { matchesSearchFields } from '../../utils/search';

function normalize(v) {
  return String(v || '').trim().toLowerCase();
}

function formatDateTime(value) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const PAGE_SIZE = 8;

export default function DriverHistory() {
  usePageHeader('History', 'Completed orders and issue reports');
  const { session } = useSession();
  const navigate = useNavigate();
  const driverName = session?.name || '';

  const [trips, setTrips] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  async function load({ background = false } = {}) {
    if (!background) setLoading(true);
    try {
      const [t, d] = await Promise.all([Trips.getAll(), Deliveries.getAll()]);
      setTrips(t || []);
      setDeliveries(d || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);
  useLiveSync(load);

  function getDeliveryForTrip(trip) {
    const requestId = trip.request || trip.deliveryId || trip.deliveryRequestId;
    return deliveries.find((d) => String(d.id) === String(requestId)) || deliveries.find((d) => String(d.deliveryId) === String(requestId)) || null;
  }

  const completedRows = useMemo(() => {
    const completedTrips = trips.filter((trip) => normalize(trip.driver || trip.assignedDriver || trip.driverName) === normalize(driverName) && ['completed', 'delivered'].includes(normalize(trip.status)));
    return completedTrips.map((trip) => {
      const delivery = getDeliveryForTrip(trip);
      const requestId = trip.request || trip.deliveryId || trip.deliveryRequestId || 'N/A';
      const customer = trip.customer || trip.client || delivery?.customer || delivery?.client || 'Customer not available';
      const pickup = trip.pickup || delivery?.pickup || 'Pickup not available';
      const drop = trip.destination || trip.dropoff || delivery?.dropoff || delivery?.destination || 'Drop not available';
      const status = trip.status || delivery?.status || 'Status unavailable';
      const time = trip.completedAt || trip.updatedAt || trip.issueReportedAt || trip.createdAt || 'Recently';
      const feedback = trip.feedback || delivery?.feedback;
      return { trip, requestId, customer, pickup, drop, status, time, feedback };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, [trips, deliveries, driverName]);

  const filteredRows = useMemo(() => {
    return completedRows.filter((row) => matchesSearchFields(search, [
      row.trip.id,
      row.requestId,
    ]));
  }, [completedRows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const issueTrips = useMemo(
    () =>
      trips.filter((trip) => normalize(trip.driver || trip.assignedDriver || trip.driverName) === normalize(driverName) && (normalize(trip.status).includes('issue') || trip.issueType || trip.issueDescription)),
    [trips, driverName],
  );

  if (loading) return <section className="content">Loading...</section>;

  return (
    <section className="content">
      <div className="history-grid">
        <div className="history-card">
          <div className="card-head">
            <div>
              <h2>Order History</h2>
              <p>Completed and delivered trips</p>
            </div>
            <span className="count-pill">{completedRows.length}</span>
          </div>

          <div className="driver-history-filters">
            <input
              className="driver-filter-control driver-filter-search"
              placeholder="Search trip or delivery ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
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

          {pageRows.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 14 }}>
              <span style={{ color: '#9ca3af', fontSize: 12 }}>
                Showing {pageRows.length} of {filteredRows.length}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  disabled={currentPage <= 1}
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #262626', background: '#111', color: '#fff', cursor: 'pointer' }}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <span style={{ color: '#9ca3af', fontSize: 12, alignSelf: 'center' }}>
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
            {issueTrips.length === 0 ? (
              <div className="empty-state">No issue reports found.</div>
            ) : (
              issueTrips.map((trip) => {
                const delivery = getDeliveryForTrip(trip);
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
        </div>
      </div>

      <style>{`
        .history-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .history-card { background: linear-gradient(135deg, #1f1f1f, #111); border: 1px solid #262626; border-radius: 20px; padding: 22px; color: #fff; box-shadow: 0 18px 40px rgba(0,0,0,.25); min-height: 260px; }
        .card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 18px; }
        .card-head h2 { margin: 0; font-size: 24px; font-weight: 900; }
        .card-head p { margin: 6px 0 0; color: #9ca3af; font-size: 13px; }
        .count-pill, .small-btn { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: #ffd400; color: #000; font-weight: 900; padding: 8px 14px; text-decoration: none; border: none; white-space: nowrap; cursor: pointer; font: inherit; }
        .timeline-list { display: flex; flex-direction: column; gap: 14px; }
        .timeline-item { position: relative; display: block; padding: 16px 16px 16px 42px; background: #0b0b0b; border: 1px solid #262626; border-radius: 16px; min-height: 110px; }
        .timeline-dot { position: absolute; left: 16px; top: 20px; width: 14px; height: 14px; border-radius: 999px; background: #ffd400; box-shadow: 0 0 0 4px rgba(255,212,0,.12); }
        .timeline-title { margin: 0 0 6px; font-size: 16px; font-weight: 900; line-height: 1.35; }
        .timeline-meta { color: #9ca3af; font-size: 13px; line-height: 1.6; }
        .timeline-time { margin-top: 10px; color: #ffd400; font-size: 12px; font-weight: 900; line-height: 1.4; }
        .issue-list { display: flex; flex-direction: column; gap: 14px; }
        .issue-card { background: #0b0b0b; border: 1px solid #262626; border-radius: 16px; padding: 16px; }
        .issue-top { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; margin-bottom: 10px; }
        .issue-title { font-weight: 900; font-size: 16px; }
        .issue-id { background: rgba(255,212,0,.15); color: #ffd400; border: 1px solid rgba(255,212,0,.35); padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 900; white-space: nowrap; }
        .issue-desc { color: #d1d5db; font-size: 14px; line-height: 1.5; margin-bottom: 10px; }
        .issue-meta { color: #9ca3af; font-size: 12px; }
        .issue-actions { margin-top: 14px; display: flex; gap: 10px; justify-content: flex-end; }
        .view-btn { border: 1px solid #262626; background: #111; color: #fff; padding: 9px 14px; border-radius: 12px; font-weight: 900; text-decoration: none; cursor: pointer; font: inherit; }
        .empty-state { background: #0b0b0b; border: 1px dashed #333; border-radius: 16px; padding: 22px; color: #9ca3af; text-align: center; font-weight: 700; }
        @media (max-width: 1000px) { .history-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
