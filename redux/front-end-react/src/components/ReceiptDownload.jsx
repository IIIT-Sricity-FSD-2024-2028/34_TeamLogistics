import { useState } from 'react';
import { apiFileRequest } from '../api/client';

export default function ReceiptDownload({ payment, documentId, filename, children, className }) {
  const [error, setError] = useState('');
  async function download() {
    setError('');
    try {
      const endpoint = documentId ? `/documents/${encodeURIComponent(documentId)}/file` : `/transactions/payments/${encodeURIComponent(payment.id)}/receipt`;
      const file = await apiFileRequest(endpoint);
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || payment?.receiptName || 'receipt';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (cause) {
      setError(cause.message);
    }
  }
  return <><button type="button" className={className} onClick={download}>{children || 'Download receipt'}</button>{error && <span role="alert">{error}</span>}</>;
}
