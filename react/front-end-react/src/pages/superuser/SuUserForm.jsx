import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';

function roleLabelToValue(role) {
  const v = String(role || '').trim().toLowerCase();
  if (v === 'fleet manager' || v === 'fleet-manager') return 'fleet-manager';
  if (v === 'business client' || v === 'business-client') return 'business-client';
  if (v === 'super user' || v === 'superuser') return 'superuser';
  if (v === 'driver') return 'driver';
  return v;
}

export default function SuUserForm({ editMode }) {
  usePageHeader(editMode ? 'Edit User' : 'Add New User');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const userId = params.get('id') || '';

  const [notFound, setNotFound] = useState(false);
  const [loaded, setLoaded] = useState(!editMode);
  const [showPassword, setShowPassword] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('fleet-manager');
  const [status, setStatus] = useState('Active');
  const [details, setDetails] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!editMode || !userId) return;
    (async () => {
      try {
        const current = await Users.getOne(userId);
        setName(current.name || current.fullName || '');
        setEmail(current.email || '');
        setPassword(current.password || '');
        setPhone(current.phone || '');
        setRole(roleLabelToValue(current.role || 'fleet-manager'));
        setStatus(current.status || 'Active');
        setDetails(current.profileDetails || {});
        setLoaded(true);
      } catch {
        setNotFound(true);
        setLoaded(true);
      }
    })();
  }, [editMode, userId]);

  function setDetail(key, value) {
    setDetails((d) => ({ ...d, [key]: value }));
  }

  function err(key) {
    return errors[key] ? <div className="error">{errors[key]}</div> : <div className="error" />;
  }

  async function handleSave() {
    const nextErrors = {};

    if (!/^[A-Za-z][A-Za-z\s]{2,59}$/.test(name)) nextErrors.name = 'Full name must be 3-60 letters and spaces only';
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) nextErrors.email = 'Enter a valid email address';
    if (!/^[6-9]\d{9}$/.test(phone)) nextErrors.phone = 'Phone number must be 10 digits and start from 6, 7, 8, or 9';

    const pwdOk = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!editMode && !pwdOk.test(password)) nextErrors.password = 'Password must be at least 8 characters and include 1 capital letter, 1 number, and 1 special character';
    if (editMode && password && !pwdOk.test(password)) nextErrors.password = 'Password must be at least 8 characters and include 1 capital letter, 1 number, and 1 special character';

    const profileDetails = { ...details };

    if (role === 'fleet-manager') {
      if (!profileDetails.companyName || profileDetails.companyName.length < 3) nextErrors['detail-companyName'] = 'Enter a valid company name';
      if (!profileDetails.companyAddress || profileDetails.companyAddress.length < 5) nextErrors['detail-companyAddress'] = 'Enter a valid company address';
      if (!/^[1-9]\d{0,3}$/.test(profileDetails.numberOfVehicles || '')) nextErrors['detail-numberOfVehicles'] = 'Number of vehicles must be between 1 and 9999';
    }

    if (role === 'business-client') {
      if (!profileDetails.companyName || profileDetails.companyName.length < 3) nextErrors['detail-companyName'] = 'Enter a valid company name';
      if (!/^[6-9]\d{9}$/.test(profileDetails.companyContactNumber || '')) nextErrors['detail-companyContactNumber'] = 'Company contact number must be 10 digits and start from 6, 7, 8, or 9';
      if (!profileDetails.businessAddress || profileDetails.businessAddress.length < 5) nextErrors['detail-businessAddress'] = 'Enter a valid business address';
    }

    if (role === 'driver') {
      if (!/^[A-Z0-9-]{5,25}$/i.test(profileDetails.licenseNumber || '')) nextErrors['detail-licenseNumber'] = 'Enter a valid license number';
      if (!/^[A-Za-z][A-Za-z\s]{2,79}$/.test(profileDetails.accountHolderName || '')) nextErrors['detail-accountHolderName'] = 'Enter valid account holder name';
      if (!/^\d{9,18}$/.test(profileDetails.accountNumber || '')) nextErrors['detail-accountNumber'] = 'Account number must be 9-18 digits';
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test((profileDetails.ifscCode || '').toUpperCase())) nextErrors['detail-ifscCode'] = 'Enter valid IFSC code';
      if (!/^[A-Za-z][A-Za-z\s.&-]{2,79}$/.test(profileDetails.bankName || '')) nextErrors['detail-bankName'] = 'Enter valid bank name';
      profileDetails.ifscCode = (profileDetails.ifscCode || '').toUpperCase();
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const payload = { name: name.trim(), email: email.trim(), role, status, phone: phone.trim(), profileDetails };
    if (password) payload.password = password;

    try {
      if (editMode) await Users.update(userId, payload);
      else await Users.create(payload);
      navigate('/superuser/manage-users');
    } catch {
      alert('Failed to save user');
    }
  }

  if (editMode && notFound) {
    return (
      <div className="content-card form-card">
        <h2>User Not Found</h2>
        <p style={{ color: '#ff6b6b' }}>Failed to load user.</p>
      </div>
    );
  }

  if (!loaded) return <div className="content-card form-card">Loading...</div>;

  return (
    <div className="content-card form-card">
      <h2>{editMode ? 'Edit User' : 'Add New User'}</h2>

      <div className="grid-2" style={{ gap: 18 }}>
        <div className="field">
          <label>Full Name</label>
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          {err('name')}
        </div>
        <div className="field">
          <label>Email Address</label>
          <input type="email" value={email} maxLength={100} onChange={(e) => setEmail(e.target.value)} />
          {err('email')}
        </div>
      </div>

      <div className="grid-2" style={{ gap: 18 }}>
        <div className="field">
          <label>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={editMode ? 'Leave same or enter new password' : 'Minimum 8 chars, 1 capital, 1 number, 1 special'}
              style={{ width: '100%', paddingRight: 52 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label="Toggle password visibility"
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, color: '#9ca3af', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
            >
              👁
            </button>
          </div>
          {err('password')}
        </div>
        <div className="field">
          <label>Phone Number</label>
          <input value={phone} maxLength={10} inputMode="numeric" placeholder="10-digit mobile number" onChange={(e) => setPhone(e.target.value)} />
          {err('phone')}
        </div>
      </div>

      <div className="grid-2" style={{ gap: 18 }}>
        <div className="field">
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="fleet-manager">Fleet Manager</option>
            <option value="business-client">Business Client</option>
            <option value="driver">Driver</option>
            <option value="superuser">Super User</option>
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Suspended">Suspended</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="content-card" style={{ marginTop: 18, background: 'rgba(255,255,255,0.02)' }}>
        <div className="chart-title" style={{ marginBottom: 18 }}>Role-specific details</div>
        {role === 'fleet-manager' && (
          <>
            <div className="grid-2" style={{ gap: 18 }}>
              <div className="field">
                <label>Company Name</label>
                <input value={details.companyName || ''} maxLength={80} onChange={(e) => setDetail('companyName', e.target.value)} />
                {err('detail-companyName')}
              </div>
              <div className="field">
                <label>Company Address</label>
                <input value={details.companyAddress || ''} maxLength={150} onChange={(e) => setDetail('companyAddress', e.target.value)} />
                {err('detail-companyAddress')}
              </div>
            </div>
            <div className="field">
              <label>Number of Vehicles</label>
              <input value={details.numberOfVehicles || ''} inputMode="numeric" maxLength={4} onChange={(e) => setDetail('numberOfVehicles', e.target.value)} />
              {err('detail-numberOfVehicles')}
            </div>
          </>
        )}
        {role === 'business-client' && (
          <>
            <div className="grid-2" style={{ gap: 18 }}>
              <div className="field">
                <label>Company Name</label>
                <input value={details.companyName || ''} maxLength={80} onChange={(e) => setDetail('companyName', e.target.value)} />
                {err('detail-companyName')}
              </div>
              <div className="field">
                <label>Company Contact Number</label>
                <input value={details.companyContactNumber || ''} maxLength={10} inputMode="numeric" onChange={(e) => setDetail('companyContactNumber', e.target.value)} />
                {err('detail-companyContactNumber')}
              </div>
            </div>
            <div className="field">
              <label>Business Address</label>
              <input value={details.businessAddress || ''} maxLength={150} onChange={(e) => setDetail('businessAddress', e.target.value)} />
              {err('detail-businessAddress')}
            </div>
          </>
        )}
        {role === 'driver' && (
          <>
            <div className="grid-2" style={{ gap: 18 }}>
              <div className="field">
                <label>Driver License Number</label>
                <input value={details.licenseNumber || ''} maxLength={25} onChange={(e) => setDetail('licenseNumber', e.target.value)} />
                {err('detail-licenseNumber')}
              </div>
              <div className="field">
                <label>Account Holder Name</label>
                <input value={details.accountHolderName || ''} maxLength={80} onChange={(e) => setDetail('accountHolderName', e.target.value)} />
                {err('detail-accountHolderName')}
              </div>
            </div>
            <div className="grid-2" style={{ gap: 18 }}>
              <div className="field">
                <label>Account Number</label>
                <input value={details.accountNumber || ''} inputMode="numeric" maxLength={18} onChange={(e) => setDetail('accountNumber', e.target.value)} />
                {err('detail-accountNumber')}
              </div>
              <div className="field">
                <label>IFSC Code</label>
                <input value={details.ifscCode || ''} maxLength={11} style={{ textTransform: 'uppercase' }} onChange={(e) => setDetail('ifscCode', e.target.value)} />
                {err('detail-ifscCode')}
              </div>
            </div>
            <div className="field">
              <label>Bank Name</label>
              <input value={details.bankName || ''} maxLength={80} onChange={(e) => setDetail('bankName', e.target.value)} />
              {err('detail-bankName')}
            </div>
          </>
        )}
        {role === 'superuser' && <div className="subdued">No extra details required for Super User.</div>}
      </div>

      <div className="form-actions">
        <a className="btn-dark" href="/superuser/manage-users">Cancel</a>
        <button className="btn-yellow" onClick={handleSave}>{editMode ? 'Save Changes' : 'Create User'}</button>
      </div>
    </div>
  );
}
