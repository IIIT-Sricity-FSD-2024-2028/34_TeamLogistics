import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePortalStyles } from '../../hooks/usePortalStyles';
import { useToast } from '../../hooks/useToast';
import BrandLogo from '../../components/BrandLogo';
import { Auth } from '../../api/namespaces';
import TermsModal from '../../components/TermsModal';
import { TERMS_VERSION } from '../../constants/legal';

const BUSINESS_EMAIL_REGEX =
  /^(?=.{1,64}@)(?=.{6,320}$)(?!\.)(?!.*\.\.)([A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+(?:\.[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+)*)@([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)$/;

export default function RegisterBusinessClient() {
  usePortalStyles(['styles.css', 'brand-logo.css', 'terms-modal.css']);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyContact, setCompanyContact] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [personalMobile, setPersonalMobile] = useState('');
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
    if (!companyName.trim() || companyName.trim().length < 2) errs.companyName = 'Enter a valid company name (at least 2 characters)';
    else if (/^\d+$/.test(companyName.trim())) errs.companyName = 'Company name cannot be only numbers';
    if (!/^[A-Za-z ]{3,40}$/.test(fullName.trim())) errs.fullName = 'Enter a valid full name';
    if (companyContact.trim() && !/^[6-9]\d{9}$/.test(companyContact.trim())) errs.companyContact = 'Phone number must start with 6, 7, 8, or 9';
    if (businessAddress.trim().length < 8) errs.businessAddress = 'Business address is too short';
    if (!/^[6-9]\d{9}$/.test(personalMobile.trim())) errs.personalMobile = 'Phone number must start with 6, 7, 8, or 9';
    if (!BUSINESS_EMAIL_REGEX.test(email.trim()))
      errs.email =
        "Enter a valid email in personal_info@domain format. Use letters, numbers, allowed special characters (! # $ % & ' * + - / = ? ^ _ ` { | } ~), dots not at the start/end or repeated, max 64 chars before @, and a valid domain after @.";
    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password)) errs.password = 'Minimum 8 chars with 1 capital, 1 number, 1 special char';
    if (confirmPassword !== password) errs.confirmPassword = 'Passwords do not match';
    if (!terms) errs.terms = 'You must accept the Terms & Conditions';
    return errs;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const companyContactFinal = companyContact.trim() || personalMobile.trim();
    const payload = {
      name: companyName.trim() || fullName.trim(),
      email: email.trim(),
      password,
      role: 'business-client',
      phone: personalMobile.trim(),
      termsAccepted: true,
      termsVersion: TERMS_VERSION,
      profileDetails: {
        companyName: companyName.trim() || fullName.trim(),
        fullName: fullName.trim(),
        businessAddress: businessAddress.trim(),
        companyContactNumber: companyContactFinal,
      },
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
      <section className="showcase">
        <BrandLogo href="/" size="lg" />
        <h1>
          Grow
          <br />
          With
          <br />
          Confidence
        </h1>
        <p>Create delivery requests, follow shared status updates, and manage invoices from one dashboard.</p>
      </section>
      <section className="auth-panel-wrap">
        <div className="auth-panel" style={{ width: 'min(760px,100%)' }}>
          <h2>Create Your Account</h2>
          <form onSubmit={onSubmit} noValidate>
            <div className="form-grid">
              <div className="form-control">
                <label htmlFor="companyName">
                  Company Name <span style={{ color: '#9ca3af', fontSize: 12 }}>(Optional)</span>
                </label>
                <input id="companyName" type="text" placeholder="Enter company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                <div className="error-message">{errors.companyName}</div>
              </div>
              <div className="form-control">
                <label htmlFor="fullName">Full Name</label>
                <input id="fullName" type="text" placeholder="Enter full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <div className="error-message">{errors.fullName}</div>
              </div>
              <div className="form-control">
                <label htmlFor="companyContact">
                  Company Contact Number <span style={{ color: '#9ca3af', fontSize: 12 }}>(Optional)</span>
                </label>
                <input id="companyContact" type="text" placeholder="Enter company number" value={companyContact} onChange={(e) => setCompanyContact(e.target.value)} />
                <div className="error-message">{errors.companyContact}</div>
              </div>
              <div className="form-control">
                <label htmlFor="businessAddress">Address</label>
                <input id="businessAddress" type="text" placeholder="Enter address" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} />
                <div className="error-message">{errors.businessAddress}</div>
              </div>
              <div className="form-control">
                <label htmlFor="personalMobile">Personal Mobile Number</label>
                <input id="personalMobile" type="text" placeholder="Enter mobile" value={personalMobile} onChange={(e) => setPersonalMobile(e.target.value)} />
                <div className="error-message">{errors.personalMobile}</div>
              </div>
              <div className="form-control">
                <label htmlFor="email">Email Address</label>
                <input id="email" type="email" placeholder="Enter email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <div className="error-message">{errors.email}</div>
              </div>
              <div className="form-row">
                <div className="form-control">
                  <label htmlFor="password">Password</label>
                  <div className="input-wrap">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimum 8 chars, 1 capital, 1 number, 1 special"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
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
                {submitting ? 'Submitting...' : 'Create Account'}
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
    </main>
  );
}
