import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Trips, Deliveries, Documents } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';

export default function DriverProofOfDelivery() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tripId = params.get('id');

  const [trip, setTrip] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [notes, setNotes] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');

  const requestId = trip ? trip.request || trip.deliveryId || trip.deliveryRequestId || trip.id : '';
  usePageHeader('Proof of Delivery', requestId ? `Complete ${requestId}` : 'Upload proof and complete the delivery');

  useEffect(() => {
    (async () => {
      if (!tripId) {
        setLoadError('Trip ID missing in URL.');
        return;
      }
      try {
        const t = await Trips.getOne(tripId);
        setTrip(t);

        const dId = t.request || t.deliveryId || t.deliveryRequestId;
        let d = null;
        if (dId) {
          try {
            d = await Deliveries.getOne(dId);
          } catch {}
        }
        setDelivery(d);
      } catch (e) {
        setLoadError(e.message || 'Failed to load trip.');
      }
    })();
  }, [tripId]);

  const recipient = delivery?.contact || trip?.contact || '';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!trip) {
      setMessage({ text: 'Trip data not loaded yet.', type: 'error' });
      return;
    }
    if (!recipient.trim()) {
      setMessage({ text: 'Recipient name is required.', type: 'error' });
      return;
    }
    if (!proofFile) {
      setMessage({ text: 'Proof photo/signature file is required.', type: 'error' });
      return;
    }
    if (proofFile.size > 5 * 1024 * 1024) {
      setMessage({ text: 'File size must be less than 5 MB.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('ownerType', 'delivery');
      fd.append('delivery', requestId);
      fd.append('documentType', 'Proof of Delivery');
      fd.append('issueDate', new Date().toISOString().slice(0, 10));
      fd.append('status', 'Submitted');
      fd.append('file', proofFile);
      const uploadedProof = await Documents.create(fd);

      await Trips.updateStatus(tripId, 'Completed', {
        recipient: recipient.trim(),
        notes: notes.trim(),
        proofDocumentId: uploadedProof.id,
      });

      setMessage({ text: 'Delivery completed successfully.', type: 'success' });
      setTimeout(() => navigate('/driver/dashboard'), 500);
    } catch (e) {
      setMessage({ text: `Complete delivery failed: ${e.message}`, type: 'error' });
      setSubmitting(false);
    }
  }

  if (loadError && !trip) return <section className="content">{loadError}</section>;

  const customer =
    trip?.customer ||
    trip?.client ||
    trip?.customerName ||
    trip?.clientName ||
    delivery?.customer ||
    delivery?.client ||
    delivery?.customerName ||
    delivery?.clientName ||
    delivery?.company ||
    delivery?.businessName ||
    delivery?.name ||
    'Customer not available';
  const contact = delivery?.contact || trip?.contact || 'Contact not available';
  const pickup = trip?.pickup || trip?.pickupLocation || delivery?.pickup || 'Pickup not available';
  const drop = trip?.destination || trip?.dropoff || trip?.dropLocation || delivery?.dropoff || delivery?.destination || 'Drop not available';
  const poType = trip?.packageType || delivery?.packageType || '';
  const poDims = trip?.packageDimensions || delivery?.packageDimensions;
  const packageInfo = poType && poDims && poDims.length ? `${poType} — ${poDims.length} × ${poDims.width} × ${poDims.height} ${poDims.unit || 'cm'}` : delivery?.package || trip?.package || trip?.packageType || 'Package not available';
  const distance = trip?.distance || delivery?.distance || 'Distance not available';
  const status = trip?.status || delivery?.status || 'Status unavailable';

  return (
    <section className="content">
      <div className="pod-grid">
        <div className="pod-card">
          <h2>Delivery Confirmation</h2>

          <form onSubmit={handleSubmit}>
            <label>Delivery ID</label>
            <input type="text" readOnly value={requestId} />

            <label>Recipient Name *</label>
            <input type="text" readOnly aria-readonly="true" value={recipient} />
            <small>The recipient name comes from the delivery request and cannot be changed by the driver.</small>

            <label>Delivery Notes</label>
            <textarea placeholder="Optional proof notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

            <label>Photo / Signature *</label>
            <input type="file" accept="image/*,.pdf" required onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
            <small>Only image/PDF files up to 5 MB.</small>

            {message && <div className={message.type}>{message.text}</div>}

            <button className="yellow-btn" type="submit" disabled={submitting}>
              {submitting ? (proofFile ? 'Completing delivery...' : 'Uploading proof...') : 'Complete Delivery'}
            </button>
          </form>
        </div>

        <div className="pod-card">
          <h2>Order Summary</h2>
          <div className="summary-row">
            <span>Trip ID</span>
            <strong>{trip?.id || tripId}</strong>
          </div>
          <div className="summary-row">
            <span>Delivery Request</span>
            <strong>{requestId}</strong>
          </div>
          <div className="summary-row">
            <span>Customer</span>
            <strong>{customer}</strong>
          </div>
          <div className="summary-row">
            <span>Contact</span>
            <strong>{contact}</strong>
          </div>
          <div className="summary-row">
            <span>Pickup</span>
            <strong>{pickup}</strong>
          </div>
          <div className="summary-row">
            <span>Drop</span>
            <strong>{drop}</strong>
          </div>
          <div className="summary-row">
            <span>Package</span>
            <strong>{packageInfo}</strong>
          </div>
          <div className="summary-row">
            <span>Status</span>
            <strong className="status-pill">{status}</strong>
          </div>
          <div className="summary-row">
            <span>Distance</span>
            <strong>{distance}</strong>
          </div>
        </div>
      </div>

      <style>{`
        .pod-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; max-width: 1050px; }
        .pod-card { background: linear-gradient(135deg, #1f1f1f, #111); border: 1px solid #262626; border-radius: 20px; padding: 22px; color: #fff; box-shadow: 0 18px 40px rgba(0,0,0,.25); }
        .pod-card h2 { margin: 0 0 22px; font-size: 24px; font-weight: 900; }
        form label { display: block; margin: 14px 0 8px; color: #e5e7eb; font-weight: 800; font-size: 14px; }
        form input, form textarea { width: 100%; box-sizing: border-box; background: #070707; color: #fff; border: 1px solid #2a2a2a; border-radius: 14px; padding: 13px 14px; outline: none; font-family: Inter, sans-serif; font-weight: 600; }
        form input:focus, form textarea:focus { border-color: #ffd400; box-shadow: 0 0 0 3px rgba(255,212,0,.15); }
        form input[readonly] { color: #d1d5db; cursor: not-allowed; opacity: .85; }
        textarea { min-height: 120px; resize: vertical; }
        small { display: block; margin-top: 8px; color: #9ca3af; font-size: 12px; }
        .yellow-btn { margin-top: 18px; width: 100%; border: none; border-radius: 14px; background: #ffd400; color: #000; font-weight: 900; padding: 14px 18px; cursor: pointer; font-family: Inter, sans-serif; }
        .yellow-btn:disabled { opacity: .65; cursor: not-allowed; }
        .summary-row { display: grid; grid-template-columns: 170px 1fr; gap: 16px; padding: 14px 0; border-bottom: 1px solid #262626; align-items: center; }
        .summary-row span { color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; font-weight: 900; }
        .summary-row strong { color: #fff; font-size: 15px; line-height: 1.4; }
        .status-pill { display: inline-flex; width: fit-content; background: rgba(255,212,0,.15); color: #ffd400 !important; border: 1px solid rgba(255,212,0,.35); border-radius: 999px; padding: 6px 10px; font-size: 12px !important; font-weight: 900; }
        .success { margin-top: 14px; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 700; background: rgba(16,185,129,.12); border: 1px solid #10b981; color: #d1fae5; }
        .error { margin-top: 14px; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 700; background: rgba(239,68,68,.12); border: 1px solid #ef4444; color: #fecaca; }
        @media (max-width: 900px) { .pod-grid { grid-template-columns: 1fr; } .summary-row { grid-template-columns: 1fr; gap: 6px; } }
      `}</style>
    </section>
  );
}
