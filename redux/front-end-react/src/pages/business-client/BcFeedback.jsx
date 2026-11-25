import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useGetDeliveryQuery, useGetTripsQuery, useSubmitFeedbackMutation, EMPTY_LIST } from '../../redux/businessClientApi';
import { getPickup, getDropoff } from './bcUtils';

export default function BcFeedback() {
  usePageStyleScope('bc-feedback');
  const [params] = useSearchParams();
  const deliveryId = params.get('id');
  const navigate = useNavigate();

  const deliveryQuery = useGetDeliveryQuery(deliveryId, { skip: !deliveryId });
  const delivery = deliveryQuery.currentData || null;
  const tripsQuery = useGetTripsQuery(undefined, { skip: !deliveryId });
  const trip = (tripsQuery.data || EMPTY_LIST).find((item) =>
    [item.request, item.deliveryId, item.delivery_id, item.requestId, item.deliveryRequestId]
      .some((value) => String(value || '') === String(deliveryId))) || null;
  const loadError = !deliveryId ? 'Missing delivery ID. Please open feedback from a completed delivery.' : deliveryQuery.error?.message || '';
  const [submitFeedback, { isLoading: submitting }] = useSubmitFeedbackMutation();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [deliveryQuality, setDeliveryQuality] = useState('');
  const [driverBehavior, setDriverBehavior] = useState('');
  const [overallExperience, setOverallExperience] = useState('');
  const [actionMessage, setMessage] = useState(null);
  const message = actionMessage || (loadError ? { text: loadError, type: 'error' } : null);
  async function handleSubmit(e) {
    e.preventDefault();
    if (!delivery) {
      setMessage({ text: 'Delivery is not loaded yet.', type: 'error' });
      return;
    }

    if (!rating || !deliveryQuality || !driverBehavior || !overallExperience) {
      setMessage({
        text: 'Please select an overall rating, delivery quality, driver behavior, and overall experience.',
        type: 'error',
      });
      return;
    }

    const payload = { rating, comment: comment.trim(), deliveryQuality, driverBehavior, overallExperience };

    setMessage(null);
    try {
      await submitFeedback({ id: delivery.id, feedback: payload }).unwrap();
      navigate('/business-client/completed-deliveries?feedback=submitted', { replace: true });
    } catch (error) {
      console.error('Feedback submit failed:', error);
      setMessage({ text: `Feedback submit failed: ${error.message}`, type: 'error' });
    }
  }

  const savedFeedback = delivery?.feedback || null;
  const isViewingFeedback = Boolean(savedFeedback);

  let packageDisplay = '--';
  if (delivery) {
    const pkgType = delivery.packageType || '';
    const pkgDims = delivery.packageDimensions;
    if (pkgType && pkgDims && pkgDims.length) {
      packageDisplay = `${pkgType} — ${pkgDims.length} × ${pkgDims.width} × ${pkgDims.height} ${pkgDims.unit || 'cm'}`;
    } else if (pkgType) {
      packageDisplay = pkgType;
    } else {
      packageDisplay = delivery.package || delivery.item || '--';
    }
  }

  return (
    <>
      <h1 className="page-title">{isViewingFeedback ? 'View Feedback' : 'Provide Feedback'}</h1>
      <p className="page-subtitle">
        {isViewingFeedback ? 'Your submitted delivery feedback' : 'Rate your completed delivery experience'}
      </p>

      <div className="feedback-card">
        <form id="feedbackForm" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div>
              <label>Delivery ID</label>
              <input type="text" readOnly value={delivery?.id || deliveryId || ''} />
            </div>
            <div>
              <label>Trip ID</label>
              <input type="text" readOnly value={trip?.id || '--'} />
            </div>
            <div>
              <label>Driver</label>
              <input type="text" readOnly value={trip?.driver || delivery?.driver || delivery?.assignedDriver || 'Not assigned'} />
            </div>
            <div>
              <label>Status</label>
              <input type="text" readOnly value={delivery?.status || trip?.status || '--'} />
            </div>
          </div>

          <div className="summary-box">
            <div>
              <span>From</span>
              <strong>{delivery ? getPickup(delivery) : '--'}</strong>
            </div>
            <div>
              <span>To</span>
              <strong>{delivery ? getDropoff(delivery) : '--'}</strong>
            </div>
            <div>
              <span>Package</span>
              <strong>{packageDisplay}</strong>
            </div>
          </div>

          {isViewingFeedback ? (
            <section className="saved-feedback" aria-label="Submitted feedback">
              <div className="saved-feedback-rating">
                <span>Overall Rating</span>
                <strong>{Number(savedFeedback.rating) || 0}/5</strong>
                <div className="saved-stars" aria-label={`${Number(savedFeedback.rating) || 0} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <span key={value} className={value <= Number(savedFeedback.rating) ? 'active' : ''}>★</span>
                  ))}
                </div>
              </div>

              <div className="saved-feedback-grid">
                <div>
                  <span>Delivery Quality</span>
                  <strong>{savedFeedback.deliveryQuality || 'Not provided'}</strong>
                </div>
                <div>
                  <span>Driver Behavior</span>
                  <strong>{savedFeedback.driverBehavior || 'Not provided'}</strong>
                </div>
                <div>
                  <span>Overall Experience</span>
                  <strong>{savedFeedback.overallExperience || 'Not provided'}</strong>
                </div>
                <div>
                  <span>Submitted</span>
                  <strong>{savedFeedback.submittedAt ? new Date(savedFeedback.submittedAt).toLocaleString() : 'Date unavailable'}</strong>
                </div>
              </div>

              <div className="saved-feedback-comment">
                <span>Comments</span>
                <p>{savedFeedback.comment || 'No comments provided.'}</p>
              </div>
            </section>
          ) : (
            <>
          <label>Overall Rating *</label>
          <div className="stars" id="stars" role="radiogroup" aria-label="Overall rating" aria-required="true">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={rating === v}
                aria-label={`${v} out of 5 stars`}
                disabled={isViewingFeedback}
                className={v <= rating ? 'active' : ''}
                onClick={() => setRating(v)}
              >
                ★
              </button>
            ))}
          </div>

          <label>Share Your Experience</label>
          <textarea readOnly={isViewingFeedback} placeholder="Tell us what went well and what can be improved" value={comment} onChange={(e) => setComment(e.target.value)}></textarea>

          <div className="form-grid">
            <div>
              <label>Delivery Quality *</label>
              <select required disabled={isViewingFeedback} value={deliveryQuality} onChange={(e) => setDeliveryQuality(e.target.value)}>
                <option value="">Select quality</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Average">Average</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
            <div>
              <label>Driver Behavior *</label>
              <select required disabled={isViewingFeedback} value={driverBehavior} onChange={(e) => setDriverBehavior(e.target.value)}>
                <option value="">Select behavior</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Average">Average</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
          </div>

          <label>Overall Experience *</label>
          <select required disabled={isViewingFeedback} value={overallExperience} onChange={(e) => setOverallExperience(e.target.value)}>
            <option value="">Select experience</option>
            <option value="Very satisfied">Very satisfied</option>
            <option value="Satisfied">Satisfied</option>
            <option value="Neutral">Neutral</option>
            <option value="Unsatisfied">Unsatisfied</option>
          </select>
            </>
          )}

          {message && <div className={message.type}>{message.text}</div>}

          <div className="actions">
            {!isViewingFeedback && (
              <button id="submitBtn" type="submit" className="yellow-btn" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            )}
            <Link to="/business-client/completed-deliveries" className="dark-btn">
              {isViewingFeedback ? 'Back' : 'Cancel'}
            </Link>
          </div>
        </form>
      </div>

    </>
  );
}
