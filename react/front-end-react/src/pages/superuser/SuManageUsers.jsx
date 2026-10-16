import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from '../../api/namespaces';
import { useSession } from '../../auth/SessionContext';
import { usePageHeader } from '../../hooks/usePageHeader';
import { statusClass } from '../../components/Icon';
import Modal from '../../components/Modal';
import { useLiveSync } from '../../hooks/useLiveSync';
import { matchesFilter, matchesSearchFields, uniqueFilterOptions } from '../../utils/search';

function roleLabelToValue(role) {
  const v = String(role || '').trim().toLowerCase();
  if (v === 'fleet manager' || v === 'fleet-manager') return 'fleet-manager';
  if (v === 'business client' || v === 'business-client') return 'business-client';
  if (v === 'super user' || v === 'superuser') return 'superuser';
  if (v === 'driver') return 'driver';
  return v;
}

function roleValueToLabel(role) {
  const v = roleLabelToValue(role);
  return ({ superuser: 'Super User', 'fleet-manager': 'Fleet Manager', 'business-client': 'Business Client', driver: 'Driver' })[v] || role || 'User';
}

function UserViewModal({ userId, onClose }) {
  const [u, setU] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setU(await Users.getOne(userId));
      } catch {
        setFailed(true);
      }
    })();
  }, [userId]);

  const name = u?.name || u?.fullName || '-';
  const uInitials = name !== '-' ? name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'U' : 'U';

  return (
    <Modal onClose={onClose}>
      <div className="content-card details-card user-modal-card standalone-modal">
        <div className="details-top">
          <div className="details-title">User Details</div>
          <button className="close-icon" onClick={onClose}>×</button>
        </div>
        {!u && !failed && <div style={{ textAlign: 'center', color: '#b9b9b9', padding: 40 }}>Loading user details...</div>}
        {failed && <div style={{ textAlign: 'center', color: '#ff6b6b', padding: 40 }}>Failed to load user.</div>}
        {u && (
          <div className="user-modal-body">
            <div className="user-summary">
              <div className="user-avatar-box">{uInitials}</div>
              <div className="user-summary-copy">
                <div className="user-summary-name">{name}</div>
                <div className="user-status-line">
                  <span className={`status-dot ${statusClass(u.status)}`} />
                  <span>{u.status || 'Active'}</span>
                </div>
              </div>
            </div>
            <div className="user-info-grid">
              <div className="user-info-row">
                <div className="detail-label">User ID</div>
                <div className="user-info-value">{u.id || '-'}</div>
              </div>
              <div className="user-info-row">
                <div className="detail-label">Email Address</div>
                <div className="user-info-value">{u.email || '-'}</div>
              </div>
              <div className="user-info-row">
                <div className="detail-label">Phone Number</div>
                <div className="user-info-value">{u.phone || '-'}</div>
              </div>
              <div className="user-info-row">
                <div className="detail-label">Role</div>
                <div className="user-info-value">{roleValueToLabel(u.role)}</div>
              </div>
              <div className="user-info-row">
                <div className="detail-label">Status</div>
                <div className="user-info-value">{u.status || 'Active'}</div>
              </div>
              <div className="user-info-row">
                <div className="detail-label">Last Login</div>
                <div className="user-info-value">{u.lastLogin || '--'}</div>
              </div>
            </div>
          </div>
        )}
        <div className="detail-footer user-modal-footer">
          <button className="btn-dark modal-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

export default function SuManageUsers() {
  usePageHeader('Manage Users');
  const { session } = useSession();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState('id');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState(null);
  const [viewUserId, setViewUserId] = useState(null);
  const pageSize = 10;

  async function load() {
    setFailed(false);
    try {
      const list = await Users.getAll();
      setUsers(list || []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLiveSync(load);

  useEffect(() => setPage(1), [role, statusFilter, search]);

  const filteredUsers = users.filter((user) => {
    const matchesRole = !role || roleLabelToValue(user.role) === role;
    const matchesSearch = matchesSearchFields(search, [
      user.name,
      user.fullName,
    ]);
    return matchesRole && matchesFilter(user.status || 'Active', statusFilter) && matchesSearch;
  });
  const statusOptions = uniqueFilterOptions(users, (user) => user.status || 'Active');

  const sorted = [...filteredUsers].sort((a, b) => {
    const av = String((sortField === 'name' ? a.name || a.fullName : a[sortField]) || '').toLowerCase();
    const bv = String((sortField === 'name' ? b.name || b.fullName : b[sortField]) || '').toLowerCase();
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const pageUsers = sorted.slice((curPage - 1) * pageSize, curPage * pageSize);

  function sortBy(field) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  }

  async function toggleStatus(u) {
    if (session && session.userId === u.id) {
      alert('Cannot suspend your own account');
      return;
    }
    const next = u.status === 'Suspended' ? 'Active' : 'Suspended';
    try {
      await Users.updateStatus(u.id, next);
      await load();
    } catch {
      alert('Failed to update user status');
    }
  }

  async function deleteUser(u) {
    if (session && session.userId === u.id) {
      alert('Cannot delete your own account');
      return;
    }
    if (!confirm(`Delete user ${u.id}?`)) return;
    try {
      await Users.delete(u.id);
      await load();
    } catch {
      alert('Failed to delete user');
    }
  }

  const cols = [
    ['id', 'User ID'],
    ['name', 'Name'],
    ['email', 'Email'],
    ['role', 'Role'],
    ['status', 'Status'],
    ['lastLogin', 'Last Login'],
  ];

  return (
    <div className="content-card table-card" onClick={() => setOpenMenu(null)}>
      <div className="table-head" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h3>User Management</h3>
          <div className="subdued" style={{ marginTop: 6 }}>Search, filter, and manage all created users.</div>
        </div>
        <div className="filters" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="mini-input" placeholder="Search user name" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="mini-input" style={{ minWidth: 180 }} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All Roles</option>
            <option value="superuser">Super User</option>
            <option value="fleet-manager">Fleet Manager</option>
            <option value="business-client">Business Client</option>
            <option value="driver">Driver</option>
          </select>
          <select className="mini-input" style={{ minWidth: 180 }} aria-label="Filter users by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <Link className="btn-yellow" to="/superuser/add-user">Add New User</Link>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            {cols.map(([field, label]) => (
              <th key={field} className="sortable-th" style={{ cursor: 'pointer' }} onClick={() => sortBy(field)}>
                {label} <span className="sort-arrow">{sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
            ))}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', color: '#b9b9b9', padding: 24 }}>Loading users...</td>
            </tr>
          )}
          {!loading && failed && (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#ff6b6b' }}>Failed to load users.</td>
            </tr>
          )}
          {!loading && !failed && pageUsers.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>No users found for the current search/filter.</td>
            </tr>
          )}
          {!loading &&
            !failed &&
            pageUsers.map((u) => {
              const status = u.status || 'Active';
              return (
                <tr key={u.id}>
                  <td>{u.id || '-'}</td>
                  <td>{u.name || u.fullName || '-'}</td>
                  <td>{u.email || '-'}</td>
                  <td>{roleValueToLabel(u.role)}</td>
                  <td>
                    <span className={`status-pill ${statusClass(status)}`}>{status}</span>
                  </td>
                  <td>{u.lastLogin || '--'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <div className="action-menu-wrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="action-trigger dots-trigger"
                          aria-label="More actions"
                          onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                        >
                          ⋯
                        </button>
                        <div className={`action-menu ${openMenu === u.id ? 'show' : ''}`}>
                          <button className="action-item" type="button" onClick={() => { setOpenMenu(null); setViewUserId(u.id); }}>View User</button>
                          <Link className="action-item" to={`/superuser/edit-user?id=${u.id}`}>Edit User</Link>
                          <button className="action-item" onClick={() => { setOpenMenu(null); toggleStatus(u); }}>
                            {status === 'Suspended' ? 'Enable User' : 'Disable User'}
                          </button>
                          <button className="action-item danger-link" onClick={() => { setOpenMenu(null); deleteUser(u); }}>Delete User</button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>

      {!loading && !failed && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
          <div className="subdued">
            Showing <strong>{pageUsers.length}</strong> of <strong>{sorted.length}</strong> users
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn-yellow" disabled={curPage <= 1} style={{ padding: '6px 14px', opacity: curPage <= 1 ? 0.5 : 1 }} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span className="subdued">Page {curPage} of {totalPages}</span>
            <button className="btn-yellow" disabled={curPage >= totalPages} style={{ padding: '6px 14px', opacity: curPage >= totalPages ? 0.5 : 1 }} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {viewUserId && <UserViewModal userId={viewUserId} onClose={() => setViewUserId(null)} />}
    </div>
  );
}
