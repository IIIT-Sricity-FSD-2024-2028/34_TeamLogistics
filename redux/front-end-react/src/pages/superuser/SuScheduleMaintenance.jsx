import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGetVehiclesQuery, useGetMaintenanceQuery, useGetMaintenanceRecordQuery, useCreateMaintenanceMutation, useUpdateMaintenanceMutation, EMPTY_LIST, queryError } from '../../redux/superuserApi';
import { usePageHeader } from '../../hooks/usePageHeader';
import { isFutureDate, minimumFutureDate } from '../../utils/dateConstraints';

const issueTypes = ['Engine Oil Change', 'Brake Pad Replacement', 'Tire Rotation & Balance', 'Air Filter Replacement', 'Transmission Service'];
const priorities = ['Low', 'Medium', 'High', 'Critical'];
const maintenanceStatuses = ['Scheduled', 'In Progress', 'Under Maintenance', 'Completed', 'Overdue', 'Cancelled'];
const activeMaintenanceStatuses = new Set(['scheduled', 'in progress', 'under maintenance', 'overdue']);
const priorityMeta = {
  Low: { color: '#22c55e', bg: 'rgba(34,197,94,.12)' },
  Medium: { color: '#f7d10a', bg: 'rgba(247,209,10,.12)' },
  High: { color: '#ff9f1a', bg: 'rgba(255,159,26,.12)' },
  Critical: { color: '#ef4444', bg: 'rgba(239,68,68,.12)' },
};
const inputStyle = { background: '#1f1f22', border: '1px solid #2c2c31', borderRadius: 18, minHeight: 58 };

