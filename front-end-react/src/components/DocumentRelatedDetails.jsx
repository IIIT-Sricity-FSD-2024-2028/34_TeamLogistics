import { useEffect, useState } from 'react';
import { Deliveries, Drivers, Trips, Vehicles } from '../api/namespaces';
import Modal from './Modal';

const normalize = (value) => String(value || '').trim().toLowerCase();

export function getDocumentOwnerTypeLabel(document) {
  const ownerType = normalize(document?.ownerType);
  if (ownerType === 'delivery') return 'Trip / Delivery';
  if (ownerType === 'driver') return 'Driver';
  if (ownerType === 'vehicle') return 'Vehicle';
  if (ownerType === 'business-client') return 'Business Client';
  return document?.ownerType || 'Unknown';
}

export function getDocumentOwnerLabel(document) {
  const ownerType = normalize(document?.ownerType);
  if (ownerType === 'delivery') return document?.delivery || 'Not linked';
  if (ownerType === 'driver') return document?.driver || 'Not linked';
  if (ownerType === 'vehicle') return document?.vehicle || 'Not linked';
  return document?.delivery || document?.driver || document?.vehicle || 'Not linked';
}

function Detail({ label, value, full = false }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined, padding: 14, border: '1px solid #2a2a2a', borderRadius: 14, background: '#111' }}>
      <div style={{ color: '#8f8f8f', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ color: '#fff', fontWeight: 700, overflowWrap: 'anywhere' }}>{value || '--'}</div>
    </div>
  );
}

export default function DocumentRelatedDetails({ document, onClose, standalone = false }) {
  const [related, setRelated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadRelatedRecord() {
      setLoading(true);
      setError('');
      setRelated(null);

      try {
        const ownerType = normalize(document?.ownerType);
        if (ownerType === 'vehicle') {
          const vehicles = await Vehicles.getAll();
          const owner = normalize(document?.vehicle);
          const vehicle = (vehicles || []).find((item) =>
            [item.id, item.plate, item.plateNumber, item.vehicleNumber].some((value) => normalize(value) === owner),
          );
          if (!vehicle) throw new Error(`Vehicle ${document?.vehicle || ''} was not found.`);
          if (!cancelled) setRelated({ kind: 'vehicle', record: vehicle });
          return;
        }

        if (ownerType === 'driver') {
          const drivers = await Drivers.getAll();
          const owner = normalize(document?.driver);
          const driver = (drivers || []).find((item) =>
            [item.id, item.name, item.driver, item.email].some((value) => normalize(value) === owner),
          );
          if (!driver) throw new Error(`Driver ${document?.driver || ''} was not found.`);
          if (!cancelled) setRelated({ kind: 'driver', record: driver });
          return;
        }

        if (ownerType === 'delivery') {
          const deliveryId = document?.delivery || '';
          const [trips, delivery] = await Promise.all([
            Trips.getAll(),
            deliveryId ? Deliveries.getOne(deliveryId).catch(() => null) : Promise.resolve(null),
          ]);
          const owner = normalize(deliveryId);
          const trip = (trips || []).find((item) =>
            [item.id, item.request, item.deliveryId, item.deliveryRequestId].some((value) => normalize(value) === owner),
          );
          if (!trip && !delivery) throw new Error(`Trip or delivery ${deliveryId} was not found.`);
          if (!cancelled) setRelated({ kind: 'trip', record: trip, delivery });
          return;
        }

        throw new Error('This document type does not have a linked trip, driver, or vehicle.');
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Failed to load the related record.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRelatedRecord();
    return () => {
      cancelled = true;
    };
  }, [document]);

  const record = related?.record;
  const delivery = related?.delivery;
  const routePickup = record?.pickup || record?.pickupLocation || delivery?.pickup;
  const routeDrop = record?.destination || record?.dropoff || record?.dropLocation || delivery?.dropoff || delivery?.destination;

  const content = (
      <div style={{ maxWidth: 820, margin: '0 auto', borderRadius: 20, border: '1px solid #2a2a2a', background: '#181818', color: '#fff', boxShadow: '0 24px 70px rgba(0,0,0,.55)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '20px 22px', borderBottom: '1px solid #2a2a2a' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>Document & Related Details</div>
            <div style={{ color: '#9ca3af', marginTop: 5 }}>{document?.id || '--'} · {document?.documentType || 'Document'}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: '1px solid #3a3a3a', borderRadius: 10, background: '#111', color: '#fff', width: 38, height: 38, cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        <div style={{ padding: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 12, color: '#ffd400' }}>Document Information</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <Detail label="Document ID" value={document?.id} />
            <Detail label="Document Type" value={document?.documentType} />
            <Detail label="Related Type" value={getDocumentOwnerTypeLabel(document)} />
            <Detail label="Related Record" value={getDocumentOwnerLabel(document)} />
            <Detail label="File Name" value={document?.fileName} />
            <Detail label="Status" value={document?.status} />
            <Detail label="Issue Date" value={document?.issueDate} />
            <Detail label="Expiry Date" value={document?.expiryDate || 'Not applicable'} />
          </div>

          <div style={{ fontSize: 15, fontWeight: 900, margin: '24px 0 12px', color: '#ffd400' }}>Related Record</div>
          {loading && <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Loading related details...</div>}
          {!loading && error && <div style={{ padding: 18, border: '1px solid #7f1d1d', borderRadius: 14, background: '#2a1111', color: '#fecaca' }}>{error}</div>}

          {!loading && related?.kind === 'trip' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <Detail label="Trip ID" value={record?.id || 'Trip not created'} />
              <Detail label="Delivery ID" value={record?.request || delivery?.id || document?.delivery} />
              <Detail label="Customer" value={record?.customer || delivery?.customer || delivery?.client} />
              <Detail label="Status" value={record?.status || delivery?.status} />
              <Detail label="Driver" value={record?.driver || delivery?.driver || 'Not assigned'} />
              <Detail label="Vehicle" value={record?.vehicle || delivery?.vehicle || 'Not assigned'} />
              <Detail label="Pickup" value={routePickup} full />
              <Detail label="Destination" value={routeDrop} full />
            </div>
          )}

          {!loading && related?.kind === 'driver' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <Detail label="Driver ID" value={record?.id} />
              <Detail label="Name" value={record?.name || record?.driver} />
              <Detail label="Status" value={record?.status} />
              <Detail label="Phone" value={record?.phone} />
              <Detail label="Email" value={record?.email} />
              <Detail label="License" value={record?.license || record?.licenseNumber} />
              <Detail label="Assigned Vehicle" value={record?.vehicle || 'Not assigned'} />
              <Detail label="Zone" value={record?.zone} />
            </div>
          )}

          {!loading && related?.kind === 'vehicle' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <Detail label="Vehicle ID" value={record?.id} />
              <Detail label="Plate Number" value={record?.plate || record?.plateNumber} />
              <Detail label="Type" value={record?.type} />
              <Detail label="Capacity" value={record?.capacity} />
              <Detail label="Status" value={record?.status} />
              <Detail label="Assigned Driver" value={record?.assignedDriver || 'Not assigned'} />
              <Detail label="Last Maintenance" value={record?.maintenance || record?.lastMaintenance} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 22px 22px' }}>
          <button type="button" onClick={onClose} style={{ border: 0, borderRadius: 12, padding: '11px 22px', background: '#ffd400', color: '#111', fontWeight: 900, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
  );

  if (standalone) return content;
  return <Modal onClose={onClose}>{content}</Modal>;
}
