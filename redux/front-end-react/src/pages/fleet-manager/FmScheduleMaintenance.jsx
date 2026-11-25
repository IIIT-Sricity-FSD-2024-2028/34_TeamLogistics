import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCreateMaintenanceMutation, useGetMaintenanceQuery, useGetMaintenanceRecordQuery, useGetMechanicsQuery, useGetVehiclesQuery, useUpdateMaintenanceMutation, EMPTY_LIST } from '../../redux/fleetManagerApi';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { isFutureDate, minimumFutureDate } from '../../utils/dateConstraints';

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
  usePageStyleScope('fm-schedule-maintenance');
  usePageHeader('Schedule Maintenance', 'Create a new maintenance task for a vehicle');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get('id') || '';

  const [existing, setExisting] = useState(null);
  const initialized = useRef(false);
  const vehiclesQuery = useGetVehiclesQuery();
  const schedulesQuery = useGetMaintenanceQuery();
  const recordQuery = useGetMaintenanceRecordQuery(id, { skip: !id });
  const mechanicsQuery = useGetMechanicsQuery();
  const vehicles = vehiclesQuery.data || EMPTY_LIST;
  const mechanics = mechanicsQuery.data || EMPTY_LIST;
  const mechanicsLoading = mechanicsQuery.isLoading;
  const mechanicsError = mechanicsQuery.isError ? 'Unable to load mechanics. Refresh the page and try again.' : '';
  const loading = vehiclesQuery.isLoading || schedulesQuery.isLoading || (id && recordQuery.isLoading);
  const failed = vehiclesQuery.isError || schedulesQuery.isError || (id && recordQuery.isError);
  const [createMaintenance, createState] = useCreateMaintenanceMutation();
  const [updateMaintenance, updateState] = useUpdateMaintenanceMutation();
  const activeVehiclePlates = useMemo(() => new Set(
    (schedulesQuery.data || EMPTY_LIST)
      .filter((item) => activeMaintenanceStatuses.has(String(item.status || '').toLowerCase().trim()) && item.id !== id)
      .map((item) => String(item.vehicle || '').toLowerCase().trim()),
  ), [schedulesQuery.data, id]);

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
    if (loading || failed || initialized.current) return;
    initialized.current = true;
        if (id && recordQuery.data) {
          const ex = recordQuery.data;
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
  }, [loading, failed, id, recordQuery.data]);

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
      if (existing) await updateMaintenance({ id, changes: payload }).unwrap();
      else await createMaintenance(payload).unwrap();
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

  if (failed || (id && !existing)) {
    return <div className="panel"><div className="panel-body" style={{ textAlign: 'center', color: '#ff8d8d', padding: 24 }}>Failed to load maintenance details.</div></div>;
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
          <button className="btn btn-yellow" onClick={save} disabled={mechanicSelectionBlocked || createState.isLoading || updateState.isLoading}>
            🔧 {createState.isLoading || updateState.isLoading ? 'Saving' : existing ? 'Update' : 'Schedule'} Maintenance
          </button>
        </div>
      </div>

    </div>
  );
}
