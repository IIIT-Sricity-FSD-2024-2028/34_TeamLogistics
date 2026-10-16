import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MaintenanceAPI, Mechanics, Vehicles } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { isFutureDate, minimumFutureDate } from '../../utils/dateConstraints';
import { loadAvailableMechanics } from './mechanicOptions';

const issueTypes = ['Engine Oil Change', 'Brake Pad Replacement', 'Tire Rotation & Balance', 'Air Filter Replacement', 'Transmission Service'];
const priorities = ['Low', 'Medium', 'High', 'Critical'];
const maintenanceStatuses = ['Scheduled', 'In Progress', 'Under Maintenance', 'Completed', 'Overdue', 'Cancelled'];
const activeMaintenanceStatuses = new Set(['scheduled', 'in progress', 'under maintenance', 'overdue']);
const invalidCostMessage = 'Enter a non-negative amount with up to 2 decimal places';
const priorityMeta = {
  Low: { color: '#22c55e', bg: 'rgba(34,197,94,.12)' },
  Medium: { color: '#ffd400', bg: 'rgba(255,212,0,.12)' },
  High: { color: '#ff9f1a', bg: 'rgba(255,159,26,.12)' },
  Critical: { color: '#ef4444', bg: 'rgba(239,68,68,.12)' },
};

function validateEstimatedCost(value) {
  if (value === '') return '';
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return invalidCostMessage;

  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? '' : invalidCostMessage;
}

