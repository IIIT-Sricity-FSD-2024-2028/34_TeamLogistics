import { createApi } from '@reduxjs/toolkit/query/react';

async function superuserBaseQuery({ method = 'GET', url, body }, { extra }) {
  try {
    const request = extra?.superuserRequest || (await import('../api/client.js')).apiRequest;
    return { data: (await request(method, url, body)) ?? null };
  } catch (error) {
    return { error: { status: error.status || 'CUSTOM_ERROR', message: error.message || 'Request failed.' } };
  }
}

const list = (result) => Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : [];
const path = (resource, id) => `/${resource}/${encodeURIComponent(id)}`;
const onSuccess = (tags) => (_result, error) => error ? [] : tags;
const userTags = ['Users', 'Approvals', 'Drivers', 'Vehicles', 'Trips', 'Deliveries', 'Dashboard', 'Notifications'];
const vehicleTags = ['Vehicles', 'Maintenance', 'Dashboard', 'Notifications'];
const financeTags = ['Payments', 'Invoices', 'Revenue', 'Payouts', 'Settlements', 'Dashboard', 'Notifications'];
export const SUPERUSER_DATA_TAGS = [
  'Dashboard', 'Users', 'Approvals', 'Deliveries', 'Trips', 'Vehicles', 'Drivers',
  'Maintenance', 'Documents', 'Invoices', 'Payments', 'Revenue', 'Payouts',
  'Settlements', 'Economics', 'RateCard', 'Security', 'Permissions', 'Notifications',
];

