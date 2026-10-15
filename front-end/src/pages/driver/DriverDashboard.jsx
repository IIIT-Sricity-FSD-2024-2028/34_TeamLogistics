import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trips, Deliveries } from '../../api/namespaces';
import { useSession } from '../../auth/SessionContext';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useLiveSync } from '../../hooks/useLiveSync';
import { matchesFilter, matchesSearchFields, uniqueFilterOptions } from '../../utils/search';
import { isPendingTrip, isInProgressTrip, isCompletedTrip, isOpenTrip } from './tripStatus';

function normalize(v) {
  return String(v || '').trim().toLowerCase();
}

export default function DriverDashboard() {
  const { session } = useSession();
  const navigate = useNavigate();
  const driverName = session?.name || '';
  usePageHeader(`Hello, ${driverName.split(' ')[0] || 'Driver'}`, "Ready for today's deliveries");

  const [allTrips, setAllTrips] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const requestVersion = useRef(0);

  async function load({ background = false } = {}) {
    const version = ++requestVersion.current;
    if (!background) setLoading(true);
    setError('');
    try {
      const [trips, dels] = await Promise.all([Trips.getAll(), Deliveries.getAll()]);
      if (version !== requestVersion.current) return;
      setAllTrips(trips || []);
      setDeliveries(dels || []);
    } catch (e) {
      if (version === requestVersion.current) setError('Could not load assigned deliveries.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLiveSync(load);

  const driverTrips = useMemo(
    () => allTrips.filter((t) => normalize(t.driver || t.assignedDriver || t.driverName) === normalize(driverName)),
    [allTrips, driverName],
  );
  const activeTrips = useMemo(() => driverTrips.filter((t) => isOpenTrip(t.status)), [driverTrips]);
  const inProgressTrips = useMemo(() => driverTrips.filter((t) => isInProgressTrip(t.status)), [driverTrips]);
  const completedTrips = useMemo(() => driverTrips.filter((t) => isCompletedTrip(t.status)), [driverTrips]);
  const pendingTrips = useMemo(() => activeTrips.filter((t) => isPendingTrip(t.status)), [activeTrips]);

  function getDeliveryForTrip(trip) {
    const requestId = trip.request || trip.deliveryId || trip.deliveryRequestId;
    return deliveries.find((d) => String(d.id) === String(requestId)) || deliveries.find((d) => String(d.deliveryId) === String(requestId)) || null;
  }

  const filteredTrips = useMemo(() => {
    return activeTrips.filter((trip) => {
      const delivery = getDeliveryForTrip(trip);
      const tripId = trip.id || trip.tripId;
      const deliveryId = trip.request || trip.deliveryId || trip.deliveryRequestId || delivery?.id;
      const status = trip.status || delivery?.status;
      return matchesSearchFields(search, [tripId, deliveryId]) &&
        matchesFilter(status, statusFilter);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTrips, search, deliveries, statusFilter]);
  const statusOptions = uniqueFilterOptions(activeTrips, (trip) => trip.status || getDeliveryForTrip(trip)?.status);

  const hasActiveTrip = inProgressTrips.length > 0;

  async function handleAction(id, action) {
    setBusyId(id);
    try {
      const nextStatus = action === 'accept' ? 'Accepted' : 'Rejected';
      const updated = await Trips.updateStatus(id, nextStatus);
      requestVersion.current += 1;
      setAllTrips((previous) => previous.map((trip) => trip.id === id ? { ...trip, ...updated, status: nextStatus } : trip));
      if (action === 'accept') navigate(`/driver/map?id=${encodeURIComponent(id)}`);
      else await load({ background: true });
    } catch (e) {
      alert(e.message || 'Failed to update trip status.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div style={{ padding: 24, color: '#9ca3af' }}>Loading...</div>;

  return (
    <div className="dashboard-content">
      <div className="driver-stats">
        <div className="driver-stat-card">
          <div className="driver-stat-icon">▣</div>
          <h3>{inProgressTrips.length}</h3>
          <p>In Progress</p>
        </div>
        <div className="driver-stat-card">
          <div className="driver-stat-icon">☑</div>
          <h3>{completedTrips.length}</h3>
          <p>Completed</p>
        </div>
        <div className="driver-stat-card">
          <div className="driver-stat-icon">◷</div>
          <h3>{pendingTrips.length}</h3>
          <p>Awaiting Acceptance</p>
        </div>
        <div className="driver-stat-card yellow">
          <div className="driver-stat-icon">●</div>
          <h3>{hasActiveTrip ? 'On Duty' : 'Available'}</h3>
          <p>Driver Status</p>
        </div>
      </div>

      <div className="dashboard-section-heading">
        <h2>Assigned Deliveries</h2>
        <p style={{ color: '#9ca3af', marginTop: 0 }}>Accept or continue active deliveries directly from the dashboard.</p>
      </div>

      <div className="driver-search-wrap">
        <div className="driver-filter-row">
          <input className="driver-filter-control driver-filter-search" type="text" placeholder="Search trip or delivery ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="driver-filter-control" aria-label="Filter deliveries by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select>
        </div>
      </div>

      {error && (
        <div style={{ padding: 24, background: '#331717', border: '1px solid #ef4444', borderRadius: 16, color: '#fecaca', textAlign: 'center' }}>{error}</div>
      )}

      {!error && filteredTrips.length === 0 && (
        <div style={{ padding: 24, background: '#171717', border: '1px solid #262626', borderRadius: 16, color: '#9ca3af', textAlign: 'center' }}>
          {search.trim() || statusFilter ? 'No assigned deliveries match the selected search and filters.' : 'No active assigned deliveries found. Completed deliveries are now shown only in History.'}
        </div>
      )}

      {!error &&
        filteredTrips.map((trip) => {
          const delivery = getDeliveryForTrip(trip);
          const id = trip.id || trip.tripId || '--';
          const deliveryId = trip.request || trip.deliveryId || trip.deliveryRequestId || delivery?.id || id;
          const pickup = trip.pickup || trip.pickupLocation || delivery?.pickup || 'Pickup not available';
          const drop = trip.destination || trip.dropoff || trip.dropLocation || delivery?.dropoff || delivery?.destination || 'Destination not available';
          const customer =
            trip.customer || trip.client || trip.customerName || trip.clientName || delivery?.customer || delivery?.client || delivery?.company || delivery?.businessName || 'Customer not available';
          const eta = trip.eta || trip.estimatedTime || delivery?.eta || 'Not available';
          const distance = trip.distance || delivery?.distance || 'Distance not available';
          const status = trip.status || delivery?.status || 'Status unavailable';
          const dbType = trip.packageType || delivery?.packageType || '';
          const dbDims = trip.packageDimensions || delivery?.packageDimensions;
          const packageName =
            dbType && dbDims && dbDims.length
              ? `${dbType} — ${dbDims.length} × ${dbDims.width} × ${dbDims.height} ${dbDims.unit || 'cm'}`
              : trip.package || trip.packageType || trip.item || delivery?.package || delivery?.item || 'Package';
          const weight = trip.weight || trip.estimatedWeight || delivery?.weight || '--';
          const instructions = trip.instructions || delivery?.instructions || 'No special instructions provided.';
          const statusN = normalize(status);

          return (
            <div className="delivery-card" key={id}>
              <div>
                <div className="delivery-title">
                  <h2>Delivery #{deliveryId}</h2>
                  <span className="status-pill">{status}</span>
                </div>

                <div className="route-block">
                  <div className="route-line">
                    <div className="dot" />
                    <div>
                      <div className="label">Pickup</div>
                      <div className="value">{pickup}</div>
                    </div>
                  </div>
                  <div className="route-line">
                    <div className="dot" />
                    <div>
                      <div className="label">Drop</div>
                      <div className="value">{drop}</div>
                    </div>
                  </div>
                </div>

                <div className="delivery-meta">
                  <div>
                    <div className="label">Customer</div>
                    <div className="value">{customer}</div>
                  </div>
                  <div>
                    <div className="label">ETA</div>
                    <div className="value">{eta}</div>
                  </div>
                  <div>
                    <div className="label">Distance</div>
                    <div className="value">{distance}</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="package-box">
                  <div className="label">Package</div>
                  <div className="value">{packageName}</div>
                  <div style={{ marginTop: 12 }} className="label">
                    Weight
                  </div>
                  <div className="value">{weight}</div>
                  <div style={{ marginTop: 12 }} className="label">
                    Instructions
                  </div>
                  <div style={{ marginTop: 4, color: '#d1d5db', fontSize: 13, lineHeight: 1.4 }}>{instructions}</div>
                </div>

                <div className="actions">
                  {statusN === 'accepted' || statusN === 'picked up' || statusN === 'in transit' ? (
                    <>
                      <button className="btn btn-yellow" onClick={() => navigate(`/driver/map?id=${encodeURIComponent(id)}`)}>Continue</button>
                      <button className="btn btn-dark" onClick={() => navigate(`/driver/report-issue?id=${encodeURIComponent(id)}`)}>Report Issue</button>
                    </>
                  ) : isPendingTrip(statusN) && hasActiveTrip ? (
                    <>
                      <button className="btn btn-yellow" disabled title="Complete your current delivery before accepting a new one">
                        Accept
                      </button>
                      <button className="btn btn-red" disabled={busyId === id} onClick={() => handleAction(id, 'reject')}>
                        Reject
                      </button>
                      <div style={{ width: '100%', marginTop: 8, color: '#f59e0b', fontSize: 12 }}>Finish your active delivery before accepting this one.</div>
                    </>
                  ) : isPendingTrip(statusN) ? (
                    <>
                      <button className="btn btn-yellow" disabled={busyId === id} onClick={() => handleAction(id, 'accept')}>
                        {busyId === id ? 'Accepting...' : 'Accept'}
                      </button>
                      <button className="btn btn-red" disabled={busyId === id} onClick={() => handleAction(id, 'reject')}>
                        Reject
                      </button>
                    </>
                  ) : null}
                  <button className="btn btn-dark" onClick={() => navigate(`/driver/task-details?id=${encodeURIComponent(id)}`)}>
                    View Details
                  </button>
                </div>
              </div>
            </div>
          );
        })}

      <style>{`
        .dashboard-content { padding-top: 20px; }
        .driver-stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 16px; }
        .driver-stat-card { background: linear-gradient(135deg, #1f1f1f, #111); border: 1px solid #262626; border-radius: 18px; padding: 22px; }
        .driver-stat-card.yellow { background: #ffd400; color: #000; }
        .driver-stat-icon { width: 34px; height: 34px; border-radius: 10px; background: rgba(255,212,0,.12); border: 1px solid rgba(255,212,0,.35); color: #ffd400; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
        .driver-stat-card.yellow .driver-stat-icon { color: #000; background: rgba(0,0,0,.08); border-color: rgba(0,0,0,.15); }
        .driver-stat-card h3 { margin: 0; font-size: 38px; line-height: 1; }
        .driver-stat-card p { margin: 10px 0 0; color: #9ca3af; }
        .driver-stat-card.yellow p { color: #111; }
        .dashboard-section-heading { margin-top: 24px; margin-bottom: 6px; }
        .dashboard-section-heading h2 { margin: 0 0 6px; font-size: 32px; }
        .dashboard-section-heading p { color: #9ca3af; margin: 0; }
        .driver-search-wrap { margin: 18px 0; background: #171717; border: 1px solid #262626; border-radius: 16px; padding: 16px; }
        .delivery-card { background: linear-gradient(135deg, #1b1b1b, #111); border: 1px solid #262626; border-radius: 18px; padding: 22px; margin-bottom: 16px; display: grid; grid-template-columns: 1fr 220px; gap: 20px; }
        .delivery-title { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
        .delivery-title h2 { margin: 0; font-size: 26px; }
        .status-pill { background: rgba(255,212,0,.16); color: #ffd400; border: 1px solid rgba(255,212,0,.35); padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 900; }
        .route-block { display: grid; gap: 12px; margin-bottom: 18px; }
        .route-line { display: flex; gap: 12px; align-items: flex-start; }
        .dot { width: 14px; height: 14px; border-radius: 999px; background: #ffd400; margin-top: 4px; box-shadow: 0 0 0 4px rgba(255,212,0,.18); }
        .label { color: #9ca3af; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; font-weight: 800; }
        .value { margin-top: 4px; font-weight: 900; color: #fff; }
        .delivery-meta { border-top: 1px solid #262626; padding-top: 14px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .package-box { border: 1px solid #262626; border-radius: 16px; padding: 16px; background: #101010; }
        .actions { margin-top: 16px; display: flex; gap: 10px; flex-wrap: wrap; }
        .btn { border: none; border-radius: 12px; padding: 12px 18px; font-weight: 900; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; transition: transform .15s ease, opacity .15s ease; }
        .btn:hover { transform: translateY(-1px); }
        .btn:disabled { opacity: .65; cursor: not-allowed; transform: none; }
        .btn-yellow { background: #ffd400; color: #000; }
        .btn-red { background: #321717; color: #fecaca; border: 1px solid #ef4444; }
        .btn-dark { background: #0b0b0b; color: #fff; border: 1px solid #262626; }
        @media (max-width: 1200px) { .driver-stats { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 1000px) { .driver-stats { grid-template-columns: 1fr 1fr; } .delivery-card { grid-template-columns: 1fr; } }
        @media (max-width: 700px) { .driver-stats { grid-template-columns: 1fr; } .delivery-meta { grid-template-columns: 1fr; } }
        .icon-circle { width: 44px; height: 44px; border: 1px solid #292929; border-radius: 14px; background: #111; color: #f5f5f5; display: flex; align-items: center; justify-content: center; position: relative; cursor: pointer; text-decoration: none; }
        .icon-circle svg { display: block; }
        .icon-badge { position: absolute; top: 7px; right: 7px; width: 7px; height: 7px; border-radius: 50%; background: #ffd400; }
      `}</style>
    </div>
  );
}
