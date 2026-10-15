import { useEffect, useState } from 'react';
import { Vehicles } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { statusClass } from '../../components/Icon';
import Modal from '../../components/Modal';
import { useLiveSync } from '../../hooks/useLiveSync';
import { matchesFilter, matchesSearchFields, uniqueFilterOptions } from '../../utils/search';

const today = new Date().toISOString().split('T')[0];
const VEHICLE_TYPES = ['Mini Truck', 'Van', 'Truck', 'Bike', 'SUV', 'Cargo Van'];
const VEHICLE_STATUSES = ['Active', 'On Trip', 'Maintenance'];

function AddVehicleModal({ onClose, onDone }) {
  const { showToast } = useToast();
  const [plate, setPlate] = useState('');
  const [type, setType] = useState('');
  const [capacity, setCapacity] = useState('');
  const [status, setStatus] = useState('Active');
  const [lastMaintenance, setLastMaintenance] = useState('');
  const [errors, setErrors] = useState({});

  async function save() {
    const next = {};
    if (!plate.trim()) next.plate = 'Plate number is required';
    if (!type.trim()) next.type = 'Vehicle type is required';
    if (lastMaintenance && lastMaintenance > today) next.lastMaintenance = 'Future maintenance date is not allowed';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await Vehicles.create({ plate: plate.trim(), type: type.trim(), capacity: capacity.trim(), status, assignedDriver: '', maintenance: lastMaintenance });
      showToast('Vehicle added successfully');
      onClose();
      onDone();
    } catch {
      alert('Failed to add vehicle');
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="content-card form-card standalone-modal" style={{ maxWidth: 760, margin: '0 auto' }}>
        <div className="details-top">
          <div className="details-title">Add Vehicle</div>
          <button className="close-icon" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          <div className="grid-2" style={{ gap: 18 }}>
            <div className="field">
              <label>Plate Number</label>
              <input placeholder="e.g. TN09AB1234" value={plate} onChange={(e) => setPlate(e.target.value)} />
              <div className="error">{errors.plate}</div>
            </div>
            <div className="field">
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Select type</option>
                {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <div className="error">{errors.type}</div>
            </div>
          </div>
          <div className="grid-2" style={{ gap: 18 }}>
            <div className="field">
              <label>Capacity</label>
              <input placeholder="e.g. 2 Tons" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
            <div className="field">
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {VEHICLE_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Last Maintenance</label>
            <input type="date" max={today} value={lastMaintenance} onChange={(e) => setLastMaintenance(e.target.value)} />
            <div className="error">{errors.lastMaintenance}</div>
          </div>
          <div className="form-actions">
            <button className="btn-dark" type="button" onClick={onClose}>Cancel</button>
            <button className="btn-yellow" type="button" onClick={save}>Add Vehicle</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function VehicleDetailsModal({ vehicleId, onClose }) {
  const [v, setV] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setV(await Vehicles.getOne(vehicleId));
      } catch {
        setFailed(true);
      }
    })();
  }, [vehicleId]);

  return (
    <Modal onClose={onClose}>
      <div className="content-card details-card modal-detail-card standalone-modal">
        <div className="details-top">
          <div className="details-title">Vehicle Details</div>
          <button className="close-icon" onClick={onClose}>×</button>
        </div>
        <div className="details-body modal-detail-body">
          {!v && !failed && <div style={{ textAlign: 'center', color: '#b9b9b9', padding: 30 }}>Loading vehicle details...</div>}
          {failed && <div style={{ textAlign: 'center', color: '#ff6b6b', padding: 30 }}>Failed to load vehicle details.</div>}
          {v && (
            <>
              <div className="detail-block"><div className="detail-label">Vehicle ID</div><div className="detail-main">{v.id || '-'}</div></div>
              <div className="detail-block"><div className="detail-label">Plate Number</div><div className="detail-main">{v.plate || v.plateNumber || '-'}</div></div>
              <div className="detail-block"><div className="detail-label">Type</div><div className="detail-main">{v.type || '-'}</div></div>
              <div className="detail-block"><div className="detail-label">Status</div><div className="detail-main"><span className={`status-pill ${statusClass(v.status)}`}>{v.status || '-'}</span></div></div>
              <div className="detail-block"><div className="detail-label">Last Maintenance</div><div className="detail-main">{v.maintenance || v.lastMaintenance || '—'}</div></div>
            </>
          )}
        </div>
        <div className="detail-footer"><button className="btn-yellow close-wide" onClick={onClose}>Close</button></div>
      </div>
    </Modal>
  );
}

