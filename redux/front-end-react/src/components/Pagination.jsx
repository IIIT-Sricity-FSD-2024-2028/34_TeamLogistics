import { useEffect, useMemo, useState } from 'react';
import './Pagination.css';

export const DEFAULT_PAGE_SIZE = 8;

export function usePagination(items, { pageSize = DEFAULT_PAGE_SIZE, resetKey = '' } = {}) {
  const rows = Array.isArray(items) ? items : [];
  const [page, setPage] = useState(1);
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(
    () => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [rows, currentPage, pageSize],
  );

  return { pageItems, currentPage, totalPages, totalItems, pageSize, setPage };
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange,
  itemLabel = 'items',
}) {
  if (!totalItems || totalPages <= 1) return null;

  const first = (currentPage - 1) * pageSize + 1;
  const last = Math.min(currentPage * pageSize, totalItems);

  return (
    <nav className="ds-pagination" aria-label={`${itemLabel} pagination`}>
      <span className="ds-pagination__summary">Showing {first}–{last} of {totalItems} {itemLabel}</span>
      <div className="ds-pagination__actions">
        <button type="button" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>Previous</button>
        <span>Page {currentPage} of {totalPages}</span>
        <button type="button" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>Next</button>
      </div>
    </nav>
  );
}
