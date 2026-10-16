import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MaintenanceAPI } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { matchesFilter, matchesSearchFields, pillClass, money, uniqueFilterOptions } from './fmUtils';
import ActionMenu from './ActionMenu';
import { useLiveSync } from '../../hooks/useLiveSync';

export default function FmMaintenance() {
  usePageHeader('Maintenance Management', 'Schedule and track vehicle maintenance');
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mechanicFilter, setMechanicFilter] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);

  async function draw() {
    try {
      const data = await MaintenanceAPI.getAll();
      setRows(data || []);
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
    () => (rows || []).filter((record) => matchesSearchFields(search, [
      record.id,
      record.issue,
    ]) &&
      matchesFilter(record.vehicle, vehicleFilter) &&
      matchesFilter(record.priority, priorityFilter) &&
      matchesFilter(record.status || 'Scheduled', statusFilter) &&
      matchesFilter(record.mechanic, mechanicFilter)),
    [rows, search, vehicleFilter, priorityFilter, statusFilter, mechanicFilter],
  );
  const vehicleOptions = uniqueFilterOptions(rows, (record) => record.vehicle);
  const priorityOptions = uniqueFilterOptions(rows, (record) => record.priority);
  const statusOptions = uniqueFilterOptions(rows, (record) => record.status || 'Scheduled');
  const mechanicOptions = uniqueFilterOptions(rows, (record) => record.mechanic);

  async function del(id) {
    if (!confirm(`Delete maintenance record ${id}?`)) return;
    await MaintenanceAPI.delete(id);
    showToast('Maintenance deleted');
    draw();
  }

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-left">
          <label className="search-sm">
            <span>⌕</span>
            <input placeholder="Search maintenance ID or issue..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <select className="filter-select" aria-label="Filter maintenance by vehicle" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}><option value="">All vehicles</option>{vehicleOptions.map((vehicle) => <option key={vehicle} value={vehicle}>{vehicle}</option>)}</select>
          <select className="filter-select" aria-label="Filter maintenance by priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}><option value="">All priorities</option>{priorityOptions.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select>
          <select className="filter-select" aria-label="Filter maintenance by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select>
          <select className="filter-select" aria-label="Filter maintenance by mechanic" value={mechanicFilter} onChange={(e) => setMechanicFilter(e.target.value)}><option value="">All mechanics</option>{mechanicOptions.map((mechanic) => <option key={mechanic} value={mechanic}>{mechanic}</option>)}</select>
        </div>
        <Link className="btn btn-yellow" to="/fleet-manager/schedule-maintenance">
          ＋ Schedule Maintenance
        </Link>
      </div>
      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Vehicle</th>
              <th>Issue</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Scheduled Date</th>
              <th>Mechanic</th>
              <th>Est. Cost</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: '#ff8d8d', padding: 18 }}>
                  Failed to load maintenance from backend.
                </td>
              </tr>
            ) : rows === null ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: '#888', padding: 18 }}>
                  Loading maintenance...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: '#888', padding: 18 }}>
                  {search.trim() || vehicleFilter || priorityFilter || statusFilter || mechanicFilter ? 'No maintenance records match the selected search and filters.' : 'No maintenance records found.'}
                </td>
              </tr>
            ) : (
              filteredRows.map((m) => (
                <tr key={m.id}>
                  <td className="em">{m.id}</td>
                  <td>{m.vehicle}</td>
                  <td>{m.issue}</td>
                  <td>
                    <span className={`pill ${pillClass(m.priority)}`}>{m.priority}</span>
                  </td>
                  <td>
                    <span className={`pill ${pillClass(m.status)}`}>{m.status || 'Scheduled'}</span>
                  </td>
                  <td>{m.date}</td>
                  <td>{m.mechanic}</td>
                  <td className="em">{money(m.cost)}</td>
                  <td>
                    <ActionMenu>
                      <Link className="btn btn-small btn-ghost" to={`/fleet-manager/schedule-maintenance?id=${encodeURIComponent(m.id)}`}>
                        Edit
                      </Link>
                      <button className="btn btn-small btn-ghost" onClick={() => del(m.id)}>
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
