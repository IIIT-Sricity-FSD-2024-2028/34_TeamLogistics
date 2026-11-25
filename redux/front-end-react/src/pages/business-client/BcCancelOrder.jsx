import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useGetDeliveryQuery, useCancelDeliveryMutation } from '../../redux/businessClientApi';

const REASONS = ['Wrong delivery details', 'Order no longer needed', 'Delay in pickup'];

export default function BcCancelOrder() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get('order') || params.get('id');

  const query = useGetDeliveryQuery(orderId, { skip: !orderId });
  const delivery = query.currentData || null;
  const loaded = !orderId || (!query.isLoading && !query.isFetching);
  const status = String(delivery?.status || '').toLowerCase();
  const closed = !['requested', 'pending', 'queued', 'assigned', 'accepted'].includes(status);
  const disabled = !delivery || closed;
  const loadError = !orderId ? 'No order was selected to cancel.' : query.isError || (loaded && !delivery) ? 'This order could not be found.' : closed ? 'This order can no longer be cancelled.' : '';
  const [cancelDelivery, { isLoading: submitting }] = useCancelDeliveryMutation();
  const [reason, setReason] = useState(REASONS[0]);
  const [notes, setNotes] = useState('');
  const [actionError, setError] = useState('');
  const error = actionError || loadError;
  async function handleConfirm() {
    if (disabled || submitting) return;
    setError('');
    const finalReason = notes.trim() ? `${reason} — ${notes.trim()}` : reason;

    try {
      await cancelDelivery({ id: delivery.id || orderId, reason: finalReason }).unwrap();
      navigate('/business-client/active-deliveries');
    } catch (err) {
      console.error('Failed to cancel order:', err);
      setError('Failed to cancel this order. Please try again.');
    }
  }

  return (
    <div className="feedback-shell">
      <h1 className="page-title small">Cancel Delivery</h1>
      <p className="page-subtitle">Review order details before cancellation</p>

      <div className="card feedback-card">
        <div
          style={{
            background: 'rgba(255,59,48,.12)',
            border: '1px solid rgba(255,59,48,.35)',
            borderRadius: 14,
            padding: '14px 16px',
            color: '#ff8d87',
            marginBottom: 20,
          }}
        >
          This action cannot be undone once processed.
        </div>

        <div className="form-grid">
          <div>
            <div className="field-label">Order ID</div>
            <div className="value-box">{!loaded ? 'Loading...' : delivery ? `#${delivery.id || orderId}` : 'Not found'}</div>
          </div>
          <div>
            <div className="field-label">Status</div>
            <div className="value-box">{!loaded ? 'Loading...' : delivery ? delivery.status || 'Unknown' : 'Not found'}</div>
          </div>
        </div>

        <div className="field-label">Pickup Location</div>
        <div className="value-box">{!loaded ? 'Loading...' : delivery ? delivery.pickup || 'Not available' : '--'}</div>

        <div className="field-label">Delivery Address</div>
        <div className="value-box">{!loaded ? 'Loading...' : delivery ? delivery.dropoff || delivery.destination || 'Not available' : '--'}</div>

        <div className="field-label">Reason for Cancellation</div>
        <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>

        <div className="field-label">Additional Notes</div>
        <textarea className="textarea" placeholder="Explain the reason for cancellation" value={notes} onChange={(e) => setNotes(e.target.value)}></textarea>

        {error && <div style={{ color: '#ff6b6b', fontSize: 13, marginTop: 10 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 16, marginTop: 20 }}>
          <Link className="btn dark" to="/business-client/active-deliveries">
            Keep Order
          </Link>
          <button type="button" className="btn outline-red" disabled={disabled || submitting} onClick={handleConfirm}>
            {submitting ? 'Cancelling...' : 'Cancel Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
