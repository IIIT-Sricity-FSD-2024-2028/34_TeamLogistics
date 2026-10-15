import { useEffect, useMemo, useState } from 'react';
import { Documents } from '../../api/namespaces';
import { usePageHeader } from '../../hooks/usePageHeader';
import { statusClass } from '../../components/Icon';
import { useLiveSync } from '../../hooks/useLiveSync';
import { useToast } from '../../hooks/useToast';
import DocumentRelatedDetails, { getDocumentOwnerLabel, getDocumentOwnerTypeLabel } from '../../components/DocumentRelatedDetails';
import RowActionMenu from '../../components/RowActionMenu';
import { matchesFilter, matchesSearchFields, uniqueFilterOptions } from '../../utils/search';

const PAGE_SIZE = 10;

export default function SuDocuments() {
  usePageHeader('Documents');
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedDocument, setSelectedDocument] = useState(null);

  async function load({ background = false } = {}) {
    if (!background) setLoading(true);
    try {
      setRows((await Documents.getAll()) || []);
      setFailed(false);
    } catch {
      // A background failure must not replace valid on-screen data with an
      // error state. The next event or reconciliation poll will retry.
      if (!background) setFailed(true);
    } finally {
      if (!background) setLoading(false);
    }
  }

  useLiveSync(load);

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => rows.filter((document) => matchesSearchFields(search, [
    document.id,
    document.fileName,
  ]) &&
    matchesFilter(document.documentType, typeFilter) &&
    matchesFilter(document.status, statusFilter)), [rows, search, typeFilter, statusFilter]);
  const typeOptions = uniqueFilterOptions(rows, (document) => document.documentType);
  const statusOptions = uniqueFilterOptions(rows, (document) => document.status);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstResult = filteredRows.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastResult = Math.min(currentPage * PAGE_SIZE, filteredRows.length);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
    } catch (error) {
      fileWindow?.close();
      showToast(error.message || 'Failed to fetch the document file.');
      await load();
    }
  }

  return (
    <div className="content-card table-card">
      <div className="table-head" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h3>Document Management</h3>
          <div className="subdued" style={{ marginTop: 6 }}>Trip, delivery, vehicle, driver, and business-client documents across the platform.</div>
        </div>
        <div className="filters" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="mini-input"
            placeholder="Search document ID or file"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select className="mini-input" aria-label="Filter documents by type" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}><option value="">All document types</option>{typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}</select>
          <select className="mini-input" aria-label="Filter documents by status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}><option value="">All statuses</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Document ID</th>
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
          {loading && <tr><td colSpan={9} style={{ textAlign: 'center', color: '#b9b9b9', padding: 24 }}>Loading documents...</td></tr>}
          {!loading && failed && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#ff6b6b' }}>Failed to load documents.</td></tr>}
          {!loading && !failed && filteredRows.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>{search.trim() || typeFilter || statusFilter ? 'No documents match the selected search and filters.' : 'No documents found.'}</td></tr>}
          {!loading &&
            !failed &&
            pageRows.map((d) => (
              <tr key={d.id}>
                <td>{d.id || '-'}</td>
                <td>{d.documentType || '-'}</td>
                <td>{getDocumentOwnerTypeLabel(d)}</td>
                <td>{getDocumentOwnerLabel(d)}</td>
                <td>{d.fileName || '-'}</td>
                <td>{d.issueDate || '-'}</td>
                <td>{d.expiryDate || '-'}</td>
                <td><span className={`status-pill ${statusClass(d.status)}`}>{d.status || '-'}</span></td>
                <td>
                  <RowActionMenu label={`Open actions for document ${d.id}`}>
                    <button className="row-action-item" type="button" onClick={() => setSelectedDocument(d)}>View details</button>
                    {d.fileUrl ? (
                      <button className="row-action-item" type="button" onClick={() => openFile(d)}>View file</button>
                    ) : (
                      <span className="row-action-item disabled">View file unavailable</span>
                    )}
                  </RowActionMenu>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {!loading && !failed && filteredRows.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '16px 20px', borderTop: '1px solid #2a2a2a', flexWrap: 'wrap' }}>
          <div className="subdued">Showing <strong>{firstResult}–{lastResult}</strong> of <strong>{filteredRows.length}</strong> documents</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn-yellow" disabled={currentPage <= 1} style={{ padding: '6px 14px', opacity: currentPage <= 1 ? 0.5 : 1 }} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
            <span className="subdued">Page {currentPage} of {totalPages}</span>
            <button className="btn-yellow" disabled={currentPage >= totalPages} style={{ padding: '6px 14px', opacity: currentPage >= totalPages ? 0.5 : 1 }} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
          </div>
        </div>
      )}
      {selectedDocument && <DocumentRelatedDetails document={selectedDocument} onClose={() => setSelectedDocument(null)} />}
    </div>
  );
}
