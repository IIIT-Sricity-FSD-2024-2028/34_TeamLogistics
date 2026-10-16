import { useEffect, useState } from 'react';
import { Dashboard } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useLiveSync } from '../../hooks/useLiveSync';

function metric(label, val, delta) {
  return (
    <div className="content-card kpi" key={label}>
      <div className="label">{label}</div>
      <div className="value">{val}</div>
      {delta && <div className="delta">↗ {delta}</div>}
    </div>
  );
}

function niceYTicks(values) {
  const max = Math.max(1, ...values);
  const rawStep = max / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
  const step = Math.ceil(rawStep / magnitude) * magnitude || 1;
  return [step * 4, step * 3, step * 2, step, 0].map((n) => Math.round(n).toLocaleString('en-IN'));
}

function BarCard({ title, values, labels, cls = '' }) {
  const max = Math.max(...values, 1);
  const yTicks = niceYTicks(values);
  return (
    <div className={`content-card chart-card ${cls}`}>
      <div className="chart-title">{title}</div>
      <div className="chart-outer">
        <div className="chart-y">
          {yTicks.map((t, i) => (
            <div key={i}>{t}</div>
          ))}
        </div>
        <div className="chart-area">
          {values.map((v, i) => (
            <div className="bar-wrap" key={i}>
              <div className="bar" style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
              <div className="bar-label">{labels[i] || ''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SuDashboard() {
  usePageHeader('Super User Control Center');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  async function load() {
    try {
      setStats(await Dashboard.getSuperuser());
      setError(false);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    load();
  }, []);
  useLiveSync(load);

  if (error) {
    return (
      <div className="content-card" style={{ padding: 24, textAlign: 'center', color: '#ff6b6b' }}>
        Unable to load dashboard data.
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="content-card" style={{ padding: 24, textAlign: 'center', color: '#b9b9b9' }}>
        Loading dashboard...
      </div>
    );
  }

  const fleetStatusValues = [stats.fleetStatus.available, stats.fleetStatus.inTransit, stats.fleetStatus.maintenance, stats.fleetStatus.offline];

  return (
    <>
      <div className="kpi-grid">
        {metric('Total Users', stats.totalUsers.toLocaleString('en-IN'), 'Live')}
        {metric('Fleet Managers', stats.fleetManagers.toLocaleString('en-IN'), 'Live')}
        {metric('Business Clients', stats.businessClients.toLocaleString('en-IN'), 'Live')}
        {metric('Drivers', stats.drivers.toLocaleString('en-IN'), 'Live')}
        {metric('Active Deliveries', stats.activeDeliveries.toLocaleString('en-IN'), 'Live')}
        {metric('System Alerts', stats.systemAlerts.toString(), 'Live')}
      </div>
      <div className="grid-2">
        <BarCard title="Delivery Performance" values={stats.deliveryPerformance} labels={stats.deliveryPerformanceLabels} />
        <BarCard title="Platform Commission Trends" values={stats.revenueTrends} labels={stats.revenueTrendsLabels} />
      </div>
      <BarCard title="Fleet Status Overview" values={fleetStatusValues} labels={['Available', 'In Transit', 'Maintenance', 'Offline']} cls="full bar-row" />
    </>
  );
}
