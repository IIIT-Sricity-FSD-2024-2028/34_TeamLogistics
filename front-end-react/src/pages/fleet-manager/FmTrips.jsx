import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Trips, Drivers, Vehicles } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { canonicalTripStatus, matchesFilter, matchesSearchFields, pillClass, uniqueFilterOptions } from './fmUtils';
import ActionMenu from './ActionMenu';
import { useLiveSync } from '../../hooks/useLiveSync';

export default function FmTrips() {
  usePageHeader('Trip Management', 'Monitor and manage all fleet trips');
  const { showToast } = useToast();
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get('deliveryId') || params.get('id') || '');
  const [driverFilter, setDriverFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [rows, setRows] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(false);

  async function draw() {
    try {
      const [t, d, v] = await Promise.all([Trips.getAll(), Drivers.getAll(), Vehicles.getAll()]);
      setRows((t || []).map((trip) => ({ ...trip, status: canonicalTripStatus(trip.status) })));
      setDrivers(d || []);
      setVehicles(v || []);
      setError(false);
    } catch (e) {
      console.error(e);
      setError(true);
    }
  }

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLiveSync(draw);

  const filteredRows = useMemo(
    () => (rows || []).filter((trip) => matchesSearchFields(search, [
      trip.id,
      trip.request || trip.deliveryId,
    ]) &&
      matchesFilter(trip.driver, driverFilter) &&
      matchesFilter(trip.vehicle, vehicleFilter) &&
      matchesFilter(trip.status, statusFilter)),
    [rows, search, driverFilter, vehicleFilter, statusFilter],
  );
  const tripDriverOptions = uniqueFilterOptions(rows, (trip) => trip.driver);
  const tripVehicleOptions = uniqueFilterOptions(rows, (trip) => trip.vehicle);
  const tripStatusOptions = uniqueFilterOptions(rows, (trip) => trip.status);

  const activeAvailableVehicles = vehicles.filter(
    (vehicle) =>
      /^active$/i.test(vehicle.status || '') &&
      (!vehicle.assignedDriver || vehicle.assignedDriver === '--'),
  );
  const availableDrivers = drivers.filter((driver) => {
    if (!/available|^active$/i.test(driver.status || '')) return false;
    const registeredVehicle = vehicles.find(
      (vehicle) => String(vehicle.plate || '').toLowerCase() === String(driver.vehicle || '').toLowerCase(),
    );
    const registeredVehicleReady = registeredVehicle &&
      /^active$/i.test(registeredVehicle.status || '') &&
      (!registeredVehicle.assignedDriver || registeredVehicle.assignedDriver === '--' || registeredVehicle.assignedDriver === driver.name);
    return Boolean(registeredVehicleReady) || activeAvailableVehicles.length > 0;
  });

  async function reassign(tripId, driverName) {
    if (!tripId || !driverName) return;
    try {
      await Trips.reassign(tripId, driverName);
      showToast('Trip reassigned successfully');
      draw();
    } catch (e) {
      console.error('Failed to reassign trip from backend:', e);
      alert(e.message || 'Failed to assign driver.');
    }
  }

  async function resolveDispute(id) {
    const amountText = prompt('Resolved billable amount for this delivery (₹):');
    if (amountText === null) return;
    const resolvedAmount = Number(amountText);
    if (Number.isNaN(resolvedAmount) || resolvedAmount < 0) {
      alert('Please enter a valid non-negative amount.');
      return;
    }
    const reason = prompt('Reason for the resolution (shown to the business client):') || '';
    try {
      await Trips.resolveDispute(id, resolvedAmount, reason);
      showToast('Dispute resolved');
      draw();
    } catch (e) {
      console.error('Failed to resolve dispute:', e);
      alert(e.message || 'Failed to resolve dispute.');
    }
  }

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-left">
          <label className="search-sm">
            <span>⌕</span>
            <input placeholder="Search trip or delivery ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <select className="filter-select" aria-label="Filter trips by driver" value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}><option value="">All drivers</option>{tripDriverOptions.map((driver) => <option key={driver} value={driver}>{driver}</option>)}</select>
          <select className="filter-select" aria-label="Filter trips by vehicle" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}><option value="">All vehicles</option>{tripVehicleOptions.map((vehicle) => <option key={vehicle} value={vehicle}>{vehicle}</option>)}</select>
          <select className="filter-select" aria-label="Filter trips by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{tripStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select>
        </div>
      </div>
      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Trip ID</th>
              <th>Driver</th>
              <th>Vehicle</th>
              <th>Route</th>
              <th>Start Time</th>
              <th>Distance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: '#ff8d8d', padding: 18 }}>
                  Failed to load trips.
                </td>
              </tr>
            ) : rows === null ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: '#888', padding: 18 }}>
                  Loading trips...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: '#888', padding: 18 }}>
                  {search.trim() || driverFilter || vehicleFilter || statusFilter ? 'No trips match the selected search and filters.' : 'No trips found.'}
                </td>
              </tr>
            ) : (
              filteredRows.map((t) => (
                <tr key={t.id}>
                  <td className="em">{t.id}</td>
                  <td>{t.driver || '--'}</td>
                  <td className="em">{t.vehicle || '--'}</td>
                  <td>
                    {t.pickup || '--'} → {t.destination || '--'}
                  </td>
                  <td>{t.startTime || '--'}</td>
                  <td className="em">{t.distance || '--'}</td>
                  <td>
                    <span className={`pill ${pillClass(t.status)}`}>{t.status || '--'}</span>
                  </td>
                  <td>
                    <ActionMenu>
                      <Link to={`/fleet-manager/live-tracking?id=${encodeURIComponent(t.id)}`}>View</Link>
                      {String(t.status || '').toLowerCase() === 'issue reported' && (
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            resolveDispute(t.id);
                          }}
                        >
                          Resolve Dispute
                        </a>
                      )}
                      <label style={{ display: 'block', padding: '8px 10px', color: '#aaa', fontSize: 13 }}>Assign Driver</label>
                      <select
                        defaultValue={t.driver || ''}
                        style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #2a2a2a', background: '#1b1b1b', color: '#fff', outline: 'none' }}
                        onChange={(e) => reassign(t.id, e.target.value)}
                      >
                        <option value="">{availableDrivers.length ? 'Select available driver' : 'No available driver or vehicle'}</option>
                        {availableDrivers.map((d) => {
                          const name = d.name || d.driver || '';
                          const registeredVehicle = vehicles.find(
                            (vehicle) => String(vehicle.plate || '').toLowerCase() === String(d.vehicle || '').toLowerCase(),
                          );
                          return (
                            <option key={name} value={name}>
                              {name} · {registeredVehicle && /^active$/i.test(registeredVehicle.status || '') ? registeredVehicle.plate : 'vehicle assigned automatically'}
                            </option>
                          );
                        })}
                      </select>
                      {!availableDrivers.length && (
                        <div style={{ padding: '10px', fontSize: 12, color: '#aaa' }}>
                          Set a driver to Available and keep at least one vehicle Active, then try again.
                        </div>
                      )}
                    </ActionMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
