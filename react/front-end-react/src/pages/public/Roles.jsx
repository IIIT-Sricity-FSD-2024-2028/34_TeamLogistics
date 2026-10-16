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

      <style>{`
        .role-hero-section {
          text-align: center;
          padding: 76px 0 20px;
        }
        .role-eyebrow {
          display: inline-block;
          color: var(--yellow);
          font-size: 13px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
          margin-bottom: 18px;
        }
        .role-hero-title {
          font-size: clamp(36px, 4.6vw, 58px);
          font-weight: 900;
          letter-spacing: -0.02em;
          line-height: 1.08;
          margin: 0 0 18px;
        }
        .role-subtitle {
          color: var(--muted);
          font-size: 18px;
          max-width: 560px;
          margin: 0 auto;
        }
        .role-grid-section {
          padding: 46px 0 90px;
        }
        .role-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(320px, 1fr));
          gap: 28px;
          max-width: 980px;
          margin: 0 auto;
        }
        .role-card {
          background: linear-gradient(165deg, #1a1a1a, #101010);
          border: 1px solid #2a2a2a;
          border-radius: 26px;
          padding: 38px;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
          transition: border-color .25s ease, transform .25s ease, box-shadow .25s ease;
        }
        .role-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 100% 0%, rgba(255,212,0,0.10), transparent 55%);
          opacity: 0;
          transition: opacity .25s ease;
          pointer-events: none;
          z-index: 0;
        }
        .role-card:hover {
          border-color: #3a3a3a;
          transform: translateY(-4px);
          box-shadow: 0 28px 60px rgba(0,0,0,.45);
        }
        .role-card:hover::before { opacity: 1; }
        .role-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 22px;
          position: relative;
          z-index: 1;
        }
        .role-icon {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          background: linear-gradient(160deg, var(--yellow), var(--yellow-2));
          color: #0b0b0b;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 14px 30px rgba(255,212,0,.2);
        }
        .role-icon svg { width: 30px; height: 30px; }
        .role-stat {
          text-align: right;
        }
        .role-stat strong {
          display: block;
          font-size: 24px;
          font-weight: 900;
          color: var(--yellow);
          line-height: 1;
        }
        .role-stat span {
          display: block;
          margin-top: 4px;
          font-size: 12px;
          color: var(--muted);
          font-weight: 700;
        }
        .role-tagline {
          position: relative;
          z-index: 1;
          display: inline-block;
          color: var(--muted);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .1em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .role-card h3 {
          position: relative;
          z-index: 1;
          font-size: 26px;
          font-weight: 900;
          margin: 0 0 12px;
        }
        .role-card p {
          position: relative;
          z-index: 1;
          margin: 0;
          color: #c9c9c9;
          line-height: 1.65;
          font-size: 15px;
        }
        .role-features {
          list-style: none;
          margin: 22px 0 28px;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 13px;
          position: relative;
          z-index: 1;
          flex: 1;
        }
        .role-features li {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #d9d9d9;
          font-size: 14.5px;
          font-weight: 600;
        }
        .role-check {
          flex: 0 0 22px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(255,212,0,.14);
          color: var(--yellow);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .role-check svg { width: 12px; height: 12px; }
        .role-cta {
          position: relative;
          z-index: 1;
          width: 100%;
          justify-content: center;
          font-size: 15px;
          padding: 15px 20px;
        }
        .role-signin {
          text-align: center;
          margin: 40px 0 0;
          color: var(--muted);
          font-size: 15px;
        }
        .role-signin a {
          color: var(--yellow);
          font-weight: 800;
        }
        @media (max-width: 800px) {
          .role-grid { grid-template-columns: 1fr; }
          .role-hero-section { padding: 50px 0 10px; }
        }
      `}</style>
    </>
  );
}
