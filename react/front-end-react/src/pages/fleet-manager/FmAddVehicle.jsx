import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Drivers, Vehicles } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { today } from './fmUtils';

const vehicleTypes = ['Mini Truck', 'Van', 'Truck', 'Bike', 'SUV', 'Cargo Van'];
const statuses = ['Active', 'On Trip', 'Maintenance'];

export default function FmAddVehicle() {
  usePageHeader('Add Vehicle', 'Register a new fleet vehicle');
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [plate, setPlate] = useState('');
  const [type, setType] = useState(vehicleTypes[0]);
  const [capacity, setCapacity] = useState('');
  const [capacityUnit, setCapacityUnit] = useState('Tons');
  const [status, setStatus] = useState(statuses[0]);
  const [driver, setDriver] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [driversError, setDriversError] = useState('');
  const [maintenance, setMaintenance] = useState('');
  const [errPlate, setErrPlate] = useState('');
  const [errCapacity, setErrCapacity] = useState('');
  const [errDriver, setErrDriver] = useState('');
  const [errMaint, setErrMaint] = useState('');

  useEffect(() => {
    let cancelled = false;

    Drivers.getAll()
      .then((items) => {
        if (!cancelled) setDrivers((items || []).filter((item) => item.name || item.driver || item.fullName || item.username));
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setDriversError('Failed to load drivers from backend');
      })
      .finally(() => {
        if (!cancelled) setDriversLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function onCapacityChange(value) {
    if (/^\d*(\.\d*)?$/.test(value)) setCapacity(value);
  }

  async function save() {
    setErrPlate('');
    setErrCapacity('');
    setErrDriver('');
    setErrMaint('');
    const p = plate.trim();
    const m = maintenance.trim();
    let valid = true;
    if (!p) {
      setErrPlate('Plate number is required');
      valid = false;
    }
    const numericCapacity = Number(capacity);
    if (!/^\d+(\.\d+)?$/.test(capacity) || !Number.isFinite(numericCapacity) || numericCapacity <= 0) {
      setErrCapacity('Enter a capacity greater than 0');
      valid = false;
    }
    if (!driver) {
      setErrDriver('Please select an assigned driver');
      valid = false;
    }
    if (m && m > today()) {
      setErrMaint('Future date is not allowed');
      valid = false;
    }
    if (!valid) return;

    const payload = { plate: p, type, capacity: `${capacity} ${capacityUnit}`, status, assignedDriver: driver, maintenance: m };
    try {
      await Vehicles.create(payload);
      showToast('Vehicle created');
      navigate('/fleet-manager/vehicles');
    } catch (e) {
      console.error(e);
      alert('Failed to create vehicle from backend');
    }
  }

  return (
    <section className="panel panel-form" style={{ marginTop: 14 }}>
      <div className="panel-head">
        <span className="panel-icon">🚚</span>
        <div className="panel-title">Add New Vehicle</div>
      </div>
      <div className="panel-body">
        <div className="form-grid">
          <div className="field">
            <label>Plate Number</label>
            <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="e.g. KA 01 MG 2323" />
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
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px', gap: 8 }}>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="any"
                value={capacity}
                onChange={(e) => onCapacityChange(e.target.value)}
                placeholder="e.g. 2.5"
                aria-label="Capacity amount"
              />
              <select value={capacityUnit} onChange={(e) => setCapacityUnit(e.target.value)} aria-label="Capacity unit">
                <option value="Tons">Tons</option>
                <option value="kg">kg</option>
              </select>
            </div>
            <div className="field-error">{errCapacity}</div>
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
            <select value={driver} onChange={(e) => setDriver(e.target.value)} disabled={driversLoading || Boolean(driversError)}>
              <option value="">
                {driversLoading ? 'Loading drivers...' : driversError ? 'Drivers unavailable' : drivers.length ? 'Select Driver' : 'No drivers available'}
              </option>
              {drivers.map((item) => {
                const name = item.name || item.driver || item.fullName || item.username;
                return (
                  <option key={item.id || name} value={name}>
                    {name}{item.status ? ` · ${item.status}` : ''}
                  </option>
                );
              })}
            </select>
            <div className="field-error">{driversError || errDriver}</div>
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
            Create Vehicle
          </button>
        </div>
      </div>
    </section>
  );
}
