import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Documents, Drivers } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import ActionMenu from './ActionMenu';
import { useLiveSync } from '../../hooks/useLiveSync';
import { matchesFilter, matchesSearchFields, uniqueFilterOptions } from './fmUtils';
import {
  formatComplianceDate,
  getDriverLicenseExpiry,
  getDriverLicenseStatus,
  getDriverOverallCompliance,
} from '../../utils/driverCompliance';

function licensePill(status) {
  const s = status.toLowerCase();
  if (s.includes('expired') || s.includes('missing')) return 'pill-red';
  if (s.includes('review')) return 'pill-yellow';
  return 'pill-green';
}

function overallPill(status) {
  const s = status.toLowerCase();
  if (s.includes('not')) return 'pill-red';
  return 'pill-green';
}

export default function FmCompliance() {
  usePageHeader('Driver Compliance', 'Monitor driver regulatory and safety compliance');
  const { showToast } = useToast();
  const [rows, setRows] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState(false);
  const [notifyingDriverId, setNotifyingDriverId] = useState('');
  const [search, setSearch] = useState('');
  const [overallFilter, setOverallFilter] = useState('');
  const [licenseFilter, setLicenseFilter] = useState('');

  async function load() {
    try {
      const [drivers, documentRows] = await Promise.all([Drivers.getAll(), Documents.getAll()]);
      setRows(drivers || []);
      setDocuments(documentRows || []);
      setError(false);
    } catch (e) {
      console.error(e);
      setError(true);
    }
  }

  useEffect(() => {
    load();
  }, []);
  useLiveSync(load);

  async function toggleStatus(d) {
    const current = d.status || '';
    const next = /suspend/i.test(current) ? 'Available' : 'Suspended';
    if (!confirm(`Change driver status to ${next}?`)) return;
    try {
      const fresh = await Drivers.getOne(d.id);
      await Drivers.update(d.id, {
        name: fresh.name,
        phone: fresh.phone || '',
        email: fresh.email || '',
        license: fresh.license || '',
        vehicle: fresh.vehicle || '',
        status: next,
      });
      showToast('Driver status updated');
      load();
    } catch (e) {
      console.error(e);
      alert('Failed to update driver status');
    }
  }

  async function notifyDriver(driver, licenseStatus, expiry) {
    if (notifyingDriverId) return;
    const expiryText = expiry ? formatComplianceDate(expiry) : 'not available';
    const message = `Your driver compliance is Not Compliant. Driver License status: ${licenseStatus}. License expiry: ${expiryText}. Driver status: ${driver.status || 'not available'}. Please review your license documents and contact your fleet manager to complete the required action.`;

    try {
      setNotifyingDriverId(driver.id);
      await Drivers.notifyCompliance(driver.id, message);
      showToast(`Compliance notification sent to ${driver.name || 'driver'}`);
    } catch (notificationError) {
      console.error(notificationError);
      showToast(notificationError.message || 'Failed to notify driver');
    } finally {
      setNotifyingDriverId('');
    }
  }

  if (error) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ textAlign: 'center', color: '#ff8d8d', padding: 24 }}>
          Failed to load compliance data.
        </div>
      </div>
    );
  }

  if (rows === null) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ textAlign: 'center', color: '#888', padding: 24 }}>
          Loading compliance data...
        </div>
      </div>
    );
  }

  const totalDrivers = rows.length;
  const compliant = rows.filter((driver) => getDriverOverallCompliance(driver, documents) === 'Compliant').length;
  const nonCompliant = rows.filter((driver) => getDriverOverallCompliance(driver, documents) === 'Not Compliant').length;
  const invalidLicenses = rows.filter((driver) => getDriverLicenseStatus(driver, documents) !== 'Valid').length;

  const filtered = rows.filter((driver) =>
    matchesSearchFields(search, [driver.name]) &&
    matchesFilter(getDriverOverallCompliance(driver, documents), overallFilter) &&
    matchesFilter(getDriverLicenseStatus(driver, documents), licenseFilter),
  );
  const overallOptions = uniqueFilterOptions(rows, (driver) => getDriverOverallCompliance(driver, documents));
  const licenseOptions = uniqueFilterOptions(rows, (driver) => getDriverLicenseStatus(driver, documents));

  return (
    <>
      <section className="stats" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))', marginBottom: 18 }}>
        <div className="stat">
          <h3>Total Drivers</h3>
          <div className="v yellow">{totalDrivers}</div>
        </div>
        <div className="stat">
          <h3>Compliant</h3>
          <div className="v yellow">{compliant}</div>
        </div>
        <div className="stat">
          <h3>Not Compliant</h3>
          <div className="v yellow">{nonCompliant}</div>
        </div>
        <div className="stat">
          <h3>Expired / Missing Licenses</h3>
          <div className="v yellow">{invalidLicenses}</div>
        </div>
      </section>

      <div className="toolbar">
        <div className="toolbar-left">
          <label className="search-sm">
            <span>⌕</span>
            <input placeholder="Search driver name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <select className="filter-select" aria-label="Filter by compliance status" value={overallFilter} onChange={(e) => setOverallFilter(e.target.value)}>
            <option value="">All compliance</option>
            {overallOptions.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select className="filter-select" aria-label="Filter by license status" value={licenseFilter} onChange={(e) => setLicenseFilter(e.target.value)}>
            <option value="">All licenses</option>
            {licenseOptions.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
        <div className="btn btn-ghost" style={{ pointerEvents: 'none' }}>
          License review: {invalidLicenses} expired or missing
        </div>
      </div>

      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Driver</th>
              <th>License Status</th>
              <th>License Expiry</th>
              <th>Overall Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#888', padding: 18 }}>
                  {search.trim() || overallFilter || licenseFilter ? 'No compliance records match the selected search and filters.' : 'No compliance records found.'}
                </td>
              </tr>
            ) : (
              filtered.map((d) => {
                const licenseStatus = getDriverLicenseStatus(d, documents);
                const expiry = getDriverLicenseExpiry(d, documents);
                const overall = getDriverOverallCompliance(d, documents);
                return (
                  <tr key={d.id}>
                    <td>
                      <div className="em">{d.name || '--'}</div>
                      <div className="muted">{d.id || '--'}</div>
                    </td>
                    <td>
                      <span className={`pill ${licensePill(licenseStatus)}`}>{licenseStatus}</span>
                    </td>
                    <td>{formatComplianceDate(expiry)}</td>
                    <td>
                      <span className={`pill ${overallPill(overall)}`}>{overall}</span>
                    </td>
                    <td>
                      <ActionMenu>
                        <Link to={`/fleet-manager/driver-profile?id=${encodeURIComponent(d.id)}`}>View Driver</Link>
                        <Link to={`/fleet-manager/edit-driver?id=${encodeURIComponent(d.id)}`}>Edit Driver</Link>
                        {overall === 'Not Compliant' && (
                          <button disabled={notifyingDriverId === d.id} onClick={() => notifyDriver(d, licenseStatus, expiry)}>
                            {notifyingDriverId === d.id ? 'Sending...' : 'Notify Driver'}
                          </button>
                        )}
                        <button onClick={() => toggleStatus(d)}>{/suspend/i.test(d.status || '') ? 'Enable Driver' : 'Suspend Driver'}</button>
                      </ActionMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
