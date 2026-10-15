import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Trips, Deliveries } from '../../api/namespaces';
import { useSession } from '../../auth/SessionContext';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useLiveSync } from '../../hooks/useLiveSync';
import { isPendingTrip, isInProgressTrip, isReportedIssue } from './tripStatus';

function normalize(v) {
  return String(v || '').trim().toLowerCase();
}


export default function DriverTaskDetails() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const driverName = session?.name || '';
  const tripId = params.get('id');

  const [trip, setTrip] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [otherActive, setOtherActive] = useState(false);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  usePageHeader(trip ? `Delivery #${trip.request || trip.deliveryId || trip.deliveryRequestId || trip.id}` : 'Task Details', trip ? `Task details for ${trip.id}` : 'Loading task details...');

  async function load({ background = false } = {}) {
    if (!background) setLoading(true);
    setError('');
    setForbidden(false);
    try {
      if (!tripId) throw new Error('Trip ID missing in URL.');
      const t = await Trips.getOne(tripId);
      if (!t) throw new Error(`Trip "${tripId}" not found.`);

      const tripDriver = normalize(t.driver || t.assignedDriver || t.driverName);
      if (driverName && tripDriver && tripDriver !== normalize(driverName)) {
        setForbidden(true);
        setLoading(false);
        return;
      }

      const requestId = t.request || t.deliveryId || t.deliveryRequestId;
      let d = null;
      if (requestId) {
        try {
          d = await Deliveries.getOne(requestId);
        } catch {}
      }

      setTrip(t);
      setDelivery(d);

      const status = t.status || d?.status || '';
      if (!ACCEPTED_LIKE.includes(normalize(status))) {
        try {
          const allTrips = await Trips.getAll();
          const hasOtherActive = (allTrips || []).some(
            (other) => String(other.id) !== String(t.id) && normalize(other.driver || other.assignedDriver) === normalize(driverName) && ['accepted', 'picked up', 'in transit'].includes(normalize(other.status)),
          );
          setOtherActive(hasOtherActive);
        } catch {}
      }
    } catch (e) {
      setError(e.message || 'Could not load task details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);
  useLiveSync(load, { enabled: Boolean(tripId) });

  async function handleAccept() {
    if (!trip) return;
    setAccepting(true);
    try {
      await Trips.updateStatus(tripId, 'Accepted');
      navigate(`/driver/map?id=${encodeURIComponent(tripId)}`);
    } catch (e) {
      alert(e.message || 'Failed to accept this delivery.');
      setAccepting(false);
    }
  }

  async function handleReject() {
    if (!trip) return;
    setRejecting(true);
    try {
      await Trips.updateStatus(tripId, 'Rejected');
      navigate('/driver/dashboard');
    } catch (e) {
      alert(e.message || 'Failed to reject this delivery.');
      setRejecting(false);
    }
  }

  async function handleSaveNote() {
    const value = note.trim();
    if (!value || !tripId) return;
    setSavingNote(true);
    try {
      const updated = await Trips.addNote(tripId, value);
      setTrip(updated);
      setNote('');
    } catch (e) {
      alert('Failed to save note: ' + (e.message || 'unknown error'));
    } finally {
      setSavingNote(false);
    }
  }

  if (loading) return <section className="content">Loading...</section>;
  if (forbidden) return <div style={{ padding: 40, textAlign: 'center', color: '#ff8d8d' }}>This trip does not belong to your account.</div>;
  if (error || !trip) return <section className="content">{error || 'Not found.'}</section>;

  const requestId = trip.request || trip.deliveryId || trip.deliveryRequestId || trip.id;
  const customer = trip.customer || trip.client || delivery?.customer || delivery?.client || delivery?.company || 'Customer not available';
  const contact = delivery?.contact || trip.contact || 'Contact not available';
  const pickup = trip.pickup || trip.pickupLocation || delivery?.pickup || 'Pickup not available';
  const drop = trip.destination || trip.dropoff || delivery?.dropoff || delivery?.destination || 'Drop not available';
  const tdType = trip.packageType || delivery?.packageType || '';
  const tdDims = trip.packageDimensions || delivery?.packageDimensions;
  const packageInfo = tdType || delivery?.package || trip.package || 'Package not available';
  const packageDimsInfo = tdDims && tdDims.length ? `${tdDims.length} × ${tdDims.width} × ${tdDims.height} ${tdDims.unit || 'cm'}` : 'Not available';
  const weight = delivery?.weight || trip.weight || 'Weight not available';
  const instructions = delivery?.instructions || trip.instructions || 'No special instructions provided.';
  const distance = trip.distance || delivery?.distance || 'Distance not available';
  const eta = trip.eta || trip.estimatedTime || 'ETA not provided';
  const status = trip.status || delivery?.status || 'Not available';
  const normalizedStatus = normalize(status);
  const notes = trip.driverNotes || [];

  return (
    <section className="content">
      <div className="details-grid">
        <div className="details-card">
          <div className="title-row">
            <div>
              <h2>Delivery #{requestId}</h2>
              <p>
                {pickup} → {drop}
              </p>
            </div>
            <span className="status-pill">{status}</span>
          </div>

          <div className="route-block">
            <div className="route-point">
              <div className="dot" />
              <div>
                <span>Pickup</span>
                <strong>{pickup}</strong>
              </div>
            </div>
            <div className="route-point">
              <div className="dot" />
              <div>
                <span>Drop-off</span>
                <strong>{drop}</strong>
              </div>
            </div>
          </div>

          <div className="info-grid">
            <div>
              <span>Trip ID</span>
              <strong>{trip.id}</strong>
            </div>
            <div>
              <span>Delivery Request</span>
              <strong>{requestId}</strong>
            </div>
            <div>
              <span>Customer</span>
              <strong>{customer}</strong>
            </div>
            <div>
              <span>Contact</span>
              <strong>{contact}</strong>
            </div>
            <div>
              <span>ETA</span>
              <strong>{eta}</strong>
            </div>
            <div>
              <span>Distance</span>
              <strong>{distance}</strong>
            </div>
          </div>

          <div className="package-box">
            <div>
              <span>Package Type</span>
              <strong>{packageInfo}</strong>
            </div>
            <div>
              <span>Dimensions</span>
              <strong>{packageDimsInfo}</strong>
            </div>
            <div>
              <span>Weight</span>
              <strong>{weight}</strong>
            </div>
            <div>
              <span>Instructions</span>
              <strong>{instructions}</strong>
            </div>
          </div>

          <div className="actions">
            {isPendingTrip(normalizedStatus) && <>
              <button className="btn btn-yellow" disabled={otherActive || accepting} onClick={handleAccept} title={otherActive ? 'Complete your current delivery before accepting a new one' : ''}>{accepting ? 'Updating...' : 'Accept Order'}</button>
              <button className="btn btn-red" disabled={rejecting} onClick={handleReject}>{rejecting ? 'Rejecting...' : 'Reject'}</button>
            </>}
            {isInProgressTrip(normalizedStatus) && <>
              <button className="btn btn-yellow" onClick={() => navigate(`/driver/map?id=${encodeURIComponent(trip.id)}`)}>Continue Delivery</button>
              <button className="btn btn-dark" onClick={() => navigate(`/driver/report-issue?id=${encodeURIComponent(trip.id)}`)}>Report Issue</button>
            </>}
            {isReportedIssue(normalizedStatus) && <button className="btn btn-dark" onClick={() => navigate(`/driver/report-issue?id=${encodeURIComponent(trip.id)}`)}>View Saved Report</button>}
            {!isPendingTrip(normalizedStatus) && !isInProgressTrip(normalizedStatus) && <button className="btn btn-dark" onClick={() => navigate('/driver/history')}>Back to History</button>}
          </div>
        </div>

        <div className="map-card">
          <div className="map-badge">Persisted route information</div>
          <div className="route-block" style={{ marginTop: 18 }}>
            <div className="route-point">
              <span className="dot" />
              <div><small>Pickup</small><strong>{pickup}</strong></div>
            </div>
            <div className="route-point">
              <span className="dot" />
              <div><small>Drop-off</small><strong>{drop}</strong></div>
            </div>
          </div>
          <div className="map-bottom">
            <div>
              <span>Distance</span>
              <strong>{distance}</strong>
            </div>
            <div>
              <span>ETA</span>
              <strong>{eta}</strong>
            </div>
          </div>
          <p style={{ color: '#9ca3af', margin: '16px 0 0', lineHeight: 1.5 }}>
            Live GPS and speed are not available because no location provider is connected.
          </p>
        </div>
      </div>

      <section className="notes-section">
        <h2>Delivery Notes</h2>
        <p>Local notes for this order. These notes remain on this page.</p>

        <div className="notes-grid">
          <div className="note-card">
            <label>Note</label>
            <textarea placeholder="Add a delivery note for this order" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="note-actions">
              <button className="btn btn-yellow" disabled={savingNote} onClick={handleSaveNote}>
                {savingNote ? 'Saving...' : 'Save Note'}
              </button>
              <button className="btn btn-dark" onClick={() => setNote('')}>
                Clear
              </button>
            </div>
          </div>

          <div className="notes-list">
            {notes.length === 0 ? (
              <div className="empty-state">No notes added yet.</div>
            ) : (
              notes.map((n, i) => (
                <div className="saved-note" key={i}>
                  <strong>Note {i + 1}</strong>
                  <p>{n.text}</p>
                  <p style={{ marginTop: 8, color: '#9ca3af', fontSize: 12 }}>{new Date(n.time).toLocaleString('en-IN')}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <style>{`
        .details-grid { display: grid; grid-template-columns: 1.05fr 1fr; gap: 24px; }
        .details-card, .map-card, .note-card, .notes-list { background: linear-gradient(135deg, #1f1f1f, #111); border: 1px solid #262626; border-radius: 20px; padding: 22px; color: #fff; box-shadow: 0 18px 40px rgba(0,0,0,.25); }
        .title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 22px; }
        .title-row h2 { margin: 0; font-size: 28px; font-weight: 900; }
        .title-row p { margin: 8px 0 0; color: #9ca3af; font-weight: 600; }
        .status-pill { display: inline-flex; width: fit-content; background: rgba(255,212,0,.15); color: #ffd400; border: 1px solid rgba(255,212,0,.35); border-radius: 999px; padding: 7px 12px; font-size: 12px; font-weight: 900; white-space: nowrap; }
        .route-block { display: grid; gap: 18px; margin-bottom: 22px; background: #0b0b0b; border: 1px solid #262626; border-radius: 18px; padding: 18px; }
        .route-point { display: flex; gap: 14px; align-items: flex-start; }
        .dot { width: 14px; height: 14px; border-radius: 999px; background: #ffd400; box-shadow: 0 0 0 5px rgba(255,212,0,.15); margin-top: 4px; flex: 0 0 auto; }
        .route-point span, .info-grid span, .package-box span, .map-bottom span, .note-card label { display: block; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; font-weight: 900; margin-bottom: 5px; }
        .route-point strong, .info-grid strong, .package-box strong { font-size: 15px; line-height: 1.4; }
        .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 18px; }
        .info-grid > div, .package-box > div { background: #0b0b0b; border: 1px solid #262626; border-radius: 16px; padding: 14px; }
        .package-box { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
        .package-box > div:last-child { grid-column: 1 / -1; }
        .actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .btn { border: none; border-radius: 14px; padding: 13px 16px; font-weight: 900; cursor: pointer; text-decoration: none; display: inline-flex; justify-content: center; align-items: center; text-align: center; font-family: Inter, sans-serif; }
        .btn-yellow { background: #ffd400; color: #000; }
        .btn-red { background: rgba(239,68,68,.14); color: #fecaca; border: 1px solid #ef4444; }
        .btn-dark { background: #0b0b0b; color: #fff; border: 1px solid #262626; }
        .btn:disabled { opacity: .65; cursor: not-allowed; }
        .map-card { min-height: 0; }
        .map-badge { display: inline-flex; background: rgba(0,0,0,.78); color: #fff; padding: 12px 18px; border-radius: 999px; font-weight: 900; }
        .map-bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 18px; }
        .map-bottom > div { background: rgba(0,0,0,.78); border-radius: 16px; padding: 14px 18px; }
        .map-bottom strong { display: block; font-size: 28px; margin-top: 4px; }
        .notes-section { margin-top: 30px; }
        .notes-section h2 { margin: 0; font-size: 28px; font-weight: 900; }
        .notes-section p { color: #9ca3af; margin: 8px 0 18px; }
        .notes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .note-card textarea { width: 100%; box-sizing: border-box; min-height: 130px; background: #070707; color: #fff; border: 1px solid #2a2a2a; border-radius: 14px; padding: 14px; outline: none; resize: vertical; font-family: Inter, sans-serif; font-weight: 600; }
        .note-card textarea:focus { border-color: #ffd400; box-shadow: 0 0 0 3px rgba(255,212,0,.15); }
        .note-actions { display: flex; gap: 12px; margin-top: 12px; }
        .notes-list { display: flex; flex-direction: column; gap: 14px; }
        .saved-note { background: #0b0b0b; border: 1px solid #262626; border-radius: 16px; padding: 16px; }
        .saved-note strong { display: block; margin-bottom: 8px; }
        .saved-note p { margin: 0; color: #d1d5db; line-height: 1.5; }
        .empty-state { background: #0b0b0b; border: 1px dashed #333; border-radius: 16px; padding: 22px; color: #9ca3af; text-align: center; font-weight: 700; }
        @media (max-width: 1100px) { .details-grid, .notes-grid { grid-template-columns: 1fr; } .actions, .info-grid, .package-box { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