function EditVehicleModal({ vehicleId, onClose, onDone }) {
  const { showToast } = useToast();
  const [v, setV] = useState(null);
  const [failed, setFailed] = useState(false);
  const [plate, setPlate] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('Active');
  const [lastMaintenance, setLastMaintenance] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const data = await Vehicles.getOne(vehicleId);
        setV(data);
        setPlate(data.plate || data.plateNumber || '');
        setType(data.type || '');
        setStatus(data.status || 'Active');
        setLastMaintenance(data.maintenance || data.lastMaintenance || '');
      } catch {
        setFailed(true);
      }
    })();
  }, [vehicleId]);

  async function save() {
    const next = {};
    if (!plate.trim()) next.plate = 'Plate number is required';
    if (!type.trim()) next.type = 'Vehicle type is required';
    if (!lastMaintenance) next.lastMaintenance = 'Last maintenance date is required';
    if (lastMaintenance && lastMaintenance > today) next.lastMaintenance = 'Future date is not allowed';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await Vehicles.update(v.id, { plate: plate.trim(), type: type.trim(), status, capacity: v.capacity || '', assignedDriver: v.assignedDriver || '', maintenance: lastMaintenance });
      showToast('Vehicle updated successfully');
      onClose();
      onDone();
    } catch {
      alert('Failed to update vehicle');
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="content-card form-card standalone-modal" style={{ maxWidth: 760, margin: '0 auto' }}>
        <div className="details-top">
          <div className="details-title">Edit Vehicle</div>
          <button className="close-icon" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          {!v && !failed && <div style={{ textAlign: 'center', color: '#b9b9b9', padding: 30 }}>Loading vehicle...</div>}
          {failed && <div style={{ textAlign: 'center', color: '#ff6b6b', padding: 30 }}>Failed to load vehicle.</div>}
          {v && (
            <>
              <div className="grid-2" style={{ gap: 18 }}>
                <div className="field">
                  <label>Vehicle ID</label>
                  <input value={v.id || ''} disabled />
                </div>
                <div className="field">
                  <label>Plate Number</label>
                  <input value={plate} onChange={(e) => setPlate(e.target.value)} />
                  <div className="error">{errors.plate}</div>
                </div>
              </div>
              <div className="grid-2" style={{ gap: 18 }}>
                <div className="field">
                  <label>Type</label>
                  <input value={type} onChange={(e) => setType(e.target.value)} />
                  <div className="error">{errors.type}</div>
                </div>
                <div className="field">
                  <label>Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    {VEHICLE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Last Maintenance</label>
                <input type="date" max={today} value={lastMaintenance} onChange={(e) => setLastMaintenance(e.target.value)} />
                <div className="error">{errors.lastMaintenance}</div>
              </div>
              <div className="form-actions">
                <button className="btn-dark" type="button" onClick={onClose}>Cancel</button>
                <button className="btn-yellow" type="button" onClick={save}>Save Changes</button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function SuVehicles() {
  usePageHeader('Vehicle Management');
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [openMenu, setOpenMenu] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [viewId, setViewId] = useState(null);
  const [editId, setEditId] = useState(null);

  async function load() {
    setFailed(false);
    try {
      setRows((await Vehicles.getAll()) || []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);
  useLiveSync(load);

  async function deleteVehicle(id) {
    if (!confirm(`Delete vehicle ${id}?`)) return;
    try {
      await Vehicles.delete(id);
      showToast('Vehicle deleted successfully');
      await load();
    } catch {
      alert('Failed to delete vehicle');
    }
  }

  const filtered = rows.filter((v) => {
    const matchesSearch = matchesSearchFields(search, [
      v.id,
      v.plate || v.plateNumber,
    ]);
    return matchesSearch &&
      matchesFilter(v.type, typeFilter) &&
      matchesFilter(v.status, filter === 'all' ? '' : filter);
  });
  const typeOptions = uniqueFilterOptions(rows, (vehicle) => vehicle.type);
  const statusOptions = uniqueFilterOptions(rows, (vehicle) => vehicle.status);

  return (
    <div className="content-card table-card" onClick={() => setOpenMenu(null)}>
      <div className="table-head">
        <h3>Vehicle Management</h3>
        <div className="filters">
          <input className="mini-input" placeholder="Search vehicle ID or plate" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="mini-input" aria-label="Filter vehicles by type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="">All types</option>{typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}</select>
          <select className="mini-input" aria-label="Filter vehicles by status" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All statuses</option>{statusOptions.map((status) => <option key={status} value={String(status).toLowerCase()}>{status}</option>)}</select>
          <button className="btn-yellow" onClick={() => setShowAdd(true)}>+ Add Vehicle</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Vehicle ID</th>
            <th>Plate Number</th>
            <th>Type</th>
            <th>Status</th>
            <th>Last Maintenance</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#b9b9b9', padding: 18 }}>Loading vehicles...</td></tr>}
          {!loading && failed && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#ff6b6b', padding: 18 }}>Failed to load vehicles.</td></tr>}
          {!loading && !failed && filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#b9b9b9', padding: 18 }}>{search.trim() || typeFilter || filter !== 'all' ? 'No vehicles match the selected search and filters.' : 'No vehicles found.'}</td></tr>}
          {!loading &&
            !failed &&
            filtered.map((v) => (
                <tr key={v.id}>
                  <td>{v.id || '-'}</td>
                  <td>{v.plate || v.plateNumber || '-'}</td>
                  <td>{v.type || '-'}</td>
                  <td><span className={`status-pill ${statusClass(v.status)}`}>{v.status || '-'}</span></td>
                  <td>{v.maintenance || v.lastMaintenance || '—'}</td>
                  <td>
                    <div className="action-menu-wrap" onClick={(e) => e.stopPropagation()}>
                      <button className="action-trigger dots-trigger" aria-label="Actions" onClick={() => setOpenMenu(openMenu === v.id ? null : v.id)}>⋯</button>
                      <div className={`action-menu ${openMenu === v.id ? 'show' : ''}`}>
                        <button className="action-item" type="button" onClick={() => { setOpenMenu(null); setViewId(v.id); }}>View Vehicle</button>
                        <button className="action-item" type="button" onClick={() => { setOpenMenu(null); setEditId(v.id); }}>Edit Vehicle</button>
                        <button className="action-item danger-link" onClick={() => { setOpenMenu(null); deleteVehicle(v.id); }}>Delete Vehicle</button>
                      </div>
                    </div>
                  </td>
                </tr>
            ))}
        </tbody>
      </table>

      {showAdd && <AddVehicleModal onClose={() => setShowAdd(false)} onDone={load} />}
      {viewId && <VehicleDetailsModal vehicleId={viewId} onClose={() => setViewId(null)} />}
      {editId && <EditVehicleModal vehicleId={editId} onClose={() => setEditId(null)} onDone={load} />}
    </div>
  );
}
