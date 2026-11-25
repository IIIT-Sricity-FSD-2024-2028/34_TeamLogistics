import { useSuperuserDraft } from '../../redux/useSuperuserDraft';
import { Link } from 'react-router-dom';
import { useGetPermissionsQuery, useUpdatePermissionsMutation } from '../../redux/superuserApi';
import { usePageHeader } from '../../hooks/usePageHeader';
import { Icon } from '../../components/Icon';

const roleMap = {
  'fleet-manager': 'Fleet Manager',
  'business-client': 'Business Client',
  driver: 'Driver',
};

function RolePermissions({ roleKey }) {
  usePageHeader('Roles & Permissions');
  const query = useGetPermissionsQuery(roleKey);
  const [perms, setPerms, resetDraft] = useSuperuserDraft(query.currentData, null);
  const failed = query.isError;
  const [updatePermissions, { isLoading: saving }] = useUpdatePermissionsMutation();

  function toggle(i) {
    setPerms((prev) => (prev ? prev.map((p, idx) => (idx === i ? { ...p, enabled: !p.enabled } : p)) : prev));
  }

  async function save() {
    if (!perms) return;
    try {
      await updatePermissions({ role: roleKey, permissions: perms.map((p) => [p.name, p.description, p.enabled]) }).unwrap();
      await query.refetch();
      resetDraft();
      alert('Permissions saved. Matching backend API access rules are now enforced.');
    } catch {
      alert('Failed to update permissions');

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

export default function SuRoles({ roleKey }) {
  return <RolePermissions key={roleKey} roleKey={roleKey} />;
}
