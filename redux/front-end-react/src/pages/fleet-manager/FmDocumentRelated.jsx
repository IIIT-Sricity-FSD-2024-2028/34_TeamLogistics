import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGetDocumentQuery } from '../../redux/fleetManagerApi';
import DocumentRelatedDetails from '../../redux/FleetManagerDocumentDetails';
import { usePageHeader } from '../../hooks/usePageHeader';

export default function FmDocumentRelated() {
  usePageHeader('Document & Related Files', 'Review the selected document and its linked record');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const documentId = params.get('id') || '';
  const query = useGetDocumentQuery(documentId, { skip: !documentId });
  const document = query.data;
  const error = !documentId ? 'A document ID is required.' : query.error?.message || '';

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
