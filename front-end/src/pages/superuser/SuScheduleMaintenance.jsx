import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MaintenanceAPI, Vehicles } from '../../api/namespaces';
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

export default function SuScheduleMaintenance() {
  const [params] = useSearchParams();
  const editId = params.get('id') || '';
  const navigate = useNavigate();
  usePageHeader('Schedule Maintenance');

  const [existing, setExisting] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [activeVehiclePlates, setActiveVehiclePlates] = useState(new Set());
  const [loaded, setLoaded] = useState(false);

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
    (async () => {
      try {
        const [v, schedules] = await Promise.all([Vehicles.getAll(), MaintenanceAPI.getAll('')]);
        setVehicles(v || []);
        setActiveVehiclePlates(new Set(
          (schedules || [])
            .filter((item) => activeMaintenanceStatuses.has(String(item.status || '').toLowerCase().trim()))
            .map((item) => String(item.vehicle || '').toLowerCase().trim()),
        ));
        if (editId) {
          const ex = await MaintenanceAPI.getOne(editId);
          setExisting(ex);
          setVehicle(ex.vehicle || ex.vehicleId || '');
          setIssue(ex.issue || '');
          setPriority(ex.priority || 'Medium');
          setNotes(ex.notes || '');
          setDate(ex.date || ex.scheduledDate || '');
          setMechanic(ex.mechanic || '');
          setStatus(maintenanceStatuses.includes(ex.status) ? ex.status : 'Scheduled');
          setCost(ex.cost ? String(ex.cost).replace(/[₹,]/g, '') : '');
        }
      } catch {
        // matches original: errors are swallowed, form still renders
      } finally {
        setLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

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
      if (existing && existing.id) await MaintenanceAPI.update(existing.id, payload);
      else await MaintenanceAPI.create(payload);
      navigate('/superuser/maintenance');
    } catch (error) {
      alert(error.message || 'Failed to save maintenance');
    }
  }

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
            <button className="btn-yellow" onClick={save}>{existing ? 'Update Maintenance' : 'Schedule Maintenance'}</button>
          </div>
        </div>
      </div>

      <style>{`
        .sm-priority-group{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:2px}
        .sm-priority-pill{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;border:1px solid #2c2c31;background:#1f1f22;color:#d4d4d4;font-weight:700;font-size:13.5px;cursor:pointer;transition:border-color .15s ease,background .15s ease,color .15s ease}
        .sm-priority-pill:hover{border-color:#4a4a4a}
        .sm-priority-dot{width:9px;height:9px;border-radius:999px;flex:0 0 9px}

        .sm-ticket{background:#161616;border:1px solid #262626;border-radius:24px;box-shadow:0 10px 26px rgba(0,0,0,.16);position:relative;overflow:hidden}
        .sm-ticket-head{display:flex;align-items:center;justify-content:space-between;padding:24px 28px 18px;border-bottom:1px dashed #2f2f2f}
        .sm-ticket-title{font-weight:800;color:#f7d10a;font-size:18px}
        .sm-priority-badge{border:1px solid;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:800;letter-spacing:.02em}
        .sm-ticket-body{padding:18px 28px 6px;display:flex;flex-direction:column;gap:14px}
        .sm-ticket-row{display:grid;grid-template-columns:26px 1fr auto;align-items:center;gap:10px}
        .sm-ticket-icon{font-size:15px;opacity:.85}
        .sm-ticket-label{color:#9e9e9e;font-size:13px;font-weight:600}
        .sm-ticket-value{color:#f5f5f5;font-size:14px;font-weight:700;text-align:right;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .sm-ticket-notch{position:relative;height:0;margin:18px 0 0}
        .sm-ticket-notch span{position:absolute;top:-10px;width:20px;height:20px;border-radius:999px;background:var(--bg,#0b0b0e)}
        .sm-ticket-notch span:first-child{left:-32px}
        .sm-ticket-notch span:last-child{right:-32px}
        .sm-ticket-total{display:flex;align-items:center;justify-content:space-between;padding:18px 28px;margin-top:6px}
        .sm-ticket-total span{color:#9e9e9e;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
        .sm-ticket-total strong{color:#f7d10a;font-size:26px;font-weight:900}
      `}</style>
    </div>
  );
}
