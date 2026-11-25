import { useGetPermissionsQuery, useGetPlatformQuery, EMPTY_LIST } from '../../redux/fleetManagerApi';
import { usePageHeader } from '../../hooks/usePageHeader';

export default function FmSettings() {
  usePageHeader('Settings', 'Operational configuration from the backend');
  const platformQuery = useGetPlatformQuery();
  const permissionsQuery = useGetPermissionsQuery();
  const platform = platformQuery.data;
  const permissions = permissionsQuery.data || EMPTY_LIST;
  const failed = [platformQuery, permissionsQuery].some((query) => query.isError && !query.data);
  const loading = [platformQuery, permissionsQuery].some((query) => query.isLoading);
  const load = () => { platformQuery.refetch(); permissionsQuery.refetch(); };

  return (
    <div className="settings-shell">
      <div className="settings-tabs">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Configuration</div>
        <span className="active">Backend Settings</span>
      </div>
      <div className="settings-main">
        <div style={{ marginBottom: 20 }}>
          <div className="section-title">Live Fleet Configuration</div>
          <div className="muted">All values below are loaded from the backend.</div>
        </div>

        {failed && (
          <div className="info-card" style={{ padding: 24, color: '#ff8d8d' }}>
            Could not load settings from the backend.
            <button className="btn btn-ghost" type="button" style={{ marginLeft: 12 }} onClick={load}>Try again</button>
          </div>
        )}

        {!failed && (loading || !platform) && (
          <div className="info-card" style={{ padding: 24, color: '#888' }}>Loading backend settings...</div>
        )}

        {!failed && platform && !loading && (
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="info-card" style={{ padding: 18 }}>
              <div className="switch">
                <div><strong>Platform</strong><div className="muted">{platform.name}</div></div>
                <span className="pill pill-green">{platform.language}</span>
              </div>
              <div className="switch">
                <div><strong>Timezone</strong><div className="muted">Backend operational timezone</div></div>
                <span className="pill pill-yellow">{platform.timezone}</span>
              </div>
            </div>

            <div className="info-card" style={{ padding: 18 }}>
              {permissions.length === 0 && <div className="muted">No fleet-manager permissions are configured.</div>}
              {permissions.map(([title, description, enabled]) => (
                <div className="switch" key={title}>
                  <div><strong>{title}</strong><div className="muted">{description}</div></div>
                  <span className={`pill ${enabled ? 'pill-green' : 'pill-red'}`}>{enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
