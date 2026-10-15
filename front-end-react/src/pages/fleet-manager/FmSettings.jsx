import { useCallback, useEffect, useState } from 'react';
import { Settings } from '../../api/namespaces';
import { useLiveSync } from '../../hooks/useLiveSync';
import { usePageHeader } from '../../hooks/usePageHeader';

export default function FmSettings() {
  usePageHeader('Settings', 'Operational configuration from the backend');
  const [platform, setPlatform] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [platformSettings, fleetPermissions] = await Promise.all([
        Settings.getPlatform(),
        Settings.getPermissions('fleet-manager'),
      ]);
      setPlatform(platformSettings);
      setPermissions(Array.isArray(fleetPermissions) ? fleetPermissions : []);
    } catch (error) {
      console.error('Failed to load fleet settings from backend:', error);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useLiveSync(load);

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

        {!failed && (!platform || permissions === null) && (
          <div className="info-card" style={{ padding: 24, color: '#888' }}>Loading backend settings...</div>
        )}

        {!failed && platform && permissions !== null && (
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