function ScheduleMaintenanceForm() {
  usePageStyleScope('su-schedule-maintenance');
  const [params] = useSearchParams();
  const editId = params.get('id') || '';
  const navigate = useNavigate();
  usePageHeader('Schedule Maintenance');

  const vehiclesQuery = useGetVehiclesQuery();
  const maintenanceQuery = useGetMaintenanceQuery();
  const recordQuery = useGetMaintenanceRecordQuery(editId, { skip: !editId });
  const existing = recordQuery.currentData;
  const vehicles = vehiclesQuery.data || EMPTY_LIST;
  const activeVehiclePlates = new Set((maintenanceQuery.data || EMPTY_LIST)
    .filter((item) => activeMaintenanceStatuses.has(String(item.status || '').toLowerCase().trim()))
    .map((item) => String(item.vehicle || '').toLowerCase().trim()));
  const loaded = !vehiclesQuery.isLoading && !maintenanceQuery.isLoading
    && (!editId || (!recordQuery.isLoading && !(recordQuery.isFetching && !existing)));
  const loadError = queryError(vehiclesQuery, maintenanceQuery, recordQuery)
    || (editId && loaded && !existing ? 'Maintenance record not found.' : '');
  const initialized = useRef(false);
  const [createMaintenance, { isLoading: creating }] = useCreateMaintenanceMutation();
  const [updateMaintenance, { isLoading: updating }] = useUpdateMaintenanceMutation();

  const [vehicle, setVehicle] = useState('');
  const [issue, setIssue] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState('');
  const [mechanic, setMechanic] = useState('');
  const [cost, setCost] = useState('');
  const [status, setStatus] = useState('Scheduled');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!existing || initialized.current) return;
    initialized.current = true;
    const ex = existing;
    setVehicle(ex.vehicle || ex.vehicleId || '');
    setIssue(ex.issue || '');
    setPriority(ex.priority || 'Medium');
    setNotes(ex.notes || '');
    setDate(ex.date || ex.scheduledDate || '');
    setMechanic(ex.mechanic || '');
    setStatus(maintenanceStatuses.includes(ex.status) ? ex.status : 'Scheduled');
    setCost(ex.cost ? String(ex.cost).replace(/[₹,]/g, '') : '');
  }, [existing]);

  async function save() {
    const next = {};
    if (!vehicle) next.vehicle = 'Select a valid vehicle';
    if (!issueTypes.includes(issue)) next.issue = 'Select a valid issue type';
    if (!date) next.date = 'Date is required';
    else if ((!existing || date !== (existing.date || existing.scheduledDate)) && !isFutureDate(date)) next.date = 'Scheduled date must be in the future';
    if (!mechanic.trim()) next.mechanic = 'Enter the assigned mechanic or workshop';
    if (cost && !/^\d{1,7}(\.\d{1,2})?$/.test(cost)) next.cost = 'Enter a valid cost in rupees';
    setErrors(next);
    if (Object.keys(next).length) return;
    if (notes.trim().length > 300) {
      alert('Additional notes should be 300 characters or less.');
      return;
    }

    const payload = { vehicle, issue, priority, date, mechanic, cost: cost ? `₹${cost}` : '--', notes: notes.trim() };

    if (existing) payload.status = status;

    try {
      if (existing && existing.id) await updateMaintenance({ id: existing.id, changes: payload }).unwrap();
      else await createMaintenance(payload).unwrap();
      navigate('/superuser/maintenance');
    } catch (error) {
      alert(error.message || 'Failed to save maintenance');
    }
  }

  if (loadError) return <div className="content-card form-card" role="alert">{loadError}</div>;
  if (!loaded) return <div className="content-card form-card">Loading...</div>;

  const selectableVehicles = vehicles.filter((item) => {
    const plate = item.plate || item.plateNumber || item.id || '';
    return String(item.status || '').toLowerCase() !== 'maintenance' &&
      !activeVehiclePlates.has(String(plate).toLowerCase().trim());
  });

  return (
    <div className="schedule-grid" style={{ display: 'grid', gridTemplateColumns: '1.9fr 1fr', gap: 24, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 24 }}>
        <div className="content-card form-card" style={{ padding: 28, borderRadius: 24 }}>
          <h3 style={{ margin: '0 0 22px 0', color: '#f7d10a', fontSize: 18, fontWeight: 800 }}>Vehicle & Issue Details</h3>
          <div className="field" style={{ marginBottom: 18 }}>
            <label>Vehicle *</label>
            {existing ? (
              <input style={inputStyle} value={vehicle} disabled />
            ) : (
              <select style={inputStyle} value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
                <option value="">Select vehicle</option>
                {selectableVehicles.map((v) => {
                  const plate = v.plate || v.plateNumber || v.id || '';
                  return <option key={plate} value={plate}>{plate}</option>;
                })}
              </select>
            )}
            <div className="error">{errors.vehicle}</div>
            {!existing && <div style={{ color: '#9e9e9e', fontSize: 12, marginTop: 8 }}>Vehicles already under maintenance are hidden. Scheduling will set the selected vehicle to Maintenance.</div>}
            {!existing && selectableVehicles.length === 0 && <div className="error">No vehicles are currently available for maintenance scheduling.</div>}
          </div>
          <div className="field" style={{ marginBottom: 18 }}>
            <label>Issue Type *</label>
            <select style={inputStyle} value={issue} onChange={(e) => setIssue(e.target.value)}>
              <option value="">Select issue</option>
              {issueTypes.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <div className="error">{errors.issue}</div>
          </div>
          <div className="field" style={{ marginBottom: 18 }}>
            <label>Priority *</label>
            <div className="sm-priority-group">
              {priorities.map((x) => {
                const meta = priorityMeta[x];
                const active = priority === x;
                return (
                  <button
                    type="button"
                    key={x}
                    className="sm-priority-pill"
                    onClick={() => setPriority(x)}
                    style={active ? { background: meta.bg, borderColor: meta.color, color: meta.color } : undefined}
                  >
                    <span className="sm-priority-dot" style={{ background: meta.color }} />
                    {x}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="content-card form-card" style={{ padding: 28, borderRadius: 24 }}>
          <h3 style={{ margin: '0 0 22px 0', color: '#f7d10a', fontSize: 18, fontWeight: 800 }}>Additional Notes</h3>
          <div className="field" style={{ marginBottom: 0 }}>
            <textarea
              placeholder="Enter any special instructions or notes for the mechanic..."
              style={{ ...inputStyle, minHeight: 210, height: 210, resize: 'vertical', padding: 18 }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 24 }}>
        <div className="content-card form-card" style={{ padding: 28, borderRadius: 24 }}>
          <h3 style={{ margin: '0 0 22px 0', color: '#f7d10a', fontSize: 18, fontWeight: 800 }}>Scheduling & Assignment</h3>
          <div className="field" style={{ marginBottom: 18 }}>
            <label>Scheduled Date *</label>
            <input type="date" min={minimumFutureDate()} style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="error">{errors.date}</div>
          </div>
          {existing && (
            <div className="field" style={{ marginBottom: 18 }}>
              <label>Maintenance Status</label>
              <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
                {maintenanceStatuses.map((value) => <option key={value}>{value}</option>)}
              </select>
            </div>
          )}
          <div className="field" style={{ marginBottom: 18 }}>
            <label>Assigned Mechanic *</label>
            <input style={inputStyle} value={mechanic} onChange={(e) => setMechanic(e.target.value)} placeholder="Enter mechanic or workshop name" />
            <div className="error">{errors.mechanic}</div>
          </div>
          <div className="field" style={{ marginBottom: 18 }}>
            <label>Estimated Cost (₹)</label>
            <input placeholder="e.g. 2500" style={inputStyle} value={cost} onChange={(e) => setCost(e.target.value)} />
            <div className="error">{errors.cost}</div>
          </div>
        </div>

        <div className="sm-ticket">
          <div className="sm-ticket-head">
            <div className="sm-ticket-title">Summary Preview</div>
            <span className="sm-priority-badge" style={{ background: priorityMeta[priority].bg, color: priorityMeta[priority].color, borderColor: priorityMeta[priority].color }}>
              {priority}
            </span>
          </div>
          <div className="sm-ticket-body">
            <div className="sm-ticket-row"><span className="sm-ticket-icon">🚚</span><span className="sm-ticket-label">Vehicle</span><span className="sm-ticket-value">{vehicle || '—'}</span></div>
            <div className="sm-ticket-row"><span className="sm-ticket-icon">🔧</span><span className="sm-ticket-label">Issue</span><span className="sm-ticket-value">{issue || '—'}</span></div>
            <div className="sm-ticket-row"><span className="sm-ticket-icon">📅</span><span className="sm-ticket-label">Date</span><span className="sm-ticket-value">{date || '—'}</span></div>
            <div className="sm-ticket-row"><span className="sm-ticket-icon">🧰</span><span className="sm-ticket-label">Mechanic</span><span className="sm-ticket-value">{mechanic || '—'}</span></div>
          </div>
          <div className="sm-ticket-notch" aria-hidden="true"><span /><span /></div>
          <div className="sm-ticket-total">
            <span>Estimated Cost</span>
            <strong>{cost ? `₹${cost}` : '—'}</strong>
          </div>
          <div className="form-actions" style={{ padding: '0 22px 22px' }}>
            <a className="btn-dark" href="/superuser/maintenance">Cancel</a>
            <button className="btn-yellow" disabled={creating || updating || !loaded || Boolean(loadError)} onClick={save}>{existing ? 'Update Maintenance' : 'Schedule Maintenance'}</button>
          </div>
        </div>
      </div>

    </div>
  );
}

export default function SuScheduleMaintenance() {
  const [params] = useSearchParams();
  return <ScheduleMaintenanceForm key={params.get('id') || 'new'} />;
}
