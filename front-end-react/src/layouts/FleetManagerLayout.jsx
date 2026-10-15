import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { usePortalStyles } from '../hooks/usePortalStyles';
import { useNotificationBadge } from '../hooks/useNotificationBadge';
import { usePageHeaderContext, PageHeaderProvider } from '../hooks/usePageHeader';
import { useSession } from '../auth/SessionContext';
import BrandLogo from '../components/BrandLogo';
import { initials } from '../pages/fleet-manager/fmUtils';

const nav = [
  [
    'Dashboard',
    '/fleet-manager/dashboard',
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect height="6" rx="1" width="6" x="4" y="4"></rect>
      <rect height="6" rx="1" width="6" x="14" y="4"></rect>
      <rect height="6" rx="1" width="6" x="4" y="14"></rect>
      <rect height="6" rx="1" width="6" x="14" y="14"></rect>
    </svg>,
  ],
  [
    'Vehicles',
    '/fleet-manager/vehicles',
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M3 14V9a2 2 0 0 1 2-2h8l3 3h3a2 2 0 0 1 2 2v2"></path>
      <circle cx="7" cy="16.5" r="2"></circle>
      <circle cx="17" cy="16.5" r="2"></circle>
    </svg>,
  ],
  [
    'Drivers',
    '/fleet-manager/drivers',
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="9" cy="8" r="3"></circle>
      <path d="M4 19a5 5 0 0 1 10 0"></path>
      <circle cx="17" cy="9" r="2"></circle>
      <path d="M15 19a4 4 0 0 1 5-3.8"></path>
    </svg>,
  ],
  [
    'Compliance',
    '/fleet-manager/compliance',
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"></path>
    </svg>,
  ],
  [
    'Trips',
    '/fleet-manager/trips',
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 12h12"></path>
      <path d="M13 6l6 6-6 6"></path>
    </svg>,
  ],
  [
    'Maintenance',
    '/fleet-manager/maintenance',
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M14.7 6.3a4 4 0 0 0 3 5.7l-7.4 7.4a2 2 0 1 1-2.8-2.8l7.4-7.4a4 4 0 0 0-5.7-3"></path>
    </svg>,
  ],
  [
    'Documents',
    '/fleet-manager/documents',
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 3h6l5 5v13H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path>
      <path d="M14 3v5h5"></path>
    </svg>,
  ],
  [
    'Analytics',
    '/fleet-manager/analytics',
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 20V9"></path>
      <path d="M10 20V4"></path>
      <path d="M16 20v-7"></path>
      <path d="M22 20V12"></path>
    </svg>,
  ],
  [
    'Transactions',
    '/fleet-manager/transactions',
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="3" y="5" width="18" height="14" rx="2"></rect>
      <path d="M3 10h18"></path>
      <path d="M7 15h4"></path>
    </svg>,
  ],
  [
    'Notifications',
    '/fleet-manager/notifications',
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M15 17H5l1.3-1.3A2 2 0 0 0 7 14.3V10a5 5 0 1 1 10 0v4.3a2 2 0 0 0 .6 1.4L19 17h-4"></path>
      <path d="M10 20a2 2 0 0 0 4 0"></path>
    </svg>,
  ],
  [
    'Profile',
    '/fleet-manager/profile',
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4"></circle>
      <path d="M4 20a8 8 0 0 1 16 0"></path>
    </svg>,
  ],
];

function FleetManagerShell() {
  usePortalStyles(['brand-logo.css', 'fleet-manager.css']);
  const { logout, session } = useSession();
  const { unread } = useNotificationBadge();
  const { header } = usePageHeaderContext();
  const navigate = useNavigate();

  return (
    <div className="fleet-layout">
      <aside className="sidebar">
        <div className="brand">
          <BrandLogo href="/fleet-manager/dashboard" size="sm" sub="Fleet Manager Portal" />
        </div>
        <nav className="nav">
          {nav.map(([name, href, icon]) => (
            <NavLink key={href} to={href} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="ico">{icon}</span>
              <span>{name}</span>
            </NavLink>
          ))}
        </nav>
        <a
          className="logout"
          href="/login"
          onClick={(e) => {
            e.preventDefault();
            logout();
            navigate('/login');
          }}
        >
          <span className="ico">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <path d="M16 17l5-5-5-5"></path>
              <path d="M21 12H9"></path>
            </svg>
          </span>
          <span>Logout</span>
        </a>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="pagehead">
            <h1>{header.title}</h1>
            <p>{header.subtitle}</p>
          </div>
          <div className="toptools">
            <a
              aria-label="Notifications"
              className="iconbox iconlink notif-link"
              href="/fleet-manager/notifications"
              onClick={(e) => {
                e.preventDefault();
                navigate('/fleet-manager/notifications');
              }}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M15 17H5l1.3-1.3A2 2 0 0 0 7 14.3V10a5 5 0 1 1 10 0v4.3a2 2 0 0 0 .6 1.4L19 17h-4"></path>
                <path d="M10 20a2 2 0 0 0 4 0"></path>
              </svg>
              <span className="dot">{unread}</span>
            </a>
            <NavLink className="top-profile-link" to="/fleet-manager/profile" aria-label="Open fleet manager profile">
              <div className="avatar">{initials(session?.name)}</div>
              <div className="usertext">
                <strong>{session?.name || ''}</strong>
                <span>Fleet Manager</span>
              </div>
            </NavLink>
          </div>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function FleetManagerLayout() {
  return (
    <PageHeaderProvider>
      <FleetManagerShell />
    </PageHeaderProvider>
  );
}
