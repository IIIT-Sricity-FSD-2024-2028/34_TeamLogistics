import { useGetTripQuery, useGetDeliveryQuery, queryError } from './driverApi';

// currentData prevents a previous trip appearing when the URL changes.
export function useDriverTrip(id) {
  const tripQuery = useGetTripQuery(id, { skip: !id });
  const trip = tripQuery.currentData || null;
  const deliveryId = trip?.request || trip?.deliveryId || trip?.deliveryRequestId;
  const deliveryQuery = useGetDeliveryQuery(deliveryId, { skip: !deliveryId });
  return {
    trip,
    delivery: deliveryQuery.currentData || null,
    loading: Boolean(id) && (tripQuery.isLoading || (tripQuery.isFetching && !trip)
      || deliveryQuery.isLoading || (deliveryQuery.isFetching && !deliveryQuery.currentData)),
    error: !id ? 'Trip ID missing in URL.' : queryError(tripQuery)
      || (tripQuery.isSuccess && !trip ? 'Trip not found.' : ''),
  };
}
