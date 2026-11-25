import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGetTripsQuery, useUpdateTripStatusMutation, useAddTripNoteMutation, EMPTY_LIST } from '../../redux/driverApi';
import { useDriverTrip } from '../../redux/useDriverTrip';
import { useSession } from '../../auth/SessionContext';
import { usePageHeader } from '../../hooks/usePageHeader';
import { isPendingTrip, isInProgressTrip, isReportedIssue } from './tripStatus';
import { formatDeliveryPrice } from '../../utils/deliveryPricing';

function normalize(v) {
  return String(v || '').trim().toLowerCase();
}


export default function DriverTaskDetails() {
  usePageStyleScope('driver-task-details');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const driverName = session?.name || '';
  const tripId = params.get('id');

  const { trip, delivery, loading, error } = useDriverTrip(tripId);
  const tripsQuery = useGetTripsQuery();
  const tripDriver = normalize(trip?.driver || trip?.assignedDriver || trip?.driverName);
  const forbidden = Boolean(driverName && tripDriver && tripDriver !== normalize(driverName));
  const otherActive = (tripsQuery.data || EMPTY_LIST).some((other) =>
    String(other.id) !== String(tripId)
    && normalize(other.driver || other.assignedDriver || other.driverName) === normalize(driverName)
    && isInProgressTrip(other.status));
  const [acceptTrip, { isLoading: accepting }] = useUpdateTripStatusMutation();
  const [rejectTrip, { isLoading: rejecting }] = useUpdateTripStatusMutation();
  const [addTripNote, { isLoading: savingNote }] = useAddTripNoteMutation();
  const [note, setNote] = useState('');

  usePageHeader(trip ? `Delivery #${trip.request || trip.deliveryId || trip.deliveryRequestId || trip.id}` : 'Task Details', trip ? `Task details for ${trip.id}` : 'Loading task details...');

  async function handleAccept() {
    if (!trip) return;
    try {
      await acceptTrip({ id: tripId, status: 'Accepted' }).unwrap();
      navigate(`/driver/map?id=${encodeURIComponent(tripId)}`);
    } catch (e) {
      alert(e.message || 'Failed to accept this delivery.');
    }
  }

  async function handleReject() {
    if (!trip) return;
    try {
      await rejectTrip({ id: tripId, status: 'Rejected' }).unwrap();
      navigate('/driver/dashboard');
    } catch (e) {
      alert(e.message || 'Failed to reject this delivery.');
    }
  }

  async function handleSaveNote() {
    const value = note.trim();
    if (!value || !tripId) return;
    try {
      await addTripNote({ id: tripId, text: value }).unwrap();
      setNote('');
    } catch (e) {
      alert('Failed to save note: ' + (e.message || 'unknown error'));
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
            <div>
              <span>Delivery Price</span>
              <strong>{formatDeliveryPrice(delivery || trip)}</strong>
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
            {normalizedStatus === 'attempt failed' && <p>Awaiting your fleet manager’s decision.</p>}
            {normalizedStatus === 'returning' && <button className="btn btn-yellow" disabled={accepting} onClick={async () => {
              try { await acceptTrip({ id: tripId, status: 'Returned' }).unwrap(); }
              catch (error) { alert(error.message || 'Could not confirm return'); }
            }}>Confirm parcel returned to sender</button>}
            {isPendingTrip(normalizedStatus) && <>
              <button className="btn btn-yellow" disabled={otherActive || accepting || rejecting || !tripsQuery.isSuccess} onClick={handleAccept} title={otherActive ? 'Complete your current delivery before accepting a new one' : ''}>{accepting ? 'Updating...' : 'Accept Order'}</button>
              <button className="btn btn-red" disabled={rejecting || accepting} onClick={handleReject}>{rejecting ? 'Rejecting...' : 'Reject'}</button>
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

    </section>
  );
}
