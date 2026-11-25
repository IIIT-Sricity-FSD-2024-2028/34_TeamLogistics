import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGetTripsQuery, useUploadDocumentMutation, useReportTripIssueMutation, EMPTY_LIST, queryError } from '../../redux/driverApi';
import { useDriverTrip } from '../../redux/useDriverTrip';
import { usePageHeader } from '../../hooks/usePageHeader';
import { isInProgressTrip, isReportedIssue } from './tripStatus';

export default function DriverReportIssue() {
  usePageStyleScope('driver-report-issue');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tripId = params.get('id');

  const { trip, delivery, error: tripError } = useDriverTrip(tripId);
  const tripsQuery = useGetTripsQuery({page:1,limit:100,view:'driver-working'},{skip:Boolean(tripId)});
  const allTrips = tripsQuery.data?.items || EMPTY_LIST;
  const loadError = (tripId ? tripError : '') || queryError(tripsQuery);
  const [uploadDocument] = useUploadDocumentMutation();
  const [reportTripIssue] = useReportTripIssueMutation();
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const deliveryId = trip ? trip.request || trip.deliveryId || trip.deliveryRequestId : '';
  usePageHeader('Report Issue', deliveryId ? `Submit an incident for ${deliveryId}` : 'Submit an incident for this delivery');

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
    if (issueType === 'Failed delivery attempt' && !photo) {
      setMessage({ text: 'Attach a photo documenting the failed handoff.', type: 'error' }); return;
    }
    if (photo && photo.size > 5 * 1024 * 1024) {
      setMessage({ text: 'Photo evidence must be 5 MB or smaller.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      let evidenceId;
      if (photo) {
        const dId = trip.request || trip.deliveryId || trip.deliveryRequestId || trip.id;
        const fd = new FormData();
        fd.append('ownerType', 'delivery');
        fd.append('delivery', dId);
        fd.append('documentType', 'Issue Evidence');
        fd.append('status', 'Submitted');
        fd.append('file', photo);
        evidenceId = (await uploadDocument(fd).unwrap()).id;
      }
      await reportTripIssue({ id: trip.id, issueType, evidenceId, description: description.trim() }).unwrap();

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
                  {trip.status === 'In Transit' && <option value="Failed delivery attempt">Failed delivery attempt (e.g. recipient unavailable)</option>}
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

    </section>
  );
}
