import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePortalStyles } from '../../hooks/usePortalStyles';
import { useToast } from '../../hooks/useToast';
import BrandLogo from '../../components/BrandLogo';
import { Auth } from '../../api/namespaces';
import TermsModal from '../../components/TermsModal';
import { TERMS_VERSION } from '../../constants/legal';

const EMAIL_REGEX =
  /^(?=.{1,64}@)(?=.{6,320}$)(?!\.)(?!.*\.\.)([A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+(?:\.[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+)*)@([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)$/;

export default function RegisterDriver() {
  usePortalStyles(['styles.css', 'brand-logo.css', 'terms-modal.css']);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [license, setLicense] = useState('');
  const [licenseDoc, setLicenseDoc] = useState(null);
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBook, setBankBook] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const errs = {};
    const fullName = name.trim();
    const phoneVal = phone.trim();
    const licenseVal = license.trim().toUpperCase();

    if (!/^[A-Za-z ]+$/.test(fullName) || fullName.length < 2) errs.name = 'Full name should contain only letters and spaces';
    if (!/^[6-9]\d{9}$/.test(phoneVal)) errs.phone = 'Phone number should be 10 digits and start with 9, 8, 7, or 6';
    if (!/^[A-Z]{2}-\d{2}-\d{4}-\d{7}$/.test(licenseVal)) errs.license = 'Driver License Number should be in AA-12-1234-1234567 format';
    if (!licenseDoc) errs.licenseDoc = 'Upload License is required';
    else if (!/\.png$/i.test(licenseDoc.name) && licenseDoc.type !== 'image/png') errs.licenseDoc = 'Only PNG file is allowed for Upload License';
    if (!/^[A-Za-z ]+$/.test(accountHolder.trim()) || accountHolder.trim().length < 2)
      errs.accountHolder = 'Account Holder Name should contain only letters and spaces';
    if (!/^\d{12}$/.test(accountNumber.trim())) errs.accountNumber = 'Account Number should be exactly 12 digits';
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase())) errs.ifsc = 'IFSC Code must be 11 characters: first 4 letters, 5th 0, last 6 letters or numbers';
    if (!/^[A-Za-z .&-]+$/.test(bankName.trim()) || bankName.trim().length < 2)
      errs.bankName = 'Bank Name should contain only letters, spaces, dots, ampersand, and hyphen';
    if (!bankBook) errs.bankBook = 'Upload Bank Book is required';
    else if (!/\.png$/i.test(bankBook.name) && bankBook.type !== 'image/png') errs.bankBook = 'Only PNG file is allowed for Upload Bank Book';
    if (!EMAIL_REGEX.test(email.trim())) errs.email = 'Enter a valid email address';
    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password))
      errs.password = 'Password must be minimum 8 characters with 1 capital letter, 1 number, and 1 special character';
    if (confirmPassword !== password) errs.confirmPassword = 'Passwords do not match';
    if (!terms) errs.terms = 'You must accept the Terms & Conditions';
    return errs;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const payload = {
      name: name.trim(),
      email: email.trim(),
      password,
      role: 'driver',
      phone: phone.trim(),
      termsAccepted: true,
      termsVersion: TERMS_VERSION,
      profileDetails: {
        licenseNumber: license.trim().toUpperCase(),
        accountHolderName: accountHolder.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifsc.trim().toUpperCase(),
        bankName: bankName.trim(),
        licenseDocument: licenseDoc ? licenseDoc.name : '',
        bankBook: bankBook ? bankBook.name : '',
      },
    };

    setSubmitting(true);
    try {
      await Auth.register(payload);
      showToast('Driver registration submitted for super user approval.');
      setTimeout(() => navigate('/login'), 700);
    } catch (err) {
      setErrors((prev) => ({ ...prev, email: err.message || 'Registration failed. Please try again.' }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="showcase">
        <BrandLogo href="/" size="lg" />
        <h1>
          Drive
          <br />
          Deliver
          <br />
          Earn
        </h1>
        <p>Get matched to nearby deliveries, follow turn-by-turn trip guidance, and track every payout — all in one app.</p>
      </section>
      <section className="auth-panel-wrap">
        <div className="auth-panel" style={{ width: 'min(760px,100%)' }}>
          <h2>Register as Driver</h2>
          <form onSubmit={onSubmit} noValidate>
            <div className="form-grid">
              <div className="form-control">
                <label htmlFor="name">Full Name</label>
                <input id="name" type="text" placeholder="Enter your full name" value={name} onChange={(e) => setName(e.target.value)} />
                <div className="error-message">{errors.name}</div>
              </div>
              <div className="form-control">
                <label htmlFor="phone">Phone Number</label>
                <input id="phone" type="text" placeholder="Enter phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <div className="error-message">{errors.phone}</div>
              </div>
              <div className="form-control">
                <label htmlFor="license">Driver License Number</label>
                <input id="license" type="text" placeholder="Enter license no." value={license} onChange={(e) => setLicense(e.target.value)} />
                <div className="error-message">{errors.license}</div>
              </div>
              <div className="form-control">
                <label htmlFor="licenseDoc">Upload License</label>
                <div className="file-upload-wrap">
                  <label className="file-upload-btn" htmlFor="licenseDoc">
                    Choose File
                  </label>
                  <input
                    className="file-upload-input"
                    id="licenseDoc"
                    type="file"
                    accept=".png,image/png"
                    onChange={(e) => setLicenseDoc(e.target.files?.[0] || null)}
                  />
                  <span className="file-upload-name">{licenseDoc ? licenseDoc.name : 'No file chosen'}</span>
                </div>
                <div className="error-message">{errors.licenseDoc}</div>
              </div>
              <div className="panel" style={{ padding: 20 }}>
                <h3 style={{ marginTop: 0 }}>Bank Details</h3>
                <div className="form-grid">
                  <div className="form-control">
                    <label htmlFor="accountHolder">Account Holder Name</label>
                    <input id="accountHolder" type="text" placeholder="Enter account holder name" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
                    <div className="error-message">{errors.accountHolder}</div>
                  </div>
                  <div className="form-row">
                    <div className="form-control">
                      <label htmlFor="accountNumber">Account Number</label>
                      <input
                        id="accountNumber"
                        type="text"
                        placeholder="Enter account no."
                        maxLength={12}
                        inputMode="numeric"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                      />
                      <div className="error-message">{errors.accountNumber}</div>
                    </div>
                    <div className="form-control">
                      <label htmlFor="ifsc">IFSC Code</label>
                      <input id="ifsc" type="text" placeholder="Enter IFSC" maxLength={11} value={ifsc} onChange={(e) => setIfsc(e.target.value)} />
                      <div className="error-message">{errors.ifsc}</div>
                    </div>
                  </div>
                  <div className="form-control">
                    <label htmlFor="bankName">Bank Name</label>
                    <input id="bankName" type="text" placeholder="Enter bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
                    <div className="error-message">{errors.bankName}</div>
                  </div>
                  <div className="form-control">
                    <label htmlFor="bankBook">Upload Bank Book</label>
                    <div className="file-upload-wrap">
                      <label className="file-upload-btn" htmlFor="bankBook">
                        Choose File
                      </label>
                      <input className="file-upload-input" id="bankBook" type="file" accept=".png,image/png" onChange={(e) => setBankBook(e.target.files?.[0] || null)} />
                      <span className="file-upload-name">{bankBook ? bankBook.name : 'No file chosen'}</span>
                    </div>
                    <div className="error-message">{errors.bankBook}</div>
                  </div>
                </div>
              </div>
              <div className="form-control">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" placeholder="Enter email address" value={email} onChange={(e) => setEmail(e.target.value)} />
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
              <div className="form-control">
                <label className="checkbox-line legal-consent">
                  <input
                    id="terms"
                    type="checkbox"
                    checked={terms}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setShowTerms(true);
                      } else {
                        setTerms(false);
                      }
                    }}
                    aria-describedby="terms-error"
                  />
                  <span>
                    I have read and agree to the{' '}
                    <button
                      className="text-link legal-trigger"
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setShowTerms(true);
                      }}
                    >
                      Terms &amp; Conditions
                    </button>.
                  </span>
                </label>
                <div className="error-message" id="terms-error">{errors.terms}</div>
              </div>
            </div>
            <div className="form-actions" style={{ justifyContent: 'stretch' }}>
              <button className="btn" style={{ width: '100%', background: '#111', color: '#ffd400' }} type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Register as Driver'}
              </button>
            </div>
            <div className="form-footer">
              Already have an account? <Link to="/login">Sign in</Link>
            </div>
          </form>
        </div>
      </section>

      <TermsModal
        open={showTerms}
        onClose={() => setShowTerms(false)}
        onAccept={() => {
          setTerms(true);
          setErrors((current) => ({ ...current, terms: '' }));
          setShowTerms(false);
        }}
      />

      <style>{`
        .file-upload-wrap { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 2px }
        .file-upload-input { position: absolute; opacity: 0; pointer-events: none; width: 1px; height: 1px }
        .file-upload-btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); background: #111; color: #ffd400; font-weight: 700; cursor: pointer; min-height: 46px; transition: filter .15s ease }
        .file-upload-btn:hover { filter: brightness(1.15) }
        .file-upload-name { color: #050505; font-size: 14px; font-weight: 600; word-break: break-word }
        .auth-panel .panel { color: #fff; }
        .auth-panel .panel .file-upload-name { color: #d8dfeb; font-weight: 400 }
        .auth-panel .panel .form-control label { color: #bdbdbd; }
      `}</style>
    </main>
  );
}
