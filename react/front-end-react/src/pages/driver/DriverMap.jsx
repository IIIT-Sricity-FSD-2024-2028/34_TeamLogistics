import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Trips, Deliveries } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useLiveSync } from '../../hooks/useLiveSync';
import TripPosition from '../../components/TripPosition';

function rupee(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);
}

const ACTIVE_STATUSES = ['accepted', 'picked up', 'in transit'];
const STATUS_STEPS = ['accepted', 'picked up', 'in transit', 'delivered'];
const NOT_YET_ACCEPTED = ['queued', 'assigned', 'pending', 'delayed'];

function statusIndex(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') return 3;
  return STATUS_STEPS.indexOf(s);
}

export default function DriverMap() {
  usePageHeader('Driver Portal', 'Desktop view');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [trip, setTrip] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notAccepted, setNotAccepted] = useState('');
  const [noActive, setNoActive] = useState(false);
  const [advancing, setAdvancing] = useState(false);
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
    let lastSent = 0;
    const watch = navigator.geolocation.watchPosition(async ({ coords }) => {
      if (!active || uploading || Date.now() - lastSent < 15000) return;
      uploading = true;
      try {
        await Trips.updateLocation(trip.id, {
          latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy,
        });
        lastSent = Date.now();
        if (active) setLocationError('');
      } catch (error) {
        if (active) setLocationError(error.message || 'Unable to share location.');
      } finally {
        uploading = false;
      }
    }, (error) => {
      if (active) {
        setLocationError(error.message || 'Location permission is required.');
        if (error.code === 1) setSharingLocation(false);
      }
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
    return () => {
      active = false;
      navigator.geolocation.clearWatch(watch);
    };
  }, [sharingLocation, trip?.id]);

  useEffect(() => {
    if (!ACTIVE_STATUSES.includes(String(trip?.status || '').toLowerCase())) setSharingLocation(false);
  }, [trip?.status]);

  async function load({ background = false } = {}) {
    if (!background) setLoading(true);
    setError('');
    setNotAccepted('');
    setNoActive(false);
    try {
      let tripId = params.get('id');
      if (!tripId) {
        const trips = await Trips.getAll();
        const active = (trips || []).find((t) => ACTIVE_STATUSES.includes(String(t.status || '').toLowerCase()));
        tripId = active ? active.id : null;
      }
      if (!tripId) {
        setNoActive(true);
        setLoading(false);
        return;
      }

      const t = await Trips.getOne(tripId);
      if (!t) throw new Error('Trip not found');

      if (NOT_YET_ACCEPTED.includes(String(t.status || '').toLowerCase())) {
        setNotAccepted(t.status || 'Queued');
        setLoading(false);
        return;
      }

      let d = null;
      try {
        const requestId = t.request || t.deliveryId || t.deliveryRequestId;
        if (requestId) d = await Deliveries.getOne(requestId);
      } catch {}

      setTrip(t);
      setDelivery(d);
    } catch (e) {
      setError('Unable to load this trip. It may no longer exist.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  useLiveSync(load);

  async function advance(nextStatus) {
    if (!trip) return;
    setAdvancing(true);
    setActionError('');
    try {
      await Trips.updateStatus(trip.id || params.get('id'), nextStatus);
      await load();
    } catch (e) {
      setActionError(e.message || 'Unable to update this delivery.');
    } finally {
      setAdvancing(false);
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

  if (error)
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

      <style>{`
        .driver-map-layout{grid-template-columns:minmax(0,1.55fr) minmax(360px,.9fr);gap:22px;align-items:start}
        .driver-map-panel{min-width:0;overflow:hidden;border:1px solid #2b2b2b;border-radius:28px;background:#111;box-shadow:0 22px 48px rgba(0,0,0,.32)}
        .driver-map-canvas{position:relative;height:280px;overflow:hidden;background:linear-gradient(135deg,#202733,#111820)}
        .driver-map-canvas iframe{display:block;width:100%;height:100%;border:0;filter:saturate(.82) contrast(.96)}
        .driver-map-badge{position:absolute;top:18px;right:18px;display:flex;align-items:center;gap:9px;padding:10px 13px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(12,12,12,.9);color:#ddd;font-size:12px;font-weight:800;box-shadow:0 8px 24px rgba(0,0,0,.28);backdrop-filter:blur(8px)}
        .driver-map-badge>span{width:8px;height:8px;border-radius:50%;background:#9ca3af}
        .driver-map-badge.live>span{background:#22c55e;box-shadow:0 0 0 5px rgba(34,197,94,.15)}
        .driver-map-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;padding:32px;text-align:center;color:#d6d6d6;background:radial-gradient(circle at center,rgba(255,212,0,.09),transparent 34%),linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:auto,48px 48px,48px 48px}
        .driver-map-empty-icon{display:grid;place-items:center;width:58px;height:58px;border-radius:18px;background:var(--yellow);color:#111;font-size:34px;font-weight:900;margin-bottom:4px}
        .driver-map-empty strong{font-size:18px}.driver-map-empty>span:last-child{max-width:390px;color:#9ca3af;line-height:1.5;font-size:13px}
        .driver-route-summary{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr) minmax(210px,.72fr);gap:12px;align-items:center;padding:14px 18px;border-top:1px solid #2a2a2a;border-bottom:1px solid #2a2a2a;background:linear-gradient(180deg,#181818,#141414)}
        .driver-route-point{display:grid;grid-template-columns:14px minmax(0,1fr);gap:12px;align-items:start;min-width:0}
        .driver-route-dot{width:12px;height:12px;margin-top:4px;border:3px solid var(--yellow);border-radius:50%;background:#111;box-sizing:border-box}
        .driver-route-point.destination .driver-route-dot{background:var(--yellow)}
        .driver-route-label{display:block;margin-bottom:5px;color:#8f96a3;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
        .driver-route-point strong{display:block;overflow:hidden;color:#fff;font-size:15px;line-height:1.35;text-overflow:ellipsis;white-space:nowrap}
        .driver-route-arrow{color:var(--yellow);font-size:24px;font-weight:900}
        .driver-route-facts{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:11px 13px;border:1px solid #303030;border-radius:16px;background:#101010}
        .driver-route-facts span,.driver-map-metrics span{display:block;color:#8f96a3;font-size:11px;margin-bottom:5px}
        .driver-route-facts strong{display:block;color:#fff;font-size:13px;line-height:1.3}
        .driver-map-bottom{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(220px,.55fr);gap:12px;padding:14px 18px 18px}
        .driver-location-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center;min-width:0}.driver-location-copy{min-width:0}.driver-location-copy>div{margin-top:0!important;color:#e5e7eb;line-height:1.4}.driver-location-card a{display:inline-flex;margin-top:4px;color:var(--yellow);font-weight:700}.driver-location-card .btn{margin-top:0;white-space:nowrap}
        .driver-location-error{margin:7px 0 0;color:#ff8d8d;font-size:13px}
        .driver-map-metrics{display:grid;grid-template-columns:max-content max-content;gap:10px;align-self:center;align-items:start;justify-content:end}
        .driver-map-metrics>div{min-width:0;padding:10px 14px;border:1px solid #303030;border-radius:14px;background:linear-gradient(180deg,#191919,#121212)}
        .driver-map-metrics strong{display:block;color:#fff;font-size:20px;line-height:1.2;white-space:nowrap}
        .driver-progress-card{min-width:0;border-radius:28px}
        .driver-issue-action{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:12px;align-items:center;margin-top:18px;padding:14px;border:1px solid rgba(239,68,68,.28);border-radius:18px;background:linear-gradient(135deg,rgba(239,68,68,.12),rgba(239,68,68,.035));color:#fff}
        .driver-issue-action.is-reported{border-color:rgba(245,158,11,.34);background:linear-gradient(135deg,rgba(245,158,11,.13),rgba(245,158,11,.035))}
        .driver-issue-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:rgba(239,68,68,.16);color:#ff8c8c}
        .driver-issue-action.is-reported .driver-issue-icon{background:rgba(245,158,11,.16);color:#fbbf24}
        .driver-issue-icon svg{width:22px;height:22px}
        .driver-issue-copy{min-width:0}.driver-issue-copy strong{display:block;margin-bottom:3px;font-size:14px}.driver-issue-copy span{display:block;color:#aaa;font-size:12px;line-height:1.4}
        .driver-issue-button{min-height:38px;padding:9px 13px;border:1px solid rgba(255,120,120,.32);border-radius:11px;background:#2a1313;color:#ffb1b1;font:inherit;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;transition:background .15s ease,border-color .15s ease,transform .15s ease}
        .driver-issue-button:hover{border-color:rgba(255,140,140,.55);background:#351717;transform:translateY(-1px)}
        .driver-issue-button:focus-visible{outline:2px solid #ff8c8c;outline-offset:2px}
        .driver-issue-action.is-reported .driver-issue-button{border-color:rgba(245,158,11,.34);background:#2a2111;color:#fbd376}.driver-issue-action.is-reported .driver-issue-button:hover{background:#342813;border-color:rgba(245,158,11,.55)}
        @media(max-width:1400px){.driver-route-summary{grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)}.driver-route-facts{grid-column:1/-1}}
        @media(max-width:1200px){.driver-map-layout{grid-template-columns:1fr}.driver-map-canvas{height:300px}}
        @media(max-width:700px){.driver-map-panel,.driver-progress-card{border-radius:20px}.driver-map-canvas{height:260px}.driver-map-badge{top:12px;right:12px;max-width:calc(100% - 24px)}.driver-route-summary{grid-template-columns:1fr;padding:16px}.driver-route-arrow{transform:rotate(90deg);justify-self:start;margin-left:2px}.driver-route-facts{grid-column:auto}.driver-map-bottom{grid-template-columns:1fr;padding:16px}.driver-location-card{grid-template-columns:1fr}.driver-location-card .btn{justify-self:start}.driver-map-metrics{justify-content:start}.driver-route-point strong{white-space:normal}.driver-issue-action{grid-template-columns:42px minmax(0,1fr)}.driver-issue-button{grid-column:1/-1;width:100%}}
      `}</style>
    </section>
  );
}
