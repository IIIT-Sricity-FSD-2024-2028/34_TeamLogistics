import { useRecordPage } from '../../components/useRecordPage';
import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useGetTripsQuery, useGetDriversQuery, useUpdateDriverMutation, useUpdateTripStatusMutation, queryError } from '../../redux/driverApi';
import { setDashboardSearch, setDashboardStatusFilter } from '../../redux/driverSlice';
import { useSession } from '../../auth/SessionContext';
import { usePageHeader } from '../../hooks/usePageHeader';
import { isPendingTrip } from './tripStatus';
import Pagination from '../../components/Pagination';

function normalize(v) {
  return String(v || '').trim().toLowerCase();
}

export default function DriverDashboard() {
  usePageStyleScope('driver-dashboard');
  const { session } = useSession();
  const navigate = useNavigate();
  const driverName = session?.name || '';
  usePageHeader(`Hello, ${driverName.split(' ')[0] || 'Driver'}`, "Ready for today's deliveries");

  const dispatch = useDispatch();
  const { search, statusFilter } = useSelector((state) => state.driver.dashboard);
  const setSearch = (value) => dispatch(setDashboardSearch(value));
  const setStatusFilter = (value) => dispatch(setDashboardStatusFilter(value));
  const tripPages = useRecordPage(useGetTripsQuery, {view: 'driver-open', search, status: statusFilter});
  const {query} = tripPages;
  const driversQuery = useGetDriversQuery();
  const driver = driversQuery.data?.[0];
  const [updateDriver, availabilityUpdate] = useUpdateDriverMutation();
  const loading = query.isLoading;
  const error = queryError(query);
  const [updateTripStatus] = useUpdateTripStatusMutation();
  const [busyId, setBusyId] = useState(null);

  const counts = query.currentData?.statusCounts || {};
  const count = (...statuses) => statuses.reduce((sum, status) => sum + (counts[status] || 0), 0);
  const inProgress = count('accepted','picked up','in transit');
  const hasActiveTrip = inProgress + count('attempt failed', 'returning', 'issue reported') > 0;
  const canToggle = ['Available', 'Unavailable'].includes(driver?.status);

  async function toggleAvailability() {
    try {
      const status = driver.status === 'Available' ? 'Unavailable' : 'Available';
      await updateDriver({ id: driver.id, changes: { status } }).unwrap();
    } catch {
      driversQuery.refetch();
    }
  }
  const statusOptions = tripPages.options.status || [];

  async function handleAction(id, action) {
    setBusyId(id);
    try {
      const nextStatus = action === 'accept' ? 'Accepted' : 'Rejected';
      await updateTripStatus({ id, status: nextStatus }).unwrap();
      if (action === 'accept') navigate(`/driver/map?id=${encodeURIComponent(id)}`);
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
          <h3>{inProgress}</h3>
          <p>In Progress</p>
        </div>
        <div className="driver-stat-card">
          <div className="driver-stat-icon">☑</div>
          <h3>{count('completed','delivered')}</h3>
          <p>Completed</p>
        </div>
        <div className="driver-stat-card">
          <div className="driver-stat-icon">◷</div>
          <h3>{count('assigned','queued','pending')}</h3>
          <p>Awaiting Acceptance</p>
        </div>
        <div className="driver-stat-card yellow">
          <div className="driver-stat-icon">●</div>
          <h3 aria-live="polite">{driver?.status || (driversQuery.isLoading ? 'Loading?' : 'Unknown')}</h3>
          <p>Driver Status</p>
          {canToggle && <button className="btn btn-yellow" type="button" onClick={toggleAvailability}
            disabled={availabilityUpdate.isLoading || driversQuery.isFetching}>
            {driver.status === 'Available' ? 'Go unavailable' : 'Go available'}
          </button>}
          {driver?.status === 'In Work' && <small>You have an assigned delivery.</small>}
          {(availabilityUpdate.error || driversQuery.isError) &&
            <p role="alert">{availabilityUpdate.error?.message || queryError(driversQuery)}</p>}
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

      {!error && !query.isFetching && tripPages.totalItems === 0 && (
        <div style={{ padding: 24, background: '#171717', border: '1px solid #262626', borderRadius: 16, color: '#9ca3af', textAlign: 'center' }}>
          {search.trim() || statusFilter ? 'No assigned deliveries match the selected search and filters.' : 'No active assigned deliveries found. Completed deliveries are now shown only in History.'}
        </div>
      )}

      {!error &&
        tripPages.pageItems.map((trip) => {
          const delivery = trip.delivery;
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

      {!error && <Pagination {...tripPages} onPageChange={tripPages.setPage} itemLabel="deliveries" />}

    </div>
  );
}