export const superuserApi = createApi({
  reducerPath: 'superuserApi',
  baseQuery: superuserBaseQuery,
  tagTypes: SUPERUSER_DATA_TAGS,
  refetchOnMountOrArgChange: true,
  endpoints: (builder) => ({
    getDashboard: builder.query({ query: () => ({ url: '/dashboard/superuser' }), providesTags: ['Dashboard'] }),
    getUsers: builder.query({ query: () => ({ url: '/users' }), transformResponse: list, providesTags: ['Users'] }),
    getUser: builder.query({ query: (id) => ({ url: path('users', id) }), providesTags: ['Users'] }),
    getApprovals: builder.query({ query: () => ({ url: '/users/approvals/pending' }), transformResponse: list, providesTags: ['Approvals'] }),
    getDeliveries: builder.query({ query: (params) => ({ url: params ? '/deliveries?' + new URLSearchParams(params) : '/deliveries' }), transformResponse: (data, _meta, params) => params ? data : list(data), providesTags: ['Deliveries'] }),
    getDelivery: builder.query({ query: (id) => ({ url: path('deliveries', id) }), providesTags: ['Deliveries'] }),
    getTrips: builder.query({ query: (params) => ({ url: params ? '/trips?' + new URLSearchParams(params) : '/trips' }), transformResponse: (data, _meta, params) => params ? data : list(data), providesTags: ['Trips'] }),
    getTrip: builder.query({ query: (id) => ({ url: path('trips', id) }), providesTags: ['Trips'] }),
    getVehicles: builder.query({ query: params => ({url:params ? '/vehicles?' + new URLSearchParams(params) : '/vehicles'}), transformResponse:(data,_meta,params) => params ? data : list(data), providesTags: ['Vehicles'] }),
    getVehicle: builder.query({ query: (id) => ({ url: path('vehicles', id) }), providesTags: ['Vehicles'] }),
    getDrivers: builder.query({ query: params => ({url:params ? '/drivers?' + new URLSearchParams(params) : '/drivers'}), transformResponse:(data,_meta,params) => params ? data : list(data), providesTags: ['Drivers'] }),
    getMaintenance: builder.query({ query: () => ({ url: '/maintenance' }), transformResponse: list, providesTags: ['Maintenance'] }),
    getMaintenanceRecord: builder.query({ query: (id) => ({ url: path('maintenance', id) }), providesTags: ['Maintenance'] }),
    getDocuments: builder.query({ query: () => ({ url: '/documents' }), transformResponse: list, providesTags: ['Documents'] }),
    getInvoices: builder.query({ query: () => ({ url: '/transactions/invoices' }), transformResponse: list, providesTags: ['Invoices'] }),
    getPayments: builder.query({ query: () => ({ url: '/transactions/payments' }), transformResponse: list, providesTags: ['Payments'] }),
    getRevenue: builder.query({ query: () => ({ url: '/transactions/revenue-summary' }), providesTags: ['Revenue'] }),
    getPayouts: builder.query({ query: () => ({ url: '/payouts/driver' }), transformResponse: list, providesTags: ['Payouts'] }),
    getSettlements: builder.query({ query: () => ({ url: '/payouts/fleet-manager/settlements' }), transformResponse: list, providesTags: ['Settlements'] }),
    getEconomics: builder.query({ query: () => ({ url: '/settings/economics' }), providesTags: ['Economics'] }),
    getRateCard: builder.query({ query: () => ({ url: '/payouts/rate-card/platform' }), providesTags: ['RateCard'] }),
    getSecurity: builder.query({ query: () => ({ url: '/settings/security' }), providesTags: ['Security'] }),
    getPermissions: builder.query({
      query: (role) => ({ url: path('settings/permissions', role) }),
      transformResponse: (raw) => (Array.isArray(raw) ? raw : raw?.permissions || []).map((p, i) => ({
        name: p.name || p.title || p[0] || `Permission ${i + 1}`,
        description: p.description || p.desc || p[1] || '',
        enabled: typeof p.enabled === 'boolean' ? p.enabled : Boolean(p[2]),
      })),
      providesTags: (_result, _error, role) => [{ type: 'Permissions', id: role }],
    }),
    createUser: builder.mutation({ query: (body) => ({ method: 'POST', url: '/users', body }), invalidatesTags: onSuccess(userTags) }),
    updateUser: builder.mutation({ query: ({ id, changes }) => ({ method: 'PUT', url: path('users', id), body: changes }), invalidatesTags: onSuccess(userTags) }),
    updateUserStatus: builder.mutation({ query: ({ id, status }) => ({ method: 'PATCH', url: `${path('users', id)}/status`, body: { status } }), invalidatesTags: onSuccess(userTags) }),
    deleteUser: builder.mutation({ query: (id) => ({ method: 'DELETE', url: path('users', id) }), invalidatesTags: onSuccess(userTags) }),
    reviewApproval: builder.mutation({ query: ({ id, decision }) => ({ method: 'PATCH', url: `${path('users', id)}/approval`, body: { decision } }), invalidatesTags: onSuccess(userTags) }),
    blockDelivery: builder.mutation({ query: ({ id, reason }) => ({ method: 'PATCH', url: `${path('deliveries', id)}/block`, body: { reason } }), invalidatesTags: onSuccess(['Deliveries', 'Trips', 'Dashboard', 'Notifications']) }),
    unblockDelivery: builder.mutation({ query: ({ id, reason }) => ({ method: 'PATCH', url: `${path('deliveries', id)}/unblock`, body: { reason } }), invalidatesTags: onSuccess(['Deliveries', 'Trips', 'Dashboard', 'Notifications']) }),
    createVehicle: builder.mutation({ query: (body) => ({ method: 'POST', url: '/vehicles', body }), invalidatesTags: onSuccess(vehicleTags) }),
    updateVehicle: builder.mutation({ query: ({ id, changes }) => ({ method: 'PUT', url: path('vehicles', id), body: changes }), invalidatesTags: onSuccess(vehicleTags) }),
    deleteVehicle: builder.mutation({ query: (id) => ({ method: 'DELETE', url: path('vehicles', id) }), invalidatesTags: onSuccess(vehicleTags) }),
    createMaintenance: builder.mutation({ query: (body) => ({ method: 'POST', url: '/maintenance', body }), invalidatesTags: onSuccess(vehicleTags) }),
    updateMaintenance: builder.mutation({ query: ({ id, changes }) => ({ method: 'PUT', url: path('maintenance', id), body: changes }), invalidatesTags: onSuccess(vehicleTags) }),
    deleteMaintenance: builder.mutation({ query: (id) => ({ method: 'DELETE', url: path('maintenance', id) }), invalidatesTags: onSuccess(vehicleTags) }),
    reversePayment: builder.mutation({ query: ({id, kind, reason}) => ({method: 'POST', url: path('transactions/payments',id) + '/reversal', body: {kind, reason}}), invalidatesTags: onSuccess(financeTags) }),
    reviewPayment: builder.mutation({ query: ({ id, status }) => ({ method: 'PATCH', url: `${path('transactions/payments', id)}/status`, body: { status } }), invalidatesTags: onSuccess(financeTags) }),
    markPayoutPaid: builder.mutation({ query: (id) => ({ method: 'PATCH', url: `${path('payouts/driver', id)}/paid` }), invalidatesTags: onSuccess(financeTags) }),
    createSettlement: builder.mutation({ query: (body) => ({ method: 'POST', url: '/payouts/fleet-manager/settlement', body }), invalidatesTags: onSuccess(['Settlements', 'Notifications']) }),
    lockSettlement: builder.mutation({ query: (body) => ({ method: 'POST', url: '/payouts/fleet-manager/settlement/lock', body }), invalidatesTags: onSuccess(['Settlements', 'Notifications']) }),
    updateEconomics: builder.mutation({ query: (body) => ({ method: 'PUT', url: '/settings/economics', body }), invalidatesTags: onSuccess(['Economics', 'Revenue', 'Dashboard']) }),
    updateRateCard: builder.mutation({ query: (body) => ({ method: 'PUT', url: '/payouts/rate-card/platform', body }), invalidatesTags: onSuccess(['RateCard']) }),
    updateSecurity: builder.mutation({ query: (body) => ({ method: 'PUT', url: '/settings/security', body }), invalidatesTags: onSuccess(['Security']) }),
    updatePermissions: builder.mutation({
      query: ({ role, permissions }) => ({ method: 'PUT', url: path('settings/permissions', role), body: { permissions } }),
      invalidatesTags: (_result, error, { role }) => error ? [] : [{ type: 'Permissions', id: role }],
    }),
    getNotifications: builder.query({ query: (params) => ({ url: params ? `/notifications?${new URLSearchParams(params)}` : '/notifications' }), transformResponse: (data, _meta, params) => params ? data : list(data), providesTags: ['Notifications'] }),
    markNotification: builder.mutation({ query: ({ id, read }) => ({ method: 'PATCH', url: path('notifications', id), body: { read } }), invalidatesTags: onSuccess(['Notifications']) }),
    markAllNotificationsRead: builder.mutation({ query: () => ({ method: 'PATCH', url: '/notifications/mark-read' }), invalidatesTags: onSuccess(['Notifications']) }),
    deleteNotification: builder.mutation({ query: (id) => ({ method: 'DELETE', url: path('notifications', id) }), invalidatesTags: onSuccess(['Notifications']) }),
  }),
});

