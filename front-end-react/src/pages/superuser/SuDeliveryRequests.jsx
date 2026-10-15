import { useEffect, useState } from 'react';
import { Deliveries } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { statusClass, Icon } from '../../components/Icon';
import Modal from '../../components/Modal';
import { useLiveSync } from '../../hooks/useLiveSync';
import { matchesFilter, matchesSearchFields, uniqueFilterOptions } from '../../utils/search';

function RequestDetailModal({ requestId, onClose }) {
  const [r, setR] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await Deliveries.getOne(requestId);
        setR({
          id: raw.id || requestId,
          customer: raw.customer || '--',
          contact: raw.contact || '--',
          pickup: raw.pickup || '--',
          dropoff: raw.dropoff || '--',
          package: raw.package || '--',
          type: raw.type || 'Standard',
          requestTime: raw.requestTime || '--',
          status: raw.status || 'Pending',
        });
      } catch {
        setFailed(true);
      }
    })();
  }, [requestId]);

  return (
    <Modal onClose={onClose}>
      <div className="content-card details-card modal-detail-card standalone-modal">
        <div className="details-top">
          <div className="details-title">Request Details</div>
          <button className="close-icon" onClick={onClose}>×</button>
        </div>
        <div className="details-body modal-detail-body one-col">
          {!r && !failed && <div style={{ textAlign: 'center', color: '#b9b9b9', padding: 24 }}>Loading request...</div>}
          {failed && <div style={{ textAlign: 'center', color: '#ff6b6b', padding: 24 }}>Failed to load request details.</div>}
          {r && (
            <>
              <div className="detail-block"><div className="detail-label">Request ID</div><div className="detail-main">{Icon.doc}{r.id}</div></div>
              <div className="detail-block"><div className="detail-label">Delivery Type</div><div className="detail-main"><span className="small-pill">{r.type}</span></div></div>
              <div className="detail-block full"><div className="detail-label">Client Company</div><div className="detail-main">{Icon.user}{r.customer}</div><div className="detail-sub">{r.contact}</div></div>
              <div className="detail-block full"><div className="detail-label">Pickup Address</div><div className="detail-main">{Icon.map}{r.pickup}</div></div>
              <div className="detail-block full"><div className="detail-label">Drop Address</div><div className="detail-main">{Icon.map}{r.dropoff}</div></div>
              <div className="detail-block full"><div className="detail-label">Package Details</div><div className="detail-main">{Icon.package}{r.package}</div></div>
              <div className="detail-block"><div className="detail-label">Request Time</div><div className="detail-main">{Icon.calendar}{r.requestTime}</div></div>
              <div className="detail-block"><div className="detail-label">Current Status</div><div className="detail-main">{Icon.map}<span>{r.status}</span></div></div>
            </>
          )}
        </div>
        <div className="detail-footer"><button className="btn-yellow close-wide" onClick={onClose}>Close</button></div>
      </div>
    </Modal>
  );
}

function BlockUnblockModal({ requestId, mode, onClose, onDone }) {
  const [r, setR] = useState(null);
  const [failed, setFailed] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const isBlock = mode === 'block';

  useEffect(() => {
    (async () => {
      try {
        setR(await Deliveries.getOne(requestId));
      } catch {
        setFailed(true);
      }
    })();
  }, [requestId]);

  async function confirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(`Please enter reason for ${isBlock ? 'blocking' : 'unblocking'}`);
      return;
    }
    try {
      if (isBlock) await Deliveries.block(r.id, trimmed);
      else await Deliveries.unblock(r.id, trimmed);
      onClose();
      onDone();
    } catch {
      setError(`Failed to ${isBlock ? 'block' : 'unblock'} order`);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="content-card details-card modal-detail-card standalone-modal">
        <div className="details-top">
          <div className="details-title">{isBlock ? 'Block Order' : 'Unblock Order'}</div>
          <button className="close-icon" onClick={onClose}>×</button>
        </div>
        <div className="details-body modal-detail-body one-col">
          {!r && !failed && <div style={{ textAlign: 'center', color: '#b9b9b9', padding: 30 }}>Loading order details...</div>}
          {failed && <div style={{ textAlign: 'center', color: '#ff6b6b', padding: 30 }}>Failed to load order details.</div>}
          {r && (
            <>
              <div className="detail-block full"><div className="detail-label">Request ID</div><div className="detail-main">{Icon.doc}{r.id || '-'}</div></div>
              <div className="detail-block full"><div className="detail-label">Client Company</div><div className="detail-main">{Icon.user}{r.customer || '-'}</div></div>
              <div className="detail-block full"><div className="detail-label">Pickup Address</div><div className="detail-main">{Icon.map}{r.pickup || '-'}</div></div>
              <div className="detail-block full"><div className="detail-label">Drop Address</div><div className="detail-main">{Icon.map}{r.dropoff || '-'}</div></div>
              <div className="detail-block full"><div className="detail-label">Current Status</div><div className="detail-main"><span>{r.status || '-'}</span></div></div>
              <div className="field">
                <label>Reason for {isBlock ? 'Blocking' : 'Unblocking'}</label>
                <textarea style={{ width: '100%', minHeight: 140, resize: 'vertical', display: 'block' }} placeholder={`Enter reason for ${isBlock ? 'blocking' : 'unblocking'} this order`} value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="error">{error}</div>
              </div>
            </>
          )}
        </div>
        <div className="detail-footer">
          <button className="btn-dark close-wide" onClick={onClose}>Cancel</button>
          <button className="btn-yellow close-wide" onClick={confirm}>{isBlock ? 'Block Order' : 'Unblock Order'}</button>
        </div>
      </div>
    </Modal>
  );
}

