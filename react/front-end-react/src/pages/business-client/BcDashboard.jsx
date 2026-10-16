import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Deliveries, Transactions } from '../../api/namespaces';
import { getCurrentClientNames, belongsToCurrentClient } from './bcUtils';
import { useLiveSync } from '../../hooks/useLiveSync';
import { summarizeDeliveries } from './deliverySummary';


export default function BcDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, ...summarizeDeliveries([], []).counts });
  const [error, setError] = useState('');

  async function load() {
    try {
      const [deliveriesResult, invoicesResult, clientNames] = await Promise.all([
        Deliveries.getAll(),
        Transactions.getInvoices(),
        getCurrentClientNames(),
      ]);
      const deliveries = Array.isArray(deliveriesResult) ? deliveriesResult : deliveriesResult?.data || [];
      const invoices = Array.isArray(invoicesResult) ? invoicesResult : invoicesResult?.data || [];
      const allDeliveries = deliveries.filter((d) => belongsToCurrentClient(d, clientNames));
      const myInvoices = invoices.filter((inv) => belongsToCurrentClient({ customer: inv.client }, clientNames));
      const summary = summarizeDeliveries(allDeliveries, myInvoices);
      setStats({ total: summary.total, ...summary.counts });
      setError('');
    } catch (e) {
      console.error('Failed to sync business dashboard:', e);
      setError('Could not refresh the dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);
  useLiveSync(load);

  return (
    <>
      <div className="hero-card">
        <h1 className="page-title medium">
          Welcome Back to Deliver<span className="accent">Sync</span>
        </h1>
        <p className="page-subtitle">
          {loading ? 'Loading dashboard...' : 'Your logistics command center.'}
        </p>
        <Link className="btn yellow cta" to="/business-client/create-delivery">
          <span className="ico">
            <svg viewBox="0 0 24 24">
              <path d="M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z"></path>
              <path d="M12 22V11"></path>
              <path d="M20 6.5l-8 4.5-8-4.5"></path>
            </svg>
          </span>
          Create New Delivery
        </Link>
      </div>

      {error && <p role="alert" style={{ color: '#f3a5a5' }}>{error}</p>}
      <div className="stat-grid dashboard-compact">
        {[
          ['Total Deliveries', stats.total, 'All delivery requests'],
          ['Delivered & Paid', stats.deliveredPaid, 'Delivery and payment completed'],
          ['Delivered · Payment Pending', stats.deliveredPaymentPending, 'Unpaid or awaiting an invoice'],
          ['Cancelled', stats.cancelled, 'Cancelled delivery requests'],
          ['Rejected', stats.rejected, 'Rejected delivery requests'],
          ...(stats.other ? [['Other / Billing Review', stats.other, 'Other invoice or delivery statuses']] : []),
        ].map(([label, count, detail]) => (
          <div className="card compact-card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{loading ? '—' : count}</div>
            <div className="stat-foot">{detail}</div>
          </div>
        ))}
      </div>

    </>
  );
}
