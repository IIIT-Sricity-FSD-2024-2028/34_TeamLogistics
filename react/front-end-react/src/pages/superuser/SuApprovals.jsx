import { useCallback, useEffect, useMemo, useState } from 'react';
import { Approvals } from '../../api/namespaces';
import { useLiveSync } from '../../hooks/useLiveSync';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { matchesSearchFields } from '../../utils/search';

const roleLabels = {
  'business-client': 'Business Client',
  driver: 'Driver',
  'fleet-manager': 'Fleet Manager',
};

function isPending(user) {
  return ['pending', 'pending approval'].includes(String(user.status || '').trim().toLowerCase());
}

function initials(name) {
  return String(name || 'User')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value) {
  if (!value) return 'Recently submitted';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently submitted';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function maskAccount(value) {
  const account = String(value || '');
  if (!account) return 'Not provided';
  return `•••• ${account.slice(-4)}`;
}

function ApplicantDetails({ user }) {
  const details = user.profileDetails || {};

  if (user.role === 'business-client') {
    return (
      <div className="approval-details">
        <div><span>Contact person</span><strong>{details.fullName || user.name || '—'}</strong></div>
        <div><span>Company</span><strong>{details.companyName || user.companyName || user.name || '—'}</strong></div>
        <div><span>Business address</span><strong>{details.businessAddress || user.address || 'Not provided'}</strong></div>
        <div><span>Company contact</span><strong>{details.companyContactNumber || user.phone || 'Not provided'}</strong></div>
      </div>
    );
  }

  if (user.role === 'driver') {
    return (
      <div className="approval-details">
        <div><span>Licence number</span><strong>{details.licenseNumber || 'Not provided'}</strong></div>
        <div><span>Licence document</span><strong>{details.licenseDocument || 'Not provided'}</strong></div>
        <div><span>Bank</span><strong>{details.bankName || 'Not provided'}</strong></div>
        <div><span>Payout account</span><strong>{maskAccount(details.accountNumber)}</strong></div>
      </div>
    );
  }

  return (
    <div className="approval-details">
      <div><span>Company</span><strong>{details.companyName || user.companyName || 'Not provided'}</strong></div>
      <div><span>Company address</span><strong>{details.companyAddress || user.address || 'Not provided'}</strong></div>
      <div><span>Fleet size</span><strong>{details.numberOfVehicles || 'Not provided'}</strong></div>
      <div><span>Phone</span><strong>{user.phone || 'Not provided'}</strong></div>
    </div>
  );
}

export default function SuApprovals() {
  usePageHeader('Registration Approvals');
  const { showToast } = useToast();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [workingId, setWorkingId] = useState('');

  const load = useCallback(async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    setFailed(false);
    try {
      const users = await Approvals.getPending();
      setApplications((users || []).filter(isPending));
    } catch {
      setFailed(true);
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useLiveSync(load);

  const filtered = useMemo(() => {
    return applications.filter((user) => {
      if (role !== 'all' && user.role !== role) return false;
      return matchesSearchFields(search, [user.name, user.fullName]);
    });
  }, [applications, role, search]);

  const counts = useMemo(() => ({
    all: applications.length,
    'business-client': applications.filter((user) => user.role === 'business-client').length,
    driver: applications.filter((user) => user.role === 'driver').length,
    'fleet-manager': applications.filter((user) => user.role === 'fleet-manager').length,
  }), [applications]);

  async function review(user, nextStatus) {
    if (nextStatus === 'Rejected' && !window.confirm(`Reject the registration for ${user.name || user.email}?`)) return;
    setWorkingId(user.id);
    try {
      await Approvals.review(user.id, nextStatus === 'Active' ? 'approve' : 'reject');
      setApplications((current) => current.filter((item) => item.id !== user.id));
      showToast(nextStatus === 'Active' ? `${user.name} approved successfully` : `${user.name}'s registration was rejected`);
    } catch (error) {
      showToast(error.message || 'Could not update this registration');
    } finally {
      setWorkingId('');
    }
  }

  return (
    <div className="approvals-page">
      <section className="approvals-hero">
        <div>
          <span className="approvals-eyebrow">Account review queue</span>
          <h1>New registrations</h1>
          <p>Review identity and role details before granting access to DeliverSync.</p>
        </div>
        <div className="approvals-count" aria-label={`${applications.length} pending registrations`}>
          <strong>{applications.length}</strong>
          <span>Pending</span>
        </div>
      </section>

      <section className="approval-toolbar" aria-label="Approval filters">
        <select className="mini-input" aria-label="Filter registrations by role" value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="all">All roles ({counts.all})</option>
          <option value="business-client">Business clients ({counts['business-client']})</option>
          <option value="driver">Drivers ({counts.driver})</option>
          <option value="fleet-manager">Fleet managers ({counts['fleet-manager']})</option>
        </select>
        <label className="approval-search">
          <span className="sr-only">Search registrations</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search applicant name" />
        </label>
      </section>

      {loading && <div className="approval-state">Loading registration requests...</div>}
      {!loading && failed && (
        <div className="approval-state error">
          <strong>Could not load registrations</strong>
          <button type="button" className="btn-yellow" onClick={() => load()}>Try again</button>
        </div>
      )}
      {!loading && !failed && filtered.length === 0 && (
        <div className="approval-state empty">
          <div className="approval-empty-icon">✓</div>
          <strong>{applications.length ? 'No matching registrations' : 'All caught up'}</strong>
          <p>{applications.length ? 'Try another search or role filter.' : 'New website registrations will appear here automatically.'}</p>
        </div>
      )}

      {!loading && !failed && filtered.length > 0 && (
        <div className="approval-list">
          {filtered.map((user) => {
            const busy = workingId === user.id;
            return (
              <article className="approval-card" key={user.id}>
                <header className="approval-card-head">
                  <div className="approval-identity">
                    <div className="approval-avatar">{initials(user.name)}</div>
                    <div>
                      <div className="approval-name-row">
                        <h2>{user.name || 'Unnamed applicant'}</h2>
                        <span className={`approval-role ${user.role}`}>{roleLabels[user.role] || user.role}</span>
                      </div>
                      <p>{user.email || 'No email'} <span>•</span> {user.phone || 'No phone'}</p>
                    </div>
                  </div>
                  <div className="approval-meta">
                    <span>{user.id}</span>
                    <time>{formatDate(user.createdAt)}</time>
                  </div>
                </header>

                <ApplicantDetails user={user} />

                <footer className="approval-actions">
                  <p><span />Awaiting superuser decision</p>
                  <div>
                    <button type="button" className="approval-reject" disabled={busy} onClick={() => review(user, 'Rejected')}>
                      Reject
                    </button>
                    <button type="button" className="approval-approve" disabled={busy} onClick={() => review(user, 'Active')}>
                      {busy ? 'Updating...' : 'Approve account'}
                    </button>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
