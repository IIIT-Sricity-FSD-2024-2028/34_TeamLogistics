import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Auth } from '../../api/namespaces';
import { useSession } from '../../auth/SessionContext';
import { usePortalStyles } from '../../hooks/usePortalStyles';
import BrandLogo from '../../components/BrandLogo';

const roleHome = {
  superuser: '/superuser/dashboard',
  'fleet-manager': '/fleet-manager/dashboard',
  'business-client': '/business-client/dashboard',
  driver: '/driver/dashboard',
};

export default function Login() {
  usePortalStyles(['styles.css', 'brand-logo.css']);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useSession();
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setFieldErrors({});
    setGlobalError('');
    setSuccess('');

    const identifier = email.trim();
    const errs = {};
    if (!identifier) errs.email = 'Email is required';
    else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/.test(identifier)) errs.email = 'Please enter a valid email address';
    if (!password) errs.password = 'Password is required';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const result = await Auth.login(identifier, password);
      login({ ...result, remembered: rememberMe, loggedInAt: new Date().toISOString() });
      setSuccess(`${result.name} signed in successfully! Redirecting...`);
      setTimeout(() => navigate(roleHome[result.role] || '/'), 400);
    } catch (err) {
      const message = String(err.message || '');
      if (err.status === 0 || err.status >= 500) setGlobalError(message || 'The server is temporarily unavailable.');
      else if (/incorrect password/i.test(message)) setFieldErrors({ password: message });
      else if (/no account found/i.test(message)) setFieldErrors({ email: message });
      else if (message) setFieldErrors({ email: message });
      else setGlobalError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="showcase">
        <BrandLogo href="/" size="lg" />
        <h1>
          Access
          <br />
          Your
          <br />
          Operations
        </h1>
        <p>Log in to manage fleets, track persisted delivery updates, and monitor operational performance.</p>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-panel">
          <h2>Welcome Back!!</h2>

          {globalError && <div className="login-global-error show">{globalError}</div>}
          {success && <div className="login-success show">{success}</div>}

          <form onSubmit={onSubmit} noValidate>
            <div className="form-grid">
              <div className="form-control">
                <label htmlFor="email">Email</label>
                <div className="input-wrap">
                  <input
                    id="email"
                    type="email"
                    placeholder="abc@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ borderColor: fieldErrors.email ? '#ff5b5b' : '' }}
                  />
                </div>
                <span className="error-message">{fieldErrors.email}</span>
              </div>

              <div className="form-control">
                <label htmlFor="password">Password</label>
                <div className="input-wrap">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value.replace(/\s/g, ''))}
                    style={{ borderColor: fieldErrors.password ? '#ff5b5b' : '' }}
                  />
                  <button type="button" className="toggle-visibility" onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
                <span className="error-message">{fieldErrors.password}</span>
              </div>
            </div>

            <div className="form-meta">
              <label className="checkbox-line">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} /> Remember Me
              </label>
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" type="submit" disabled={loading} style={{ minWidth: 160, background: '#111', color: '#ffd400' }}>
                {loading ? 'Signing in...' : 'Login'}
              </button>
            </div>

            <div className="form-footer">
              Don't have an account? <Link to="/roles">Get started</Link>
            </div>
          </form>
        </div>
      </section>

      <style>{`
        .form-control .error-message { color: #ff5b5b; font-size: 0.82rem; margin-top: 4px; min-height: 1.1em; display: block; }
        .login-global-error { background: rgba(255,91,91,0.12); color: #ff5b5b; border: 1px solid rgba(255,91,91,0.3); border-radius: 8px; padding: 10px 14px; font-size: 0.9rem; margin-bottom: 16px; text-align: center; }
        .login-success { background: rgba(46,204,113,0.12); color: #2ecc71; border: 1px solid rgba(46,204,113,0.3); border-radius: 8px; padding: 10px 14px; font-size: 0.9rem; margin-bottom: 16px; text-align: center; }
      `}</style>
    </main>
  );
}
