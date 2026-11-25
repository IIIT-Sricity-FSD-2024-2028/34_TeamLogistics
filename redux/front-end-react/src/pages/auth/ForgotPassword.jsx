import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Auth } from '../../api/namespaces';
import BrandLogo from '../../components/BrandLogo';
import { usePortalStyles } from '../../hooks/usePortalStyles';

const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;

export default function ForgotPassword() {
  usePageStyleScope('forgot-password');
  usePortalStyles(['styles.css', 'brand-logo.css']);
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function requestCode(event) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setFieldErrors({});
    setGlobalError('');
    setMessage('');

    if (!normalizedEmail) {
      setFieldErrors({ email: 'Email is required' });
      return;
    }
    if (!emailPattern.test(normalizedEmail)) {
      setFieldErrors({ email: 'Please enter a valid email address' });
      return;
    }

    setLoading(true);
    try {
      const result = await Auth.forgotPassword(normalizedEmail);
      setEmail(normalizedEmail);
      setMessage(result.message);
      setStep('reset');
    } catch (error) {
      setGlobalError(error.message || 'Unable to request a reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    const errors = {};
    setFieldErrors({});
    setGlobalError('');
    setMessage('');

    if (!/^\d{6}$/.test(code)) errors.code = 'Enter the 6-digit reset code';
    if (newPassword.length < 8) errors.newPassword = 'Password must contain at least 8 characters';
    else if (!/(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])/.test(newPassword)) {
      errors.newPassword = 'Include an uppercase letter, a number, and a special character';
    }
    if (confirmPassword !== newPassword) errors.confirmPassword = 'Passwords do not match';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const result = await Auth.resetPassword(email, code, newPassword);
      setMessage(result.message);
      setStep('success');
    } catch (error) {
      const errorMessage = error.message || 'Unable to reset your password. Please try again.';
      if (/code/i.test(errorMessage)) setFieldErrors({ code: errorMessage });
      else if (/password/i.test(errorMessage)) setFieldErrors({ newPassword: errorMessage });
      else setGlobalError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function startOver() {
    setStep('email');
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    setFieldErrors({});
    setGlobalError('');
    setMessage('');
  }

  return (
    <main className="login-shell">
      <section className="showcase">
        <BrandLogo href="/" size="lg" />
        <h1>Recover<br />Your<br />Account</h1>
        <p>Verify your email with a one-time code, then choose a secure new password.</p>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-panel reset-panel">
          <h2>{step === 'success' ? 'Password Updated' : 'Forgot Password'}</h2>

          {globalError && <div className="reset-alert reset-error" role="alert">{globalError}</div>}
          {message && <div className="reset-alert reset-message" role="status">{message}</div>}

          {step === 'email' && (
            <form onSubmit={requestCode} noValidate>
              <p className="reset-description">Enter the email address connected to your DeliverSync account.</p>
              <div className="form-control">
                <label htmlFor="reset-email">Email</label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  placeholder="abc@gmail.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  style={{ borderColor: fieldErrors.email ? '#ff5b5b' : '' }}
                />
                <span className="error-message">{fieldErrors.email}</span>
              </div>
              <div className="form-actions">
                <button className="btn btn-secondary reset-submit" type="submit" disabled={loading}>
                  {loading ? 'Creating code...' : 'Send reset code'}
                </button>
              </div>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={resetPassword} noValidate>
              <p className="reset-description">Enter the code for <strong>{email}</strong> and set your new password.</p>
              <div className="form-grid">
                <div className="form-control">
                  <label htmlFor="reset-code">Reset code</label>
                  <input
                    id="reset-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{ borderColor: fieldErrors.code ? '#ff5b5b' : '' }}
                  />
                  <span className="error-message">{fieldErrors.code}</span>
                </div>
                <div className="form-control">
                  <label htmlFor="new-password">New password</label>
                  <div className="input-wrap">
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value.replace(/\s/g, ''))}
                      style={{ borderColor: fieldErrors.newPassword ? '#ff5b5b' : '' }}
                    />
                    <button type="button" className="toggle-visibility" onClick={() => setShowPassword((value) => !value)}>
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <span className="error-message">{fieldErrors.newPassword}</span>
                </div>
                <div className="form-control">
                  <label htmlFor="confirm-password">Confirm new password</label>
                  <input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value.replace(/\s/g, ''))}
                    style={{ borderColor: fieldErrors.confirmPassword ? '#ff5b5b' : '' }}
                  />
                  <span className="error-message">{fieldErrors.confirmPassword}</span>
                </div>
              </div>
              <div className="form-actions reset-actions">
                <button className="btn btn-secondary reset-submit" type="submit" disabled={loading}>
                  {loading ? 'Updating password...' : 'Reset password'}
                </button>
                <button className="reset-secondary" type="button" onClick={startOver} disabled={loading}>Use another email</button>
              </div>
            </form>
          )}

          {step === 'success' && (
            <div className="reset-success-actions">
              <p>Your password is ready to use. Return to login and sign in securely.</p>
              <button className="btn btn-secondary reset-submit" type="button" onClick={() => navigate('/login')}>
                Back to login
              </button>
            </div>
          )}

          {step !== 'success' && <div className="form-footer"><Link to="/login">Back to login</Link></div>}
        </div>
      </section>

    </main>
  );
}
