import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGetTripsQuery, useUpdateTripStatusMutation, useUpdateTripLocationMutation, EMPTY_LIST, queryError } from '../../redux/driverApi';
import { useDriverTrip } from '../../redux/useDriverTrip';
import { usePageHeader } from '../../hooks/usePageHeader';
import TripPosition from '../../components/TripPosition';

function rupee(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);
}

const ACTIVE_STATUSES = ['accepted', 'picked up', 'in transit', 'issue reported', 'attempt failed', 'returning'];
const STATUS_STEPS = ['accepted', 'picked up', 'in transit', 'delivered'];
const NOT_YET_ACCEPTED = ['queued', 'assigned', 'pending', 'delayed'];

function statusIndex(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') return 3;
  return STATUS_STEPS.indexOf(s);
}

export default function DriverMap() {
  usePageStyleScope('driver-map');
  usePageHeader('Driver Portal', 'Desktop view');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedId = params.get('id');
  const tripsQuery = useGetTripsQuery({page:1,limit:1,view:'driver-working'}, { skip: Boolean(requestedId) });
  const activeTrip = (tripsQuery.data?.items || EMPTY_LIST).find((item) => ACTIVE_STATUSES.includes(String(item.status || '').toLowerCase()));
  const selectedId = requestedId || activeTrip?.id;
  const { trip, delivery, loading: tripLoading, error: tripError } = useDriverTrip(selectedId);
  const loading = tripsQuery.isLoading || tripLoading;
  const error = queryError(tripsQuery) || (selectedId ? tripError : '');
  const noActive = !loading && !error && !selectedId;
  const notAccepted = NOT_YET_ACCEPTED.includes(String(trip?.status || '').toLowerCase()) ? trip.status : '';
  const [updateTripStatus, { isLoading: advancing }] = useUpdateTripStatusMutation();
  const [updateTripLocation] = useUpdateTripLocationMutation();
  const [actionError, setActionError] = useState('');
  const [sharingLocation, setSharingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    if (!sharingLocation || !trip?.id) return undefined;
    if (!navigator.geolocation) {
      setLocationError('Location sharing is not supported by this browser.');
      setSharingLocation(false);
      return undefined;
    }
    let active = true;
    let uploading = false;
    let pending;
    let nextSend = 0;
    async function flush() {
      if (!active || uploading || !pending || !navigator.onLine || Date.now() < nextSend) return;
      const sample = pending;
      if (Date.now() - Date.parse(sample.measuredAt) > 600000) { pending = undefined; return; }
      uploading = true;
      nextSend = Date.now() + 15000;
      try {
        await updateTripLocation({ id: trip.id, position: sample }).unwrap();
        if (pending === sample) pending = undefined;
        if (active) setLocationError('');
      } catch (error) {
        if (pending === sample && Number(error.status) >= 400 && Number(error.status) < 500) pending = undefined;
        if (active) setLocationError(error.data?.message || error.message || 'Unable to share location. Waiting for a fresh fix or connection.');
      } finally { uploading = false; }
    }
    const watch = navigator.geolocation.watchPosition(({ coords, timestamp }) => {
      if (!active) return;
      pending = { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy,
        measuredAt: new Date(timestamp).toISOString() };
      if (!navigator.onLine) setLocationError('Offline. The latest position will be shared when the connection returns.');
      void flush();
    }, (error) => {
      if (active) {
        setLocationError(error.message || 'Location permission is required.');
        if (error.code === 1) setSharingLocation(false);
      }
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
    const timer = setInterval(flush, 15000);
    window.addEventListener('online', flush);
    return () => {
      active = false;
      pending = undefined;
      clearInterval(timer);
      window.removeEventListener('online', flush);
      navigator.geolocation.clearWatch(watch);
    };
  }, [sharingLocation, trip?.id, updateTripLocation]);

  useEffect(() => {
    if (!ACTIVE_STATUSES.includes(String(trip?.status || '').toLowerCase())) setSharingLocation(false);
  }, [trip?.status]);

  const [parcelBarcode, setParcelBarcode] = useState('');
  async function advance(nextStatus) {
    if (!trip) return;
    setActionError('');
    try {
      await updateTripStatus({ id: trip.id || selectedId, status: nextStatus, details: { parcelBarcode } }).unwrap();
    } catch (e) {
      setActionError(e.message || 'Unable to update this delivery.');
    }
  }

  if (loading) return <section className="content">Loading trip...</section>;

  if (noActive)
    return (
      <section className="content">
        <div style={{ padding: 24, background: '#171717', border: '1px solid #262626', borderRadius: 16, color: '#9ca3af', textAlign: 'center' }}>
          You have no active delivery right now. Accept a delivery from the Dashboard to see it here.
        </div>
      </section>
    );

  if (notAccepted)
    return (
      <section className="content">
        <div style={{ padding: 24, background: '#171717', border: '1px solid #262626', borderRadius: 16, color: '#9ca3af', textAlign: 'center' }}>
          This delivery ({notAccepted}) hasn't been accepted yet. Go to the Dashboard to accept it first.
        </div>
      </section>
    );

  if (error || !trip)
    return (
      <section className="content">
        <div style={{ padding: 24, background: '#171717', border: '1px solid #262626', borderRadius: 16, color: '#9ca3af', textAlign: 'center' }}>{error}</div>
      </section>
    );

  const tripId = trip.id || params.get('id');
  const pickup = trip.pickup || trip.pickupLocation || delivery?.pickup || 'Pickup not available';
  const drop = trip.destination || trip.dropoff || trip.dropLocation || delivery?.dropoff || delivery?.destination || 'Destination not available';
  const distance = trip.distance || delivery?.distance || 'Distance not available';
  const eta = trip.eta || trip.estimatedTime || delivery?.eta || 'Not available';
  const status = trip.status || delivery?.status || 'Status unavailable';
  const amount = trip.amount || delivery?.amount || delivery?.pricing?.total || 0;
  const customer =
    trip.customer ||
    trip.client ||
    trip.customerName ||
    trip.clientName ||
    delivery?.customer ||
    delivery?.client ||
    delivery?.customerName ||
    delivery?.clientName ||
    delivery?.company ||
    delivery?.businessName ||
    delivery?.name ||
    'Customer not available';
  const isIssueReported = String(status).toLowerCase() === 'issue reported';
  const idx = isIssueReported ? statusIndex(trip.statusBeforeIssue) : statusIndex(status);
  const latitude = Number(trip.lastPosition?.latitude);
  const longitude = Number(trip.lastPosition?.longitude);
  const hasMapPosition = Number.isFinite(latitude) && Number.isFinite(longitude);
  const mapEmbedUrl = hasMapPosition
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent([
        longitude - 0.018,
        latitude - 0.012,
        longitude + 0.018,
        latitude + 0.012,
      ].join(','))}&layer=mapnik&marker=${encodeURIComponent(`${latitude},${longitude}`)}`
    : '';

  return (
    <section className="content driver-map-page">
      <div className="map-layout driver-map-layout">
        <div className="driver-map-panel">
          <div className="driver-map-canvas">
            {hasMapPosition ? (
              <iframe
                title="Current driver location"
                src={mapEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="driver-map-empty">
                <span className="driver-map-empty-icon">⌖</span>
                <strong>Live map is waiting for your location</strong>
                <span>Use “Share live location” below to place your position on the map.</span>
              </div>
            )}
            <div className={`driver-map-badge${sharingLocation ? ' live' : ''}`}>
              <span />
              {sharingLocation ? 'Live location sharing' : hasMapPosition ? 'Last known position' : 'Location unavailable'}
            </div>
          </div>

          <div className="driver-route-summary">
            <div className="driver-route-point pickup">
              <span className="driver-route-dot" />
              <div>
                <span className="driver-route-label">Pickup</span>
                <strong>{pickup}</strong>
              </div>
            </div>
            <div className="driver-route-arrow" aria-hidden="true">→</div>
            <div className="driver-route-point destination">
              <span className="driver-route-dot" />
              <div>
                <span className="driver-route-label">Destination</span>
                <strong>{drop}</strong>
              </div>
            </div>
            <div className="driver-route-facts">
              <div>
                <span>Distance</span>
                <strong>{distance}</strong>
              </div>
              <div>
                <span>ETA</span>
                <strong>{eta}</strong>
              </div>
            </div>
          </div>

          <div className="driver-map-bottom">
            <div className="driver-location-card">
              <div className="driver-location-copy">
                <TripPosition position={trip.lastPosition} />
                {trip.retryAt && <p>Second attempt scheduled for {new Date(trip.retryAt).toLocaleString()}</p>}
                <small>Keep this page open while sharing. Locking the phone can pause location updates.</small>
                {locationError && <p role="alert" className="driver-location-error">{locationError}</p>}
              </div>
              <button
                className="btn yellow"
                type="button"
                onClick={() => setSharingLocation((value) => !value)}
                disabled={!ACTIVE_STATUSES.includes(String(trip.status).toLowerCase())}
              >
                {sharingLocation ? 'Stop sharing location' : 'Share live location'}
              </button>
            </div>
            <div className="driver-map-metrics">
              <div>
                <span>Amount</span>
                <strong>{rupee(amount)}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{status}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="card driver-progress-card">
          <h2 style={{ marginTop: 0 }}>Delivery Progress</h2>

          {idx >= 0 && (
            <div className="progress-steps">
              {['Accepted', 'Picked Up', 'In Transit', 'Delivered'].map((label, i) => (
                <div className={`step ${idx >= i ? 'done' : ''}`} key={label}>
                  <div className="step-bubble">{i + 1}</div>
                  <div className="step-label">{label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="package-light-card">
            <div className="meta-label">Customer</div>
            <div className="meta-value">{customer}</div>
            <div className="meta-label" style={{ marginTop: 12 }}>
              Current Route
            </div>
            <div className="meta-value">
              {pickup} → {drop}
            </div>
            <div className="meta-label" style={{ marginTop: 12 }}>
              Trip Status
            </div>
            <div className="meta-value" style={{ color: 'var(--yellow)' }}>
              {status}
            </div>
            <div className="meta-label" style={{ marginTop: 12 }}>
              Delivery Request
            </div>
            <div className="meta-value">{trip.request || trip.deliveryId || trip.id || tripId}</div>
          </div>

          {idx === 0 && delivery?.requiresParcelScan && <label>Pickup parcel barcode<input className="input" value={parcelBarcode} onChange={(e) => setParcelBarcode(e.target.value)} placeholder="Scan or enter label digits" /></label>}
          {actionError && <p role="alert" style={{ color: '#ff8d8d' }}>{actionError}</p>}
          {isIssueReported ? (
            <>
              <div className="package-light-card" style={{ marginTop: 16, border: '1px solid #ef4444' }}>
                <div className="meta-label" style={{ color: '#ff8c8c' }}>
                  Issue Reported
                </div>
                <div className="meta-value">
                  {trip.issueType || 'Issue'}: {trip.issueDescription || 'No description'}
                </div>
              </div>
              {trip.statusBeforeIssue ? <button className="btn yellow full" disabled={advancing} style={{ marginTop: 14 }} onClick={() => advance(trip.statusBeforeIssue)}>
                {advancing ? 'Updating...' : 'Resume Delivery'}
              </button> : <p style={{ color: '#f5b66d', marginTop: 14 }}>The earlier delivery stage was not recorded. The fleet manager must reassign this trip before it can resume.</p>}
            </>
          ) : idx === 0 ? (
            <button className="btn yellow full" disabled={advancing} style={{ marginTop: 14 }} onClick={() => advance('Picked Up')}>
              {advancing ? 'Updating...' : 'Mark as Picked Up'}
            </button>
          ) : idx === 1 ? (
            <button className="btn yellow full" disabled={advancing} style={{ marginTop: 14 }} onClick={() => advance('In Transit')}>
              {advancing ? 'Updating...' : 'Mark as In Transit'}
            </button>
          ) : idx === 2 ? (
            <button className="btn yellow full" style={{ marginTop: 14 }} onClick={() => navigate(`/driver/proof-of-delivery?id=${encodeURIComponent(tripId)}`)}>
              Continue to Proof of Delivery
            </button>
          ) : idx === 3 ? (
            <div className="package-light-card" style={{ marginTop: 16, textAlign: 'center', color: 'var(--yellow)', fontWeight: 800 }}>
              ✓ Delivery completed
            </div>
          ) : null}

          <div className={`driver-issue-action${isIssueReported ? ' is-reported' : ''}`}>
            <div className="driver-issue-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 8.5V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M12 16.5H12.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M10.3 4.2L2.8 17.1A2 2 0 0 0 4.53 20h14.94a2 2 0 0 0 1.73-2.9L13.7 4.2a1.96 1.96 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="driver-issue-copy">
              <strong>{isIssueReported ? 'Issue report saved' : 'Problem with this delivery?'}</strong>
              <span>{isIssueReported ? 'Review the report submitted for this trip.' : 'Notify the fleet manager and record what happened.'}</span>
            </div>
            <button
              className="driver-issue-button"
              type="button"
              onClick={() => navigate(`/driver/report-issue?id=${encodeURIComponent(tripId)}&action=issue`)}
            >
              {isIssueReported ? 'View report' : 'Report issue'}
            </button>
          </div>
        </div>
      </div>

    </section>
  );
}
