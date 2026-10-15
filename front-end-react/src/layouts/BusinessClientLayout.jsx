import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { usePortalStyles } from '../hooks/usePortalStyles';
import { useNotificationBadge } from '../hooks/useNotificationBadge';
import { useSession } from '../auth/SessionContext';
import BrandLogo from '../components/BrandLogo';
import { useBcCurrentUser } from '../pages/business-client/useBcCurrentUser';

const nav = [
  [
    'Dashboard',
    '/business-client/dashboard',
    <svg viewBox="0 0 24 24">
      <path d="M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z"></path>
      <path d="M12 22V11"></path>
      <path d="M20 6.5l-8 4.5-8-4.5"></path>
    </svg>,
  ],
  [
    'Create Delivery',
    '/business-client/create-delivery',
    <svg viewBox="0 0 24 24">
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"></path>
    </svg>,
  ],
  [
    'Active Deliveries',
    '/business-client/active-deliveries',
    <svg viewBox="0 0 24 24">
      <path d="M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z"></path>
      <path d="M12 22V11"></path>
      <path d="M20 6.5l-8 4.5-8-4.5"></path>
    </svg>,
  ],
  [
    'Completed Deliveries',
    '/business-client/completed-deliveries',
    <svg viewBox="0 0 24 24">
      <path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1V3z"></path>
      <path d="M9 8h6"></path>
      <path d="M9 12h6"></path>
    </svg>,
  ],
  [
    'Transactions',
    '/business-client/transactions',
    <svg viewBox="0 0 24 24">
      <path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1V3z"></path>
      <path d="M9 8h6"></path>
      <path d="M9 12h6"></path>
    </svg>,
  ],
  [
    'Notifications',
    '/business-client/notifications',
    <svg viewBox="0 0 24 24">
      <path d="M18 9C18 5.686 15.314 3 12 3C8.686 3 6 5.686 6 9V13.2C6 14.054 5.728 14.885 5.224 15.574L4 17.25H20L18.776 15.574C18.272 14.885 18 14.054 18 13.2V9Z"></path>
      <path d="M9.5 20C10.1 20.62 11 21 12 21C13 21 13.9 20.62 14.5 20"></path>
    </svg>,
  ],
  [
    'Profile',
    '/business-client/profile',
    <svg viewBox="0 0 24 24">
      <path d="M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z"></path>
      <path d="M12 22V11"></path>
      <path d="M20 6.5l-8 4.5-8-4.5"></path>
    </svg>,
  ],
];

export default function BusinessClientLayout() {
  usePortalStyles(['brand-logo.css', 'business-client.css']);
  const { logout } = useSession();
  const { unread } = useNotificationBadge();
  const navigate = useNavigate();
  const current = useBcCurrentUser();

  return (
    <div className="bc-layout">
      <aside className="bc-sidebar">
        <div className="bc-brand">
          <BrandLogo href="/business-client/dashboard" size="sm" sub="Business Client" />
        </div>

        <nav className="bc-nav">
          {nav.map(([name, href, icon]) => (
            <NavLink key={href} to={href} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="ico">{icon}</span>
              <span>{name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="spacer"></div>

        <a
          className="bc-logout"
          href="/login"
          onClick={(e) => {
            e.preventDefault();
            logout();
            navigate('/login');
          }}
        >
          <span className="ico">
            <svg viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <path d="M16 17l5-5-5-5"></path>
              <path d="M21 12H9"></path>
            </svg>
          </span>
          <span>Logout</span>
        </a>
      </aside>

      <main className="bc-main">
        <header className="bc-topbar">
          <div className="bc-topbar-left">
            <div className="company">{current.companyName}</div>
            <div className="subtitle">Business Client Dashboard</div>
          </div>

          <div className="bc-top-actions">
            <a
              className="bc-bell"
              href="/business-client/notifications"
              aria-label="Notifications"
              onClick={(e) => {
                e.preventDefault();
                navigate('/business-client/notifications');
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path
                  d="M18 9C18 5.686 15.314 3 12 3C8.686 3 6 5.686 6 9V13.2C6 14.054 5.728 14.885 5.224 15.574L4 17.25H20L18.776 15.574C18.272 14.885 18 14.054 18 13.2V9Z"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M9.5 20C10.1 20.62 11 21 12 21C13 21 13.9 20.62 14.5 20" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
              </svg>
              <span className="badge" style={{ display: unread > 0 ? '' : 'none' }}>
                {unread}
              </span>
            </a>

            <a
              className="bc-profile-chip"
              href="/business-client/profile"
              onClick={(e) => {
                e.preventDefault();
                navigate('/business-client/profile');
              }}
            >
              <div className="bc-profile-avatar">{current.initials}</div>
              <div className="bc-profile-info">
                <strong>{current.name}</strong>
                <span>{current.role}</span>
              </div>
            </a>
          </div>
        </header>

        <section className="bc-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
