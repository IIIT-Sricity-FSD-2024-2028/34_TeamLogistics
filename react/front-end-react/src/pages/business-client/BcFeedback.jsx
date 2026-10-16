import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Deliveries, Trips } from '../../api/namespaces';
import { getArray, getPickup, getDropoff } from './bcUtils';

export default function BcFeedback() {
  const [params] = useSearchParams();
  const deliveryId = params.get('id');
  const navigate = useNavigate();

  const [delivery, setDelivery] = useState(null);
  const [trip, setTrip] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [deliveryQuality, setDeliveryQuality] = useState('');
  const [driverBehavior, setDriverBehavior] = useState('');
  const [overallExperience, setOverallExperience] = useState('');
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!deliveryId) {
        setMessage({ text: 'Missing delivery ID. Please open feedback from a completed delivery.', type: 'error' });
        return;
      }

      try {
        const d = await Deliveries.getOne(deliveryId);
        if (cancelled) return;

        setDelivery(d);

        try {
          const tripsResult = await Trips.getAll();
          const trips = getArray(tripsResult);
          const linkedTrip = trips.find((t) =>
            [t.request, t.deliveryId, t.delivery_id, t.requestId, t.deliveryRequestId]
              .some((value) => String(value || '') === String(deliveryId)),
          ) || null;
          if (!cancelled) setTrip(linkedTrip);
        } catch (tripError) {
          console.warn('Optional trip details could not be loaded:', tripError);
        }
      } catch (error) {
        console.error('Feedback page load failed:', error);
        if (!cancelled) setMessage({ text: `Could not load feedback data: ${error.message}`, type: 'error' });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [deliveryId]);

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
    setSubmitting(true);
    try {
      await Deliveries.feedback(delivery.id, payload);
      navigate('/business-client/completed-deliveries?feedback=submitted', { replace: true });
    } catch (error) {
      console.error('Feedback submit failed:', error);
      setMessage({ text: `Feedback submit failed: ${error.message}`, type: 'error' });
      setSubmitting(false);
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

      <style>{`
        body { font-family: Inter, sans-serif; }
        .back-link { display: inline-block; color: #9ca3af; text-decoration: none; font-size: 16px; margin-bottom: 18px; }
        .feedback-card { max-width: 980px; background: linear-gradient(135deg, #1f1f1f, #111); border: 1px solid #262626; border-radius: 22px; padding: 28px; color: #fff; box-shadow: 0 18px 40px rgba(0,0,0,.25); }
        .feedback-card .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .feedback-card label { display: block; margin: 18px 0 8px; color: #9fb0c9; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; font-size: 13px; }
        .feedback-card input, .feedback-card textarea, .feedback-card select { width: 100%; box-sizing: border-box; background: #050505; border: 1px solid #1f2937; color: #fff; border-radius: 14px; padding: 15px 16px; font-family: Inter, sans-serif; font-weight: 700; outline: none; }
        .feedback-card input:focus, .feedback-card textarea:focus, .feedback-card select:focus { border-color: #ffd400; box-shadow: 0 0 0 3px rgba(255, 212, 0, .15); }
        .feedback-card textarea { min-height: 130px; resize: vertical; }
        .feedback-card input[readonly] { opacity: .85; cursor: not-allowed; }
        .summary-box { margin-top: 18px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .summary-box div { background: #080808; border: 1px solid #262626; border-radius: 16px; padding: 16px; }
        .summary-box span { display: block; color: #9ca3af; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px; }
        .summary-box strong { display: block; font-size: 15px; }
        .saved-feedback { margin-top: 22px; display: grid; gap: 16px; }
        .saved-feedback-rating, .saved-feedback-grid > div, .saved-feedback-comment { background: #080808; border: 1px solid #262626; border-radius: 16px; padding: 16px; }
        .saved-feedback-rating > span, .saved-feedback-grid span, .saved-feedback-comment > span { display: block; color: #9fb0c9; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 7px; }
        .saved-feedback-rating strong { font-size: 26px; color: #fff; }
        .saved-stars { display: flex; gap: 5px; margin-top: 8px; color: #4b5563; font-size: 28px; }
        .saved-stars .active { color: #ffd400; }
        .saved-feedback-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .saved-feedback-grid strong { color: #fff; }
        .saved-feedback-comment p { margin: 0; color: #fff; line-height: 1.6; white-space: pre-wrap; }
        .stars { display: flex; gap: 10px; margin-bottom: 8px; }
        .stars button { background: transparent; border: none; font-size: 34px; cursor: pointer; color: #4b5563; transition: transform .15s ease, color .15s ease; }
        .stars button.active { color: #ffd400; }
        .stars button:hover { transform: scale(1.08); }
        .stars button:disabled { cursor: default; }
        .stars button:disabled:hover { transform: none; }
        .actions { display: flex; gap: 12px; margin-top: 20px; }
        .yellow-btn, .dark-btn { border: none; border-radius: 14px; padding: 14px 20px; font-weight: 900; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; font-family: Inter, sans-serif; }
        .yellow-btn { background: #ffd400; color: #000; }
        .yellow-btn:disabled { opacity: .6; cursor: not-allowed; }
        .dark-btn { background: #0b0b0b; color: #fff; border: 1px solid #262626; }
        .feedback-card > form > .success, .feedback-card > form > .error { margin-top: 16px; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 800; }
        .success { background: rgba(16, 185, 129, .12); border: 1px solid #10b981; color: #d1fae5; }
        .error { background: rgba(239, 68, 68, .12); border: 1px solid #ef4444; color: #fecaca; }
        @media (max-width: 800px) {
          .feedback-card .form-grid, .summary-box, .saved-feedback-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}