export const {
  useReversePaymentMutation, useGetDashboardQuery, useGetUsersQuery, useGetUserQuery, useGetApprovalsQuery,
  useGetDeliveriesQuery, useGetDeliveryQuery, useGetTripsQuery, useGetTripQuery,
  useGetVehiclesQuery, useGetVehicleQuery, useGetDriversQuery, useGetMaintenanceQuery,
  useGetMaintenanceRecordQuery, useGetDocumentsQuery, useGetInvoicesQuery,
  useGetPaymentsQuery, useGetRevenueQuery, useGetPayoutsQuery, useGetSettlementsQuery,
  useGetEconomicsQuery, useGetRateCardQuery, useGetSecurityQuery, useGetPermissionsQuery,
  useCreateUserMutation, useUpdateUserMutation, useUpdateUserStatusMutation, useDeleteUserMutation,
  useReviewApprovalMutation, useBlockDeliveryMutation, useUnblockDeliveryMutation,
  useCreateVehicleMutation, useUpdateVehicleMutation, useDeleteVehicleMutation,
  useCreateMaintenanceMutation, useUpdateMaintenanceMutation, useDeleteMaintenanceMutation,
  useReviewPaymentMutation, useMarkPayoutPaidMutation, useCreateSettlementMutation, useLockSettlementMutation,
  useUpdateEconomicsMutation, useUpdateRateCardMutation, useUpdateSecurityMutation, useUpdatePermissionsMutation,
  useGetNotificationsQuery, useMarkNotificationMutation, useMarkAllNotificationsReadMutation, useDeleteNotificationMutation,
} = superuserApi;

export const EMPTY_LIST = Object.freeze([]);
export const queryError = (...queries) => queries.find((query) => query.isError)?.error?.message || '';
