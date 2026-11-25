import { useEffect, useState } from 'react';

export default function TripPosition({ position }) {
  const [, setNow] = useState(0);
  const measurement = position?.measuredAt || position?.recordedAt;
  useEffect(() => {
    const timestamp = Date.parse(measurement);
    const delay = timestamp + 60001 - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [measurement]);
  if (!position) return <p style={{ color: '#9ca3af' }}>No driver location has been shared yet.</p>;
  const { latitude, longitude, accuracy } = position;
  const age = Date.now() - new Date(measurement).getTime();
  return (
    <div style={{ marginTop: 16 }}>
      <div>{age > 60000 ? 'Last known driver position' : 'Driver position'}: {latitude.toFixed(5)}, {longitude.toFixed(5)}</div>
      <div style={{ color: '#9ca3af', marginTop: 6 }}>
        Recorded: {new Date(measurement).toLocaleString('en-IN')}
        {accuracy != null && ` · Accuracy: ${Math.round(accuracy)} m`}
      </div>
      {position.nearDrop && age <= 60000 && <div>Within the configured drop-off area</div>}
      <a href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`} target="_blank" rel="noopener noreferrer">View on map</a>
    </div>
  );
}
