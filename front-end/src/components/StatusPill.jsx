export default function StatusPill({ value }) {
  const text = String(value || '');
  const slug = text.toLowerCase().replace(/\s+/g, '-');
  return <span className={`status-pill status-${slug}`}>{text}</span>;
}
