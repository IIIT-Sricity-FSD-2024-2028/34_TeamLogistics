import { createApi } from '@reduxjs/toolkit/query/react';
import { getArray } from '../pages/business-client/bcUtils.js';

async function businessClientBaseQuery({ method = 'GET', url, body }, { extra }) {
  try {
    const request = extra?.businessClientRequest || (await import('../api/client.js')).apiRequest;
    return { data: (await request(method, url, body)) ?? null };
  } catch (error) {
    return { error: { status: error.status || 'CUSTOM_ERROR', message: error.message || 'Request failed.' } };
  }
}

const idPath = (resource, id) => `/${resource}/${encodeURIComponent(id)}`;
const onSuccess = (tags) => (_result, error) => error ? [] : tags;
export const BUSINESS_CLIENT_DATA_TAGS = ['Deliveries', 'Trips', 'Drivers', 'Vehicles', 'Invoices', 'Payments', 'User', 'Notifications'];

export const businessClientApi = createApi({
  reducerPath: 'businessClientApi',
  baseQuery: businessClientBaseQuery,
  tagTypes: BUSINESS_CLIENT_DATA_TAGS,
  refetchOnMountOrArgChange: true,
  endpoints: (builder) => ({
    getBusinessDashboard: builder.query({query: () => ({url:'/dashboard/business-client'}), providesTags:['Deliveries','Invoices','Payments']}),
    getDeliveries: builder.query({ query: (params) => ({ url: params ? '/deliveries?' + new URLSearchParams(params) : '/deliveries' }), transformResponse: (data, _meta, params) => params ? data : getArray(data), providesTags: ['Deliveries'],
    }),
    getTracking: builder.query({query: id => ({url:idPath('deliveries',id) + '/tracking'}), providesTags:['Deliveries','Trips','Vehicles','Drivers']}),
    getParcelLabel: builder.query({query: (id) => ({url: idPath('deliveries', id) + '/label'})}),
    getDelivery: builder.query({
      query: (id) => ({ url: idPath('deliveries', id) }), providesTags: ['Deliveries'],
    }),
    getTrips: builder.query({
      query: () => ({ url: '/trips' }), transformResponse: getArray, providesTags: ['Trips'],
    }),
    getDrivers: builder.query({
      query: () => ({ url: '/drivers' }), transformResponse: getArray, providesTags: ['Drivers'],
    }),
    getVehicles: builder.query({
      query: () => ({ url: '/vehicles' }), transformResponse: getArray, providesTags: ['Vehicles'],
    }),
    getInvoices: builder.query({
      query: params => ({url: params ? '/transactions/invoices?' + new URLSearchParams(params) : '/transactions/invoices'}), transformResponse: (data, _meta, params) => params ? data : getArray(data), providesTags: ['Invoices'],
    }),
    getPayments: builder.query({
      query: params => ({url: params ? '/transactions/payments?' + new URLSearchParams(params) : '/transactions/payments'}), transformResponse: (data, _meta, params) => params ? data : getArray(data), providesTags: ['Payments'],
    }),
    getCurrentUser: builder.query({
      async queryFn(id, _api, _options, baseQuery) {
        const result = await baseQuery({ url: idPath('users', id) });
        if (result.error) return result;
        if (!result.data || String(result.data.id) !== String(id)) {
          return { error: { status: 'CUSTOM_ERROR', message: 'Could not load the logged-in business client profile.' } };
        }
        return result;
      },
      providesTags: ['User'],
    }),
    startPhoneVerification: builder.mutation({ query: (phone) => ({ method: 'POST', url: '/deliveries/recipient/start', body: { phone } }) }),
    confirmPhoneVerification: builder.mutation({ query: (body) => ({ method: 'POST', url: '/deliveries/recipient/confirm', body }) }),
    getServiceRoutes: builder.query({ query: () => ({ url: '/deliveries/routes' }) }),
    getDeliveryQuote: builder.query({
      query: (body) => ({ method: 'POST', url: '/deliveries/quote', body }),
      keepUnusedDataFor: 0,
    }),
    createDelivery: builder.mutation({
      query: (body) => ({ method: 'POST', url: '/deliveries', body }),
      invalidatesTags: onSuccess(['Deliveries', 'Notifications']),
    }),
    cancelDelivery: builder.mutation({
      query: ({ id, reason }) => ({ method: 'PATCH', url: `${idPath('deliveries', id)}/cancel`, body: { reason } }),
      invalidatesTags: onSuccess(['Deliveries', 'Trips', 'Invoices', 'Notifications']),
    }),
    setMissingRecipient: builder.mutation({
      query: ({ id, ...body }) => ({ method: 'PATCH', url: `${idPath('deliveries', id)}/recipient`, body }),
      invalidatesTags: onSuccess(['Deliveries']),
    }),
    issueDeliveryOtp: builder.mutation({
      query: (id) => ({ method: 'POST', url: `${idPath('deliveries', id)}/delivery-otp` }),
      invalidatesTags: onSuccess(['Deliveries', 'Notifications']),
    }),
    submitFeedback: builder.mutation({
      query: ({ id, feedback }) => ({ method: 'PATCH', url: `${idPath('deliveries', id)}/feedback`, body: feedback }),
      invalidatesTags: onSuccess(['Deliveries', 'Trips', 'Notifications']),
    }),
    createPayment: builder.mutation({
      query: (body) => ({ method: 'POST', url: '/transactions', body }),
      invalidatesTags: onSuccess(['Invoices', 'Payments', 'Notifications']),
    }),
    updateProfile: builder.mutation({
      query: ({ id, changes }) => ({ method: 'PUT', url: idPath('users', id), body: changes }),
      invalidatesTags: onSuccess(['User', 'Deliveries', 'Invoices', 'Payments']),
    }),
    uploadDocument: builder.mutation({
      query: (body) => ({ method: 'POST', url: '/documents', body }),
    }),
    getNotifications: builder.query({
      query: (params) => ({ url: params ? `/notifications?${new URLSearchParams(params)}` : '/notifications' }), transformResponse: (data, _meta, params) => params ? data : getArray(data), providesTags: ['Notifications'],
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
  useGetTrackingQuery, useGetBusinessDashboardQuery, useGetParcelLabelQuery, useGetDeliveriesQuery, useGetDeliveryQuery, useGetTripsQuery, useGetDriversQuery,
  useGetVehiclesQuery, useGetInvoicesQuery, useGetPaymentsQuery, useGetCurrentUserQuery,
  useStartPhoneVerificationMutation, useConfirmPhoneVerificationMutation,
  useGetServiceRoutesQuery, useGetDeliveryQuoteQuery, useCreateDeliveryMutation, useCancelDeliveryMutation, useIssueDeliveryOtpMutation, useSetMissingRecipientMutation,
  useSubmitFeedbackMutation, useCreatePaymentMutation, useUpdateProfileMutation,
  useUploadDocumentMutation, useGetNotificationsQuery, useMarkNotificationMutation,
  useMarkAllNotificationsReadMutation, useDeleteNotificationMutation,
} = businessClientApi;

export const EMPTY_LIST = Object.freeze([]);
export const queryError = (...queries) => queries.find((query) => query.isError)?.error?.message || '';
