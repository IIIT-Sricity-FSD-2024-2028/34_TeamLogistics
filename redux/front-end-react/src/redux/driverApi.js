import { createApi } from '@reduxjs/toolkit/query/react';

// Reuse the application's authenticated transport and cross-portal change events.
// Tests can supply a transport through the store's thunk extra argument.
async function driverBaseQuery({ method = 'GET', url, body }, { extra }) {
  try {
    const request = extra?.driverRequest || (await import('../api/client.js')).apiRequest;
    return { data: (await request(method, url, body)) ?? null };
  } catch (error) {
    return { error: { status: error.status || 'CUSTOM_ERROR', message: error.message || 'Request failed.' } };
  }
}

const list = (result) => Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : [];
const idPath = (resource, id) => `/${resource}/${encodeURIComponent(id)}`;
export const DRIVER_DATA_TAGS = ['Trips', 'Deliveries', 'Drivers', 'Payouts', 'Notifications'];
const changedTripTags = ['Drivers', 'Trips', 'Deliveries', 'Payouts', 'Notifications'];
const onSuccess = (tags) => (_result, error) => error ? [] : tags;

export const driverApi = createApi({
  reducerPath: 'driverApi',
  baseQuery: driverBaseQuery,
  tagTypes: DRIVER_DATA_TAGS,
  refetchOnMountOrArgChange: true,
  endpoints: (builder) => ({
    getTrips: builder.query({
      query: params => ({url: params ? `/trips?${new URLSearchParams(params)}` : '/trips'}), transformResponse: (data, _meta, params) => params ? data : list(data), providesTags: ['Trips'],
    }),
    getTrip: builder.query({
      query: (id) => ({ url: idPath('trips', id) }), providesTags: ['Trips'],
    }),
    getDeliveries: builder.query({
      query: () => ({ url: '/deliveries' }), transformResponse: list, providesTags: ['Deliveries'],
    }),
    getDelivery: builder.query({
      query: (id) => ({ url: idPath('deliveries', id) }), providesTags: ['Deliveries'],
    }),
    getDrivers: builder.query({
      query: () => ({ url: '/drivers' }), transformResponse: list, providesTags: ['Drivers'],
    }),
    getPayouts: builder.query({
      query: () => ({ url: '/payouts/driver/mine' }), transformResponse: list, providesTags: ['Payouts'],
    }),
    getNotifications: builder.query({
      query: (params) => ({ url: params ? `/notifications?${new URLSearchParams(params)}` : '/notifications' }), transformResponse: (data, _meta, params) => params ? data : list(data), providesTags: ['Notifications'],
    }),
    updateTripStatus: builder.mutation({
      query: ({ id, status, details = {} }) => ({ method: 'PATCH', url: `${idPath('trips', id)}/status`, body: { status, ...details } }),
      invalidatesTags: onSuccess(changedTripTags),
    }),
    completeDelivery: builder.mutation({
      query: ({ id, body }) => ({ method: 'POST', url: `${idPath('trips', id)}/complete`, body }),
      invalidatesTags: onSuccess(changedTripTags),
    }),
    sendRecipientCode: builder.mutation({
      query: (id) => ({ method: 'POST', url: `/deliveries/${encodeURIComponent(id)}/delivery-otp` }),
    }),
    verifyDeliveryOtp: builder.mutation({
      query: ({ id, deliveryOtp }) => ({ method: 'POST', url: `${idPath('trips', id)}/verify-delivery-otp`, body: { deliveryOtp } }),
    }),
    addTripNote: builder.mutation({
      query: ({ id, text }) => ({ method: 'PATCH', url: `${idPath('trips', id)}/notes`, body: { text } }),
      invalidatesTags: onSuccess(['Trips']),
    }),
    reportTripIssue: builder.mutation({
      query: ({ id, issueType, description, evidenceId }) => ({ method: 'PATCH', url: `${idPath('trips', id)}/report-issue`, body: { issueType, description, ...(evidenceId && {evidenceId}), status: 'Issue Reported' } }),
      invalidatesTags: onSuccess(changedTripTags),
    }),
    updateTripLocation: builder.mutation({
      query: ({ id, position }) => ({ method: 'PATCH', url: `${idPath('trips', id)}/location`, body: position }),
      invalidatesTags: onSuccess(['Trips', 'Deliveries']),
    }),
    updateDriver: builder.mutation({
      query: ({ id, changes }) => ({ method: 'PUT', url: idPath('drivers', id), body: changes }),
      invalidatesTags: onSuccess(['Drivers', 'Trips']),
    }),
    uploadDocument: builder.mutation({
      query: (body) => ({ method: 'POST', url: '/documents', body }),
    }),
    markNotification: builder.mutation({
      query: ({ id, read }) => ({ method: 'PATCH', url: idPath('notifications', id), body: { read } }),
      invalidatesTags: onSuccess(['Notifications']),
    }),
    markAllNotificationsRead: builder.mutation({
      query: () => ({ method: 'PATCH', url: '/notifications/mark-read' }),
      invalidatesTags: onSuccess(['Notifications']),
    }),
    deleteNotification: builder.mutation({
      query: (id) => ({ method: 'DELETE', url: idPath('notifications', id) }),
      invalidatesTags: onSuccess(['Notifications']),
    }),
  }),
});

export const {
  useGetTripsQuery, useGetTripQuery, useGetDeliveriesQuery, useGetDeliveryQuery,
  useGetDriversQuery, useGetPayoutsQuery, useGetNotificationsQuery,
  useUpdateTripStatusMutation, useCompleteDeliveryMutation, useSendRecipientCodeMutation, useVerifyDeliveryOtpMutation, useAddTripNoteMutation, useReportTripIssueMutation,
  useUpdateTripLocationMutation, useUpdateDriverMutation, useUploadDocumentMutation,
  useMarkNotificationMutation, useMarkAllNotificationsReadMutation, useDeleteNotificationMutation,
} = driverApi;

export const EMPTY_LIST = Object.freeze([]);
export const queryError = (...queries) => queries.find((query) => query.isError)?.error?.message || '';
