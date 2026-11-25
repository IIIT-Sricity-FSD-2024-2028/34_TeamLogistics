import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useEffect, useState } from 'react';
import { useGetUserQuery, useUpdateUserMutation } from '../../redux/fleetManagerApi';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useSession } from '../../auth/SessionContext';
import { useToast } from '../../hooks/useToast';
import { initials } from './fmUtils';
import { validateFleetManagerProfile } from '../../utils/fleetManagerProfile';

export default function FmProfile() {
  usePageStyleScope('fm-profile');
  usePageHeader('Profile', 'Fleet manager account information');
  const { session, updateSession } = useSession();
  const { showToast } = useToast();
  const userId = session?.userId || '';

  const [editing, setEditing] = useState(false);
  const query = useGetUserQuery(userId, { skip: !userId });
  const user = query.data;
  const error = query.isError || !userId;
  const [updateUser] = useUpdateUserMutation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  const [numVehicles, setNumVehicles] = useState('');

  const [errName, setErrName] = useState('');
  const [errEmail, setErrEmail] = useState('');
  const [errPhone, setErrPhone] = useState('');
  const [errCompany, setErrCompany] = useState('');
  const [errAddress, setErrAddress] = useState('');
  const [errNumVehicles, setErrNumVehicles] = useState('');

  useEffect(() => {
    if (!user || editing) return;
    const details = user.profileDetails || {};
    setName(user.name || 'Fleet Manager');
    setEmail(user.email || '');
    setPhone(user.phone || '');
    setCompany(details.companyName || '');
    setAddress(details.companyAddress || '');
    setNumVehicles(details.numberOfVehicles || '');
  }, [user, editing]);

  async function save() {
    setErrName('');
    setErrEmail('');
    setErrPhone('');
    setErrCompany('');
    setErrAddress('');
    setErrNumVehicles('');

    const payload = {
      name: name.trim(),
      email: email.trim(),
      role: user.role,
      status: user.status || 'Active',
      phone: phone.trim(),
      profileDetails: { ...(user.profileDetails || {}), companyName: company.trim(), companyAddress: address.trim(), numberOfVehicles: numVehicles.trim() },
    };

    const nameError = /^[A-Za-z][A-Za-z\s]{2,59}$/.test(payload.name) ? '' : 'Name must be 3-60 letters';
    const validationErrors = validateFleetManagerProfile({ email, phone, company, address, numVehicles });
    setErrName(nameError);
    setErrEmail(validationErrors.email || '');
    setErrPhone(validationErrors.phone || '');
    setErrCompany(validationErrors.company || '');
    setErrAddress(validationErrors.address || '');
    setErrNumVehicles(validationErrors.numVehicles || '');
    if (nameError || Object.keys(validationErrors).length) return;

    try {
      const updatedUser = await updateUser({ id: user.id, changes: payload }).unwrap();
      updateSession({
        name: updatedUser?.name || payload.name,
        email: updatedUser?.email || payload.email,
      });
      showToast('Profile updated');
      setEditing(false);
      await query.refetch();
    } catch (e) {
      console.error(e);
      setErrEmail(e.message || 'Failed to update profile');
    }
  }

  if (error) {
    return (
      <div className="info-card" style={{ padding: 28, textAlign: 'center', color: '#ff8d8d' }}>
        Failed to load profile from backend.
      </div>
    );
  }

  if (!user) {
    return (
      <div className="info-card" style={{ padding: 28, textAlign: 'center', color: '#888' }}>
        Loading profile...
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {!editing && (
          <button className="btn btn-yellow" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>
      <div className="info-card" style={{ maxWidth: 1100, margin: '0 auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22 }}>
          <div style={{ width: 88, height: 88, borderRadius: 24, background: 'var(--yellow)', color: '#111', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 34 }}>
            {initials(name)}
          </div>
          <div>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#fff' }}>{name}</div>
            <div className="muted" style={{ fontSize: 20 }}>
              Fleet Manager Account
            </div>
          </div>
        </div>
        <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div className="field">
            <label>Full Name</label>
            <input value={name} maxLength={60} readOnly={!editing} onChange={(e) => { setName(e.target.value); setErrName(''); }} />
            <div className="field-error">{errName}</div>
          </div>
          <div className="field">
            <label>Email Address</label>
            <input type="email" value={email} maxLength={254} readOnly={!editing} onChange={(e) => { setEmail(e.target.value); setErrEmail(''); }} />
            <div className="field-error">{errEmail}</div>
          </div>
          <div className="field">
            <label>Phone Number</label>
            <input inputMode="numeric" maxLength={10} value={phone} readOnly={!editing} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setErrPhone(''); }} />
            <div className="field-error">{errPhone}</div>
          </div>
          <div className="field">
            <label>Company Name</label>
            <input value={company} maxLength={80} readOnly={!editing} onChange={(e) => { setCompany(e.target.value); setErrCompany(''); }} />
            <div className="field-error">{errCompany}</div>
          </div>
          <div className="field">
            <label>Company Address</label>
            <input value={address} maxLength={200} readOnly={!editing} onChange={(e) => { setAddress(e.target.value); setErrAddress(''); }} />
            <div className="field-error">{errAddress}</div>
          </div>
          <div className="field">
            <label>Number of Vehicles</label>
            <input type="number" min="1" max="100000" step="1" value={numVehicles} readOnly={!editing} onChange={(e) => { setNumVehicles(e.target.value); setErrNumVehicles(''); }} />
            <div className="field-error">{errNumVehicles}</div>
          </div>
        </div>
        {editing && (
          <div className="footer-actions">
            <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="btn btn-yellow" onClick={save}>
              Save Profile
            </button>
          </div>
        )}
      </div>
    </>
  );
}
