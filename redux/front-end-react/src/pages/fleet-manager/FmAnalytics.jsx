import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGetAnalyticsQuery, useGetVehiclesQuery, useGetDriversQuery, useGetTripsQuery, useGetMaintenanceQuery, useGetStatementQuery, useGetRateCardQuery, useUpdateRateCardMutation, EMPTY_LIST } from '../../redux/fleetManagerApi';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { maintenanceCostLine, pillClass, statusBreakdownRows, tripsPerDayBars } from './fmUtils';

const currentMonth = () => new Date().toISOString().slice(0, 7);
const normalize = (value) => String(value || '').trim().toLowerCase();
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function monthLabel(month) {
  const date = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? month : date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export default function FmAnalytics() {
  usePageStyleScope('fm-analytics');
  usePageHeader('Fleet Analytics', 'Operational performance, financial health and driver insights');
  const { showToast } = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [rates, setRates] = useState({ baseFare: '', perKm: '', perKg: '', customerBaseFare: '', customerPerKm: '', customerPerKg: '' });
  const ratesInitialized = useRef(false);
  const analyticsQuery = useGetAnalyticsQuery();
  const vehiclesQuery = useGetVehiclesQuery();
  const driversQuery = useGetDriversQuery();
  const tripsQuery = useGetTripsQuery();
  const maintenanceQuery = useGetMaintenanceQuery();
  const statementQuery = useGetStatementQuery(month);
  const rateCardQuery = useGetRateCardQuery();
  const queries = [analyticsQuery, vehiclesQuery, driversQuery, tripsQuery, maintenanceQuery];
  const analytics = analyticsQuery.data;
  const vehicles = vehiclesQuery.data || EMPTY_LIST;
  const drivers = driversQuery.data || EMPTY_LIST;
  const trips = tripsQuery.data || EMPTY_LIST;
  const maintenance = maintenanceQuery.data || EMPTY_LIST;
  const statement = statementQuery.data || null;
  const rateCard = rateCardQuery.data || null;
  const loading = queries.some((query) => query.isLoading);
  const restricted = analyticsQuery.isError && String(analyticsQuery.error?.message || '').toLowerCase().includes('reports access');
  const error = queries.some((query) => query.isError && !query.data) && !restricted;
  const [updateRateCard, updateState] = useUpdateRateCardMutation();
  const savingRates = updateState.isLoading;

  useEffect(() => {
      if (rateCard && !ratesInitialized.current) {
        ratesInitialized.current = true;
        setRates({
          baseFare: String(rateCard.effective.baseFare),
          perKm: String(rateCard.effective.perKm),
          perKg: String(rateCard.effective.perKg),
          customerBaseFare: String(rateCard.effective.customerBaseFare),
          customerPerKm: String(rateCard.effective.customerPerKm),
          customerPerKg: String(rateCard.effective.customerPerKg),
        });
      }
  }, [rateCard]);

  async function saveRateCard() {
    try {
      await updateRateCard(Object.fromEntries(Object.entries(rates).map(([key, value]) => [key, Number(value)]))).unwrap();
      showToast('Pricing configuration saved');
    } catch (saveError) {
      alert(saveError.message || 'Failed to save pricing configuration.');
    }
  }

  const activeTrips = trips.filter((trip) => /accepted|picked up|in transit|issue reported/i.test(trip.status || ''));
  const activeAvailableVehicles = vehicles.filter((vehicle) => /^active$/i.test(vehicle.status || ''));
  const availableDrivers = drivers.filter((driver) => {
    if (!/^(available|active)$/i.test(driver.status || '')) return false;
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

    </div>
  );
}
