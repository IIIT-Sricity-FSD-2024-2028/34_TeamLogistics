import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Drivers, Users } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { fleetPortalDrivers, matchesFilter, matchesSearchFields, pillClass, uniqueFilterOptions } from './fmUtils';
import ActionMenu from './ActionMenu';
import { useLiveSync } from '../../hooks/useLiveSync';

export default function FmDrivers() {
  usePageHeader('Driver Management', 'Manage drivers and monitor performance');
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);

  async function draw() {
    try {
      const [data, users] = await Promise.all([Drivers.getAll(), Users.getAll('driver')]);
      setRows(fleetPortalDrivers(data, users));
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
    () => (rows || []).filter((driver) =>
      matchesSearchFields(search, [driver.name]) && matchesFilter(driver.status, statusFilter),
    ),
    [rows, search, statusFilter],
  );
  const statusOptions = uniqueFilterOptions(rows, (driver) => driver.status);

  async function del(id) {
    if (!confirm(`Delete driver ${id}?`)) return;
    try {
      await Drivers.delete(id);
      showToast('Driver deleted');
      draw();
    } catch (e) {
      console.error('Failed to delete driver:', e);
      alert('Failed to delete driver: ' + (e.message || 'unknown error'));
    }
  }

  async function toggleStatus(d) {
    const cur = d.status || '';
    const next = /suspend/i.test(cur) ? 'Available' : 'Suspended';
    try {
      const fresh = await Drivers.getOne(d.id);
      await Drivers.update(d.id, {
        name: fresh.name,
        phone: fresh.phone || '',
        vehicle: fresh.vehicle || '',
        status: next,
        license: fresh.license || '',
        email: fresh.email || '',
      });
      showToast('Driver status updated');
      draw();
    } catch (e) {
      console.error('Failed to update driver status:', e);
      alert('Failed to update driver status: ' + (e.message || 'unknown error'));
    }
  }

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-left">
          <label className="search-sm">
            <span>⌕</span>
            <input placeholder="Search driver name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <select className="filter-select" aria-label="Filter drivers by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
        <Link className="btn btn-yellow" to="/fleet-manager/add-driver">
          ＋ Add Driver
        </Link>
      </div>
      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Driver</th>
              <th>License Number</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Rating</th>
              <th>Last Trip</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#ff8d8d', padding: 18 }}>
                  Failed to load drivers.
                </td>
              </tr>
            ) : rows === null ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#888', padding: 18 }}>
                  Loading drivers...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#888', padding: 18 }}>
                  {search.trim() || statusFilter ? 'No drivers match the selected search and filters.' : 'No drivers found.'}
                </td>
              </tr>
            ) : (
              filteredRows.map((d) => (
                <tr key={d.id}>
                  <td className="em">{d.name}</td>
                  <td>{d.license || '--'}</td>
                  <td>{d.phone || '--'}</td>
                  <td>
                    <span className={`pill ${pillClass(d.status)}`}>{d.status || '--'}</span>
                  </td>
                  <td>{d.rating || '--'}</td>
                  <td>{d.trip || '--'}</td>
                  <td>
                    <ActionMenu>
                      <Link to={`/fleet-manager/driver-profile?id=${encodeURIComponent(d.id)}`}>View</Link>
                      <Link to={`/fleet-manager/edit-driver?id=${encodeURIComponent(d.id)}`}>Edit</Link>
                      <button onClick={() => toggleStatus(d)}>{/suspend/i.test(d.status || '') ? 'Enable' : 'Suspend'}</button>
                      <button className="danger" onClick={() => del(d.id)}>
                        Delete
                      </button>
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
