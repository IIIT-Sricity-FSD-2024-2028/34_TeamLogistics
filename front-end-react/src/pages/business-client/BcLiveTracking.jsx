import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Deliveries, Trips, Drivers, Vehicles } from '../../api/namespaces';
import { getArray } from './bcUtils';
import { useLiveSync } from '../../hooks/useLiveSync';
import TripPosition from '../../components/TripPosition';

function extractWeight(packageText = '') {
  const text = String(packageText);
  const weightMatch = text.match(/(\d+)\s*(kg|kgs|lb|lbs)/i);
  return weightMatch ? weightMatch[0] : 'Not available';
}

function deliveryStage(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'delivered' || value === 'completed') return 5;
  if (value === 'in transit') return 4;
  if (value === 'picked up') return 3;
  if (value === 'accepted') return 2;
  if (value === 'assigned') return 1;
  if (value === 'requested' || value === 'pending' || value === 'queued') return 0;
  return -1;
}

function formatStatusTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-IN');
}

export default function BcLiveTracking() {
  const [params] = useSearchParams();
  const deliveryIdFromUrl = params.get('id');
  const [vm, setVm] = useState(null);
  const [failed, setFailed] = useState(false);

  async function load() {
      try {
        const [deliveriesResult, tripsResult, driversResult, vehiclesResult] = await Promise.all([
          Deliveries.getAll(),
          Trips.getAll(),
          Drivers.getAll(),
          Vehicles.getAll(),
        ]);

        const deliveries = getArray(deliveriesResult);
        const trips = getArray(tripsResult);
        const drivers = getArray(driversResult);
        const vehicles = getArray(vehiclesResult);

        let delivery = null;

        if (deliveryIdFromUrl) {
          try {
            delivery = await Deliveries.getOne(deliveryIdFromUrl);
          } catch {
            delivery = deliveries.find((d) => String(d.id) === String(deliveryIdFromUrl));
          }
        }

        if (!delivery) {
          delivery =
            deliveries.find((d) => {
              const s = String(d.status || '').toLowerCase();
              return s !== 'delivered' && s !== 'cancelled' && s !== 'completed';
            }) || deliveries[0];
        }

        if (!delivery) throw new Error('No delivery found.');

        const trip =
          trips.find((t) => String(t.deliveryId) === String(delivery.id)) ||
          trips.find((t) => String(t.delivery_id) === String(delivery.id)) ||
          trips.find((t) => String(t.request) === String(delivery.id)) ||
          trips.find((t) => String(t.requestId) === String(delivery.id)) ||
          trips.find((t) => String(t.deliveryRequestId) === String(delivery.id)) ||
          trips.find((t) => String(t.id) === String(delivery.tripId)) ||
          null;

        const driver =
          drivers.find((d) => String(d.id) === String(delivery.driverId)) ||
          drivers.find((d) => String(d.id) === String(trip?.driverId)) ||
          drivers.find((d) => String(d.name) === String(trip?.driver)) ||
          drivers.find((d) => String(d.fullName) === String(trip?.driver)) ||
          null;

        const vehicle =
          vehicles.find((v) => String(v.id) === String(delivery.vehicleId)) ||
          vehicles.find((v) => String(v.id) === String(trip?.vehicleId)) ||
          vehicles.find((v) => String(v.plateNumber) === String(trip?.vehicle)) ||
          vehicles.find((v) => String(v.registrationNumber) === String(trip?.vehicle)) ||
          vehicles.find((v) => String(v.vehicleNumber) === String(trip?.vehicle)) ||
          null;

        const trackingId = delivery.id || delivery.trackingId || delivery.tracking_id || 'Not available';
        const deliveryMethod = delivery.type || delivery.deliveryMethod || delivery.method || 'Standard Delivery';
        const packageText = delivery.package || delivery.packageDetails || delivery.packageInfo || delivery.description || '';

        const pickupLocation = delivery.pickup || delivery.pickupLocation || trip?.pickup || trip?.pickupLocation || 'Pickup location not available';

        const dropLocation =
          delivery.dropoff || delivery.dropLocation || delivery.destination || trip?.destination || trip?.dropoff || 'Drop location not available';

        const liveLocation = vehicle?.location || vehicle?.currentLocation || trip?.currentLocation || delivery.currentLocation || 'Location not available';

        const distance = trip?.distance || delivery.distance || 'Distance not available';
        const eta = trip?.eta || delivery.eta || delivery.estimatedArrival || delivery.estimatedTime || 'Not available';

        const driverName = driver?.name || driver?.fullName || trip?.driver || delivery.driver || 'Driver not assigned';
        const driverPhone = driver?.phone || driver?.contact || driver?.mobile || trip?.phone || delivery.driverPhone || 'Contact not available';
        const driverRating = driver?.rating ? `Professional Driver • ${driver.rating}★ Rating` : 'Professional Driver';

        const vehicleText = vehicle
          ? `${vehicle.type || vehicle.category || 'Vehicle'} – ${vehicle.plateNumber || vehicle.registrationNumber || vehicle.vehicleNumber || vehicle.id}`
          : trip?.vehicle || 'Vehicle not assigned';

        const packageSize =
          delivery.packageDimensions && delivery.packageDimensions.length
            ? `${delivery.packageDimensions.length} × ${delivery.packageDimensions.width} × ${delivery.packageDimensions.height} ${delivery.packageDimensions.unit || 'cm'}`
            : 'Not available';

        setVm({
          position: trip?.lastPosition || delivery.lastPosition,
          etaTime: String(eta),
          trackingId: `#${trackingId}`,
          deliveryMethod: String(deliveryMethod),
          packageWeight: extractWeight(packageText),
          packageTypeDisplay: delivery.packageType || 'Not available',
          packageSize,
          pickupInfo: `${pickupLocation} • Picked up`,
          transitInfo: `Vehicle en route to ${dropLocation}. Distance: ${distance}`,
          liveLocation: `Last reported location: ${liveLocation}`,
          completeInfo: `${dropLocation} • Pending delivery`,
          driverName: String(driverName),
          driverRating,
          driverContact: String(driverPhone),
          vehicleInfo: vehicleText,
          status: trip?.status || delivery.status || 'Status unavailable',
          statusHistory: trip?.statusHistory || delivery.statusHistory || [],
        });
        setFailed(false);
      } catch (error) {
        console.error('Delivery status backend sync failed:', error);
        setFailed(true);
      }
  }

  useEffect(() => {
    load();
  }, [deliveryIdFromUrl]);
  useLiveSync(load);

  const loading = !vm && !failed;
  const v = (val) => (failed ? 'Not available' : loading ? 'Loading...' : val);
  const stage = deliveryStage(vm?.status);
  const trackingSteps = [
    ['Request Submitted', 'Your request is stored and visible to the fleet manager.', 'requested'],
    ['Driver Assigned', vm?.driverName && vm.driverName !== 'Driver not assigned' ? vm.driverName : 'Waiting for fleet assignment', 'assigned'],
    ['Driver Accepted', 'The assigned driver has accepted the delivery.', 'accepted'],
    ['Package Picked Up', vm?.pickupInfo, 'picked up'],
    ['In Transit', vm?.transitInfo, 'in transit'],
    ['Delivered', vm?.completeInfo ? String(vm.completeInfo).replace('Pending delivery', 'Delivered') : 'Delivery completed', 'delivered'],
  ];

  return (
    <div className="track-layout">
      <h1 className="page-title">Delivery Tracking</h1>
      <p className="page-subtitle">Status shown directly from the shared backend workflow</p>
      <TripPosition position={vm?.position} />

      <div className="track-grid">
        <div>
          <div className="yellow-banner">
            <div className="small">Estimated Arrival</div>
            <div className="big">{failed ? 'Unavailable' : loading ? 'Loading...' : vm.etaTime}</div>
            <div>{failed ? 'Could not load tracking data' : 'Estimated arrival'}</div>
          </div>

          <div className="card progress-card">
            <h2>Delivery Progress</h2>
            <div className="t-sub" style={{ marginBottom: 18 }}>Backend status: <strong>{v(vm?.status)}</strong></div>

            <div className="timeline">
              {trackingSteps.map(([label, detail, historyStatus], index) => {
                const complete = stage > index || (stage === 5 && index === 5);
                const current = stage === index && stage < 5;
                const historyEvent = (vm?.statusHistory || []).find(
                  (event) => String(event.status || '').toLowerCase() === historyStatus || (historyStatus === 'delivered' && String(event.status || '').toLowerCase() === 'completed'),
                );
                const eventTime = formatStatusTime(historyEvent?.at);
                return (
                  <div className="t-item" key={label} style={{ opacity: complete || current ? 1 : 0.35, paddingBottom: index === trackingSteps.length - 1 ? 0 : undefined }}>
                    <div className={`t-dot${complete ? ' complete' : ''}`}>{complete ? '✓' : index + 1}</div>
                    <div className="t-title">
                      {label} <span className={`pill ${complete ? 'green' : 'bright'}`}>{complete ? 'Complete' : current ? vm?.status || 'Current' : 'Pending'}</span>
                    </div>
                    <div className="t-sub">{complete || current ? v(detail) : 'Not reached yet'}</div>
                    {eventTime && <div className="t-sub">Recorded: {eventTime}</div>}
                    {label === 'In Transit' && current && (
                      <div className="live-box">
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Reported Location</div>
                        <div style={{ marginTop: 10, color: '#d4d4d4' }}>{v(vm?.liveLocation)}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <div className="card side-card">
            <h3>Package Information</h3>

            <div className="kv">
              <div className="k">Tracking ID</div>
              <div className="v" style={{ color: 'var(--yellow)' }}>
                {v(vm?.trackingId)}
              </div>
            </div>
            <div className="kv">
              <div className="k">Delivery Method</div>
              <div className="v">{v(vm?.deliveryMethod)}</div>
            </div>
            <div className="kv">
              <div className="k">Package Type</div>
              <div className="v">{v(vm?.packageTypeDisplay)}</div>
            </div>
            <div className="kv">
              <div className="k">Estimated Weight</div>
              <div className="v">{v(vm?.packageWeight)}</div>
            </div>
            <div className="kv" style={{ marginBottom: 0 }}>
              <div className="k">Package Dimensions</div>
              <div className="v">{v(vm?.packageSize)}</div>
            </div>
          </div>

          <div className="card side-card" style={{ marginTop: 24 }}>
            <h3>Driver Information</h3>

            <div className="driver-head">
              <div className="driver-avatar">
                <svg viewBox="0 0 24 24">
                  <path d="M20 21a8 8 0 0 0-16 0"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{v(vm?.driverName)}</div>
                <div style={{ marginTop: 6, color: '#9f9f9f' }}>{v(vm?.driverRating)}</div>
              </div>
            </div>

            <div className="driver-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg viewBox="0 0 24 24">
                  <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 1.8l-1.3 1.3a16 16 0 0 0 6.5 6.5l1.3-1.3a2 2 0 0 1 1.8-.6l3 .5A2 2 0 0 1 22 16.9z"></path>
                </svg>
                <div>
                  <div className="k">Contact</div>
                  <div className="v">{v(vm?.driverContact)}</div>
                </div>
              </div>
            </div>

            <div className="driver-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg viewBox="0 0 24 24">
                  <path d="M10 17h4V5H2v12h2"></path>
                  <path d="M14 8h4l4 4v5h-2"></path>
                  <circle cx="7" cy="17" r="2"></circle>
                  <circle cx="17" cy="17" r="2"></circle>
                </svg>
                <div>
                  <div className="k">Vehicle</div>
                  <div className="v">{v(vm?.vehicleInfo)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .bc-content .track-layout{width:100%;max-width:none;margin:0;padding:0;box-sizing:border-box}
        .bc-content .track-grid{width:100%;max-width:none}
        .bc-content .track-grid > div{min-width:0}
        .bc-content .yellow-banner,.bc-content .card{box-sizing:border-box}
        .bc-content .track-grid{align-items:start}
        @media (max-width:900px){ .bc-content .track-grid{grid-template-columns:1fr} }
      `}</style>
    </div>
  );
}
