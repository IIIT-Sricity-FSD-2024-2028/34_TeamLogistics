import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useEffect, useState } from 'react';
import { useGetDriversQuery, useGetTripsQuery, useGetPayoutsQuery, useUpdateDriverMutation, EMPTY_LIST, queryError } from '../../redux/driverApi';
import { useSession } from '../../auth/SessionContext';
import { usePageHeader } from '../../hooks/usePageHeader';

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
  usePageStyleScope('driver-profile');
  usePageHeader('Profile', 'Your driver information and account settings');
  const { session, updateSession } = useSession();
  const driverName = session?.name || '';
  const driverEmail = session?.email || '';

  const driversQuery = useGetDriversQuery();
  const tripsQuery = useGetTripsQuery();
  const payoutsQuery = useGetPayoutsQuery();
  const drivers = driversQuery.data || EMPTY_LIST;
  const trips = tripsQuery.data || EMPTY_LIST;
  const payouts = payoutsQuery.data || EMPTY_LIST;
  const driver = drivers.find((item) => session?.userId && String(item.userId) === String(session.userId))
    || drivers.find((item) => driverEmail && normalize(item.email) === normalize(driverEmail))
    || drivers.find((item) => driverName && normalize(item.name || item.fullName) === normalize(driverName))
    || null;
  const loading = driversQuery.isLoading || tripsQuery.isLoading || payoutsQuery.isLoading;
  const loadError = queryError(driversQuery, tripsQuery, payoutsQuery);
  const [updateDriver, { isLoading: saving }] = useUpdateDriverMutation();
  const [isEditing, setIsEditing] = useState(false);
  const [fields, setFields] = useState({ name: '', email: '', phone: '', license: '', vehicle: '' });
  const [message, setMessage] = useState(null);

  function fillFields(d) {
    setFields({
      name: getDriverValue(d, ['name', 'fullName', 'driverName'], driverName),
      email: getDriverValue(d, ['email'], driverEmail),
      phone: cleanPhone(getDriverValue(d, ['phone', 'contact', 'mobile'], '')),
      license: getDriverValue(d, ['licenseNumber', 'license', 'licenceNumber', 'driverLicense'], ''),
      vehicle: getDriverValue(d, ['vehicle', 'vehicleNumber', 'assignedVehicle'], ''),
    });
  }

  useEffect(() => {
    // Background cache updates must not overwrite a profile being edited.
    if (!isEditing) fillFields(driver || { name: driverName, email: driverEmail });
  }, [driver, driverName, driverEmail, isEditing]);

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
    };

    try {
      const driverId = driver?.id || driver?.driverId;
      if (!driverId) throw new Error('Your driver profile could not be found. Please refresh and try again.');
      const updated = await updateDriver({ id: driverId, changes: payload }).unwrap();
      const merged = { ...driver, ...updated, ...payload };
      await driversQuery.refetch();
      updateSession({ name: merged.name, email: merged.email });
      fillFields(merged);
      setIsEditing(false);
      setMessage({ text: 'Profile updated successfully.', type: 'success' });
    } catch (e) {
      setMessage({ text: `Profile update failed: ${e.message}`, type: 'error' });
    }
  }

  if (loading) return <section className="content">Loading...</section>;

  const initial = String(fields.name || 'D').charAt(0).toUpperCase();
  const phoneIsValid = PHONE_PATTERN.test(fields.phone.trim());

  return (
    <section className="content">
      {loadError && <p role="alert">{loadError}</p>}
      <div className="profile-layout">
        <div className="profile-card profile-left">
          <div className="big-avatar">{initial}</div>
          <h2>{fields.name}</h2>
          <p>{fields.email}</p>
          <p>{fields.phone}</p>
          <span className="status-pill">{driver?.status || 'Unknown'}</span>
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
                  <input type="text" readOnly value={driver?.status || 'Unknown'} />
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

    </section>
  );
}
