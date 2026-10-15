export default function TripPosition({ position }) {
  if (!position) return <p style={{ color: '#9ca3af' }}>No driver location has been shared yet.</p>;
  const { latitude, longitude, accuracy, recordedAt } = position;
  const age = Date.now() - new Date(recordedAt).getTime();
  return (
    <div style={{ marginTop: 16 }}>
      <div>{age > 60000 ? 'Last known driver position' : 'Driver position'}: {latitude.toFixed(5)}, {longitude.toFixed(5)}</div>
      <div style={{ color: '#9ca3af', marginTop: 6 }}>
        Recorded: {new Date(recordedAt).toLocaleString('en-IN')}
        {accuracy != null && ` · Accuracy: ${Math.round(accuracy)} m`}
      </div>
      <a href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`} target="_blank" rel="noopener noreferrer">View on map</a>
    </div>
  );
}
