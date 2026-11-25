import { useState } from 'react';

export function useRecordPage(useQuery, filters) {
  const params = Object.fromEntries(Object.entries(filters).filter(([,value]) => value));
  const key = JSON.stringify(params);
  const [selection, setSelection] = useState({key, page: 1});
  const page = selection.key === key ? selection.page : 1;
  const query = useQuery({page, limit: 8, ...params});
  const data = query.currentData;
  return {query, pageItems: data?.items || [], options: data?.options || {}, totalItems: data?.totalItems || 0,
    currentPage: data?.currentPage || 1, totalPages: data?.totalPages || 1, pageSize: 8,
    setPage: (next) => setSelection({key, page: next})};
}