export default function FmScheduleMaintenance() {
  usePageHeader('Schedule Maintenance', 'Create a new maintenance task for a vehicle');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get('id') || '';

  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [activeVehiclePlates, setActiveVehiclePlates] = useState(new Set());
  const [mechanics, setMechanics] = useState([]);
  const [mechanicsLoading, setMechanicsLoading] = useState(true);
  const [mechanicsError, setMechanicsError] = useState('');

  const [vehicle, setVehicle] = useState('');
  const [issue, setIssue] = useState('');
  const [priority, setPriority] = useState(priorities[0]);
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
        if (id) {
          const ex = await MaintenanceAPI.getOne(id);
          setExisting(ex);
          setVehicle(ex.vehicle || ex.vehicleId || '');
          setIssue(ex.issue || '');
          setPriority(ex.priority || priorities[0]);
          setNotes(ex.notes || '');
          setDate(/^\d{4}-/.test(ex.date || '') ? ex.date : '');
          setMechanic(ex.mechanicId || (ex.mechanic ? `legacy:${ex.mechanic}` : ''));
          setStatus(maintenanceStatuses.includes(ex.status) ? ex.status : 'Scheduled');
          const storedCost = String(ex.cost ?? '').trim();
          setCost(storedCost === '--' ? '' : storedCost.replace(/[₹,]/g, ''));
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const records = await loadAvailableMechanics(Mechanics);
        if (!cancelled) setMechanics(records);
      } catch (error) {
        console.warn(error);
        if (!cancelled) setMechanicsError('Unable to load mechanics. Refresh the page and try again.');
      } finally {
        if (!cancelled) setMechanicsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    const v = vehicle.trim();
    const is = issue.trim();
    const d = date.trim();
    const c = cost;
    const selectedMechanic = mechanics.find((item) => item.id === mechanic);

    const errs = {};
    if (!v) errs.vehicle = 'Select a vehicle';
    if (!is) errs.issue = 'Select issue type';
    if (!d) errs.date = 'Date is required';
    else if ((!existing || d !== existing.date) && !isFutureDate(d)) errs.date = 'Scheduled date must be in the future';
    if (mechanicsLoading) errs.mechanic = 'Mechanics are still loading';
    else if (mechanicsError) errs.mechanic = mechanicsError;
    else if (!mechanic) errs.mechanic = 'Select the assigned mechanic or workshop';
    else if (!selectedMechanic) errs.mechanic = 'Select an active mechanic or workshop';
    const costError = validateEstimatedCost(c);
    if (costError) errs.cost = costError;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const numericCost = c === '' ? null : Number(c);
    const payload = { vehicle: v, issue: is, priority, date: d, mechanicId: selectedMechanic.id, cost: numericCost === null ? '--' : `₹${numericCost}`, notes: notes.trim() };
    if (existing) payload.status = status;

    try {
      if (existing) await MaintenanceAPI.update(id, payload);
      else await MaintenanceAPI.create(payload);
      showToast('Maintenance saved');
      navigate('/fleet-manager/maintenance');
    } catch (e) {
      console.error(e);
      alert(e.message || 'Failed to save maintenance from backend');
    }
  }

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ textAlign: 'center', color: '#888', padding: 24 }}>
          Loading...
        </div>
      </div>
    );
  }

  const selectableVehicles = vehicles.filter((item) => {
    const plate = item.plate || item.id || '';
    return String(item.status || '').toLowerCase() !== 'maintenance' &&
      !activeVehiclePlates.has(String(plate).toLowerCase().trim());
  });
  const selectedMechanic = mechanics.find((item) => item.id === mechanic);
  const existingMechanicUnavailable = Boolean(existing && mechanic && !selectedMechanic);
  const mechanicSelectionBlocked = mechanicsLoading || Boolean(mechanicsError) || mechanics.length === 0;

  const summaryRows = [
    ['Vehicle', vehicle || '—', '🚚'],
    ['Issue', issue || '—', '🔧'],
    ['Date', date || '—', '📅'],
    ['Mechanic', selectedMechanic?.name || existing?.mechanic || '—', '🧰'],
  ];
  const pm = priorityMeta[priority] || priorityMeta.Low;

  return (
    <div className="sm-page">
      <div className="split">
        <div className="stack">
          <div className="info-card sm-card">
            <h3><span className="sm-h-ico">🔧</span>Vehicle &amp; Issue Details</h3>
            <div className="field">
              <label>Vehicle *</label>
              {existing ? (
                <input value={vehicle} disabled />
              ) : (
                <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
                  <option value="">Select vehicle</option>
                  {selectableVehicles.map((v) => {
                    const plate = v.plate || v.id;
                    return (
                      <option key={plate} value={plate}>
                        {plate}
                        {v.type ? ` - ${v.type}` : ''}
                      </option>
                    );
                  })}
                </select>
              )}
              <div className="field-error">{errors.vehicle}</div>
              {!existing && <div style={{ color: '#888', fontSize: 12, marginTop: 8 }}>Vehicles already under maintenance are hidden. Scheduling will set the selected vehicle to Maintenance.</div>}
              {!existing && selectableVehicles.length === 0 && <div className="field-error">No vehicles are currently available for maintenance scheduling.</div>}
            </div>
            <div className="field">
              <label>Issue Type *</label>
              <select value={issue} onChange={(e) => setIssue(e.target.value)}>
                <option value="">Select issue</option>
                {issueTypes.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <div className="field-error">{errors.issue}</div>
            </div>
            <div className="field">
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
                      style={
                        active
                          ? { background: meta.bg, borderColor: meta.color, color: meta.color }
                          : undefined
                      }
                    >
                      <span className="sm-priority-dot" style={{ background: meta.color }} />
                      {x}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="info-card sm-card">
            <h3><span className="sm-h-ico">📝</span>Additional Notes</h3>
            <div className="field">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Enter any special instructions or notes for the mechanic..." />
            </div>
          </div>
        </div>
        <div className="stack">
          <div className="info-card sm-card">
            <h3><span className="sm-h-ico">📅</span>Scheduling &amp; Assignment</h3>
            <div className="field">
              <label>Scheduled Date *</label>
              <input type="date" min={minimumFutureDate()} value={date} onChange={(e) => setDate(e.target.value)} />
              <div className="field-error">{errors.date}</div>
            </div>
            {existing && (
              <div className="field">
                <label>Maintenance Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  {maintenanceStatuses.map((value) => <option key={value}>{value}</option>)}
                </select>
              </div>
            )}
            <div className="field">
              <label>Assigned Mechanic *</label>
              <select
                value={mechanic}
                disabled={mechanicSelectionBlocked}
                onChange={(e) => {
                  setMechanic(e.target.value);
                  setErrors((current) => ({ ...current, mechanic: '' }));
                }}
              >
                <option value="">
                  {mechanicsLoading
                    ? 'Loading mechanics...'
                    : mechanicsError
                      ? 'Mechanics unavailable'
                      : mechanics.length === 0
                        ? 'No active mechanics available'
                        : 'Select mechanic or workshop'}
                </option>
                {existingMechanicUnavailable && (
                  <option value={mechanic} disabled>{existing.mechanic || 'Previously assigned mechanic'} (Unavailable)</option>
                )}
                {mechanics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <div className="field-error">{errors.mechanic || mechanicsError}</div>
            </div>
            <div className="field">
              <label>Estimated Cost (₹)</label>
              <input
                type="text"
                inputMode="decimal"
                value={cost}
                onChange={(e) => {
                  const nextCost = e.target.value;
                  const costError = validateEstimatedCost(nextCost);
                  setCost(nextCost);
                  setErrors((current) => {
                    const nextErrors = { ...current };
                    if (costError) nextErrors.cost = costError;
                    else delete nextErrors.cost;
                    return nextErrors;
                  });
                }}
                placeholder="e.g. 1200.50"
                aria-invalid={Boolean(errors.cost)}
                aria-describedby="estimated-cost-error"
              />
              <div id="estimated-cost-error" className="field-error">{errors.cost}</div>
            </div>
          </div>

          <div className="sm-ticket">
            <div className="sm-ticket-head">
              <div className="sm-ticket-title">Summary Preview</div>
              <span className="sm-priority-badge" style={{ background: pm.bg, color: pm.color, borderColor: pm.color }}>
                {priority}
              </span>
            </div>
            <div className="sm-ticket-body">
              {summaryRows.map(([label, value, icon]) => (
                <div className="sm-ticket-row" key={label}>
                  <span className="sm-ticket-icon">{icon}</span>
                  <span className="sm-ticket-label">{label}</span>
                  <span className="sm-ticket-value">{value}</span>
                </div>
              ))}
            </div>
            <div className="sm-ticket-notch" aria-hidden="true">
              <span />
              <span />
            </div>
            <div className="sm-ticket-total">
              <span>Estimated Cost</span>
              <strong>{cost ? `₹${cost}` : '—'}</strong>
            </div>
          </div>
        </div>
      </div>
      <div className="foot-actions">
        <div></div>
        <div className="right-actions">
          <Link className="btn btn-ghost" to="/fleet-manager/maintenance">
            ✕ Cancel
          </Link>
          <button className="btn btn-yellow" onClick={save} disabled={mechanicSelectionBlocked}>
            🔧 {existing ? 'Update' : 'Schedule'} Maintenance
          </button>
        </div>
      </div>

      <style>{`
        .sm-card h3{display:flex;align-items:center;gap:10px}
        .sm-h-ico{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;background:rgba(255,212,0,.12);font-size:15px;flex:0 0 30px}
        .sm-priority-group{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:2px}
        .sm-priority-pill{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;border:1px solid #2a2a2a;background:#0d0d0d;color:#d4d4d4;font-weight:700;font-size:13.5px;cursor:pointer;transition:border-color .15s ease,background .15s ease,color .15s ease}
        .sm-priority-pill:hover{border-color:#444}
        .sm-priority-dot{width:9px;height:9px;border-radius:999px;flex:0 0 9px}

        .sm-ticket{background:var(--panel,#161616);border:1px solid var(--line,#2a2a2a);border-radius:18px;box-shadow:0 10px 26px rgba(0,0,0,.16);position:relative;overflow:hidden}
        .sm-ticket-head{display:flex;align-items:center;justify-content:space-between;padding:20px 22px 16px;border-bottom:1px dashed #2f2f2f}
        .sm-ticket-title{font-weight:800;color:var(--yellow,#ffd400);font-size:15px}
        .sm-priority-badge{border:1px solid;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:800;letter-spacing:.02em}
        .sm-ticket-body{padding:16px 22px 6px;display:flex;flex-direction:column;gap:14px}
        .sm-ticket-row{display:grid;grid-template-columns:26px 1fr auto;align-items:center;gap:10px}
        .sm-ticket-icon{font-size:15px;opacity:.85}
        .sm-ticket-label{color:#9e9e9e;font-size:13px;font-weight:600}
        .sm-ticket-value{color:#f5f5f5;font-size:14px;font-weight:700;text-align:right;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .sm-ticket-notch{position:relative;height:0;margin:18px 0 0}
        .sm-ticket-notch span{position:absolute;top:-10px;width:20px;height:20px;border-radius:999px;background:var(--bg,#060606)}
        .sm-ticket-notch span:first-child{left:-32px}
        .sm-ticket-notch span:last-child{right:-32px}
        .sm-ticket-total{display:flex;align-items:center;justify-content:space-between;padding:18px 22px 22px;margin-top:10px}
        .sm-ticket-total span{color:#9e9e9e;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
        .sm-ticket-total strong{color:var(--yellow,#ffd400);font-size:24px;font-weight:900}

        @media (max-width:640px){.sm-priority-group{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}
