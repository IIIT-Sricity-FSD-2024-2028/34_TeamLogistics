import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Vehicles, Drivers, Trips, MaintenanceAPI } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useLiveSync } from '../../hooks/useLiveSync';
import { useSession } from '../../auth/SessionContext';
import { tripsPerDayBars, maintenanceCostLine, driverPerformanceRows, quickAlerts } from './fmUtils';

export default function FmDashboard() {
  usePageHeader('Dashboard', 'Fleet overview and key metrics');
  const { session } = useSession();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [maintenance, setMaintenance] = useState([]);

  async function load({ background = false } = {}) {
    if (!background) setLoading(true);
    setError(false);
    try {
      const [v, d, t, m] = await Promise.all([Vehicles.getAll(), Drivers.getAll(), Trips.getAll(), MaintenanceAPI.getAll('')]);
      setVehicles(v || []);
      setDrivers(d || []);
      setTrips(t || []);
      setMaintenance(m || []);
    } catch (e) {
      console.error(e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLiveSync(load);

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ color: '#b9b9b9', padding: 28, textAlign: 'center' }}>
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ textAlign: 'center', color: '#ff8d8d', padding: 34 }}>
          Failed to load Fleet Manager dashboard from backend.
        </div>
      </div>
    );
  }

  const inProgress = trips.filter((t) => /requested|assigned|accepted|picked|transit|queued|active|progress|issue/i.test(t.status || '')).length;
  const completed = trips.filter((t) => /complete|delivered/i.test(t.status || '')).length;
  const pendingMaint = maintenance.filter((m) => !/complete/i.test(m.status || '')).length;
  const alerts = quickAlerts(vehicles, drivers, maintenance);
  const bars = tripsPerDayBars(trips);
  const linePoints = maintenanceCostLine(maintenance);
  const polyline = linePoints.map((p) => `${p.x},${p.y}`).join(' ');
  const perfRows = driverPerformanceRows(drivers);

  return (
    <>
      <section className="hero">
        <div>
          <h2>Welcome Back, {session?.name || 'Fleet Manager'}</h2>
          <p>Your logistics command center</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link className="btn btn-ghost" to="/fleet-manager/compliance">
            Compliance
          </Link>
          <Link className="btn btn-yellow" to="/fleet-manager/analytics">
            View Analytics
          </Link>
        </div>
      </section>

      <section className="stats" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))', alignItems: 'stretch' }}>
        <div className="stat">
          <h3>Total Vehicles</h3>
          <div className="v yellow">{vehicles.length}</div>
          <div className="s">Registered fleet vehicles</div>
        </div>
        <div className="stat">
          <h3>Number of Maintenances</h3>
          <div className="v yellow">{maintenance.length}</div>
          <div className="s">{pendingMaint} pending</div>
        </div>
        <div className="stat">
          <h3>Number of Trips</h3>
          <div className="v yellow">{trips.length}</div>
          <div className="s">{inProgress} active</div>
        </div>
        <div className="stat">
          <h3>Completed Trips</h3>
          <div className="v yellow">{completed}</div>
          <div className="s">Closed successfully</div>
        </div>
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Trips per Day</div>
            <span className="pill pill-yellow">Recent</span>
          </div>
          <div className="bars">
            {bars.length ? (
              bars.map((b, i) => (
                <div key={i} style={{ height: b.height }} title={b.title}>
                  <span>{b.label}</span>
                </div>
              ))
            ) : (
              <div style={{ height: 10 }}>
                <span>No trip data yet</span>
              </div>
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Maintenance Cost Trend</div>
            <span className="pill pill-yellow">Monthly</span>
          </div>
          <div className="linechart">
            {linePoints.length ? (
              <svg preserveAspectRatio="none" viewBox="0 0 500 190">
                <polyline fill="none" points={polyline} stroke="#f4cf12" strokeWidth={4} />
                {linePoints.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} fill="#fff" r={5}>
                    <title>{p.title}</title>
                  </circle>
                ))}
              </svg>
            ) : (
              <div style={{ padding: '60px 16px', textAlign: 'center', color: '#888' }}>No maintenance cost data yet</div>
            )}
          </div>
        </div>
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Driver Performance</div>
          </div>
          <div className="panel-body">
            <div className="progress-list">
              {perfRows.length ? (
                perfRows.map((r, i) => (
                  <div className="progress-row" key={i}>
                    <div>{r.label}</div>
                    <div className="track">
                      <span style={{ width: `${r.pct}%` }}></span>
                    </div>
                    <strong>{r.value}</strong>
                  </div>
                ))
              ) : (
                <div style={{ padding: '12px 0', textAlign: 'center', color: '#888' }}>No driver ratings yet</div>
              )}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Quick Alerts</div>
            <span className="pill pill-red">{alerts.count} Active</span>
          </div>
          <div className="panel-body">
            <div className="alert-list">
              {alerts.rows.length ? (
                alerts.rows.map((a, i) => (
                  <div className="alert" key={i}>
                    <div>
                      <strong>{a.title}</strong>
                      <div className="muted">{a.sub}</div>
                    </div>
                    <div className="muted">{a.when}</div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '12px 0', textAlign: 'center', color: '#888' }}>No active alerts</div>
              )}
            </div>
          </div>
        </div>
      </section>

    </>
  );
}
