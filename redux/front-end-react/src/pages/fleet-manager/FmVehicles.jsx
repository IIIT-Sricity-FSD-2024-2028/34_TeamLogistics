import {useRecordPage} from '../../components/useRecordPage';
import { Link } from 'react-router-dom';
import { useDeleteVehicleMutation, useGetVehiclesQuery } from '../../redux/fleetManagerApi';
import { useFleetManagerFilter } from '../../redux/useFleetManagerFilter';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useToast } from '../../hooks/useToast';
import { pillClass } from './fmUtils';
import ActionMenu from './ActionMenu';
import Pagination from '../../components/Pagination';

export default function FmVehicles() {
  usePageHeader('Vehicle Management', 'Manage and monitor your entire fleet');
  const { showToast } = useToast();
  const [search, setSearch] = useFleetManagerFilter('vehicles', 'search');
  const [typeFilter, setTypeFilter] = useFleetManagerFilter('vehicles', 'typeFilter');
  const [statusFilter, setStatusFilter] = useFleetManagerFilter('vehicles', 'statusFilter');
  const pages = useRecordPage(useGetVehiclesQuery,{search,type:typeFilter,status:statusFilter});
  const query = pages.query;
  const error = query.isError;
  const [deleteVehicle] = useDeleteVehicleMutation();
  const typeOptions = pages.options.type || [];
  const statusOptions = pages.options.status || [];

  async function del(id) {
    if (!confirm(`Delete vehicle ${id}?`)) return;
    await deleteVehicle(id).unwrap();
    showToast('Vehicle deleted');
  }

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-left">
          <label className="search-sm">
            <span>⌕</span>
            <input placeholder="Search vehicle ID or plate..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <select className="filter-select" aria-label="Filter vehicles by type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="">All types</option>{typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}</select>
          <select className="filter-select" aria-label="Filter vehicles by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select>
        </div>
        <Link className="btn btn-yellow" to="/fleet-manager/add-vehicle">
          ＋ Add Vehicle
        </Link>
      </div>
      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Vehicle ID</th>
              <th>Plate Number</th>
              <th>Type</th>
              <th>Status</th>
              <th>Last Maintenance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#ff8d8d', padding: 18 }}>
                  Failed to load vehicles from backend.
                </td>
              </tr>
            ) : query.isLoading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 18, color: '#888' }}>
                  Loading vehicles...
                </td>
              </tr>
            ) : pages.totalItems === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 18, color: '#888' }}>
                  {search.trim() || typeFilter || statusFilter ? 'No vehicles match the selected search and filters.' : 'No vehicles found.'}
                </td>
              </tr>
            ) : (
              pages.pageItems.map((v) => (
                <tr key={v.id}>
                  <td className="em">{v.id}</td>
                  <td>{v.plate || v.plateNumber || '--'}</td>
                  <td>{v.type || '--'}</td>
                  <td>
                    <span className={`pill ${pillClass(v.status)}`}>{v.status || '--'}</span>
                  </td>
                  <td>{v.maintenance || v.lastMaintenance || '--'}</td>
                  <td>
                    <ActionMenu>
                      <Link to={`/fleet-manager/edit-vehicle?id=${encodeURIComponent(v.id)}`}>Edit</Link>
                      <button className="danger" onClick={() => del(v.id)}>
                        Delete
                      </button>
                    </ActionMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination {...pages} onPageChange={pages.setPage} itemLabel="vehicles" />
      </section>
    </>
  );
}
