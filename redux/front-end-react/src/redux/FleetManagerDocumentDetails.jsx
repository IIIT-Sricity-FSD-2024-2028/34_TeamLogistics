import { DocumentRelatedDetailsView } from '../components/DocumentRelatedDetails';
import { useGetDeliveryQuery, useGetDriversQuery, useGetTripsQuery, useGetVehiclesQuery, EMPTY_LIST } from './fleetManagerApi';

const normalize = (value) => String(value || '').trim().toLowerCase();

export default function FleetManagerDocumentDetails({ document, ...props }) {
  const ownerType = String(document?.ownerType || '').toLowerCase();
  const deliveryId = document?.delivery || document?.deliveryId || '';
  const vehicles = useGetVehiclesQuery(undefined, { skip: ownerType !== 'vehicle' });
  const drivers = useGetDriversQuery(undefined, { skip: ownerType !== 'driver' });
  const trips = useGetTripsQuery(undefined, { skip: ownerType !== 'delivery' });
  const delivery = useGetDeliveryQuery(deliveryId, { skip: ownerType !== 'delivery' || !deliveryId });
  let related = null;
  if (ownerType === 'vehicle') {
    const owner = normalize(document?.vehicle);
    const record = (vehicles.data || EMPTY_LIST).find((item) => [item.id, item.plate, item.plateNumber, item.vehicleNumber].some((value) => normalize(value) === owner));
    if (record) related = { kind: 'vehicle', record };
  } else if (ownerType === 'driver') {
    const owner = normalize(document?.driver);
    const record = (drivers.data || EMPTY_LIST).find((item) => [item.id, item.name, item.driver, item.email].some((value) => normalize(value) === owner));
    if (record) related = { kind: 'driver', record };
  } else if (ownerType === 'delivery') {
    const owner = normalize(deliveryId);
    const record = (trips.data || EMPTY_LIST).find((item) => [item.id, item.request, item.deliveryId, item.deliveryRequestId].some((value) => normalize(value) === owner));
    if (record || delivery.data) related = { kind: 'trip', record, delivery: delivery.data };
  }
  const queries = ownerType === 'vehicle' ? [vehicles] : ownerType === 'driver' ? [drivers] : ownerType === 'delivery' ? [trips, delivery] : [];
  const loading = queries.some((query) => query.isLoading);
  const error = related ? '' : queries.find((query) => query.isError)?.error?.message || (!loading ? 'The linked record was not found.' : '');
  return <DocumentRelatedDetailsView document={document} related={related} loading={loading} error={error} {...props} />;
}
