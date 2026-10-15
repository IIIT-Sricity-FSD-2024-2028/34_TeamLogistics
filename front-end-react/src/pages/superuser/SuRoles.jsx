import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { Icon } from '../../components/Icon';

const roleMap = {
  'fleet-manager': 'Fleet Manager',
  'business-client': 'Business Client',
  driver: 'Driver',
};

export default function SuRoles({ roleKey }) {
  usePageHeader('Roles & Permissions');
  const [perms, setPerms] = useState(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPerms(null);
    setFailed(false);
    (async () => {
      try {
        const raw = await Settings.getPermissions(roleKey);
        const list = Array.isArray(raw) ? raw : raw.permissions || [];
        setPerms(
          list.map((p, i) => ({
            name: p.name || p.title || p[0] || `Permission ${i + 1}`,
            description: p.description || p.desc || p[1] || '',
            enabled: typeof p.enabled === 'boolean' ? p.enabled : Boolean(p[2]),
          })),
        );
      } catch {
        setFailed(true);
      }
    })();
  }, [roleKey]);

  function toggle(i) {
    setPerms((prev) => (prev ? prev.map((p, idx) => (idx === i ? { ...p, enabled: !p.enabled } : p)) : prev));
  }

  async function save() {
    if (!perms) return;
    setSaving(true);
    try {
      await Settings.updatePermissions(roleKey, perms.map((p) => [p.name, p.description, p.enabled]));
      alert('Permissions saved. Matching backend API access rules are now enforced.');
    } catch {
      alert('Failed to update permissions');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="permissions-top">
        {Object.entries(roleMap).map(([key, label]) => (
          <Link className={`role-tile ${roleKey === key ? 'active' : ''}`} to={`/superuser/roles-${key}`} key={key}>
            <div className="brand-box" style={{ width: 42, height: 42, borderRadius: 14 }}>
              {Icon.shield}
            </div>
            <div className="role-name">{label}</div>
            <div className="role-count">Role permissions</div>
          </Link>
        ))}
      </div>

      <div className="content-card">
        {failed && <div style={{ textAlign: 'center', color: '#ff6b6b', padding: 30 }}>Failed to load permissions.</div>}
        {!perms && !failed && <div style={{ textAlign: 'center', color: '#b9b9b9', padding: 30 }}>Loading permissions...</div>}
        {perms && (
          <>
            {perms.map((p, i) => (
              <div className="toggle-row" key={i}>
                <div>
                  <div className="toggle-label">{p.name}</div>
                  <div className="toggle-sub">{p.description}</div>
                </div>
                <button className={`toggle ${p.enabled ? 'on' : ''}`} onClick={() => toggle(i)} />
              </div>
            ))}
            <div style={{ padding: 20, textAlign: 'right' }}>
              <button className="btn-yellow" disabled={saving} onClick={save}>Save Changes</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
