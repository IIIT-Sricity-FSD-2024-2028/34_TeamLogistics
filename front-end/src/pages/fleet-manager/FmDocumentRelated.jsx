import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Documents } from '../../api/namespaces';
import DocumentRelatedDetails from '../../components/DocumentRelatedDetails';
import { usePageHeader } from '../../hooks/usePageHeader';

export default function FmDocumentRelated() {
  usePageHeader('Document & Related Files', 'Review the selected document and its linked record');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const documentId = params.get('id') || '';
  const [document, setDocument] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadDocument() {
      if (!documentId) {
        setError('A document ID is required.');
        return;
      }

      try {
        const row = await Documents.getOne(documentId);
        if (!cancelled) setDocument(row);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Failed to load the document.');
      }
    }

    loadDocument();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const returnToDocuments = () => navigate('/fleet-manager/documents');

  if (error) {
    return (
      <section className="panel">
        <div className="panel-body" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: '#ff8d8d', marginBottom: 16 }}>{error}</div>
          <button className="btn btn-yellow" type="button" onClick={returnToDocuments}>Back to Documents</button>
        </div>
      </section>
    );
  }

  if (!document) {
    return <section className="panel"><div className="panel-body" style={{ padding: 24, textAlign: 'center', color: '#888' }}>Loading document details...</div></section>;
  }

  return <DocumentRelatedDetails document={document} onClose={returnToDocuments} standalone />;
}
