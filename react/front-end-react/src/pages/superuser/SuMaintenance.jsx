import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MaintenanceAPI } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { statusClass } from '../../components/Icon';
import { useLiveSync } from '../../hooks/useLiveSync';
import { matchesFilter, matchesSearchFields, uniqueFilterOptions } from '../../utils/search';

export default function SuMaintenance() {
  usePageHeader('Maintenance');
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [openMenu, setOpenMenu] = useState(null);

  async function load() {
    setFailed(false);
    try {
      setRows((await MaintenanceAPI.getAll()) || []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLiveSync(load);

  const filteredRows = rows.filter((record) => matchesSearchFields(search, [
    record.id,
    record.issue,
  ]) &&
    matchesFilter(record.priority, priorityFilter) &&
    matchesFilter(record.status, statusFilter));
  const priorityOptions = uniqueFilterOptions(rows, (record) => record.priority);
  const statusOptions = uniqueFilterOptions(rows, (record) => record.status);

  async function del(id) {
    if (!confirm(`Delete maintenance record ${id}?`)) return;
    try {
      await MaintenanceAPI.delete(id);
      showToast('Maintenance record deleted successfully');
      await load();
    } catch {
      alert('Failed to delete maintenance record');
    }
  }

  return (
    <div className="content-card table-card" onClick={() => setOpenMenu(null)}>
      <div className="table-head">
        <h3>Maintenance Management</h3>
        <div className="filters">
          <input className="mini-input" placeholder="Search maintenance ID or issue" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="mini-input" aria-label="Filter maintenance by priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}><option value="">All priorities</option>{priorityOptions.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select>
          <select className="mini-input" aria-label="Filter maintenance by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select>
          <Link className="btn-yellow" to="/superuser/schedule-maintenance">Schedule Maintenance</Link>
        </div>
      </div>
      <table>
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
          {loading && <tr><td colSpan={9} style={{ textAlign: 'center', color: '#b9b9b9', padding: 18 }}>Loading maintenance records...</td></tr>}
          {!loading && failed && <tr><td colSpan={9} style={{ textAlign: 'center', color: '#ff6b6b', padding: 18 }}>Failed to load maintenance records.</td></tr>}
          {!loading && !failed && filteredRows.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: '#b9b9b9', padding: 18 }}>{search.trim() || priorityFilter || statusFilter ? 'No maintenance records match the selected search and filters.' : 'No maintenance records found.'}</td></tr>}
          {!loading &&
            !failed &&
            filteredRows.map((r) => (
              <tr key={r.id}>
                <td>{r.id || '-'}</td>
                <td>{r.vehicle || r.vehicleId || '-'}</td>
                <td>{r.issue || '-'}</td>
                <td><span className={`status-pill ${statusClass(r.priority)}`}>{r.priority || '-'}</span></td>
                <td><span className={`status-pill ${statusClass(r.status)}`}>{r.status || '-'}</span></td>
                <td>{r.date || r.scheduledDate || '-'}</td>
                <td>{r.mechanic || '-'}</td>
                <td>{r.cost || r.estimatedCost || '-'}</td>
                <td>
                  <div className="action-menu-wrap" onClick={(e) => e.stopPropagation()}>
                    <button className="action-trigger dots-trigger" aria-label="Actions" onClick={() => setOpenMenu(openMenu === r.id ? null : r.id)}>⋯</button>
                    <div className={`action-menu ${openMenu === r.id ? 'show' : ''}`}>
                      <Link className="action-item" to={`/superuser/schedule-maintenance?id=${r.id}`}>Edit</Link>
                      <button className="action-item danger-link" onClick={() => { setOpenMenu(null); del(r.id); }}>Delete</button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
