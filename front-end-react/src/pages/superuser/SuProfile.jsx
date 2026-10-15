import { useEffect, useState } from 'react';
import { Users } from '../../api/namespaces';
import { useSession } from '../../auth/SessionContext';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';

function roleValueToLabel(role) {
  const v = String(role || '').trim().toLowerCase();
  return ({ superuser: 'Super User', 'fleet-manager': 'Fleet Manager', 'business-client': 'Business Client', driver: 'Driver' })[v] || role || 'User';
}

export default function SuProfile() {
  usePageHeader('Profile');
  const { session } = useSession();
  const { showToast } = useToast();
  const [user, setUser] = useState(null);
  const [failed, setFailed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState({});

  async function load() {
    if (!session?.userId) return;
    try {
      const u = await Users.getOne(session.userId);
      setUser(u);
      setName(u.name || u.fullName || session.name || 'Super User');
      setPhone(u.phone && u.phone !== '--' ? u.phone : '');
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.userId]);

  if (failed) {
    return <div className="content-card profile-card" style={{ maxWidth: 760, textAlign: 'center', color: '#ff6b6b', padding: 30 }}>Failed to load profile.</div>;
  }

  if (!user) {
    return <div className="content-card profile-card" style={{ maxWidth: 760 }}><div style={{ textAlign: 'center', color: '#b9b9b9', padding: 30 }}>Loading profile...</div></div>;
  }

  const profileName = user.name || user.fullName || session?.name || 'Super User';
  const profileEmail = user.email || session?.email || '--';
  const profilePhone = user.phone || '--';
  const profileInitials = profileName.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'SU';

  function cancel() {
    setName(profileName);
    setPhone(profilePhone === '--' ? '' : profilePhone);
    setErrors({});
    setIsEditing(false);
  }

  async function save() {
    const next = {};
    if (!/^[A-Za-z][A-Za-z\s]{2,59}$/.test(name)) next.name = 'Name must be 3-60 letters and spaces only';
    if (phone && !/^[6-9]\d{9}$/.test(phone)) next.phone = 'Phone must be 10 digits and start from 6, 7, 8, or 9';
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      await Users.update(user.id, { name, email: user.email, role: user.role, status: user.status || 'Active', phone });
      showToast('Profile updated successfully');
      setIsEditing(false);
      await load();
    } catch {
      alert('Failed to update profile');
    }
  }

  return (
    <div className="profile-layout">
      <div className="content-card profile-card">
        <div className="profile-hero">
          <div className="avatar-big">{profileInitials}</div>
          <div>
            <div className="profile-name">{profileName}</div>
            <div className="profile-role">{roleValueToLabel(user.role || session?.role || 'superuser')}</div>
          </div>
        </div>
        <div className="profile-item">
          <div className="detail-label">Email</div>
          <div className="detail-main">{profileEmail}</div>
        </div>
        <div className="profile-item">
          <div className="detail-label">Phone</div>
          <div className="detail-main">{profilePhone}</div>
        </div>
        <div className="profile-item">
          <div className="detail-label">Permissions</div>
          <div className="detail-main">Full system control</div>
        </div>
        <div className="profile-item">
          <div className="detail-label">Last Login</div>
          <div className="detail-main">{user.lastLogin || '--'}</div>
        </div>
      </div>

      <div className="profile-grid">
        <div className="content-card profile-block">
          <strong>Security</strong>
          <div className="profile-item">
            <div className="detail-label">Account Status</div>
            <div className="detail-main">{user.status || 'Active'}</div>
          </div>
          <div className="profile-item">
            <div className="detail-label">Password Changed</div>
            <div className="detail-main">Managed in account settings</div>
          </div>
        </div>

        <div className="content-card profile-block">
          <strong>System Access</strong>
          <div className="profile-item">
            <div className="detail-label">Current Role</div>
            <div className="detail-main">{roleValueToLabel(user.role || 'superuser')}</div>
          </div>
          <div className="profile-item">
            <div className="detail-label">Environment</div>
            <div className="detail-main">Production Prototype</div>
          </div>
        </div>

        <div className="content-card profile-block" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong>Profile Update</strong>
            {!isEditing && (
              <button className="btn-yellow" type="button" onClick={() => setIsEditing(true)}>Edit</button>
            )}
          </div>
          <div className="field">
            <label>Name</label>
            <input value={name} disabled={!isEditing} onChange={(e) => setName(e.target.value)} />
            <div className="error">{errors.name}</div>
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={phone} maxLength={10} inputMode="numeric" disabled={!isEditing} onChange={(e) => setPhone(e.target.value)} />
            <div className="error">{errors.phone}</div>
          </div>
          {isEditing && (
            <div className="form-actions">
              <button className="btn-dark" type="button" onClick={cancel}>Cancel</button>
              <button className="btn-yellow" onClick={save}>Save Profile</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
