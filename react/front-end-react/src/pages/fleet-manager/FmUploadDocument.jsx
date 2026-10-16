import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Documents, Vehicles, Drivers } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { isFutureDate, minimumFutureDate } from '../../utils/dateConstraints';

const vehicleTypes = ['Pollution Certificate', 'Insurance', 'Registration'];
const driverTypes = ['Driver License'];

function optionFromVehicle(vehicle) {
  const plate = vehicle.plate || vehicle.vehicle || vehicle.vehicleNumber || '';
  const id = vehicle.id || '';
  return { value: plate, label: plate && id ? `${plate} - ${id}` : plate || id };
}

function optionFromDriver(driver) {
  const name = driver.name || driver.driver || '';
  const id = driver.id || '';
  return { value: name, label: name && id ? `${name} - ${id}` : name || id };
}

export default function FmUploadDocument() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id') || '';
  const renewalId = searchParams.get('renew') || '';
  const sourceId = editId || renewalId;
  const isEditing = Boolean(editId);
  const isRenewing = Boolean(renewalId);
  const title = isEditing ? 'Edit Document' : isRenewing ? 'Renew Document' : 'Upload Document';
  const subtitle = isEditing
    ? 'Update the selected document details'
    : isRenewing
      ? 'Upload a replacement for the expiring or expired document'
      : 'Add a new document to the fleet management system';

  usePageHeader(title, subtitle);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [kind, setKind] = useState('vehicle');
  const [docType, setDocType] = useState('');
  const [vehicleOptions, setVehicleOptions] = useState([]);
  const [driverOptions, setDriverOptions] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(Boolean(sourceId));
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFormData() {
      try {
        const [vehicles, drivers, document] = await Promise.all([
          Vehicles.getAll(),
          Drivers.getAll(),
          sourceId ? Documents.getOne(sourceId) : Promise.resolve(null),
        ]);
        if (cancelled) return;

        setVehicleOptions((vehicles || []).map(optionFromVehicle).filter((option) => option.value));
        setDriverOptions((drivers || []).map(optionFromDriver).filter((option) => option.value));

        if (document) {
          const ownerType = String(document.ownerType || '').toLowerCase();
          if (ownerType !== 'vehicle' && ownerType !== 'driver') {
            throw new Error('Only vehicle and driver documents can be edited or renewed here.');
          }
          setKind(ownerType);
          setDocType(document.documentType || '');
          setSelectedVehicle(document.vehicle || '');
          setSelectedDriver(document.driver || '');
          setExpiryDate(isEditing ? document.expiryDate || '' : '');
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load document form data:', error);
          setLoadError(error.message || 'Failed to load document details.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFormData();
    return () => {
      cancelled = true;
    };
  }, [sourceId, isEditing]);

  const types = kind === 'vehicle' ? vehicleTypes : driverTypes;

  function setKindAndReset(next) {
    setKind(next);
    setDocType('');
    setSelectedVehicle('');
    setSelectedDriver('');
  }

  async function submit() {
    const entity = kind === 'vehicle' ? selectedVehicle : selectedDriver;
    if (!docType || !entity || !expiryDate || (!isEditing && !file)) {
      showToast('Please complete all required fields.');
      return;
    }
    if (!isFutureDate(expiryDate)) {
      showToast('Expiry date must be in the future.');
      return;
    }

    try {
      setSaving(true);

      if (isEditing) {
        await Documents.update(editId, {
          ownerType: kind,
          vehicle: kind === 'vehicle' ? selectedVehicle : '',
          driver: kind === 'driver' ? selectedDriver : '',
          documentType: docType,
          expiryDate,
        });
        showToast('Document details updated successfully');
      } else {
        const issueDate = new Date().toISOString().slice(0, 10);
        const formData = new FormData();
        formData.append('ownerType', kind);
        formData.append('vehicle', kind === 'vehicle' ? selectedVehicle : '');
        formData.append('driver', kind === 'driver' ? selectedDriver : '');
        formData.append('documentType', docType);
        formData.append('issueDate', issueDate);
        formData.append('expiryDate', expiryDate);
        formData.append('status', 'Submitted');
        formData.append('file', file);

        await Documents.create(formData);
        if (isRenewing) {
          await Documents.update(renewalId, { status: 'Expired' });
        }
        showToast(isRenewing ? 'Replacement document uploaded successfully' : 'Document uploaded successfully');
      }

      navigate('/fleet-manager/documents');
    } catch (error) {
      console.error('Failed to save document to backend:', error);
      showToast(error.message || 'Failed to save document.');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="info-card" style={{ padding: 28, color: '#999', textAlign: 'center' }}>
        Loading document details from the backend...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="info-card" style={{ padding: 28, textAlign: 'center' }}>
        <div style={{ color: '#ff8d8d', marginBottom: 18 }}>{loadError}</div>
        <button className="btn btn-ghost" type="button" onClick={() => navigate('/fleet-manager/documents')}>
          Back to Documents
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="info-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button className="btn btn-square btn-ghost" type="button" onClick={() => navigate('/fleet-manager/documents')}>
            ←
          </button>
          <div>
            <div className="section-title">{title}</div>
            <div className="muted">{subtitle}</div>
          </div>
        </div>

        <div className="upload-grid" style={{ marginBottom: 24 }}>
          <div
            className={`category-card${kind === 'vehicle' ? ' active' : ''}`}
            onClick={() => setKindAndReset('vehicle')}
          >
            <div style={{ fontSize: 48, marginBottom: 10 }}>▤</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Vehicle Documents</div>
            <div className="muted">Insurance, Pollution Certificate</div>
          </div>
          <div
            className={`category-card${kind === 'driver' ? ' active' : ''}`}
            onClick={() => setKindAndReset('driver')}
          >
            <div style={{ fontSize: 48, marginBottom: 10 }}>◌</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Driver Documents</div>
            <div className="muted">Driver License</div>
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Document Type *</label>
            <select value={docType} onChange={(event) => setDocType(event.target.value)}>
              <option value="">Select document type</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {kind === 'vehicle' && (
            <div className="field vehicle-only">
              <label>Select Vehicle *</label>
              <select value={selectedVehicle} onChange={(event) => setSelectedVehicle(event.target.value)}>
                <option value="">Select vehicle</option>
                {vehicleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {kind === 'driver' && (
            <div className="field driver-only">
              <label>Select Driver *</label>
              <select value={selectedDriver} onChange={(event) => setSelectedDriver(event.target.value)}>
                <option value="">Select driver</option>
                {driverOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isEditing && (
            <div className="field">
              <label>{isRenewing ? 'Replacement File *' : 'Upload File *'}</label>
              <div className="file-shell">
                <label className="file-btn" htmlFor="docFile">
                  Choose File
                </label>
                <input
                  id="docFile"
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
                <span className="file-name">{file ? file.name : 'No file chosen'}</span>
              </div>
            </div>
          )}

          <div className="field">
            <label>Expiry Date *</label>
            <input type="date" min={minimumFutureDate()} value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
          </div>
          {!isEditing && <div className="file-note">Accepted: PDF, PNG, JPG (maximum 5 MB)</div>}
        </div>
      </div>

      <div className="upload-actions">
        <button className="btn btn-ghost" type="button" onClick={() => navigate('/fleet-manager/documents')}>
          Cancel
        </button>
        <button className="btn btn-yellow" type="button" disabled={saving} onClick={submit}>
          {saving ? 'Saving...' : isEditing ? 'Save Changes' : isRenewing ? 'Upload Renewal' : 'Upload Document'}
        </button>
      </div>

      <style>{`
        .upload-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
        .category-card{cursor:pointer}
        .field select,.field input[type=date],.field .file-shell{width:100%;background:#0a0a0a;border:1px solid #2a2a2a;border-radius:18px;color:#fff;padding:14px 16px;font:inherit;box-sizing:border-box}
        .file-shell{display:flex;align-items:center;gap:12px;min-height:56px}
        .file-shell input[type=file]{position:absolute;opacity:0;width:.1px;height:.1px;pointer-events:none}
        .file-btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;border-radius:12px;border:1px solid #3a3a3a;background:#111;color:#fff;font-weight:600;cursor:pointer}
        .file-name{font-size:13px;color:#a7a7a7;line-height:1.2}
        .upload-actions{display:flex;gap:12px;margin-top:16px}
        .file-note{font-size:13px;color:#8f8f8f;margin-top:8px}
        @media(max-width:900px){.upload-grid,.form-grid{grid-template-columns:1fr}}
      `}</style>
    </>
  );
}
