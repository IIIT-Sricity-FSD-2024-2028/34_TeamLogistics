import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Trips, Deliveries, Documents } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useLiveSync } from '../../hooks/useLiveSync';
import { isInProgressTrip, isReportedIssue } from './tripStatus';

export default function DriverReportIssue() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tripId = params.get('id');

  const [trip, setTrip] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [allTrips, setAllTrips] = useState([]);
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');

  const deliveryId = trip ? trip.request || trip.deliveryId || trip.deliveryRequestId : '';
  usePageHeader('Report Issue', deliveryId ? `Submit an incident for ${deliveryId}` : 'Submit an incident for this delivery');

  async function load() {
      try {
        setLoadError('');
        const trips = await Trips.getAll();
        setAllTrips(trips || []);
        if (!tripId) { setTrip(null); setDelivery(null); return; }
        const t = await Trips.getOne(tripId);
        setTrip(t);

        const dId = t.request || t.deliveryId || t.deliveryRequestId;
        if (dId) {
          try {
            const d = await Deliveries.getOne(dId);
            setDelivery(d);
          } catch {}
        }

      } catch (e) {
        setLoadError(e.message || 'Failed to load trip.');
      }
  }
  useEffect(() => { load(); }, [tripId]);
  useLiveSync(load, { enabled: !submitting });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!trip) {
      setMessage({ text: 'Trip is not loaded yet.', type: 'error' });
      return;
    }
    if (!isInProgressTrip(trip.status)) {
      setMessage({ text: isReportedIssue(trip.status) ? 'This issue is already reported. View the saved report below.' : 'Accept the trip before reporting an issue.', type: 'error' });
      return;
    }
    if (!issueType || !description.trim()) {
      setMessage({ text: 'Issue type and description are required.', type: 'error' });
      return;
    }
    if (photo && photo.size > 5 * 1024 * 1024) {
      setMessage({ text: 'Photo evidence must be 5 MB or smaller.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      if (photo) {
        const dId = trip.request || trip.deliveryId || trip.deliveryRequestId || trip.id;
        const fd = new FormData();
        fd.append('ownerType', 'delivery');
        fd.append('delivery', dId);
        fd.append('documentType', 'Issue Evidence');
        fd.append('status', 'Submitted');
        fd.append('file', photo);
        await Documents.create(fd);
      }
      const updated = await Trips.reportIssue(trip.id, issueType, description.trim(), 'Issue Reported');
      setTrip(updated);
      setAllTrips((previous) => previous.map((item) => item.id === updated.id ? updated : item));

      setMessage({ text: 'Issue reported successfully. Returning to the dashboard...', type: 'success' });
      setTimeout(() => navigate('/driver/dashboard', { replace: true }), 900);
    } catch (e) {
      setMessage({ text: `Issue report failed: ${e.message}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  const canReport = trip && isInProgressTrip(trip.status);
  const alreadyReported = trip && isReportedIssue(trip.status);

  return (
    <section className="content">
      <div className="issue-layout">
        <div className="issue-card">
          <h2>{alreadyReported ? 'Saved Issue Report' : 'Report an Issue'}</h2>
          <p className="muted">{alreadyReported ? 'This issue has already been saved and sent to the fleet manager. It is no longer a dashboard assignment.' : 'Select an accepted delivery and describe the issue.'}</p>

          {loadError && <div className="empty-state">{loadError}</div>}
          {message && <div role="status" className={message.type}>{message.text}</div>}
          {!tripId && <div>
            <label htmlFor="issue-trip">Choose a delivery</label>
            <select id="issue-trip" value="" onChange={(e) => e.target.value && navigate(`/driver/report-issue?id=${encodeURIComponent(e.target.value)}`)}>
              <option value="">Select an accepted trip</option>
              {allTrips.filter((item) => isInProgressTrip(item.status)).map((item) => <option key={item.id} value={item.id}>{item.request || item.id} — {item.status}</option>)}
            </select>
            {!allTrips.some((item) => isInProgressTrip(item.status)) && <p className="muted" style={{ marginTop: 16 }}>No accepted deliveries are available to report. Accept a delivery from the dashboard first.</p>}
          </div>}
          {trip && !canReport && <div className="report-item">
            <h3>{alreadyReported ? trip.issueType || 'Issue reported' : `Trip status: ${trip.status}`}</h3>
            <p>{trip.issueDescription || 'Issues can only be reported during an accepted delivery.'}</p>
            {trip.issueReportedAt && <p>Reported: {new Date(trip.issueReportedAt).toLocaleString('en-IN')}</p>}
            <div className="actions"><button className="dark-btn" onClick={() => navigate('/driver/history')}>View History</button><button className="dark-btn" onClick={() => navigate('/driver/dashboard')}>Back to Dashboard</button></div>
          </div>}

          {canReport && <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div>
                <label>Trip ID</label>
                <input type="text" readOnly value={trip?.id || tripId || ''} />
              </div>
              <div>
                <label>Delivery ID</label>
                <input type="text" readOnly value={deliveryId || '--'} />
              </div>
            </div>

            <div className="form-row">
              <div>
                <label>Issue Type *</label>
                <select value={issueType} onChange={(e) => setIssueType(e.target.value)} required>
                  <option value="">Select issue type</option>
                  <option>Vehicle problem</option>
                  <option>Traffic delay</option>
                  <option>Customer unavailable</option>
                  <option>Package damaged</option>
                  <option>Address issue</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label>Current Status</label>
                <input type="text" readOnly value={trip?.status || delivery?.status || '--'} />
              </div>
            </div>

            <label>Issue Description *</label>
            <textarea required placeholder="Describe the issue in detail..." value={description} onChange={(e) => setDescription(e.target.value)} />

            <label>Upload Photo Evidence (Optional)</label>
            <div className="upload-box">
              <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
              <p>Click to upload photo</p>
              <span>PNG or JPG up to 5 MB</span>
            </div>


            <div className="actions">
              <button className="yellow-btn" type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
              <button
                className="dark-btn"
                type="button"
                onClick={() => {
                  const activeTripId = trip?.id || tripId;
                  navigate(activeTripId ? `/driver/map?id=${encodeURIComponent(activeTripId)}` : '/driver/dashboard', { replace: true });
                }}
              >
                Cancel
              </button>
            </div>
          </form>}
        </div>

      </div>

      <style>{`
        .issue-layout { width: min(100%, 920px); margin: 0 auto; }
        .issue-card { background: linear-gradient(135deg, #1f1f1f, #111); border: 1px solid #262626; border-radius: 20px; padding: 24px; color: #fff; box-shadow: 0 18px 40px rgba(0,0,0,.25); }
        .issue-card h2 { margin: 0 0 18px; font-size: 28px; font-weight: 900; }
        .muted { color: #9ca3af; margin: 0 0 18px; line-height: 1.5; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        label { display: block; margin: 12px 0 8px; color: #fff; font-weight: 800; }
        input, select, textarea { width: 100%; box-sizing: border-box; background: #0b0b0b; border: 1px solid #2a2a2a; color: #fff; border-radius: 14px; padding: 14px; outline: none; font-family: Inter, sans-serif; font-weight: 700; }
        textarea { min-height: 150px; resize: vertical; }
        input:focus, select:focus, textarea:focus { border-color: #ffd400; box-shadow: 0 0 0 3px rgba(255,212,0,.15); }
        input[readonly] { opacity: .8; cursor: not-allowed; }
        .upload-box { border: 1px dashed #3a3a3a; border-radius: 18px; padding: 30px; text-align: center; background: #0b0b0b; color: #9ca3af; }
        .upload-box input { border: none; background: transparent; padding: 0; margin-bottom: 10px; }
        .upload-box p { margin: 8px 0 4px; font-weight: 800; color: #d1d5db; }
        .upload-box span { font-size: 13px; color: #9ca3af; }
        .actions { display: flex; gap: 12px; margin-top: 18px; }
        .yellow-btn, .dark-btn { border: none; border-radius: 14px; padding: 13px 18px; font-weight: 900; cursor: pointer; text-decoration: none; font-family: Inter, sans-serif; display: inline-flex; align-items: center; justify-content: center; }
        .yellow-btn { background: #ffd400; color: #000; }
        .dark-btn { background: #111; color: #fff; border: 1px solid #333; }
        .yellow-btn:disabled { opacity: .6; cursor: not-allowed; }
        .report-item { border: 1px solid #262626; background: #0b0b0b; border-radius: 16px; padding: 16px; margin-bottom: 12px; }
        .report-item h3 { margin: 0 0 8px; font-size: 17px; font-weight: 900; }
        .report-item p { margin: 6px 0; color: #d1d5db; line-height: 1.5; }
        .empty-state { background: #0b0b0b; border: 1px dashed #333; border-radius: 16px; padding: 24px; color: #9ca3af; text-align: center; font-weight: 700; }
        .success { margin-top: 14px; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 800; background: rgba(16,185,129,.12); border: 1px solid #10b981; color: #d1fae5; }
        .error { margin-top: 14px; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 800; background: rgba(239,68,68,.12); border: 1px solid #ef4444; color: #fecaca; }
        @media (max-width: 1000px) { .form-row { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
