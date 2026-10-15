import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trips, Drivers, Vehicles } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { initials } from './fmUtils';
import { useLiveSync } from '../../hooks/useLiveSync';
import TripPosition from '../../components/TripPosition';

export default function FmLiveTracking() {
  const [params] = useSearchParams();
  const tripId = params.get('id') || '';

  const [subtitle, setSubtitle] = useState('Loading trip...');
  usePageHeader('Trip Detail', subtitle);

  const [trip, setTrip] = useState(null);
  const [driver, setDriver] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [state, setState] = useState('loading');

  async function load() {
    if (!tripId) {
      setState('no-trip');
      setSubtitle('No trip selected');
      return;
    }
    try {
      const t = await Trips.getOne(tripId);
      if (!t) throw new Error('Trip not found');
      const [drivers, vehicles] = await Promise.all([Drivers.getAll(), Vehicles.getAll()]);
      const d = (drivers || []).find((dr) => (dr.name || '').trim().toLowerCase() === (t.driver || '').trim().toLowerCase());
      const v = (vehicles || []).find((vh) => (vh.plate || vh.plateNumber || '').trim().toLowerCase() === (t.vehicle || '').trim().toLowerCase());
      setTrip(t);
      setDriver(d || null);
      setVehicle(v || null);
      setSubtitle(`Detailed view of trip ${t.id}`);
      setState('ok');
    } catch (e) {
      console.error('Failed to load trip detail:', e);
      setState('error');
      setSubtitle('Trip not found');
    }
  }

  useEffect(() => {
    load();
  }, [tripId]);
  useLiveSync(load, { enabled: Boolean(tripId) });

  if (state === 'no-trip') {
    return <div style={{ padding: 24, textAlign: 'center', color: '#ff8d8d' }}>No trip selected.</div>;
  }
  if (state === 'error') {
    return <div style={{ padding: 24, textAlign: 'center', color: '#ff8d8d' }}>Unable to load this trip. It may no longer exist.</div>;
  }
  if (state === 'loading' || !trip) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>Loading trip details...</div>;
  }

  const statusClass = /complet|deliver/i.test(trip.status || '')
    ? 'pill-green'
    : /transit|active|queue/i.test(trip.status || '')
    ? 'pill-blue'
    : /cancel/i.test(trip.status || '')
    ? 'pill-red'
    : 'pill-yellow';

  return (
    <>
      <section className="panel" style={{ padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--yellow)' }}>
              {trip.id} <span className={`pill ${statusClass}`} style={{ marginLeft: 8 }}>{trip.status || '--'}</span>
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              ◉ {trip.pickup || '--'} → {trip.destination || '--'} · {trip.distance || 'Distance not available'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => window.print()}>
              Download Report
            </button>
          </div>
        </div>
      </section>
      <div className="split" style={{ gridTemplateColumns: '1.25fr .9fr' }}>
        <div>
          <section className="panel">
            <div className="panel-head">
              <div className="panel-title">➤ Route Overview</div>
            </div>
            <div className="panel-body">
              <div className="detail-card" style={{ margin: 0 }}>
                <div className="muted">Pickup</div>
                <strong>{trip.pickup || 'Not provided'}</strong>
                <div className="muted" style={{ marginTop: 16 }}>Drop-off</div>
                <strong>{trip.destination || 'Not provided'}</strong>
                <TripPosition position={trip.lastPosition} />
              </div>
              <div className="mini-stats">
                <div className="mini-stat">
                  <div className="big">{trip.distance || '--'}</div>
                  <div className="muted">Distance</div>
                </div>
                <div className="mini-stat">
                  <div className="big">{trip.startTime || '--'}</div>
                  <div className="muted">Start Time</div>
                </div>
                <div className="mini-stat">
                  <div className="big">{trip.status || '--'}</div>
                  <div className="muted">Status</div>
                </div>
              </div>
            </div>
          </section>
        </div>
        <div className="side-cards">
          <div className="detail-card">
            <div className="panel-title" style={{ marginBottom: 14 }}>
              ◌ Driver
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', background: '#222', borderRadius: 16, padding: 14 }}>
              <div className="avatar">{initials(trip.driver || 'D')}</div>
              <div>
                <strong>{trip.driver || 'Not assigned'}</strong>
                <div className="muted">
                  {driver?.id || '--'} · ★ {driver?.rating || '--'}
                </div>
                <div className="muted">{driver?.phone || '--'}</div>
              </div>
            </div>
          </div>
          {trip.feedback && (
            <div className="detail-card">
              <div className="panel-title" style={{ marginBottom: 14 }}>Customer Feedback</div>
              <div style={{ color: 'var(--yellow)', fontSize: 20, fontWeight: 900, marginBottom: 8 }}>
                ★ {trip.feedback.rating}/5
              </div>
              <div className="muted">{trip.feedback.comment || 'No written comment was provided.'}</div>
              {(trip.feedback.deliveryQuality || trip.feedback.driverBehavior) && (
                <div className="muted" style={{ marginTop: 10 }}>
                  Delivery quality: {trip.feedback.deliveryQuality || '--'} · Driver behavior: {trip.feedback.driverBehavior || '--'}
                </div>
              )}
            </div>
          )}
          <div className="detail-card">
            <div className="panel-title" style={{ marginBottom: 14 }}>
              ◍ Vehicle
            </div>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="mini">
                <strong>Plate</strong>
                {trip.vehicle || '--'}
              </div>
              <div className="mini">
                <strong>Type</strong>
                {vehicle?.type || '--'}
              </div>
              <div className="mini">
                <strong>Capacity</strong>
                {vehicle?.capacity || '--'}
              </div>
              <div className="mini">
                <strong>Status</strong>
                {vehicle?.status || '--'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
