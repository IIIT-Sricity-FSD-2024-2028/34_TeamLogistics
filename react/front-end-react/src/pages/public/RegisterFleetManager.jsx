import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePortalStyles } from '../../hooks/usePortalStyles';
import { useToast } from '../../hooks/useToast';
import BrandLogo from '../../components/BrandLogo';
import { Auth } from '../../api/namespaces';

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validatePhone(phone) {
  return /^[0-9+\-\s]{10,15}$/.test(phone.trim());
}
function validatePassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password);
}

export default function RegisterFleetManager() {
  usePortalStyles(['styles.css', 'brand-logo.css']);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [companyName, setCompanyName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [vehicleCount, setVehicleCount] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const errs = {};
    if (companyName.trim().length < 2) errs.companyName = 'Enter company name';
    if (managerName.trim().length < 2) errs.managerName = 'Enter fleet manager name';
    if (companyAddress.trim().length < 8) errs.companyAddress = 'Company address is required';
    if (!/^\d+$/.test(vehicleCount) || Number(vehicleCount) <= 0) errs.vehicleCount = 'Enter a valid vehicle count';
    if (!validatePhone(phone)) errs.phone = 'Enter valid phone number';
    if (!validateEmail(email)) errs.email = 'Enter valid email';
    if (!validatePassword(password)) errs.password = 'Minimum 8 chars with upper, lower, number, special char';
    if (confirmPassword !== password) errs.confirmPassword = 'Passwords do not match';
    return errs;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const payload = {
      name: managerName,
      email,
      password,
      role: 'fleet-manager',
      phone: '',
      profileDetails: {},
    };

    setSubmitting(true);
    try {
      await Auth.register(payload);
      showToast('Account created successfully. Awaiting super user approval.');
      setTimeout(() => navigate('/login'), 700);
    } catch (err) {
      setErrors((prev) => ({ ...prev, email: err.message || 'Registration failed. Please try again.' }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel-wrap" style={{ gridColumn: '1 / -1' }}>
        <div className="auth-panel dark" style={{ width: 'min(760px,100%)' }}>
          <div className="page-header-logo">
            <BrandLogo href="/" size="lg" />
          </div>
          <div className="auth-card-head">
            <div className="icon-box" style={{ margin: 0 }}>
              ▤
            </div>
            <div>
              <h3>Create Fleet Manager Account</h3>
              <p>Manage your fleet operations</p>
            </div>
          </div>
          <form onSubmit={onSubmit} noValidate>
            <div className="form-grid">
              <div className="form-control">
                <label htmlFor="companyName">Company Name</label>
                <input id="companyName" type="text" placeholder="Enter company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                <div className="error-message">{errors.companyName}</div>
              </div>
              <div className="form-control">
                <label htmlFor="managerName">Fleet Manager Name</label>
                <input id="managerName" type="text" placeholder="Enter your full name" value={managerName} onChange={(e) => setManagerName(e.target.value)} />
                <div className="error-message">{errors.managerName}</div>
              </div>
              <div className="form-control">
                <label htmlFor="companyAddress">Company Address</label>
                <input id="companyAddress" type="text" placeholder="Enter company address" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
                <div className="error-message">{errors.companyAddress}</div>
              </div>
              <div className="form-control">
                <label htmlFor="vehicleCount">Number of Vehicles</label>
                <input id="vehicleCount" type="number" placeholder="Enter number of vehicles" value={vehicleCount} onChange={(e) => setVehicleCount(e.target.value)} />
                <div className="error-message">{errors.vehicleCount}</div>
              </div>
              <div className="form-control">
                <label htmlFor="phone">Phone Number</label>
                <input id="phone" type="text" placeholder="Enter phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <div className="error-message">{errors.phone}</div>
              </div>
              <div className="form-control">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" placeholder="Enter email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <div className="error-message">{errors.email}</div>
              </div>
              <div className="form-row">
                <div className="form-control">
                  <label htmlFor="password">Password</label>
                  <div className="input-wrap">
                    <input id="password" type={showPassword ? 'text' : 'password'} placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button type="button" className="toggle-visibility" onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? '🙈' : '👁'}
                    </button>
                  </div>
                  <div className="error-message">{errors.password}</div>
                </div>
                <div className="form-control">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <div className="input-wrap">
                    <input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button type="button" className="toggle-visibility" onClick={() => setShowConfirm((v) => !v)}>
                      {showConfirm ? '🙈' : '👁'}
                    </button>
                  </div>
                  <div className="error-message">{errors.confirmPassword}</div>
                </div>
              </div>
            </div>
            <div className="form-actions" style={{ justifyContent: 'stretch' }}>
              <button className="btn btn-primary" style={{ width: '100%' }} type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Create Fleet Manager Account'}
              </button>
            </div>
            <div className="form-footer">
              Already have an account? <Link to="/login">Sign in</Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
