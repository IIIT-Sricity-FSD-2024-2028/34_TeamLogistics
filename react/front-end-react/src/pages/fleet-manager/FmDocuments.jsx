import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Documents } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { matchesFilter, matchesSearchFields, pillClass, uniqueFilterOptions } from './fmUtils';
import ActionMenu from './ActionMenu';
import { useLiveSync } from '../../hooks/useLiveSync';
import { getDocumentOwnerLabel, getDocumentOwnerTypeLabel } from '../../components/DocumentRelatedDetails';

const PAGE_SIZE = 10;

export default function FmDocuments() {
  usePageHeader('Document Management', 'Review trip, delivery, vehicle, and driver documentation');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [ownerTypeFilter, setOwnerTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState('');

  async function load() {
    try {
      const data = await Documents.getAll();
      setDocs(data || []);
      setError(false);
    } catch (e) {
      console.error(e);
      setError(true);
    }
  }

  useEffect(() => {
    load();
  }, []);
  useLiveSync(load);

  async function del(id) {
    if (!id) return;
    if (!confirm(`Delete document ${id}?`)) return;
    try {
      await Documents.delete(id);
      showToast('Document deleted');
      load();
    } catch (e) {
      console.error(e);
      alert('Failed to delete document');
    }
  }

  async function updateStatus(document, status) {
    if (!document?.id || updatingId) return;
    try {
      setUpdatingId(document.id);
      await Documents.update(document.id, { status });
      showToast(`${document.id} marked as ${status.toLowerCase()}`);
      await load();
    } catch (e) {
      console.error(e);
      showToast(e.message || 'Failed to update document status.');
    } finally {
      setUpdatingId('');
    }
  }

  async function openFile(document) {
    if (!document?.id || !document.fileUrl) return;
    const fileWindow = window.open('about:blank', '_blank');
    try {
      const file = await Documents.getFile(document.id);
      const fileUrl = URL.createObjectURL(file);
      if (fileWindow) {
        fileWindow.opener = null;
        fileWindow.location.replace(fileUrl);
      } else {
        const link = window.document.createElement('a');
        link.href = fileUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
    } catch (e) {
      fileWindow?.close();
      console.error(e);
      showToast(e.message || 'Failed to fetch the document file.');
      await load();
    }
  }

  const filtered = (docs || []).filter((document) => matchesSearchFields(search, [
    document.id,
    document.fileName,
  ]) &&
    matchesFilter(document.documentType, typeFilter) &&
    matchesFilter(getDocumentOwnerTypeLabel(document), ownerTypeFilter) &&
    matchesFilter(document.status, statusFilter));
  const typeOptions = uniqueFilterOptions(docs, (document) => document.documentType);
  const ownerTypeOptions = uniqueFilterOptions(docs, getDocumentOwnerTypeLabel);
  const statusOptions = uniqueFilterOptions(docs, (document) => document.status);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageDocs = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstResult = filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastResult = Math.min(currentPage * PAGE_SIZE, filtered.length);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (error) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ padding: 24, color: '#ff8d8d', textAlign: 'center' }}>
          Failed to load documents.
        </div>
      </div>
    );
  }

  if (docs === null) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ padding: 24, color: '#888', textAlign: 'center' }}>
          Documents backend sync is loading...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-left">
          <label className="search-sm">
            <span>⌕</span>
            <input
              placeholder="Search document ID or file..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <select className="filter-select" aria-label="Filter documents by type" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}><option value="">All document types</option>{typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}</select>
          <select className="filter-select" aria-label="Filter documents by owner type" value={ownerTypeFilter} onChange={(e) => { setOwnerTypeFilter(e.target.value); setPage(1); }}><option value="">All related types</option>{ownerTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}</select>
          <select className="filter-select" aria-label="Filter documents by status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}><option value="">All statuses</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select>
        </div>
        <button className="btn btn-yellow" type="button" onClick={() => navigate('/fleet-manager/upload-document')}>
          ＋ Upload Document
        </button>
      </div>
      <section className="panel">
        <div className="panel-head">
          <div className="panel-title">Documents</div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Document Type</th>
              <th>Related Type</th>
              <th>Related Record</th>
              <th>File Name</th>
              <th>Issue Date</th>
              <th>Expiry Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: '#888', padding: 18 }}>
                  {search.trim() || typeFilter || ownerTypeFilter || statusFilter ? 'No documents match the selected search and filters.' : 'No documents found.'}
                </td>
              </tr>
            ) : (
              pageDocs.map((d) => {
                const ownerType = String(d.ownerType || '').toLowerCase();
                const status = String(d.status || '').toLowerCase();
                const isComplianceDocument = ownerType === 'vehicle' || ownerType === 'driver';
                const canApprove = status === 'submitted';
                const canRenew = isComplianceDocument && (status === 'expiring soon' || status === 'expired');
                const canExpire = isComplianceDocument && Boolean(d.expiryDate) && (status === 'valid' || status === 'expiring soon');

                return (
                  <tr key={d.id}>
                    <td className="em">{d.id || '--'}</td>
                    <td>{d.documentType || '--'}</td>
                    <td>{getDocumentOwnerTypeLabel(d)}</td>
                    <td className="em">{getDocumentOwnerLabel(d)}</td>
                    <td>{d.fileName || '--'}</td>
                    <td>{d.issueDate || '--'}</td>
                    <td>{d.expiryDate || '--'}</td>
                    <td>
                      <span className={`pill ${pillClass(d.status)}`}>{d.status || '--'}</span>
                    </td>
                    <td>
                      <ActionMenu>
                        <button type="button" onClick={() => navigate(`/fleet-manager/document-related?id=${encodeURIComponent(d.id || '')}`)}>
                          View Related Files
                        </button>
                        {d.fileUrl && (
                          <button type="button" onClick={() => openFile(d)}>
                            View File
                          </button>
                        )}
                        {isComplianceDocument && (
                          <button
                            type="button"
                            onClick={() => navigate(`/fleet-manager/upload-document?id=${encodeURIComponent(d.id || '')}`)}
                          >
                            Edit Details
                          </button>
                        )}
                        {canApprove && (
                          <button type="button" disabled={updatingId === d.id} onClick={() => updateStatus(d, 'Valid')}>
                            Approve Document
                          </button>
                        )}
                        {canRenew && (
                          <button
                            type="button"
                            onClick={() => navigate(`/fleet-manager/upload-document?renew=${encodeURIComponent(d.id || '')}`)}
                          >
                            Renew Document
                          </button>
                        )}
                        {canExpire && (
                          <button type="button" disabled={updatingId === d.id} onClick={() => updateStatus(d, 'Expired')}>
                            Mark as Expired
                          </button>
                        )}
                        <button className="danger" onClick={() => del(d.id)}>
                          Delete
                        </button>
                      </ActionMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '16px 20px', borderTop: '1px solid #262626', flexWrap: 'wrap' }}>
            <div style={{ color: '#888', fontSize: 13 }}>Showing <strong>{firstResult}–{lastResult}</strong> of <strong>{filtered.length}</strong> documents</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="btn btn-small btn-ghost" disabled={currentPage <= 1} style={{ opacity: currentPage <= 1 ? 0.5 : 1 }} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
              <span style={{ color: '#9ca3af', fontSize: 13 }}>Page {currentPage} of {totalPages}</span>
              <button className="btn btn-small btn-yellow" disabled={currentPage >= totalPages} style={{ opacity: currentPage >= totalPages ? 0.5 : 1 }} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
