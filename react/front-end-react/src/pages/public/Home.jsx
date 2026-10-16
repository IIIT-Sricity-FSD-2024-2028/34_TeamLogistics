import { Link } from 'react-router-dom';
import { usePortalStyles } from '../../hooks/usePortalStyles';
import BrandLogo from '../../components/BrandLogo';

export default function Home() {
  usePortalStyles(['styles.css', 'brand-logo.css']);

  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <BrandLogo href="/" size="lg" />
          <nav className="nav-links">
            <Link to="/about">About Us</Link>
            <a href="#features">Features</a>
            <a href="#contact">Contact Us</a>
            <Link to="/login">Login</Link>
          </nav>
          <div className="actions">
            <Link className="btn btn-primary" to="/roles">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero container">
          <div className="hero-copy">
            <h1>
              Seamless
              <br />
              <span className="accent">
                Delivery
                <br />
                Operations
              </span>
              <br />
              Management
            </h1>
            <p>
              Assign drivers through controlled dispatch, monitor delivery states across portals, and manage fleet operations from one shared backend
              for modern businesses.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" to="/roles">
                Get Started
              </Link>
              <Link className="btn btn-outline" to="/login">
                Login
              </Link>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image-card">
              <img src="/assets/img/hero-truck.jpeg" alt="DeliverSync truck" />
            </div>
          </div>
        </section>

        <section className="stats">
          <div className="container stats-grid">
            <div className="stat">
              <div className="number">2026</div>
              <div className="label">Founded</div>
            </div>
            <div className="stat">
              <div className="number">320+</div>
              <div className="label">Team Members</div>
            </div>
            <div className="stat">
              <div className="number">600+</div>
              <div className="label">Clients Served</div>
            </div>
            <div className="stat">
              <div className="number">99.8%</div>
              <div className="label">Uptime</div>
            </div>
          </div>
        </section>

        <section className="section center container">
          <h2 className="section-title">
            <span className="accent">Our Mission</span>
          </h2>
          <p className="section-copy">
            To provide reliable logistics coordination through shared operational records and intuitive
            design. We believe that clarity in the supply chain is a competitive advantage. Our platform is engineered to eliminate data silos and empower
            teams to make proactive decisions that drive growth.
          </p>
        </section>

        <section className="section container" id="features">
          <div className="center">
            <h2 className="section-title">
              What Deliver<span className="accent">Sync</span> Offers?
            </h2>
          </div>
          <div className="card-grid">
            <article className="card">
              <div className="icon-box">◎</div>
              <h3>Controlled Dispatch</h3>
              <p>Fleet managers manually assign an available driver who has an active registered vehicle.</p>
            </article>
            <article className="card">
              <div className="icon-box">⌖</div>
              <h3>Shared Status Tracking</h3>
              <p>Every portal reads the same persisted request, trip, driver, and vehicle state.</p>
            </article>
            <article className="card">
              <div className="icon-box">◔</div>
              <h3>SLA Monitoring</h3>
              <p>Backend timestamps and status history provide accountable operational reporting.</p>
            </article>
            <article className="card">
              <div className="icon-box">▣</div>
              <h3>Compliance Engine</h3>
              <p>Complete regulatory compliance management including licenses and certifications.</p>
            </article>
            <article className="card">
              <div className="icon-box">☰</div>
              <h3>Proof of Delivery</h3>
              <p>Digital validation with signatures, photos, and timestamp documentation.</p>
            </article>
            <article className="card">
              <div className="icon-box">▤</div>
              <h3>Insights &amp; Reporting</h3>
              <p>Comprehensive analytics dashboard with actionable fleet performance insights.</p>
            </article>
          </div>
        </section>

        <section className="section container">
          <div className="center">
            <h2 className="section-title">
              Trusted by <span className="accent">Logistics Leaders</span>
            </h2>
          </div>
          <div className="card-grid">
            <article className="card quote-card">
              <div className="quote-mark">❞</div>
              <p>DeliverSync helped us reduce manual dispatch errors and improve delivery speed significantly.</p>
              <div className="quote-footer">
                <strong>Operations Manager</strong>
                <span>NorthBay Logistics</span>
              </div>
            </article>
            <article className="card quote-card">
              <div className="quote-mark">❞</div>
              <p>Shared delivery statuses give dispatchers, drivers, and customers the same operational view.</p>
              <div className="quote-footer">
                <strong>Supply Chain Lead</strong>
                <span>UrbanCart Retail</span>
              </div>
            </article>
            <article className="card quote-card">
              <div className="quote-mark">❞</div>
              <p>Implementation was seamless and the ROI was visible within the first month. Compliance tracking alone has saved countless hours.</p>
              <div className="quote-footer">
                <strong>Fleet Director</strong>
                <span>Cascade Distribution</span>
              </div>
            </article>
          </div>
        </section>

        <section className="section cta container">
          <h2 className="section-title">
            <span className="accent">Ready to Transform Your Operations?</span>
          </h2>
          <p className="section-copy">Join the growing number of logistics companies optimizing with DeliverSync.</p>
          <div style={{ marginTop: 28 }}>
            <Link className="btn btn-primary" to="/roles">
              Get Started
            </Link>
          </div>
        </section>
      </main>

      <footer className="footer" id="contact">
        <div className="container footer-grid">
          <div>
            <BrandLogo href="/" size="md" />
            <p>DeliverSync is a fleet and driver operations platform built around persisted delivery, trip, vehicle, and payment records.</p>
          </div>
          <div>
            <h4>Quick Links</h4>
            <ul>
              <li>
                <Link to="/about">About Us</Link>
              </li>
              <li>
                <a href="#features">Features</a>
              </li>
              <li>
                <a href="#contact">Contact</a>
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
