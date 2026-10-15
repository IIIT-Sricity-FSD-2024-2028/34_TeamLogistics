import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Vehicles, Drivers } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { today } from './fmUtils';

const vehicleTypes = ['Mini Truck', 'Van', 'Truck', 'Bike', 'SUV', 'Cargo Van'];
const statuses = ['Active', 'On Trip', 'Maintenance'];
const INDIAN_PLATE_REGEX = /^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{1,2}[ -]?[0-9]{4}$/;

export default function FmEditVehicle() {
  usePageHeader('Edit Vehicle', 'Update asset details and operating status');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get('id') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [drivers, setDrivers] = useState([]);

  const [plateSelectVal, setPlateSelectVal] = useState('');
  const [originalPlate, setOriginalPlate] = useState('');
  const [plate, setPlate] = useState('');
  const [showPlateInput, setShowPlateInput] = useState(false);
  const [type, setType] = useState(vehicleTypes[0]);
  const [capacity, setCapacity] = useState('');
  const [status, setStatus] = useState(statuses[0]);
  const [driver, setDriver] = useState('');
  const [maintenance, setMaintenance] = useState('');

  const [errPlate, setErrPlate] = useState('');
  const [errMaint, setErrMaint] = useState('');
  const [errDriver, setErrDriver] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [v, d] = await Promise.all([Vehicles.getOne(id), Drivers.getAll()]);
        setDrivers(d || []);
        const p = v.plate || '';
        setOriginalPlate(p);
        setPlateSelectVal(p);
        setPlate(p);
        setType(v.type || vehicleTypes[0]);
        setCapacity(v.capacity || '');
        setStatus(statuses.includes(v.status) ? v.status : statuses[0]);
        setDriver(v.assignedDriver || v.driver || '');
        const maint = v.maintenance || v.lastMaintenance || '';
        setMaintenance(/^\d{4}-\d{2}-\d{2}$/.test(maint) ? maint : '');
      } catch (e) {
        console.error(e);
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function onPlateSelectChange(v) {
    setPlateSelectVal(v);
    if (v === '__custom__') {
      setShowPlateInput(true);
      setPlate('');
    } else {
      setShowPlateInput(false);
      setPlate(v);
    }
  }

  async function save() {
    setErrPlate('');
    setErrMaint('');
    setErrDriver('');

    const p = plate.trim().toUpperCase();
    const maint = maintenance.trim();
    const assignedDriver = driver.trim();

    let ok = true;
    if (!p) {
      setErrPlate('Plate number is required');
      ok = false;
    } else if (!INDIAN_PLATE_REGEX.test(p)) {
      setErrPlate('Enter valid Indian plate number, e.g. KA 01 MG 2323 or DL 2C AA 1111');
      ok = false;
    }
    if (maint && maint > today()) {
      setErrMaint('Future date is not allowed');
      ok = false;
    }
    if (!assignedDriver) {
      setErrDriver('Please select assigned driver');
      ok = false;
    }
    if (!ok) return;

    const payload = { plate: p, type, capacity: capacity.trim(), status, assignedDriver, maintenance: maint };
    await Vehicles.update(id, payload);
    showToast('Vehicle updated');
    navigate('/fleet-manager/vehicles');
  }

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ textAlign: 'center', color: '#888', padding: 24 }}>
          Loading vehicle...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ textAlign: 'center', color: '#ff8d8d', padding: 34 }}>
          Failed to load vehicle.
        </div>
      </div>
    );
  }

  return (
    <section className="panel panel-form" style={{ marginTop: 14 }}>
      <div className="panel-head">
        <span className="panel-icon">✎</span>
        <div className="panel-title">Edit Vehicle</div>
      </div>
      <div className="panel-body">
        <div className="form-grid">
          <div className="field">
            <label>Plate Number</label>
            <select value={plateSelectVal} onChange={(e) => onPlateSelectChange(e.target.value)}>
              <option value={originalPlate}>{originalPlate || '(no plate on file)'}</option>
              <option value="__custom__">+ Enter a different plate number</option>
            </select>
            {showPlateInput && (
              <input type="text" style={{ marginTop: 8 }} value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="e.g. KA 01 MG 2323" />
            )}
            <div className="field-error">{errPlate}</div>
          </div>
          <div className="field">
            <label>Vehicle Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {vehicleTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Capacity</label>
            <input value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Assigned Driver</label>
            <select value={driver} onChange={(e) => setDriver(e.target.value)}>
              <option value="">Select Driver</option>
              {drivers.map((d) => {
                const name = d.name || d.driver || d.fullName || d.username || '';
                return (
                  <option key={name} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>
            <div className="error">{errDriver}</div>
          </div>
          <div className="field">
            <label>Last Maintenance Date</label>
            <input type="date" max={today()} value={maintenance} onChange={(e) => setMaintenance(e.target.value)} />
            <div className="field-error">{errMaint}</div>
          </div>
        </div>
        <div className="footer-actions">
          <Link className="btn btn-ghost" to="/fleet-manager/vehicles">
            Cancel
          </Link>
          <button className="btn btn-yellow" onClick={save}>
            Update Vehicle
          </button>
        </div>
      </div>
    </section>
  );
}
