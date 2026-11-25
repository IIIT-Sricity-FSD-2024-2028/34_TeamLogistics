import ParcelLabel from './ParcelLabel';
import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGetDeliveriesQuery, useGetTrackingQuery, useSetMissingRecipientMutation, useIssueDeliveryOtpMutation } from '../../redux/businessClientApi';
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
  usePageStyleScope('bc-live-tracking');
  const [params] = useSearchParams();
  const deliveryIdFromUrl = params.get('id');
  const defaultQuery = useGetDeliveriesQuery({page:1,limit:1,view:'active'}, {skip:Boolean(deliveryIdFromUrl)});
  const selectedId = deliveryIdFromUrl || defaultQuery.currentData?.items?.[0]?.id;
  const tracking = useGetTrackingQuery(selectedId,{skip:!selectedId});
  const [issueDeliveryOtp, otpRequest] = useIssueDeliveryOtpMutation();
  const [otpMessage, setOtpMessage] = useState('');
  const [saveRecipient] = useSetMissingRecipientMutation();
  const record = tracking.currentData;
  const delivery = record?.delivery;
  const loading = defaultQuery.isLoading || tracking.isLoading;
  const failed = defaultQuery.isError || tracking.isError || (!loading && !delivery);
  const vm = useMemo(() => {
    if (loading || failed || !delivery) return null;
    const {trip,driver,vehicle} = record;

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
      ? `${vehicle.type || vehicle.category || 'Vehicle'} – ${vehicle.plate || vehicle.plateNumber || vehicle.registrationNumber || vehicle.vehicleNumber || vehicle.id}`
      : trip?.vehicle || 'Vehicle not assigned';

    const packageSize =
      delivery.packageDimensions && delivery.packageDimensions.length
        ? `${delivery.packageDimensions.length} × ${delivery.packageDimensions.width} × ${delivery.packageDimensions.height} ${delivery.packageDimensions.unit || 'cm'}`
        : 'Not available';

    return {
      position: trip?.lastPosition || delivery.lastPosition,
      etaTime: String(eta),
      trackingId: `#${trackingId}`,
      deliveryMethod: String(deliveryMethod),
      packageWeight: delivery.weight ? delivery.weight + ' kg' : extractWeight(packageText),
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
      deliveryOtp: delivery.deliveryOtp,
    };
  }, [delivery, record, loading, failed]);

  const v = (val) => (failed ? 'Not available' : loading ? 'Loading...' : val);
  const stage = deliveryStage(vm?.status);
  const handoffHistory = vm?.statusHistory?.some((event) => event.status === 'Attempt Failed') ? vm.statusHistory : null;
  const trackingSteps = [
    ['Request Submitted', 'Your request is stored and visible to the fleet manager.', 'requested'],
    ['Driver Assigned', vm?.driverName && vm.driverName !== 'Driver not assigned' ? vm.driverName : 'Waiting for fleet assignment', 'assigned'],
    ['Driver Accepted', 'The assigned driver has accepted the delivery.', 'accepted'],
    ['Package Picked Up', vm?.pickupInfo, 'picked up'],
    ['In Transit', vm?.transitInfo, 'in transit'],
    ['Delivered', vm?.completeInfo ? String(vm.completeInfo).replace('Pending delivery', 'Delivered') : 'Delivery completed', 'delivered'],
  ];

  async function generateDeliveryOtp() {
    if (!delivery?.id) return;
    setOtpMessage('');
    try {
      const result = await issueDeliveryOtp(delivery.id).unwrap();
      setOtpMessage(result.message || 'A new delivery OTP was generated.');
    } catch (error) {
      setOtpMessage(error.message || 'Could not generate the delivery OTP.');
    }
  }

  return (
    <div className="track-layout">
      <h1 className="page-title">Delivery Tracking</h1>
      <p className="page-subtitle">Status shown directly from the shared backend workflow</p>
      {delivery?.requiresParcelScan && <ParcelLabel id={delivery.id} />}
      <TripPosition position={vm?.position} />

      <div className="track-grid">
        <div>
          <div className="yellow-banner">
            <div className="small">Estimated Arrival</div>
            <div className="big">{failed ? 'Unavailable' : loading ? 'Loading...' : vm.etaTime}</div>
            <div>{failed ? 'Could not load tracking data' : 'Estimated arrival'}</div>
          </div>

          {stage === 4 && (
            <div className="card" style={{ marginBottom: 24, padding: 24, border: '1px solid rgba(255,212,0,.45)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ margin: '0 0 8px' }}>Delivery Confirmation OTP</h2>
                  <p style={{ margin: 0, color: '#aaa' }}>
                    {vm?.deliveryOtp?.issued
                      ? 'The recipient receives a handoff code. It expires after ten minutes.'
                      : 'Generate an OTP when the driver is ready to hand over the package.'}
                  </p>
                </div>
                <button className="btn yellow" type="button" disabled={otpRequest.isLoading || !delivery?.recipientEmail} onClick={generateDeliveryOtp}>
                  {otpRequest.isLoading ? 'Generating...' : vm?.deliveryOtp?.issued ? 'Generate New OTP' : 'Generate OTP'}
                </button>
              </div>
              {!delivery?.recipientEmail && <form key={delivery?.id} onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                try {
                  await saveRecipient({ id: delivery.id, recipientName: data.get('name'), recipientEmail: data.get('email') }).unwrap();
                  setOtpMessage('Recipient saved. You can now send the code.');
                } catch (error) { setOtpMessage(error.message); }
              }}>
                <label>Recipient name<input className="input" name="name" required /></label>
                <label>Recipient email<input className="input" type="email" name="email" required /></label>
                <button className="btn" type="submit">Save handoff recipient</button>
              </form>}
              {otpMessage && <div role="status" style={{ marginTop: 12 }}>{otpMessage}</div>}
            </div>
          )}

          <div className="card progress-card">
            <h2>Delivery Progress</h2>
            <div className="t-sub" style={{ marginBottom: 18 }}>Backend status: <strong>{v(vm?.status)}</strong></div>

            <div className="timeline">
              {handoffHistory ? handoffHistory.map((event, index) => (
                <div className="t-item" key={`${event.at}-${index}`}>
                  <div className="t-dot complete">✓</div>
                  <div className="t-title">{event.status === 'In Transit' && event.source === 'fleet-manager' ? 'Second attempt authorised' : event.status}</div>
                  {event.reason && <div className="t-sub">{event.reason}</div>}
                  {event.at && <div className="t-sub">{formatStatusTime(event.at)}</div>}
                </div>
              )) : trackingSteps.map(([label, detail, historyStatus], index) => {
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

    </div>
  );
}
