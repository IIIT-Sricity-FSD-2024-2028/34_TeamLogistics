import { useEffect, useMemo, useState } from 'react';
import { Dashboard, Vehicles, Drivers, Trips, MaintenanceAPI, Payouts } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { maintenanceCostLine, pillClass, statusBreakdownRows, tripsPerDayBars } from './fmUtils';
import { useLiveSync } from '../../hooks/useLiveSync';

const currentMonth = () => new Date().toISOString().slice(0, 7);
const normalize = (value) => String(value || '').trim().toLowerCase();
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function monthLabel(month) {
  const date = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? month : date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export default function FmAnalytics() {
  usePageHeader('Fleet Analytics', 'Operational performance, financial health and driver insights');
  const { showToast } = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [restricted, setRestricted] = useState(false);
  const [error, setError] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [statement, setStatement] = useState(null);
  const [rateCard, setRateCard] = useState(null);
  const [rates, setRates] = useState({ baseFare: '', perKm: '', perKg: '', customerBaseFare: '', customerPerKm: '', customerPerKg: '' });
  const [savingRates, setSavingRates] = useState(false);

  async function load({ background = false } = {}) {
    if (!background) setLoading(true);
    setError(false);
    setRestricted(false);
    try {
      const [summary, vehicleRows, driverRows, tripRows, maintenanceRows, monthlyStatement, card] = await Promise.all([
        Dashboard.getFleetManagerAnalytics(),
        Vehicles.getAll(),
        Drivers.getAll(),
        Trips.getAll(),
        MaintenanceAPI.getAll(''),
        Payouts.getFleetManagerStatement(month).catch(() => null),
        Payouts.getMyRateCard().catch(() => null),
      ]);
      setAnalytics(summary);
      setVehicles(vehicleRows || []);
      setDrivers(driverRows || []);
      setTrips(tripRows || []);
      setMaintenance(maintenanceRows || []);
      setStatement(monthlyStatement);
      setRateCard(card);
      if (card) {
        setRates({
          baseFare: String(card.effective.baseFare),
          perKm: String(card.effective.perKm),
          perKg: String(card.effective.perKg),
          customerBaseFare: String(card.effective.customerBaseFare),
          customerPerKm: String(card.effective.customerPerKm),
          customerPerKg: String(card.effective.customerPerKg),
        });
      }
    } catch (loadError) {
      console.error(loadError);
      if (String(loadError.message || '').toLowerCase().includes('reports access')) setRestricted(true);
      else setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);
  useLiveSync(() => load({ background: true }));

  async function saveRateCard() {
    setSavingRates(true);
    try {
      await Payouts.setMyRateCard(Object.fromEntries(Object.entries(rates).map(([key, value]) => [key, Number(value)])));
      showToast('Pricing configuration saved');
      await load({ background: true });
    } catch (saveError) {
      alert(saveError.message || 'Failed to save pricing configuration.');
    } finally {
      setSavingRates(false);
    }
  }

  const activeTrips = trips.filter((trip) => /accepted|picked up|in transit|issue reported/i.test(trip.status || ''));
  const activeAvailableVehicles = vehicles.filter((vehicle) => /^active$/i.test(vehicle.status || ''));
  const availableDrivers = drivers.filter((driver) => {
    if (!/available|^active$/i.test(driver.status || '')) return false;
    const ownVehicleReady = activeAvailableVehicles.some(
      (vehicle) => normalize(vehicle.plate) === normalize(driver.vehicle) &&
        (!vehicle.assignedDriver || vehicle.assignedDriver === '--' || vehicle.assignedDriver === driver.name),
    );
    const automaticVehicleReady = activeAvailableVehicles.some(
      (vehicle) => !vehicle.assignedDriver || vehicle.assignedDriver === '--' || vehicle.assignedDriver === driver.name,
    );
    return ownVehicleReady || automaticVehicleReady;
  });
  const maintenanceVehicles = vehicles.filter((vehicle) => /maintenance/i.test(vehicle.status || ''));
  const issueTrips = trips.filter((trip) => /issue/i.test(trip.status || ''));
  const tripBars = useMemo(() => tripsPerDayBars(trips), [trips]);
  const maintenancePoints = useMemo(() => maintenanceCostLine(maintenance), [maintenance]);
  const maintenancePolyline = maintenancePoints.map((point) => `${point.x},${point.y}`).join(' ');
  const vehicleStatuses = useMemo(() => statusBreakdownRows(vehicles), [vehicles]);

  const driverRows = useMemo(() => drivers
    .map((driver) => ({
      ...driver,
      completed: trips.filter((trip) => normalize(trip.driver) === normalize(driver.name) && /completed|delivered/i.test(trip.status || '')).length,
      ratingValue: Number(driver.rating || 0),
    }))
    .sort((left, right) => right.ratingValue - left.ratingValue || right.completed - left.completed)
    .slice(0, 6), [drivers, trips]);

  if (loading) {
    return <section className="panel"><div className="panel-body fm-analytics-state">Loading fleet analytics...</div></section>;
  }
  if (restricted) {
    return (
      <section className="panel">
        <div className="panel-body fm-analytics-state">
          <strong>Analytics access is restricted</strong>
          <span>Contact your superuser to enable Reports Access.</span>
        </div>
      </section>
    );
  }
  if (error || !analytics) {
    return <section className="panel"><div className="panel-body fm-analytics-state error">Fleet analytics could not be loaded.</div></section>;
  }

  const readiness = analytics.vehicleActiveRatioPercent || 0;
  const completion = analytics.tripCompletionRatioPercent || 0;

  return (
    <div className="fm-analytics-page">
      <section className="hero">
        <div>
          <h2>Performance Overview</h2>
          <p>Live fleet operations and monthly financial performance.</p>
        </div>
        <div className="fm-analytics-actions">
          <label className="fm-month-field">
            <span>Financial month</span>
            <input className="filter-select" type="month" value={month} max={currentMonth()} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <button className="btn btn-yellow" type="button" onClick={() => window.print()}>Export Report</button>
        </div>
      </section>

      <section className="stats" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))', alignItems: 'stretch' }}>
        <div className="stat">
          <h3>Fleet Readiness</h3>
          <div className="v yellow">{readiness}%</div>
          <div className="s">{activeAvailableVehicles.length} of {vehicles.length} vehicles active</div>
        </div>
        <div className="stat">
          <h3>Trip Completion</h3>
          <div className="v yellow">{completion}%</div>
          <div className="s">{analytics.completedTrips} completed trips</div>
        </div>
        <div className="stat">
          <h3>Available Drivers</h3>
          <div className="v yellow">{availableDrivers.length}</div>
          <div className="s">Out of {drivers.length} registered drivers</div>
        </div>
        <div className="stat">
          <h3>Net Income</h3>
          <div className="v yellow">{statement ? money(statement.netIncome) : '--'}</div>
          <div className="s">{monthLabel(month)}</div>
        </div>
      </section>

      <section className="panel fm-signal-panel">
        <div className="panel-head">
          <div className="panel-title">Current Fleet Status</div>
          <span className="pill pill-yellow">Live</span>
        </div>
        <div className="panel-body">
          <div className="mini-stats">
            <div className="mini-stat"><div className="big">{activeTrips.length}</div><div className="muted">Active Trips</div></div>
            <div className="mini-stat"><div className="big">{availableDrivers.length}</div><div className="muted">Drivers Ready</div></div>
            <div className="mini-stat"><div className="big">{maintenanceVehicles.length}</div><div className="muted">In Maintenance</div></div>
            <div className="mini-stat"><div className="big">{issueTrips.length}</div><div className="muted">Open Issues</div></div>
          </div>
        </div>
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Recent Trip Activity</div>
            <span className="pill pill-yellow">Last 7 active dates</span>
          </div>
          {tripBars.length ? (
            <div className="bars">
              {tripBars.map((bar, index) => <div key={`${bar.label}-${index}`} style={{ height: bar.height }} title={bar.title}><span>{bar.label}</span></div>)}
            </div>
          ) : <div className="panel-body fm-empty">Trip activity will appear after trips are created.</div>}
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Fleet Health</div>
            <span className="pill pill-green">{readiness}% Ready</span>
          </div>
          <div className="panel-body">
            <div className="progress-list">
              {vehicleStatuses.slice(0, 5).map((row) => (
                <div className="progress-row" key={row.label}>
                  <div>{row.label}</div>
                  <div className="track"><span style={{ width: `${row.pct}%` }} /></div>
                  <strong>{row.value}</strong>
                </div>
              ))}
              {!vehicleStatuses.length && <div className="fm-empty">No vehicles registered.</div>}
            </div>
          </div>
        </div>
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">{monthLabel(month)} Financials</div>
            <span className="pill pill-yellow">Post-paid</span>
          </div>
          <div className="panel-body">
            {statement ? (
              <div className="summary-list">
                <div className="summary-row"><span>Fleet net income</span><strong className="yellow">{money(statement.netIncome)}</strong></div>
                <div className="summary-row"><span>Fleet revenue share</span><strong>{money(statement.tripRevenue)}</strong></div>
                <div className="summary-row"><span>Platform commission</span><strong>{money(statement.platformCommission)}</strong></div>
                <div className="summary-row"><span>Driver earnings</span><strong>-{money(statement.driverPayoutsTotal)}</strong></div>
                <div className="summary-row"><span>Maintenance costs</span><strong>-{money(statement.maintenanceCosts)}</strong></div>
                <div className="summary-row"><span>Pending driver liability</span><strong>{money(statement.pendingDriverEarnings)}</strong></div>
                <div className="summary-row"><span>Billable completed trips</span><strong>{statement.completedTrips}</strong></div>
              </div>
            ) : <div className="fm-empty">Financial statement is unavailable for this month.</div>}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Maintenance Cost Trend</div>
            <span className="pill pill-yellow">{money(analytics.maintenanceCost)} Total</span>
          </div>
          {maintenancePoints.length ? (
            <div className="linechart">
              <svg viewBox="0 0 500 190" preserveAspectRatio="none" role="img" aria-label="Maintenance cost trend">
                <polyline points={maintenancePolyline} fill="none" stroke="#ffd400" strokeWidth="4" />
                {maintenancePoints.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="5" fill="#fff"><title>{point.title}</title></circle>)}
              </svg>
            </div>
          ) : <div className="panel-body fm-empty">Maintenance cost history will appear here.</div>}
        </div>
      </section>

      <section className="panel fm-driver-panel">
        <div className="panel-head">
          <div className="panel-title">Driver Performance</div>
          <span className="pill pill-yellow">Rating and Completed Trips</span>
        </div>
        <div className="fm-table-scroll">
          <table className="table">
            <thead><tr><th>Rank</th><th>Driver</th><th>Status</th><th>Vehicle</th><th>Completed Trips</th><th>Customer Rating</th></tr></thead>
            <tbody>
              {driverRows.map((driver, index) => (
                <tr key={driver.id || driver.name}>
                  <td><strong>#{index + 1}</strong></td>
                  <td><span className="em">{driver.name || 'Unnamed driver'}</span><div className="muted">{driver.id || 'Driver'}</div></td>
                  <td><span className={`pill ${pillClass(driver.status)}`}>{driver.status || 'Unknown'}</span></td>
                  <td>{driver.vehicle && driver.vehicle !== '--' ? driver.vehicle : 'Auto-assign'}</td>
                  <td>{driver.completed}</td>
                  <td><strong className="yellow">★ {driver.ratingValue ? driver.ratingValue.toFixed(1) : 'New'}</strong></td>
                </tr>
              ))}
              {!driverRows.length && <tr><td colSpan={6} className="fm-empty">No driver performance data yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <details className="panel fm-rate-card">
        <summary className="panel-head">
          <div className="panel-title">Customer and Driver Rate Card</div>
          <span className="pill pill-yellow">{rateCard?.isCustom ? 'Custom Rates' : 'Platform Defaults'}</span>
        </summary>
        {rateCard ? (
          <div className="panel-body fm-rate-grid">
            <div className="fm-rate-column">
              <h3>Driver Payout</h3>
              {[['baseFare', 'Base fare'], ['perKm', 'Per kilometre'], ['perKg', 'Per kilogram']].map(([key, label]) => (
                <label className="fm-rate-field" key={key}><span>{label}</span><div><b>₹</b><input type="number" min={rateCard.platformFloor[key]} step="0.01" value={rates[key]} onChange={(event) => setRates((value) => ({ ...value, [key]: event.target.value }))} /></div></label>
              ))}
            </div>
            <div className="fm-rate-column">
              <h3>Customer Price</h3>
              {[['customerBaseFare', 'Base price'], ['customerPerKm', 'Per kilometre'], ['customerPerKg', 'Per kilogram']].map(([key, label]) => (
                <label className="fm-rate-field" key={key}><span>{label}</span><div><b>₹</b><input type="number" min={rateCard.platformFloor[key]} step="0.01" value={rates[key]} onChange={(event) => setRates((value) => ({ ...value, [key]: event.target.value }))} /></div></label>
              ))}
            </div>
            <div className="fm-rate-action">
              <p>Customer prices must preserve at least {rateCard.economics.minimumFleetMarginPercent}% fleet margin after the {rateCard.economics.commissionRate}% platform commission.</p>
              <button className="btn btn-yellow" type="button" disabled={savingRates} onClick={saveRateCard}>{savingRates ? 'Saving...' : 'Save Pricing'}</button>
            </div>
          </div>
        ) : <div className="panel-body fm-empty">Rate-card configuration could not be loaded.</div>}
      </details>

      <style>{`
        .fm-analytics-page{display:flex;flex-direction:column;gap:16px}.fm-analytics-page .hero{margin-bottom:0}.fm-analytics-page .stats,.fm-analytics-page .grid2{margin-bottom:0}.fm-analytics-actions{display:flex;align-items:flex-end;gap:10px}.fm-month-field{display:grid;gap:6px}.fm-month-field>span{color:var(--muted);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.fm-month-field .filter-select{min-width:180px}.fm-signal-panel .panel-body{padding-top:14px}.fm-signal-panel .mini-stats{margin-top:0}.fm-signal-panel .mini-stat{text-align:left}.fm-signal-panel .mini-stat .big{font-size:22px;margin-bottom:7px}.fm-empty,.fm-analytics-state{text-align:center;color:#888;padding:34px}.fm-analytics-state{display:grid;gap:8px}.fm-analytics-state.error{color:#ff8d8d}.fm-table-scroll{overflow-x:auto}.fm-driver-panel .table{min-width:820px}.fm-driver-panel .muted{font-size:12px;margin-top:4px}.fm-rate-card summary{cursor:pointer;list-style:none}.fm-rate-card summary::-webkit-details-marker{display:none}.fm-rate-card[open] summary{border-bottom:1px solid #252525}.fm-rate-grid{display:grid;grid-template-columns:1fr 1fr .8fr;gap:22px}.fm-rate-column h3{margin:0 0 16px;color:var(--yellow);font-size:15px}.fm-rate-field{display:grid;grid-template-columns:1fr 145px;align-items:center;gap:12px;margin-bottom:12px;color:#aaa;font-size:13px}.fm-rate-field>div{display:flex;align-items:center;border:1px solid #2d2d2d;border-radius:12px;background:#0d0d0d;overflow:hidden}.fm-rate-field b{padding-left:12px;color:var(--yellow)}.fm-rate-field input{width:100%;min-width:0;padding:10px;border:0;outline:0;background:transparent;color:#f4f4f4}.fm-rate-action{align-self:end;padding:16px;border:1px solid var(--line);border-radius:14px;background:#111}.fm-rate-action p{margin:0 0 14px;color:#999;font-size:12px;line-height:1.5}.fm-rate-action .btn{width:100%;justify-content:center}.fm-rate-action .btn:disabled{opacity:.6}.progress-row{grid-template-columns:110px 1fr 78px}.progress-row strong{text-align:right;font-size:12px}@media(max-width:1100px){.fm-rate-grid{grid-template-columns:1fr 1fr}.fm-rate-action{grid-column:1/-1}}@media(max-width:720px){.fm-analytics-actions{width:100%;align-items:stretch;flex-direction:column}.fm-month-field .filter-select,.fm-analytics-actions .btn{width:100%;justify-content:center}.fm-rate-grid{grid-template-columns:1fr}.fm-rate-action{grid-column:auto}.fm-rate-field{grid-template-columns:1fr 130px}.progress-row{grid-template-columns:88px 1fr 70px}}@media print{.sidebar,.topbar,.fm-analytics-actions,.fm-rate-card{display:none!important}.fleet-layout{display:block}.content{padding:0}.panel,.stat{break-inside:avoid}}
      `}</style>
    </div>
  );
}
