import { Link } from 'react-router-dom';

export default function BrandLogo({ href = '/', size = 'md', sub = '' }) {
  return (
    <Link className={`ds-brand-link ds-brand-${size}`} to={href}>
      <div className="ds-brand-icon">
        <img src="/assets/img/fleet-logo-icon.png" alt="DeliverSync Logo" />
      </div>
      <div className="ds-brand-text">
        <span className="ds-brand-word">
          <span className="ds-deliver">Deliver</span>
          <span className="ds-sync">Sync</span>
        </span>
        {sub && <span className="ds-brand-sub">{sub}</span>}
      </div>
    </Link>
  );
}