export default function SuDeliveryRequests() {
  usePageHeader('Delivery Requests');
  useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [openMenu, setOpenMenu] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [blockModal, setBlockModal] = useState(null);

  async function load() {
    setFailed(false);
    try {
      const deliveries = await Deliveries.getAll();
      setRows(deliveries || []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);
  useLiveSync(load);

  const filtered = rows.filter((request) => matchesSearchFields(search, [
    request.id,
  ]) &&
    matchesFilter(request.type, typeFilter) &&
    matchesFilter(request.status, statusFilter));
  const typeOptions = uniqueFilterOptions(rows, (request) => request.type);
  const statusOptions = uniqueFilterOptions(rows, (request) => request.status);

  return (
    <div className="content-card table-card" onClick={() => setOpenMenu(null)}>
      <div className="table-head">
        <h3>Delivery Requests</h3>
        <div className="filters">
          <input className="mini-input" placeholder="Search request ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="mini-input" aria-label="Filter requests by type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="">All types</option>{typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}</select>
          <select className="mini-input" aria-label="Filter requests by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Client</th>
            <th>Pickup</th>
            <th>Drop Address</th>
            <th>Type</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={7} style={{ textAlign: 'center', color: '#b9b9b9', padding: 18 }}>Loading deliveries...</td></tr>
          )}
          {!loading && failed && (
            <tr><td colSpan={7} style={{ textAlign: 'center', color: '#ff6b6b', padding: 18 }}>Failed to load deliveries.</td></tr>
          )}
          {!loading && !failed && filtered.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: 'center', color: '#b9b9b9', padding: 18 }}>{search.trim() || typeFilter || statusFilter ? 'No delivery requests match the selected search and filters.' : 'No delivery requests found.'}</td></tr>
          )}
          {!loading &&
            !failed &&
            filtered.map((r) => {
              const isBlocked = String(r.status || '').toLowerCase() === 'blocked';
              return (
                <tr key={r.id}>
                  <td>{r.id || '-'}</td>
                  <td>{r.customer || '-'}</td>
                  <td>{r.pickup || '-'}</td>
                  <td>{r.dropoff || '-'}</td>
                  <td>{r.type || '-'}</td>
                  <td><span className={`status-pill ${statusClass(r.status)}`}>{r.status || '-'}</span></td>
                  <td>
                    <div className="action-menu-wrap" onClick={(e) => e.stopPropagation()}>
                      <button className="action-trigger dots-trigger" aria-label="Actions" onClick={() => setOpenMenu(openMenu === r.id ? null : r.id)}>⋯</button>
                      <div className={`action-menu ${openMenu === r.id ? 'show' : ''}`}>
                        <button className="action-item" type="button" onClick={() => { setOpenMenu(null); setViewId(r.id); }}>View</button>
                        {isBlocked ? (
                          <button className="action-item" type="button" onClick={() => { setOpenMenu(null); setBlockModal({ id: r.id, mode: 'unblock' }); }}>Unblock Order</button>
                        ) : (
                          <button className="action-item danger-link" type="button" onClick={() => { setOpenMenu(null); setBlockModal({ id: r.id, mode: 'block' }); }}>Block Order</button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>

      {viewId && <RequestDetailModal requestId={viewId} onClose={() => setViewId(null)} />}
      {blockModal && (
        <BlockUnblockModal
          requestId={blockModal.id}
          mode={blockModal.mode}
          onClose={() => setBlockModal(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
