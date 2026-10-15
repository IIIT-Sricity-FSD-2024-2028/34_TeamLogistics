import { useEffect, useMemo, useState } from 'react';
import { Trips, Deliveries, Payouts } from '../../api/namespaces';
import { useSession } from '../../auth/SessionContext';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useLiveSync } from '../../hooks/useLiveSync';

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
  usePageHeader('Earnings', 'Your payouts and completed-delivery income');
  const { session } = useSession();
  const driverName = session?.name || '';

  const [trips, setTrips] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  async function load({ background = false } = {}) {
    if (!background) setLoading(true);
    setLoadError('');
    try {
      const [tripData, deliveryData, payoutData] = await Promise.all([
        Trips.getAll(),
        Deliveries.getAll(),
        Payouts.getMyPayouts(),
      ]);
      setTrips(tripData || []);
      setDeliveries(deliveryData || []);
      setPayouts(payoutData || []);
    } catch (error) {
      setLoadError(error.message || 'Unable to load your earnings right now.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);
  useLiveSync(load);

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
                      {rows.map((row) => {
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
                  {rows.map((row) => {
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
              </>
            )}
          </article>
        </>
      )}

      <style>{`
        .driver-earnings-page{padding-top:6px;color:#fff}
        .driver-earnings-state{display:grid;place-items:center;min-height:280px;border:1px solid #292929;border-radius:22px;background:linear-gradient(145deg,#191919,#101010);color:#9ca3af;font-weight:800}.driver-earnings-state.error{align-content:center;gap:9px;color:#d1d5db;text-align:center}.driver-earnings-state.error strong{color:#fff;font-size:20px}.driver-earnings-state.error span{font-size:13px}.driver-earnings-state.error button{margin-top:8px;padding:10px 16px;border:0;border-radius:10px;background:var(--yellow);color:#111;font-weight:900;cursor:pointer}
        .driver-earnings-overview{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(310px,.75fr);gap:18px;margin-bottom:18px}
        .driver-earnings-hero{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.8fr);gap:28px;align-items:end;min-height:210px;padding:30px;overflow:hidden;border:1px solid #e7c300;border-radius:24px;background:linear-gradient(135deg,#ffe249 0%,#ffd400 58%,#edc400 100%);color:#111;box-shadow:0 22px 52px rgba(255,212,0,.12)}
        .driver-earnings-hero-copy,.driver-earnings-progress-block{position:relative;z-index:1}.driver-earnings-eyebrow{display:block;color:#8e8e8e;font-size:11px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.driver-earnings-hero .driver-earnings-eyebrow{color:#494100}.driver-earnings-hero-copy>strong{display:block;margin:12px 0 8px;font-size:clamp(38px,4vw,58px);line-height:1;font-weight:950;letter-spacing:-.045em}.driver-earnings-hero-copy p{margin:0;color:#4f4700;font-size:14px;font-weight:700}
        .driver-earnings-progress-block{padding:16px;border:1px solid rgba(17,17,17,.13);border-radius:17px;background:rgba(255,255,255,.3);backdrop-filter:blur(8px)}.driver-earnings-progress-label{display:flex;justify-content:space-between;gap:12px;margin-bottom:10px;font-size:12px;font-weight:850}.driver-earnings-progress{height:8px;overflow:hidden;border-radius:999px;background:rgba(17,17,17,.13)}.driver-earnings-progress span{display:block;height:100%;border-radius:inherit;background:#111}.driver-earnings-progress-block small{display:block;margin-top:10px;color:#514900;font-size:11px;font-weight:750;line-height:1.45}.driver-earnings-hero-mark{position:absolute;right:-24px;top:-64px;color:rgba(17,17,17,.055);font-size:250px;font-weight:950;line-height:1;transform:rotate(8deg)}
        .driver-period-card{padding:24px;border:1px solid #2b2b2b;border-radius:24px;background:linear-gradient(145deg,#1b1b1b,#101010);box-shadow:0 22px 46px rgba(0,0,0,.27)}.driver-period-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:17px;border-bottom:1px solid #292929}.driver-period-heading span{display:block;color:#8f8f8f;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.driver-period-heading strong{display:block;margin-top:6px;font-size:16px}.driver-period-pulse{display:flex;align-items:center;gap:6px;color:#86efac!important;font-size:10px!important;letter-spacing:.05em!important}.driver-period-pulse span{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.12)}.driver-period-list{display:grid;gap:0;margin-top:5px}.driver-period-list>div{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 0;border-bottom:1px solid #232323}.driver-period-list>div:last-child{border:0;padding-bottom:0}.driver-period-list span{color:#999;font-size:12px}.driver-period-list strong{font-size:15px}
        .driver-earnings-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-bottom:18px}.driver-earnings-stat{display:flex;align-items:center;gap:15px;min-width:0;padding:19px;border:1px solid #292929;border-radius:18px;background:#151515}.driver-stat-icon{display:grid;place-items:center;flex:0 0 auto;width:46px;height:46px;border-radius:14px}.driver-stat-icon svg{width:23px;height:23px;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.driver-stat-icon.paid{background:rgba(34,197,94,.11);color:#86efac}.driver-stat-icon.pending{background:rgba(245,158,11,.11);color:#fbbf24}.driver-stat-icon.average{background:rgba(96,165,250,.11);color:#93c5fd}.driver-earnings-stat>div:last-child{min-width:0}.driver-earnings-stat span,.driver-earnings-stat small{display:block;color:#8f8f8f}.driver-earnings-stat span{margin-bottom:5px;font-size:11px;font-weight:850;text-transform:uppercase;letter-spacing:.07em}.driver-earnings-stat strong{display:block;overflow:hidden;font-size:22px;line-height:1.2;text-overflow:ellipsis}.driver-earnings-stat small{margin-top:5px;font-size:11px}
        .driver-payout-card{overflow:hidden;border:1px solid #292929;border-radius:24px;background:linear-gradient(145deg,#191919,#101010);box-shadow:0 22px 48px rgba(0,0,0,.24)}.driver-payout-header{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:24px 26px;border-bottom:1px solid #292929}.driver-payout-header h2{margin:6px 0 5px;font-size:25px}.driver-payout-header p{margin:0;color:#929292;font-size:13px;line-height:1.5}.driver-payout-count{padding:8px 12px;border:1px solid #343434;border-radius:999px;background:#101010;color:#d7d7d7;font-size:11px;font-weight:850;white-space:nowrap}
        .driver-payout-table-wrap{overflow-x:auto}.driver-payout-table{width:100%;min-width:850px;border-collapse:collapse}.driver-payout-table th{padding:13px 18px;background:#121212;color:#777;text-align:left;text-transform:uppercase;font-size:10px;letter-spacing:.09em}.driver-payout-table th:last-child,.driver-payout-table td:last-child{text-align:right}.driver-payout-table td{padding:16px 18px;border-top:1px solid #242424;color:#d7d7d7;font-size:13px}.driver-payout-table tbody tr{transition:background .15s ease}.driver-payout-table tbody tr:hover{background:#191919}.driver-payout-table td:first-child strong,.driver-payout-table td:first-child span{display:block}.driver-payout-table td:first-child strong{color:#fff}.driver-payout-table td:first-child span{margin-top:4px;color:#747474;font-size:10px}.driver-payout-amount{color:var(--yellow)!important;font-weight:950!important;white-space:nowrap}
        .driver-payout-status{display:inline-flex;width:max-content;padding:6px 9px;border-radius:999px;background:#292929;color:#d1d5db;font-size:10px;font-weight:900;text-transform:capitalize;white-space:nowrap}.driver-payout-status.paid{background:rgba(34,197,94,.12);color:#86efac}.driver-payout-status.unpaid{background:rgba(245,158,11,.12);color:#fcd34d}
        .driver-payout-empty{display:grid;place-items:center;padding:52px 24px;text-align:center}.driver-payout-empty>div{display:grid;place-items:center;width:52px;height:52px;border-radius:16px;background:rgba(255,212,0,.1);color:var(--yellow);font-size:24px;font-weight:950}.driver-payout-empty h3{margin:14px 0 6px}.driver-payout-empty p{margin:0;color:#8f8f8f;font-size:13px}.driver-payout-mobile-list{display:none}
        @media(max-width:1200px){.driver-earnings-overview{grid-template-columns:1fr}.driver-period-list{grid-template-columns:repeat(3,1fr);gap:12px}.driver-period-list>div{display:block;border:0;padding:12px;border-radius:14px;background:#101010}.driver-period-list strong{display:block;margin-top:7px}}
        @media(max-width:900px){.driver-earnings-stats{grid-template-columns:1fr}.driver-earnings-hero{grid-template-columns:1fr;align-items:start}.driver-payout-table-wrap{display:none}.driver-payout-mobile-list{display:grid;gap:12px;padding:16px}.driver-payout-mobile{padding:16px;border:1px solid #292929;border-radius:16px;background:#111}.driver-payout-mobile-top,.driver-payout-mobile-meta,.driver-payout-mobile-bottom{display:flex;justify-content:space-between;gap:16px}.driver-payout-mobile-top>div span,.driver-payout-mobile-top>div small{display:block}.driver-payout-mobile-top>div span{color:#777;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.driver-payout-mobile-top>div strong{display:block;margin-top:4px}.driver-payout-mobile-top>div small{margin-top:3px;color:#717171;font-size:10px}.driver-payout-mobile-meta{margin:14px 0;padding:12px 0;border-top:1px solid #252525;border-bottom:1px solid #252525;color:#a8a8a8;font-size:12px}.driver-payout-mobile-bottom{align-items:center;color:#aaa;font-size:12px}}
        @media(max-width:600px){.driver-earnings-hero,.driver-period-card{padding:20px;border-radius:20px}.driver-earnings-hero-copy>strong{font-size:38px}.driver-period-list{grid-template-columns:1fr}.driver-period-list>div{display:flex}.driver-period-list strong{margin-top:0}.driver-payout-header{display:block;padding:20px}.driver-payout-count{display:inline-flex;margin-top:14px}.driver-payout-mobile-meta{flex-direction:column;gap:6px}.driver-earnings-stat strong{font-size:20px}}
      `}</style>
    </section>
  );
}
