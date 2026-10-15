import { useEffect, useState } from 'react';
import { Drivers, Trips, Payouts } from '../../api/namespaces';
import { useSession } from '../../auth/SessionContext';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useLiveSync } from '../../hooks/useLiveSync';

function normalize(v) {
  return String(v || '').trim().toLowerCase();
}

function formatMoney(amount) {
  const value = Number(amount || 0);
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PHONE_PATTERN = /^[6-9]\d{9}$/;

function cleanPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length > 10 && digits.startsWith('91') ? digits.slice(2, 12) : digits.slice(0, 10);
}

function getDriverValue(driver, keys, fallback = 'Not available') {
  for (const key of keys) {
    if (driver?.[key]) return driver[key];
  }
  return fallback;
}

export default function DriverProfile() {
  usePageHeader('Profile', 'Your driver information and account settings');
  const { session } = useSession();
  const driverName = session?.name || '';
  const driverEmail = session?.email || '';

  const [driver, setDriver] = useState(null);
  const [trips, setTrips] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [fields, setFields] = useState({ name: '', email: '', phone: '', license: '', status: 'Available', vehicle: '' });
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  function fillFields(d) {
    setFields({
      name: getDriverValue(d, ['name', 'fullName', 'driverName'], driverName),
      email: getDriverValue(d, ['email'], driverEmail),
      phone: cleanPhone(getDriverValue(d, ['phone', 'contact', 'mobile'], '')),
      license: getDriverValue(d, ['licenseNumber', 'license', 'licenceNumber', 'driverLicense'], ''),
      status: getDriverValue(d, ['status'], 'Available'),
      vehicle: getDriverValue(d, ['vehicle', 'vehicleNumber', 'assignedVehicle'], ''),
    });
  }

  async function load() {
    try {
      const [drivers, t, p] = await Promise.all([Drivers.getAll(), Trips.getAll(), Payouts.getMyPayouts()]);
      const found =
        drivers.find((dr) => normalize(dr.name) === normalize(driverName)) ||
        drivers.find((dr) => normalize(dr.email) === normalize(driverEmail)) ||
        drivers.find((dr) => normalize(dr.fullName) === normalize(driverName)) ||
        null;
      setDriver(found);
      fillFields(found || { name: driverName, email: driverEmail });
      setTrips(t || []);
      setPayouts(p || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);
  useLiveSync(load, { enabled: !isEditing });

  const completedTrips = trips.filter((trip) => {
    const drv = normalize(trip.driver || trip.assignedDriver || trip.driverName);
    return drv === normalize(fields.name) && ['completed', 'delivered'].includes(normalize(trip.status));
  });
  const totalEarnings = payouts.reduce((sum, payout) => sum + Number(payout.totalAmount || 0), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isEditing) return;
    if (!fields.name || !fields.email || !fields.phone) {
      setMessage({ text: 'Name, email, and phone are required.', type: 'error' });
      return;
    }

    const phone = fields.phone.trim();
    if (!PHONE_PATTERN.test(phone)) {
      setMessage({ text: 'Enter a valid 10-digit phone number starting with 6, 7, 8, or 9.', type: 'error' });
      return;
    }

    const payload = {
      name: fields.name.trim(),
      email: fields.email.trim(),
      phone,
      licenseNumber: fields.license.trim(),
      status: fields.status,
    };

    setSaving(true);
    try {
      const driverId = driver?.id || driver?.driverId;
      const updated = driverId ? await Drivers.update(driverId, payload) : payload;
      const merged = { ...driver, ...updated, ...payload };
      setDriver(merged);
      fillFields(merged);
      setIsEditing(false);
      setMessage({ text: 'Profile updated successfully.', type: 'success' });
    } catch (e) {
      setMessage({ text: `Profile update failed: ${e.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="content">Loading...</section>;

  const initial = String(fields.name || 'D').charAt(0).toUpperCase();
  const phoneIsValid = PHONE_PATTERN.test(fields.phone.trim());

  return (
    <section className="content">
      <div className="profile-layout">
        <div className="profile-card profile-left">
          <div className="big-avatar">{initial}</div>
          <h2>{fields.name}</h2>
          <p>{fields.email}</p>
          <p>{fields.phone}</p>
          <span className="status-pill">{fields.status}</span>
        </div>

        <div className="profile-main">
          <div className="profile-stats">
            <div className="stat-card">
              <strong>{completedTrips.length}</strong>
              <span>Completed Deliveries</span>
            </div>
            <div className="stat-card">
              <strong>{formatMoney(totalEarnings)}</strong>
              <span>Total Persisted Earnings</span>
            </div>
            <div className="stat-card">
              <strong>{fields.license}</strong>
              <span>License Number</span>
            </div>
          </div>

          <div className="details-card">
            <div className="card-head">
              <h2>Profile Details</h2>
              <button
                className="yellow-btn"
                type="button"
                onClick={() => {
                  setMessage(null);
                  setIsEditing((v) => !v);
                }}
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div>
                  <label>Full Name</label>
                  <input type="text" readOnly={!isEditing} value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} />
                </div>
                <div>
                  <label>Email</label>
                  <input type="email" readOnly={!isEditing} value={fields.email} onChange={(e) => setFields({ ...fields, email: e.target.value })} />
                </div>
                <div>
                  <label>Phone</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={10}
                    readOnly={!isEditing}
                    aria-invalid={isEditing && !phoneIsValid}
                    aria-describedby="phone-help"
                    value={fields.phone}
                    onChange={(e) => {
                      setFields({ ...fields, phone: cleanPhone(e.target.value) });
                      if (message?.type === 'error') setMessage(null);
                    }}
                  />
                  {isEditing && (
                    <span id="phone-help" className={fields.phone && !phoneIsValid ? 'field-error' : 'field-hint'}>
                      {fields.phone && !phoneIsValid
                        ? 'Enter 10 digits starting with 6, 7, 8, or 9.'
                        : '10 digits, starting with 6, 7, 8, or 9.'}
                    </span>
                  )}
                </div>
                <div>
                  <label>License Number</label>
                  <input type="text" readOnly={!isEditing} value={fields.license} onChange={(e) => setFields({ ...fields, license: e.target.value })} />
                </div>
                <div>
                  <label>Status</label>
                  <select disabled={!isEditing} value={fields.status} onChange={(e) => setFields({ ...fields, status: e.target.value })}>
                    <option value="Active">Active</option>
                    <option value="Available">Available</option>
                    <option value="On Duty">On Duty</option>
                  </select>
                </div>
                <div>
                  <label>Vehicle</label>
                  <input type="text" readOnly value={fields.vehicle} />
                </div>
              </div>

              {message && <div className={message.type}>{message.text}</div>}

              <button className="yellow-btn" id="saveBtn" type="submit" disabled={!isEditing || saving || !phoneIsValid}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        .profile-layout { display: grid; grid-template-columns: 310px 1fr; gap: 22px; }
        .profile-card, .details-card, .stat-card { background: linear-gradient(135deg, #1f1f1f, #111); border: 1px solid #262626; border-radius: 20px; color: #fff; box-shadow: 0 18px 40px rgba(0,0,0,.25); }
        .profile-left { padding: 28px; text-align: center; min-height: 430px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
        .big-avatar { width: 86px; height: 86px; border-radius: 999px; background: #ffd400; color: #000; display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: 900; margin-bottom: 10px; }
        .profile-left h2 { margin: 0; font-size: 24px; font-weight: 900; }
        .profile-left p { margin: 0; color: #9ca3af; font-size: 14px; }
        .status-pill { margin-top: 12px; display: inline-flex; width: fit-content; background: rgba(255,212,0,.15); color: #ffd400; border: 1px solid rgba(255,212,0,.35); border-radius: 999px; padding: 7px 12px; font-size: 12px; font-weight: 900; }
        .profile-main { display: flex; flex-direction: column; gap: 18px; }
        .profile-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .stat-card { padding: 20px; }
        .stat-card strong { display: block; font-size: 28px; font-weight: 900; margin-bottom: 6px; }
        .stat-card span { color: #d1d5db; font-size: 14px; font-weight: 700; }
        .details-card { padding: 22px; }
        .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
        .card-head h2 { margin: 0; font-size: 24px; font-weight: 900; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        label { display: block; margin-bottom: 8px; color: #e5e7eb; font-size: 14px; font-weight: 800; }
        input, select { width: 100%; box-sizing: border-box; background: #070707; color: #fff; border: 1px solid #2a2a2a; border-radius: 14px; padding: 13px 14px; outline: none; font-family: Inter, sans-serif; font-weight: 700; }
        input:focus, select:focus { border-color: #ffd400; box-shadow: 0 0 0 3px rgba(255,212,0,.15); }
        input[aria-invalid="true"] { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,.1); }
        input[readonly], select:disabled { opacity: .8; cursor: not-allowed; }
        .field-hint, .field-error { display: block; margin-top: 7px; font-size: 12px; font-weight: 700; line-height: 1.4; }
        .field-hint { color: #8f96a3; }
        .field-error { color: #fca5a5; }
        .yellow-btn { border: none; border-radius: 999px; background: #ffd400; color: #000; font-weight: 900; padding: 11px 18px; cursor: pointer; font-family: Inter, sans-serif; }
        .yellow-btn:disabled { opacity: .55; cursor: not-allowed; }
        #saveBtn { margin-top: 18px; border-radius: 14px; }
        .success { margin-top: 16px; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 700; background: rgba(16,185,129,.12); border: 1px solid #10b981; color: #d1fae5; }
        .error { margin-top: 16px; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 700; background: rgba(239,68,68,.12); border: 1px solid #ef4444; color: #fecaca; }
        @media (max-width: 1000px) { .profile-layout, .profile-stats, .form-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
