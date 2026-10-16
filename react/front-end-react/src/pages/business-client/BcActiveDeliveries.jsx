import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Deliveries } from '../../api/namespaces';
import { getArray, normalize, getPickup, getDropoff, getDriver } from './bcUtils';
import { useLiveSync } from '../../hooks/useLiveSync';
import { matchesFilter, matchesSearchFields, uniqueFilterOptions } from '../../utils/search';
import './BcActiveDeliveries.css';
import { formatDeliveryPrice } from '../../utils/deliveryPricing';

const activeStatuses = [
  'requested',
  'pending',
  'approved',
  'queued',
  'assigned',
  'accepted',
  'picked up',
  'in transit',
  'issue reported',
  'blocked',
];

function isActiveDelivery(delivery) {
  return activeStatuses.includes(normalize(delivery.status));
}

function getEta(delivery) {
  return delivery.eta || delivery.estimatedTime || delivery.estimatedArrival || 'Not provided';
}

export default function BcActiveDeliveries() {
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [search, setSearch] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('');
  const [status, setStatus] = useState('loading');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Cancelled by business client');
  const [cancellingBtnId, setCancellingBtnId] = useState(null);
  const resolverRef = useRef(null);
  const reasonInputRef = useRef(null);

  async function loadDeliveries() {
    try {
      const result = await Deliveries.getAll();
      const all = getArray(result);
      const active = all
        .filter(isActiveDelivery)
        .sort((a, b) => {
          const aTime = new Date(a.createdAt || a.requestTime || 0).getTime();
          const bTime = new Date(b.createdAt || b.requestTime || 0).getTime();
          return bTime - aTime;
        });
      setActiveDeliveries(active);
      setStatus('ok');
    } catch (error) {
      console.error('Active deliveries backend sync failed:', error);
      setStatus('error');
    }
  }

  useEffect(() => {
    loadDeliveries();
  }, []);
  useLiveSync(loadDeliveries);

  const filteredDeliveries = activeDeliveries.filter((delivery) =>
    matchesSearchFields(search, [delivery.id || delivery.deliveryId]) &&
    matchesFilter(getDriver(delivery), driverFilter) &&
    matchesFilter(delivery.status, deliveryStatusFilter),
  );
  const driverOptions = uniqueFilterOptions(activeDeliveries, getDriver);
  const deliveryStatusOptions = uniqueFilterOptions(activeDeliveries, (delivery) => delivery.status);

  function openCancelModal() {
    setCancelReason('Cancelled by business client');
    setCancelOpen(true);
    setTimeout(() => {
      reasonInputRef.current?.focus();
      reasonInputRef.current?.select();
    }, 50);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }

  function closeCancelModal(reason) {
    setCancelOpen(false);
    if (resolverRef.current) {
      resolverRef.current(reason);
      resolverRef.current = null;
    }
  }

  async function handleCancelClick(id) {
    const reason = await openCancelModal();
    if (reason === null) return;

    setCancellingBtnId(id);
    try {
      await Deliveries.cancel(id, reason);
      await loadDeliveries();
    } catch (error) {
      console.error('Cancel delivery failed:', error);
    } finally {
      setCancellingBtnId(null);
    }
  }

  return (
    <section className="bc-active-page">
      <h1 className="page-title bc-active-title">Active Deliveries</h1>

      <p className="page-subtitle">
        {status === 'loading'
          ? 'Loading active deliveries...'
          : status === 'error'
          ? 'Backend sync failed'
          : `${filteredDeliveries.length} ${filteredDeliveries.length === 1 ? 'delivery' : 'deliveries'} in progress`}
      </p>

      <div className="bc-active-search">
        <label className="bc-search-dark">
          <svg viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7"></circle>
            <path d="M20 20l-3.5-3.5"></path>
          </svg>
          <input
            id="bc-active-delivery-search"
            type="text"
            placeholder="Search delivery ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select aria-label="Filter active deliveries by driver" value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}><option value="">All drivers</option>{driverOptions.map((driver) => <option key={driver} value={driver}>{driver}</option>)}</select>
        <select aria-label="Filter active deliveries by status" value={deliveryStatusFilter} onChange={(e) => setDeliveryStatusFilter(e.target.value)}><option value="">All statuses</option>{deliveryStatusOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      </div>

      <div className="delivery-list" id="deliveryList">
        {status === 'loading' && (
          <div style={{ padding: 24, background: '#171717', border: '1px solid #262626', borderRadius: 16, color: '#9ca3af', textAlign: 'center' }}>
            Loading deliveries...
          </div>
        )}

        {status === 'error' && (
          <div style={{ padding: 24, background: '#331717', border: '1px solid #ef4444', borderRadius: 16, color: '#fecaca', textAlign: 'center' }}>
            Could not load active deliveries.
          </div>
        )}

        {status === 'ok' && filteredDeliveries.length === 0 && (
          <div style={{ padding: 24, background: '#171717', border: '1px solid #262626', borderRadius: 16, color: '#9ca3af', textAlign: 'center' }}>
            {search.trim() || driverFilter || deliveryStatusFilter ? 'No active delivery matches the selected search and filters.' : 'No active deliveries found.'}
          </div>
        )}

        {status === 'ok' &&
          filteredDeliveries.map((delivery) => {
            const id = delivery.id || delivery.deliveryId || '--';
            const pickup = getPickup(delivery);
            const dropoff = getDropoff(delivery);
            const driver = getDriver(delivery);
            const eta = getEta(delivery);
            const statusText = delivery.status || 'Status unavailable';
            const driverSub = delivery.driverPhone || delivery.phone || delivery.deliveryType || delivery.type || '--';
            const busy = cancellingBtnId === id;

            return (
              <div className="delivery-item" key={id} data-order-id={id}>
                <div>
                  <div className="delivery-id">#{id}</div>
                  <span className="pill bright">{String(statusText).toUpperCase()}</span>
                </div>

                <div>
                  <div className="delivery-meta-label">From</div>
                  <div className="delivery-meta-value">{pickup}</div>
                </div>

                <div>
                  <div className="delivery-meta-label">To</div>
                  <div className="delivery-meta-value">{dropoff}</div>
                </div>

                <div>
                  <div className="delivery-meta-label">Driver</div>
                  <div className="delivery-meta-value">{driver}</div>
                  <div className="delivery-meta-sub">{driverSub}</div>
                </div>

                <div>
                  <div className="delivery-meta-label">ETA</div>
                  <div className="bc-active-eta">{eta}</div>
                </div>

                <div>
                  <div className="delivery-meta-label">Price</div>
                  <div className="delivery-meta-value">{formatDeliveryPrice(delivery)}</div>
                </div>

                <div className="bc-active-actions">
                <a className="btn yellow" href={`/business-client/live-tracking?id=${encodeURIComponent(id)}`}>
                  <svg viewBox="0 0 24 24">
                    <path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11z"></path>
                    <circle cx="12" cy="10" r="2"></circle>
                  </svg>
                  View Status
                </a>

                <button className="btn outline-red" type="button" disabled={busy} onClick={() => handleCancelClick(id)}>
                  {busy ? 'Cancelling...' : '× Cancel Order'}
                </button>
                </div>
              </div>
            );
          })}
      </div>

      {createPortal(
        <div className={`cancel-modal${cancelOpen ? ' show' : ''}`} id="cancelModal">
          <div className="cancel-modal-backdrop" onClick={() => closeCancelModal(null)}></div>

          <div className="cancel-modal-card" role="dialog" aria-modal="true" aria-labelledby="cancelModalTitle">
            <h2 id="cancelModalTitle">Cancel Order</h2>
            <p>Please provide a reason for cancelling this delivery.</p>

            <textarea
              ref={reasonInputRef}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter cancellation reason..."
              onKeyDown={(e) => {
                if (e.key === 'Escape') closeCancelModal(null);
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  const reason = cancelReason.trim();
                  if (!reason) {
                    reasonInputRef.current?.focus();
                    return;
                  }
                  closeCancelModal(reason);
                }
              }}
            ></textarea>

            <div className="cancel-modal-actions">
              <button type="button" className="cancel-close" onClick={() => closeCancelModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="cancel-confirm"
                onClick={() => {
                  const reason = cancelReason.trim();
                  if (!reason) {
                    reasonInputRef.current?.focus();
                    return;
                  }
                  closeCancelModal(reason);
                }}
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        .cancel-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9999}
        .cancel-modal.show{display:flex}
        .cancel-modal-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(4px)}
        .cancel-modal-card{position:relative;width:min(520px,calc(100% - 40px));background:#181818;border:1px solid #2d2d2d;border-radius:20px;padding:28px;box-shadow:0 24px 80px rgba(0,0,0,.5);box-sizing:border-box}
        .cancel-modal-card h2{margin:0 0 8px;color:#fff;font-size:24px;line-height:1.2}
        .cancel-modal-card p{margin:0 0 20px;color:#9ca3af;font-size:14px;line-height:1.5}
        .cancel-modal-card textarea{width:100%;min-height:110px;box-sizing:border-box;resize:vertical;padding:14px 16px;background:#0b0b0b;border:1px solid #343434;border-radius:14px;color:#fff;font:inherit;outline:none}
        .cancel-modal-card textarea::placeholder{color:#777}
        .cancel-modal-card textarea:focus{border-color:#ffd400;box-shadow:0 0 0 3px rgba(255,212,0,.12)}
        .cancel-modal-actions{display:flex;justify-content:flex-end;gap:12px;margin-top:20px}
        .cancel-close,.cancel-confirm{min-height:44px;padding:0 18px;border-radius:12px;font:inherit;font-weight:700;cursor:pointer}
        .cancel-close{background:#181818;border:1px solid #333;color:#fff}
        .cancel-close:hover{background:#222}
        .cancel-confirm{background:#ffd400;border:1px solid #ffd400;color:#111}
        .cancel-confirm:hover{background:#ffe04a;border-color:#ffe04a}
        .cancel-close:focus-visible,.cancel-confirm:focus-visible{outline:2px solid #fff;outline-offset:2px}
        @media (max-width:600px){
          .cancel-modal-card{width:calc(100% - 24px);padding:22px;border-radius:16px}
          .cancel-modal-actions{flex-direction:column}
          .cancel-close,.cancel-confirm{width:100%}
        }
      `}</style>
    </section>
  );
}
