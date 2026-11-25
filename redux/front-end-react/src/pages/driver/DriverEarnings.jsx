import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useMemo } from 'react';
import { useGetTripsQuery, useGetDeliveriesQuery, useGetPayoutsQuery, EMPTY_LIST, queryError } from '../../redux/driverApi';
import { useSession } from '../../auth/SessionContext';
import { usePageHeader } from '../../hooks/usePageHeader';
import Pagination, { usePagination } from '../../components/Pagination';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function formatMoney(amount) {
  const value = Number(amount || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SummaryIcon({ type }) {
  const paths = {
    paid: <><path d="M4 7.5h16v10H4z" /><path d="M7 7.5V5h10v2.5M8 12.5h.01M16 12.5h.01" /></>,
    pending: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5l3 1.5" /></>,
    average: <><path d="M5 19V9M12 19V5M19 19v-7" /><path d="M3 19h18" /></>,
  };

  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">{paths[type]}</svg>;
}

export default function DriverEarnings() {
  usePageStyleScope('driver-earnings');
  usePageHeader('Earnings', 'Your payouts and completed-delivery income');
  const { session } = useSession();
  const driverName = session?.name || '';

  const tripsQuery = useGetTripsQuery();
  const deliveriesQuery = useGetDeliveriesQuery();
  const payoutsQuery = useGetPayoutsQuery();
  const trips = tripsQuery.data || EMPTY_LIST;
  const deliveries = deliveriesQuery.data || EMPTY_LIST;
  const payouts = payoutsQuery.data || EMPTY_LIST;
  const loading = tripsQuery.isLoading || deliveriesQuery.isLoading || payoutsQuery.isLoading;
  const loadError = queryError(tripsQuery, deliveriesQuery, payoutsQuery);
  const load = () => Promise.all([tripsQuery.refetch(), deliveriesQuery.refetch(), payoutsQuery.refetch()]);

  const rows = useMemo(() => {
    const completedTrips = trips.filter((trip) => {
      const assignedDriver = normalize(trip.driver || trip.assignedDriver || trip.driverName);
      return assignedDriver === normalize(driverName) && ['completed', 'delivered'].includes(normalize(trip.status));
    });

    return completedTrips
      .map((trip) => {
        const requestId = trip.request || trip.deliveryId || trip.deliveryRequestId;
        const delivery = deliveries.find((item) => String(item.id) === String(requestId))
          || deliveries.find((item) => String(item.deliveryId) === String(requestId))
          || null;
        const payout = payouts.find((item) => String(item.tripId) === String(trip.id)) || null;
        const completedAt = payout?.paidAt || payout?.approvedAt || payout?.earnedAt || payout?.createdAt
          || trip.completedAt || trip.updatedAt || trip.createdAt;

        return {
          trip,
          payout,
          requestId: requestId || delivery?.id || trip.id,
          customer: trip.customer || trip.client || delivery?.customer || delivery?.client || delivery?.company || 'Customer not available',
          distance: trip.distance || delivery?.distance || 'Not recorded',
          payoutStatus: normalize(payout?.status) === 'paid' ? 'Paid' : 'Unpaid',
          amount: Number(payout?.totalAmount || 0),
          completedAt,
        };
      })
      .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
  }, [trips, deliveries, payouts, driverName]);

  const summary = useMemo(() => rows.reduce((result, row) => {
    result.total += row.amount;
    if (normalize(row.payoutStatus) === 'paid') result.paid += row.amount;
    else if (row.payout) result.pending += row.amount;
    return result;
  }, { total: 0, paid: 0, pending: 0 }), [rows]);

  const periodEarnings = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const sumSince = (start) => rows.reduce((sum, row) => {
      const date = row.completedAt ? new Date(row.completedAt) : null;
      return date && !Number.isNaN(date.getTime()) && date >= start ? sum + row.amount : sum;
    }, 0);

    return {
      today: sumSince(startOfToday),
      week: sumSince(startOfWeek),
      month: sumSince(startOfMonth),
    };
  }, [rows]);

  const average = rows.length ? summary.total / rows.length : 0;
  const paidPercent = summary.total ? Math.round((summary.paid / summary.total) * 100) : 0;
  const payoutPages = usePagination(rows);

  return (
    <section className="content driver-earnings-page">
      {loading ? (
        <div className="driver-earnings-state">Loading your earnings…</div>
      ) : loadError ? (
        <div className="driver-earnings-state error">
          <strong>We couldn’t load your earnings</strong>
          <span>{loadError}</span>
          <button type="button" onClick={() => load()}>Try again</button>
        </div>
      ) : (
        <>
          <div className="driver-earnings-overview">
            <article className="driver-earnings-hero">
              <div className="driver-earnings-hero-copy">
                <span className="driver-earnings-eyebrow">Total earnings</span>
                <strong>{formatMoney(summary.total)}</strong>
                <p>From {rows.length} completed {rows.length === 1 ? 'delivery' : 'deliveries'}</p>
              </div>
              <div className="driver-earnings-progress-block">
                <div className="driver-earnings-progress-label">
                  <span>Paid to date</span>
                  <b>{paidPercent}%</b>
                </div>
                <div className="driver-earnings-progress" aria-label={`${paidPercent}% of earnings paid`}>
                  <span style={{ width: `${paidPercent}%` }} />
                </div>
                <small>{formatMoney(summary.paid)} paid · {formatMoney(summary.pending)} unpaid</small>
              </div>
              <div className="driver-earnings-hero-mark" aria-hidden="true">₹</div>
            </article>

            <article className="driver-period-card">
              <div className="driver-period-heading">
                <div>
                  <span>Earnings snapshot</span>
                  <strong>Recent performance</strong>
                </div>
                <div className="driver-period-pulse"><span /> Live</div>
              </div>
              <div className="driver-period-list">
                <div><span>Today</span><strong>{formatMoney(periodEarnings.today)}</strong></div>
                <div><span>This week</span><strong>{formatMoney(periodEarnings.week)}</strong></div>
                <div><span>This month</span><strong>{formatMoney(periodEarnings.month)}</strong></div>
              </div>
            </article>
          </div>

          <div className="driver-earnings-stats">
            <article className="driver-earnings-stat">
              <div className="driver-stat-icon paid"><SummaryIcon type="paid" /></div>
              <div><span>Paid out</span><strong>{formatMoney(summary.paid)}</strong><small>Successfully transferred</small></div>
            </article>
            <article className="driver-earnings-stat">
              <div className="driver-stat-icon pending"><SummaryIcon type="pending" /></div>
              <div><span>Unpaid earnings</span><strong>{formatMoney(summary.pending)}</strong><small>Awaiting transfer</small></div>
            </article>
            <article className="driver-earnings-stat">
              <div className="driver-stat-icon average"><SummaryIcon type="average" /></div>
              <div><span>Average per delivery</span><strong>{formatMoney(average)}</strong><small>Across completed trips</small></div>
            </article>
          </div>

          <article className="driver-payout-card">
            <header className="driver-payout-header">
              <div>
                <span className="driver-earnings-eyebrow">Payout activity</span>
                <h2>Delivery earnings</h2>
                <p>A clear record of earnings generated from your completed deliveries.</p>
              </div>
              <span className="driver-payout-count">{rows.length} {rows.length === 1 ? 'record' : 'records'}</span>
            </header>

            {rows.length === 0 ? (
              <div className="driver-payout-empty">
                <div>₹</div>
                <h3>No earnings recorded yet</h3>
                <p>Your completed-delivery payouts will appear here.</p>
              </div>
            ) : (
              <>
                <div className="driver-payout-table-wrap">
                  <table className="driver-payout-table">
                    <thead>
                      <tr>
                        <th>Delivery</th>
                        <th>Customer</th>
                        <th>Completed</th>
                        <th>Distance</th>
                        <th>Payment status</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payoutPages.pageItems.map((row) => {
                        const statusClass = normalize(row.payoutStatus).replace(/\s+/g, '-');
                        return (
                          <tr key={row.trip.id}>
                            <td><strong>{row.requestId}</strong><span>{row.trip.id}</span></td>
                            <td>{row.customer}</td>
                            <td>{formatDate(row.completedAt)}</td>
                            <td>{row.distance}</td>
                            <td><span className={`driver-payout-status ${statusClass}`}>{row.payoutStatus}</span></td>
                            <td className="driver-payout-amount">{formatMoney(row.amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="driver-payout-mobile-list">
                  {payoutPages.pageItems.map((row) => {
                    const statusClass = normalize(row.payoutStatus).replace(/\s+/g, '-');
                    return (
                      <div className="driver-payout-mobile" key={row.trip.id}>
                        <div className="driver-payout-mobile-top">
                          <div><span>Delivery</span><strong>{row.requestId}</strong><small>{row.trip.id}</small></div>
                          <strong className="driver-payout-amount">{formatMoney(row.amount)}</strong>
                        </div>
                        <div className="driver-payout-mobile-meta"><span>{row.customer}</span><span>{formatDate(row.completedAt)}</span></div>
                        <div className="driver-payout-mobile-bottom"><span>{row.distance}</span><span className={`driver-payout-status ${statusClass}`}>{row.payoutStatus}</span></div>
                      </div>
                    );
                  })}
                </div>
                <Pagination {...payoutPages} onPageChange={payoutPages.setPage} itemLabel="payouts" />
              </>
            )}
          </article>
        </>
      )}

    </section>
  );
}
