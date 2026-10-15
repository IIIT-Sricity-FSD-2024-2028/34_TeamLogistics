import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { usePortalStyles } from '../hooks/usePortalStyles';
import { useNotificationBadge } from '../hooks/useNotificationBadge';
import { usePageHeaderContext, PageHeaderProvider } from '../hooks/usePageHeader';
import { useSession } from '../auth/SessionContext';
import BrandLogo from '../components/BrandLogo';
import { Icon } from '../components/Icon';

const nav = [
  ['Dashboard', 'dashboard', 'dashboard'],
  ['Delivery Requests', 'delivery-requests', 'cube'],
  ['Trips Monitoring', 'trip-monitoring', 'pin'],
  ['Vehicles', 'vehicles', 'vehicle'],
  ['Maintenance', 'maintenance', 'wrench'],
  ['Manage Users', 'manage-users', 'users'],
  ['Approvals', 'approvals', 'shield'],
  ['Roles & Permissions', 'roles-fleet-manager', 'shield'],
  ['System Configuration', 'system-configuration', 'gear'],
  ['Reports', 'reports', 'report'],
  ['Transactions', 'transactions', 'doc'],
  ['Documents', 'documents', 'doc'],
  ['Notifications', 'notifications', 'bell'],
  ['Profile', 'profile', 'profile'],
];

function activeNavKey(pathname) {
  const seg = pathname.split('/')[2] || 'dashboard';
  if (seg.includes('user')) return 'manage-users';
  if (seg.startsWith('roles')) return 'roles-fleet-manager';
  if (seg.includes('delivery-request') || seg === 'block-order' || seg === 'unblock-order') return 'delivery-requests';
  if (seg.startsWith('trip')) return 'trip-monitoring';
  if (seg.includes('vehicle')) return 'vehicles';
  if (seg.includes('maintenance')) return 'maintenance';
  return seg;
}

function initials(name) {
  if (!name) return 'SU';
  return name.trim().split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function SuperuserShell() {
  usePortalStyles(['brand-logo.css', 'superuser.css']);
  const { logout, session } = useSession();
  const { unread } = useNotificationBadge();
  const { header } = usePageHeaderContext();
  const navigate = useNavigate();
  const location = useLocation();
  const active = activeNavKey(location.pathname);

  return (
    <div className="su-shell">
      <aside className="su-sidebar">
        <div className="brand-wrap">
          <BrandLogo href="/superuser/dashboard" size="sm" sub="Super User Portal" />
        </div>

        <nav className="nav-section">
          {nav.map(([name, href, key]) => (
            <NavLink key={href} to={`/superuser/${href}`} className={`nav-link ${active === href ? 'active' : ''}`}>
              {Icon[key]}
              <span>{name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="side-footer">
          <button
            className="logout-btn"
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            {Icon.logout}
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="su-main">
        <header className="topbar">
          <div className="page-title">{header.title}</div>
          <div className="topbar-right">
            <button className="icon-btn" onClick={() => navigate('/superuser/notifications')} aria-label="Notifications">
              {Icon.bell}
              {unread > 0 && <span className="badge-count">{unread}</span>}
            </button>
            <button className="avatar-mini" onClick={() => navigate('/superuser/profile')} aria-label="Profile">
              {initials(session?.name)}
            </button>
          </div>
        </header>
        <div className="page-scroll">
          <div id="pageRoot">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SuperuserLayout() {
  return (
    <PageHeaderProvider>
      <SuperuserShell />
    </PageHeaderProvider>
  );
}
