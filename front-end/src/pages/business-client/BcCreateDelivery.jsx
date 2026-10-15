import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Deliveries, Documents, Users } from '../../api/namespaces';
import { getSession } from '../../api/client';

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function BcCreateDelivery() {
  const navigate = useNavigate();

  const [deliveryType, setDeliveryType] = useState('standard');
  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [packageType, setPackageType] = useState('');
  const [pkgLength, setPkgLength] = useState('');
  const [pkgWidth, setPkgWidth] = useState('');
  const [pkgHeight, setPkgHeight] = useState('');
  const [pkgWeight, setPkgWeight] = useState('');
  const [file, setFile] = useState(null);
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [instructions, setInstructions] = useState('');
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(''), 2800);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const newErrors = {};

    const length = parseFloat(pkgLength);
    const width = parseFloat(pkgWidth);
    const height = parseFloat(pkgHeight);
    const weight = parseFloat(pkgWeight);
    let preferredDeliveryAt = null;

    if (!pickup.trim()) newErrors.pickup = 'Pickup location is required';
    if (!drop.trim()) newErrors.drop = 'Drop location is required';
    if (!packageType) newErrors.packageType = 'Package type is required';
    if (isNaN(length) || length <= 0 || length > 1000) newErrors.pkgLength = 'Length must be between 1 and 1000 cm';
    if (isNaN(width) || width <= 0 || width > 1000) newErrors.pkgWidth = 'Width must be between 1 and 1000 cm';
    if (isNaN(height) || height <= 0 || height > 1000) newErrors.pkgHeight = 'Height must be between 1 and 1000 cm';
    if (isNaN(weight) || weight <= 0 || weight > 1000) newErrors.pkgWeight = 'Weight must be between 0.1 and 1000 kg';
    if (preferredDate && !preferredTime) newErrors.preferredTime = 'Select a preferred delivery time';
    if (preferredTime && !preferredDate) newErrors.preferredDate = 'Select a preferred delivery date';
    if (preferredDate && preferredTime) {
      preferredDeliveryAt = new Date(`${preferredDate}T${preferredTime}:00`);
      if (Number.isNaN(preferredDeliveryAt.getTime()) || preferredDeliveryAt <= new Date()) {
        newErrors.preferredDate = 'Preferred delivery must be in the future';
        newErrors.preferredTime = 'Choose a future time';
      }
    }

    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!['pdf', 'csv'].includes(ext)) {
        showToast('Only PDF or CSV files are allowed');
        setErrors(newErrors);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('The delivery list must be 5 MB or smaller');
        setErrors(newErrors);
        return;
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length) return;
    setSubmitting(true);

    let customerName = 'Business Client';
    try {
      const session = getSession();
      if (session?.userId) {
        const user = await Users.getById(session.userId);
        customerName = user?.companyName || user?.company || user?.profileDetails?.companyName || user?.name || customerName;
      }
    } catch (err) {
      console.error('Failed to resolve current business client for delivery creation:', err);
    }

    const payload = {
      customer: customerName,
      pickup,
      dropoff: drop,
      packageType,
      packageDimensions: { length, width, height, unit: 'cm' },
      weight,
      type: deliveryType === 'express' ? 'Express' : 'Standard',
      priority: deliveryType === 'express' ? 'High' : 'Medium',
      items: 1,
      instructions: instructions || '',
      ...(preferredDeliveryAt ? { preferredDeliveryAt: preferredDeliveryAt.toISOString() } : {}),
    };

    let created = null;
    try {
      created = await Deliveries.create(payload);

      if (file) {
        const documentData = new FormData();
        documentData.append('ownerType', 'delivery');
        documentData.append('delivery', created.id);
        documentData.append('documentType', 'Delivery List');
        documentData.append('issueDate', toDateInputValue(new Date()));
        documentData.append('status', 'Submitted');
        documentData.append('file', file);
        await Documents.create(documentData);
      }

      showToast(file ? 'Delivery request and delivery list submitted.' : created.message || 'Delivery request submitted.');
      setTimeout(() => navigate('/business-client/active-deliveries'), 700);
    } catch (error) {
      console.error('Failed to create delivery:', error);
      showToast(created ? `Delivery ${created.id} was created, but the delivery list upload failed.` : 'Failed to create delivery');
    } finally {
      setSubmitting(false);
    }
  }

  const now = new Date();
  const minimumDate = toDateInputValue(now);
  const nextMinute = new Date(now);
  nextMinute.setSeconds(0, 0);
  nextMinute.setMinutes(nextMinute.getMinutes() + 1);
  const minimumTime = preferredDate === minimumDate ? toTimeInputValue(nextMinute) : undefined;

  return (
    <div className="form-section">
      <div className="form-header-row">
        <div>
          <h1 className="page-title small">
            Create <span className="accent">Delivery</span>
          </h1>
          <p className="page-subtitle">Submit a new delivery request</p>
        </div>
      </div>

      <form id="bc-create-form" onSubmit={handleSubmit}>
        <div className="field-label">Delivery Type</div>

        <div className="option-row">
          <div
            className={`option-card${deliveryType === 'standard' ? ' selected' : ''}`}
            onClick={() => setDeliveryType('standard')}
          >
            <div className="option-title">
              <svg viewBox="0 0 24 24">
                <path d="M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z"></path>
                <path d="M12 22V11"></path>
                <path d="M20 6.5l-8 4.5-8-4.5"></path>
              </svg>
              Standard
            </div>
            <div>Next-day delivery</div>
            <div className="option-price">₹40</div>
          </div>

          <div className={`option-card${deliveryType === 'express' ? ' selected' : ''}`} onClick={() => setDeliveryType('express')}>
            <div className="option-title">
              <svg viewBox="0 0 24 24">
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"></path>
              </svg>
              Express
            </div>
            <div>Same-day delivery</div>
            <div className="option-price">₹80</div>
          </div>
        </div>

        <div className="form-grid">
          <div>
            <div className="field-label">Pickup Location</div>
            <input className="input" placeholder="Enter pickup address" value={pickup} onChange={(e) => setPickup(e.target.value)} />
            {errors.pickup && <div className="inline-error" style={{ color: '#ff6b6b', fontSize: 13, marginTop: 6 }}>{errors.pickup}</div>}
          </div>

          <div>
            <div className="field-label">Drop Location</div>
            <input className="input" placeholder="Enter delivery address" value={drop} onChange={(e) => setDrop(e.target.value)} />
            {errors.drop && <div className="inline-error" style={{ color: '#ff6b6b', fontSize: 13, marginTop: 6 }}>{errors.drop}</div>}
          </div>
        </div>

        <div className="field-label">
          Package Type <span style={{ color: '#ff5b5b' }}>*</span>
        </div>
        <select className="input" required value={packageType} onChange={(e) => setPackageType(e.target.value)}>
          <option value="" disabled>
            Select package type
          </option>
          <option value="Documents">Documents</option>
          <option value="Electronics">Electronics</option>
          <option value="Clothing">Clothing</option>
          <option value="Food">Food</option>
          <option value="Medical Supplies">Medical Supplies</option>
          <option value="Fragile Items">Fragile Items</option>
          <option value="Furniture">Furniture</option>
          <option value="Retail Goods">Retail Goods</option>
          <option value="Industrial Parts">Industrial Parts</option>
          <option value="Other">Other</option>
        </select>
        {errors.packageType && <div className="inline-error" style={{ color: '#ff6b6b', fontSize: 13, marginTop: 6 }}>{errors.packageType}</div>}

        <div className="field-label" style={{ marginTop: 18 }}>
          Package Dimensions <span style={{ color: '#ff5b5b' }}>*</span>
        </div>
        <div className="form-grid form-grid-3">
          <div>
            <label className="dim-label" htmlFor="pkgLength">
              Length
            </label>
            <div className="dim-input-wrap">
              <input
                className="input"
                id="pkgLength"
                type="number"
                min="1"
                max="1000"
                step="any"
                placeholder="0"
                required
                value={pkgLength}
                onChange={(e) => setPkgLength(e.target.value)}
              />
              <span className="dim-unit">cm</span>
            </div>
            {errors.pkgLength && <div className="inline-error" style={{ color: '#ff6b6b', fontSize: 13, marginTop: 6 }}>{errors.pkgLength}</div>}
          </div>
          <div>
            <label className="dim-label" htmlFor="pkgWidth">
              Width
            </label>
            <div className="dim-input-wrap">
              <input
                className="input"
                id="pkgWidth"
                type="number"
                min="1"
                max="1000"
                step="any"
                placeholder="0"
                required
                value={pkgWidth}
                onChange={(e) => setPkgWidth(e.target.value)}
              />
              <span className="dim-unit">cm</span>
            </div>
            {errors.pkgWidth && <div className="inline-error" style={{ color: '#ff6b6b', fontSize: 13, marginTop: 6 }}>{errors.pkgWidth}</div>}
          </div>
          <div>
            <label className="dim-label" htmlFor="pkgHeight">
              Height
            </label>
            <div className="dim-input-wrap">
              <input
                className="input"
                id="pkgHeight"
                type="number"
                min="1"
                max="1000"
                step="any"
                placeholder="0"
                required
                value={pkgHeight}
                onChange={(e) => setPkgHeight(e.target.value)}
              />
              <span className="dim-unit">cm</span>
            </div>
            {errors.pkgHeight && <div className="inline-error" style={{ color: '#ff6b6b', fontSize: 13, marginTop: 6 }}>{errors.pkgHeight}</div>}
          </div>
        </div>

        <div className="field-label" style={{ marginTop: 18 }}>
          Package Weight <span style={{ color: '#ff5b5b' }}>*</span>
        </div>
        <div className="dim-input-wrap" style={{ maxWidth: 220 }}>
          <input
            className="input"
            type="number"
            min="0.1"
            max="1000"
            step="any"
            placeholder="0"
            required
            value={pkgWeight}
            onChange={(e) => setPkgWeight(e.target.value)}
          />
          <span className="dim-unit">kg</span>
        </div>
        {errors.pkgWeight && <div className="inline-error" style={{ color: '#ff6b6b', fontSize: 13, marginTop: 6 }}>{errors.pkgWeight}</div>}

        <style>{`
          .form-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
          .dim-label { display: block; font-size: 0.82rem; color: rgba(255,255,255,.55); margin-bottom: 6px; }
          .dim-input-wrap { position: relative; }
          .dim-input-wrap .input { padding-right: 40px; }
          .dim-unit {
            position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
            font-size: 0.82rem; color: rgba(255,255,255,.4); pointer-events: none;
          }
          .date-time-input { color-scheme: dark; }
          .date-time-input::-webkit-calendar-picker-indicator {
            filter: brightness(0) invert(1);
            opacity: 1;
            cursor: pointer;
          }
          @media (max-width: 540px) { .form-grid-3 { grid-template-columns: 1fr; } }
        `}</style>

        <div className="field-label">Upload Delivery List (PDF, CSV)</div>
        <label className="upload-box" htmlFor="delivery-list-upload">
          <svg viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <path d="M7 10l5-5 5 5"></path>
            <path d="M12 5v12"></path>
          </svg>
          <div>Click to upload or drag and drop</div>
          <div className="muted">PDF or CSV files only</div>
          <div className="upload-file-name">{file ? file.name : 'No file selected'}</div>
        </label>

        <input
          id="delivery-list-upload"
          type="file"
          accept=".pdf,.csv,application/pdf,text/csv"
          hidden
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <div className="form-grid">
          <div>
            <div className="field-label">Preferred Delivery Date</div>
            <input
              className="input date-time-input"
              type="date"
              min={minimumDate}
              value={preferredDate}
              onChange={(e) => {
                const nextDate = e.target.value;
                setPreferredDate(nextDate);
                if (nextDate === minimumDate && preferredTime && preferredTime < toTimeInputValue(nextMinute)) {
                  setPreferredTime('');
                }
              }}
            />
            {errors.preferredDate && <div className="inline-error" style={{ color: '#ff6b6b', fontSize: 13, marginTop: 6 }}>{errors.preferredDate}</div>}
          </div>

          <div>
            <div className="field-label">Preferred Time</div>
            <input className="input date-time-input" type="time" min={minimumTime} value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} />
            {errors.preferredTime && <div className="inline-error" style={{ color: '#ff6b6b', fontSize: 13, marginTop: 6 }}>{errors.preferredTime}</div>}
          </div>
        </div>

        <div className="field-label">Delivery Instructions (Optional)</div>
        <textarea
          className="textarea"
          placeholder="Any special handling or delivery instructions..."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        ></textarea>

        <div style={{ marginTop: 28 }}>
          <button className="btn yellow full" type="submit" disabled={submitting}>
            <svg viewBox="0 0 24 24">
              <path d="M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z"></path>
              <path d="M12 22V11"></path>
              <path d="M20 6.5l-8 4.5-8-4.5"></path>
            </svg>
            {submitting ? 'Submitting Delivery Request...' : 'Submit Delivery Request'}
          </button>
        </div>
      </form>

      <div className="how-list">
        <h2 style={{ margin: '0 0 6px', color: '#fff' }}>How it works</h2>

        <div className="how-item">
          <span className="step">1</span>
          <span>Submit your delivery request with all required details</span>
        </div>

        <div className="how-item">
          <span className="step">2</span>
          <span>A fleet manager manually assigns an available driver with an active registered vehicle</span>
        </div>

        <div className="how-item">
          <span className="step">3</span>
          <span>Track each persisted status update from request through delivery</span>
        </div>

        <div className="how-item">
          <span className="step">4</span>
          <span>An invoice is created from the completed delivery record and configured rates</span>
        </div>
      </div>

      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            background: '#1e1e2f',
            color: '#fff',
            padding: '14px 28px',
            borderRadius: 12,
            fontSize: 14,
            zIndex: 99999,
            boxShadow: '0 8px 32px rgba(0,0,0,.4)',
            borderLeft: '4px solid #facc15',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
