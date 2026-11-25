import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCompleteDeliveryMutation, useSendRecipientCodeMutation } from '../../redux/driverApi';
import { useDriverTrip } from '../../redux/useDriverTrip';
import { usePageHeader } from '../../hooks/usePageHeader';

export default function DriverProofOfDelivery() {
  usePageStyleScope('driver-proof-of-delivery');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tripId = params.get('id');

  const { trip, delivery, error: loadError } = useDriverTrip(tripId);
  const [completeDelivery] = useCompleteDeliveryMutation();
  const [sendCode, sendState] = useSendRecipientCodeMutation();
  const [parcelBarcode, setParcelBarcode] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryOtp, setDeliveryOtp] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const requestId = trip ? trip.request || trip.deliveryId || trip.deliveryRequestId || trip.id : '';
  usePageHeader('Proof of Delivery', requestId ? `Complete ${requestId}` : 'Upload proof and complete the delivery');

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
    if (!/^\d{6}$/.test(deliveryOtp)) {
      setMessage({ text: 'Enter the six-digit OTP provided by the recipient.', type: 'error' });
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
      const body = new FormData();
      body.append('parcelBarcode', parcelBarcode);
      body.append('deliveryOtp', deliveryOtp);
      body.append('recipient', recipient.trim());
      body.append('notes', notes.trim());
      body.append('file', proofFile);
      await completeDelivery({ id: tripId, body }).unwrap();

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

            {delivery?.requiresParcelScan && <label>Parcel barcode<input required className="input" value={parcelBarcode} onChange={(e) => setParcelBarcode(e.target.value)} placeholder="Scan or enter label digits" /></label>}
            <label>Delivery Notes</label>
            <textarea placeholder="Optional proof notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

            <button type="button" disabled={!requestId || sendState.isLoading} onClick={async () => {
              try {
                const result = await sendCode(requestId).unwrap();
                setMessage({ text: result.message, type: 'success' });
              } catch (error) {
                setMessage({ text: error.message, type: 'error' });
              }
            }}>Send code to recipient</button>
            <label>Delivery OTP *</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="Enter 6-digit OTP"
              value={deliveryOtp}
              onChange={(e) => setDeliveryOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <small>Ask the recipient for the OTP only after handing over the package.</small>

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

    </section>
  );
}
