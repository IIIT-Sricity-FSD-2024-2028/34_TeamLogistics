import { useRecordPage } from '../../components/useRecordPage';
import { useDispatch, useSelector } from 'react-redux';
import { setActiveFilters } from '../../redux/businessClientSlice';
import { usePageStyleScope } from '../../hooks/usePageStyleScope';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGetDeliveriesQuery, useCancelDeliveryMutation, EMPTY_LIST } from '../../redux/businessClientApi';
import { normalize, getPickup, getDropoff, getDriver } from './bcUtils';
import { matchesFilter, matchesSearchFields, uniqueFilterOptions } from '../../utils/search';
import './BcActiveDeliveries.css';
import { formatDeliveryPrice } from '../../utils/deliveryPricing';
import Pagination, { usePagination } from '../../components/Pagination';

function getEta(delivery) {
  return delivery.eta || delivery.estimatedTime || delivery.estimatedArrival || 'Not provided';
}

export default function BcActiveDeliveries() {
  usePageStyleScope('bc-active-deliveries');
  const dispatch = useDispatch();
  const { search, driverFilter, deliveryStatusFilter } = useSelector((state) => state.businessClient.active);
  const setSearch = (search) => dispatch(setActiveFilters({ search }));
  const setDriverFilter = (driverFilter) => dispatch(setActiveFilters({ driverFilter }));
  const setDeliveryStatusFilter = (deliveryStatusFilter) => dispatch(setActiveFilters({ deliveryStatusFilter }));
  const deliveryPages = useRecordPage(useGetDeliveriesQuery, { view: 'active', search, driver: driverFilter, status: deliveryStatusFilter });
  const {query} = deliveryPages;
  const [cancelDelivery] = useCancelDeliveryMutation();
  const status = query.isFetching ? 'loading' : query.isError ? 'error' : 'ok';
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Cancelled by business client');
  const [cancellingBtnId, setCancellingBtnId] = useState(null);
  const resolverRef = useRef(null);
  const reasonInputRef = useRef(null);

  const driverOptions = deliveryPages.options.driver || [];
  const deliveryStatusOptions = deliveryPages.options.status || [];

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
      await cancelDelivery({ id, reason }).unwrap();
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
          : `${deliveryPages.totalItems} ${deliveryPages.totalItems === 1 ? 'delivery' : 'deliveries'} in progress`}
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

        {status === 'ok' && deliveryPages.totalItems === 0 && (
          <div style={{ padding: 24, background: '#171717', border: '1px solid #262626', borderRadius: 16, color: '#9ca3af', textAlign: 'center' }}>
            {search.trim() || driverFilter || deliveryStatusFilter ? 'No active delivery matches the selected search and filters.' : 'No active deliveries found.'}
          </div>
        )}

        {status === 'ok' &&
          deliveryPages.pageItems.map((delivery) => {
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

                {['requested', 'pending', 'queued', 'assigned', 'accepted'].includes(statusText.toLowerCase()) && (
                <button className="btn outline-red" type="button" disabled={busy} onClick={() => handleCancelClick(id)}>
                  {busy ? 'Cancelling...' : '× Cancel Order'}
                </button>)}
                </div>
              </div>
            );
          })}
      </div>
      {status === 'ok' && <Pagination {...deliveryPages} onPageChange={deliveryPages.setPage} itemLabel="deliveries" />}

      {cancelOpen && createPortal(
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

    </section>
  );
}
