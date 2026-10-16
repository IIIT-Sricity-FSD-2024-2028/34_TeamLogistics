import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Drivers } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { pillClass, initials } from './fmUtils';

export default function FmDriverProfile() {
  usePageHeader('Driver Profile', 'Complete driver information and performance');
  const [params] = useSearchParams();
  const id = params.get('id') || '';
  const [driver, setDriver] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await Drivers.getOne(id);
        setDriver(d);
      } catch (e) {
        console.error(e);
        setError(true);
      }
    })();
  }, [id]);

  if (error) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ textAlign: 'center', color: '#ff8d8d', padding: 34 }}>
          Failed to load driver from backend.
        </div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ textAlign: 'center', color: '#888', padding: 24 }}>
          Loading driver profile...
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="hero" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 74, height: 74, borderRadius: 24, background: 'var(--yellow)', display: 'grid', placeItems: 'center', color: '#111', fontSize: 34, fontWeight: 800 }}>
            {initials(driver.name)}
          </div>
          <div>
            <h2 style={{ margin: '0 0 6px' }}>
              {driver.name} <span className={`pill ${pillClass(driver.status)}`}>{driver.status || '--'}</span>
            </h2>
            <p>
              {driver.id} · {driver.phone || '--'} · {driver.email || '--'}
            </p>
            <div className="rating">
              ★★★★★ <span style={{ color: '#ddd', fontSize: 16 }}>{driver.rating || '--'}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link className="btn btn-yellow" to={`/fleet-manager/edit-driver?id=${encodeURIComponent(driver.id)}`}>
            Edit Driver
          </Link>
        </div>
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <div className="panel-title">Driver Information</div>
        </div>
        <div className="panel-body">
          <div className="cards2">
            <div className="mini">
              <strong>Driver ID</strong>
              <span>{driver.id}</span>
            </div>
            <div className="mini">
              <strong>Full Name</strong>
              <span>{driver.name}</span>
            </div>
            <div className="mini">
              <strong>Phone</strong>
              <span>{driver.phone || '--'}</span>
            </div>
            <div className="mini">
              <strong>Email</strong>
              <span>{driver.email || '--'}</span>
            </div>
            <div className="mini">
              <strong>License</strong>
              <span>{driver.license || '--'}</span>
            </div>
            <div className="mini">
              <strong>Assigned Vehicle</strong>
              <span>{driver.vehicle || '--'}</span>
            </div>
            <div className="mini">
              <strong>Last Trip</strong>
              <span>{driver.trip || '--'}</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
