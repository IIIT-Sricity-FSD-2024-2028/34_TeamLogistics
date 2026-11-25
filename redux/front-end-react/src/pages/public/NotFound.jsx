import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { Link, useLocation } from 'react-router-dom';
import BrandLogo from '../../components/BrandLogo';
import { usePortalStyles } from '../../hooks/usePortalStyles';

export default function NotFound() {
  usePageStyleScope('not-found');
  usePortalStyles(['styles.css', 'brand-logo.css']);
  const location = useLocation();

  return (
    <main className="not-found-page">
      <div className="not-found-glow" aria-hidden="true" />
      <header className="not-found-header">
        <BrandLogo href="/" size="lg" />
      </header>

      <section className="not-found-card">
        <div className="not-found-code">404</div>
        <p className="not-found-eyebrow">Page not found</p>
        <h1>There is no page like that.</h1>
        <p className="not-found-copy">
          The address <code>{location.pathname}</code> does not match any page in DeliverSync.
          Check the URL or use one of the links below.
        </p>
        <div className="not-found-actions">
          <Link className="not-found-primary" to="/login">Go to login</Link>
          <Link className="not-found-secondary" to="/">Back to home</Link>
        </div>
      </section>

    </main>
  );
}
