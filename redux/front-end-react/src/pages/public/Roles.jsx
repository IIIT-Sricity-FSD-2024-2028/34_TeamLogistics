import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { Link } from 'react-router-dom';
import { usePortalStyles } from '../../hooks/usePortalStyles';
import BrandLogo from '../../components/BrandLogo';

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function BusinessIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="18" height="12" rx="1.5" />
      <path d="M8 9V6a4 4 0 0 1 8 0v3" />
      <path d="M3 14h18" />
    </svg>
  );
}

function DriverIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16V9a1 1 0 0 1 1-1h9l4 4h3a1 1 0 0 1 1 1v3" />
      <circle cx="7.5" cy="17.5" r="2" />
      <circle cx="17.5" cy="17.5" r="2" />
      <path d="M9.5 17.5h6" />
    </svg>
  );
}

const roles = [
  {
    key: 'business',
    icon: <BusinessIcon />,
    title: 'Business Client',
    tagline: 'For companies that ship',
    description: 'Create delivery requests, follow persisted status updates, and manage invoices from one dashboard.',
    features: ['Create and track delivery requests', 'Shared delivery status history', 'Manage invoices and payment proof'],
    stat: ['600+', 'Businesses onboard'],
    cta: 'Register as Business Client',
    to: '/register-business-client',
  },
  {
    key: 'driver',
    icon: <DriverIcon />,
    title: 'Driver',
    tagline: 'For those who deliver',
    description: 'Get matched to nearby deliveries, follow turn-by-turn trip guidance, and track every payout in one app.',
    features: ['Get matched to nearby deliveries', 'Turn-by-turn trip navigation', 'Track earnings and payouts'],
    stat: ['300+', 'Drivers on the road'],
    cta: 'Register as Driver',
    to: '/register-driver',
  },
];

export default function Roles() {
  usePageStyleScope('roles');
  usePortalStyles(['styles.css', 'brand-logo.css']);

  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <BrandLogo href="/" size="lg" />
          <nav className="nav-links">
            <Link to="/about">About Us</Link>
            <Link to="/#features">Features</Link>
            <Link to="/#contact">Contact Us</Link>
          </nav>
          <div className="actions">
            <Link className="btn btn-outline" to="/login">
              Login
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="role-hero-section container">
          <span className="role-eyebrow">Get Started</span>
          <h1 className="role-hero-title">
            Choose your path on <span className="accent">DeliverSync</span>
          </h1>
          <p className="role-subtitle">Two ways to join the platform — pick the one that matches what you need to do.</p>
        </section>

        <section className="role-grid-section container">
          <div className="role-grid">
            {roles.map((role) => (
              <article className="role-card" key={role.key}>
                <div className="role-card-top">
                  <div className="role-icon">{role.icon}</div>
                  <div className="role-stat">
                    <strong>{role.stat[0]}</strong>
                    <span>{role.stat[1]}</span>
                  </div>
                </div>

                <span className="role-tagline">{role.tagline}</span>
                <h3>{role.title}</h3>
                <p>{role.description}</p>

                <ul className="role-features">
                  {role.features.map((f) => (
                    <li key={f}>
                      <span className="role-check">
                        <CheckIcon />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link className="btn btn-primary role-cta" to={role.to}>
                  {role.cta}
                </Link>
              </article>
            ))}
          </div>

          <p className="role-signin">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </section>
      </main>

      <footer className="footer" id="contact">
        <div className="container footer-grid">
          <div>
            <BrandLogo href="/" size="md" />
            <p>DeliverSync is a smart fleet and driver operations management platform designed to optimize logistics operations for modern businesses.</p>
          </div>
          <div>
            <h4>Quick Links</h4>
            <ul>
              <li>
                <Link to="/about">About Us</Link>
              </li>
              <li>
                <Link to="/#features">Features</Link>
              </li>
              <li>
                <Link to="/#contact">Contact</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>Contact Information</h4>
            <p>
              support@deliverysync.com
              <br />
              +91 9440316789, +91 8795473470
              <br />
              BH-1, IIIT Sricity, Andhra Pradesh - 517646
            </p>
          </div>
        </div>
        <div className="container footer-bottom">© 2026 DeliverSync. All rights reserved.</div>
      </footer>

    </>
  );
}
