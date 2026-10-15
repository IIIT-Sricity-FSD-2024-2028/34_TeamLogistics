import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { usePortalStyles } from '../hooks/usePortalStyles';
import { useNotificationBadge } from '../hooks/useNotificationBadge';
import { usePageHeaderContext, PageHeaderProvider } from '../hooks/usePageHeader';
import { useSession } from '../auth/SessionContext';
import BrandLogo from '../components/BrandLogo';

const nav = [
  ['Dashboard', '/driver/dashboard', 'dashboard'],
  ['Map', '/driver/map', 'map'],
  ['History', '/driver/history', 'history'],
  ['Notifications', '/driver/notifications', 'notifications'],
  ['Earnings', '/driver/earnings', 'earnings'],
  ['Profile', '/driver/profile', 'profile'],
];

function initials(name) {
  if (!name) return 'D';
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function DriverShell() {
  usePortalStyles(['brand-logo.css', 'driver-desktop.css']);
  const { logout, session } = useSession();
  const { unread } = useNotificationBadge();
  const { header } = usePageHeaderContext();
  const navigate = useNavigate();

  return (
    <div className="driver-shell">
      <aside className="driver-sidebar">
        <BrandLogo href="/driver/dashboard" size="sm" sub="Driver Portal" />

        <nav className="sidebar-nav">
          {nav.map(([name, href, key]) => (
            <NavLink key={href} to={href} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className={`nav-icon icon-${key}`} />
              <span>{name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="logout-btn"
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="driver-main">
        <header className="topbar">
          <div className="topbar-left">
            <h1>{header.title}</h1>
            {header.subtitle && <p>{header.subtitle}</p>}
          </div>

          <div className="topbar-right">
            <div style={{ position: 'relative' }}>
              <button className="icon-circle notification-link" aria-label="Notifications" onClick={() => navigate('/driver/notifications')}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path
                    d="M18 9C18 5.686 15.314 3 12 3C8.686 3 6 5.686 6 9V13.2C6 14.054 5.728 14.885 5.224 15.574L4 17.25H20L18.776 15.574C18.272 14.885 18 14.054 18 13.2V9Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M9.5 20C10.1 20.62 11 21 12 21C13 21 13.9 20.62 14.5 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                {unread > 0 && <span className="icon-badge">{unread}</span>}
              </button>
            </div>

            <button className="profile-chip" type="button" onClick={() => navigate('/driver/profile')}>
              <div className="profile-avatar">{initials(session?.name)}</div>
              <div>
                <div style={{ fontWeight: 800, color: '#fff' }}>{session?.name || 'Driver'}</div>
                <div style={{ fontSize: 12, color: '#9e9e9e' }}>{session?.email || ''}</div>
              </div>
            </button>
          </div>
        </header>

        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}

export default function DriverLayout() {
  return (
    <PageHeaderProvider>
      <DriverShell />
    </PageHeaderProvider>
  );
}
