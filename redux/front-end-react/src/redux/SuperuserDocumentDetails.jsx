import { DocumentRelatedDetailsView } from '../components/DocumentRelatedDetails';
import { useGetVehiclesQuery, useGetDriversQuery, useGetTripsQuery, useGetDeliveryQuery, EMPTY_LIST, queryError } from './superuserApi';

const normalize = (value) => String(value || '').trim().toLowerCase();

export default function SuperuserDocumentDetails({ document, ...props }) {
  const ownerType = normalize(document?.ownerType);
  const vehicles = useGetVehiclesQuery(undefined, { skip: ownerType !== 'vehicle' });
  const drivers = useGetDriversQuery(undefined, { skip: ownerType !== 'driver' });
  const trips = useGetTripsQuery(undefined, { skip: ownerType !== 'delivery' });
  const delivery = useGetDeliveryQuery(document?.delivery, { skip: ownerType !== 'delivery' || !document?.delivery });
  const loading = [vehicles, drivers, trips, delivery].some((query) => query.isLoading || (query.isFetching && !query.currentData));
  let related = null;
  let error = queryError(vehicles, drivers, trips);
  if (ownerType === 'vehicle') {
    const owner = normalize(document?.vehicle);
    const record = (vehicles.data || EMPTY_LIST).find((item) => owner && [item.id, item.plate, item.plateNumber, item.vehicleNumber].some((value) => normalize(value) === owner));
    if (record) related = { kind: 'vehicle', record };
    else error ||= `Vehicle ${document?.vehicle || ''} was not found.`;
  } else if (ownerType === 'driver') {
    const owner = normalize(document?.driver);
    const record = (drivers.data || EMPTY_LIST).find((item) => owner && [item.id, item.name, item.driver, item.email].some((value) => normalize(value) === owner));
    if (record) related = { kind: 'driver', record };
    else error ||= `Driver ${document?.driver || ''} was not found.`;
  } else if (ownerType === 'delivery') {
    const owner = normalize(document?.delivery);
    const record = (trips.data || EMPTY_LIST).find((item) => owner && [item.id, item.request, item.deliveryId, item.deliveryRequestId].some((value) => normalize(value) === owner));
    if (record || delivery.currentData) related = { kind: 'trip', record, delivery: delivery.currentData };
    else error ||= `Trip or delivery ${document?.delivery || ''} was not found.`;
  } else {
    error = 'This document type does not have a linked trip, driver, or vehicle.';
  }
  return <DocumentRelatedDetailsView {...props} document={document} related={related} loading={loading} error={error} />;
}
