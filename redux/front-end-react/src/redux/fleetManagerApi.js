import { createApi } from '@reduxjs/toolkit/query/react';

async function fleetManagerBaseQuery({ method = 'GET', url, body }, { extra }) {
  try {
    const request = extra?.fleetManagerRequest || (await import('../api/client.js')).apiRequest;
    return { data: (await request(method, url, body)) ?? null };
  } catch (error) {
    return { error: { status: error.status || 'CUSTOM_ERROR', message: error.message || 'Request failed.' } };
  }
}

const list = (result) => Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : [];
const path = (resource, id) => `/${resource}/${encodeURIComponent(id)}`;
const success = (tags) => (_result, error) => error ? [] : tags;
const operations = ['Dashboard', 'Analytics', 'Vehicles', 'Drivers', 'Trips', 'Maintenance'];
const driverChanges = [...operations, 'Users', 'Documents', 'Notifications'];
const vehicleChanges = [...operations, 'Notifications'];
const financeChanges = ['Statement', 'Payouts', 'Payments', 'Invoices', 'Analytics', 'Dashboard', 'Notifications'];

export const FLEET_MANAGER_DATA_TAGS = [
  ...operations, 'Users', 'Documents', 'Payments', 'Invoices', 'Payouts', 'Statement',
  'RateCard', 'Platform', 'Permissions', 'Notifications', 'Deliveries', 'Mechanics',
];

export const fleetManagerApi = createApi({
  reducerPath: 'fleetManagerApi',
  baseQuery: fleetManagerBaseQuery,
  tagTypes: FLEET_MANAGER_DATA_TAGS,
  refetchOnMountOrArgChange: true,
  endpoints: (builder) => ({
    getDashboard: builder.query({ query: () => ({ url: '/dashboard/fleet-manager' }), providesTags: ['Dashboard'] }),
    getAnalytics: builder.query({ query: () => ({ url: '/dashboard/fleet-manager/analytics' }), providesTags: ['Analytics'] }),
    getVehicles: builder.query({ query: params => ({url:params ? '/vehicles?' + new URLSearchParams(params) : '/vehicles'}), transformResponse:(data,_meta,params) => params ? data : list(data), providesTags: ['Vehicles'] }),
    getVehicle: builder.query({ query: (id) => ({ url: path('vehicles', id) }), providesTags: ['Vehicles'] }),
    getDrivers: builder.query({ query: params => ({url:params ? '/drivers?' + new URLSearchParams(params) : '/drivers'}), transformResponse:(data,_meta,params) => params ? data : list(data), providesTags: ['Drivers'] }),
    getDriver: builder.query({ query: (id) => ({ url: path('drivers', id) }), providesTags: ['Drivers'] }),
    getDriverUsers: builder.query({ query: () => ({ url: '/users?role=driver' }), transformResponse: list, providesTags: ['Users'] }),
    getUser: builder.query({ query: (id) => ({ url: path('users', id) }), providesTags: ['Users'] }),
    getServiceRoutes: builder.query({query: () => ({url:'/deliveries/routes'})}),
    getTrips: builder.query({ query: (params) => ({ url: params ? '/trips?' + new URLSearchParams(params) : '/trips' }), transformResponse: (data, _meta, params) => params ? data : list(data), providesTags: ['Trips'] }),
    getTrip: builder.query({ query: (id) => ({ url: path('trips', id) }), providesTags: ['Trips'] }),
    getDelivery: builder.query({ query: (id) => ({ url: path('deliveries', id) }), providesTags: ['Deliveries'] }),
    getMaintenance: builder.query({ query: () => ({ url: '/maintenance' }), transformResponse: list, providesTags: ['Maintenance'] }),
    getMaintenanceRecord: builder.query({ query: (id) => ({ url: path('maintenance', id) }), providesTags: ['Maintenance'] }),
    getMechanics: builder.query({ query: () => ({ url: '/mechanics?active=true' }), transformResponse: (raw) => list(raw).filter((record) => record?.active === true && String(record.id || '').trim() && String(record.name || '').trim()), providesTags: ['Mechanics'] }),
    getDocuments: builder.query({ query: () => ({ url: '/documents' }), transformResponse: list, providesTags: ['Documents'] }),
    getDocument: builder.query({ query: (id) => ({ url: path('documents', id) }), providesTags: ['Documents'] }),
    getPayments: builder.query({ query: () => ({ url: '/transactions/payments' }), transformResponse: list, providesTags: ['Payments'] }),
    getInvoices: builder.query({ query: () => ({ url: '/transactions/invoices' }), transformResponse: list, providesTags: ['Invoices'] }),
    getDriverPayouts: builder.query({ query: () => ({ url: '/payouts/driver' }), transformResponse: list, providesTags: ['Payouts'] }),
    getStatement: builder.query({ query: (month) => ({ url: `/payouts/fleet-manager/statement?month=${encodeURIComponent(month || '')}` }), providesTags: ['Statement'] }),
    getRateCard: builder.query({ query: () => ({ url: '/payouts/rate-card/mine' }), providesTags: ['RateCard'] }),
    getPlatform: builder.query({ query: () => ({ url: '/settings/platform' }), providesTags: ['Platform'] }),
    getPermissions: builder.query({ query: () => ({ url: '/settings/permissions/fleet-manager' }), transformResponse: list, providesTags: ['Permissions'] }),
    getNotifications: builder.query({ query: (params) => ({ url: params ? `/notifications?${new URLSearchParams(params)}` : '/notifications' }), transformResponse: (data, _meta, params) => params ? data : list(data), providesTags: ['Notifications'] }),

    createDriver: builder.mutation({ query: (body) => ({ method: 'POST', url: '/drivers', body }), invalidatesTags: success(driverChanges) }),
    updateDriver: builder.mutation({ query: ({ id, changes }) => ({ method: 'PUT', url: path('drivers', id), body: changes }), invalidatesTags: success(driverChanges) }),
    deleteDriver: builder.mutation({ query: (id) => ({ method: 'DELETE', url: path('drivers', id) }), invalidatesTags: success(driverChanges) }),
    notifyDriverCompliance: builder.mutation({ query: ({ id, message }) => ({ method: 'POST', url: `${path('drivers', id)}/compliance-notification`, body: { message } }), invalidatesTags: success(['Notifications']) }),
    createVehicle: builder.mutation({ query: (body) => ({ method: 'POST', url: '/vehicles', body }), invalidatesTags: success(vehicleChanges) }),
    updateVehicle: builder.mutation({ query: ({ id, changes }) => ({ method: 'PUT', url: path('vehicles', id), body: changes }), invalidatesTags: success(vehicleChanges) }),
    deleteVehicle: builder.mutation({ query: (id) => ({ method: 'DELETE', url: path('vehicles', id) }), invalidatesTags: success(vehicleChanges) }),
    reassignTrip: builder.mutation({ query: ({ id, driver }) => ({ method: 'PATCH', url: `${path('trips', id)}/reassign`, body: { driver } }), invalidatesTags: success([...operations, 'Notifications']) }),
    decideFailedAttempt: builder.mutation({ query: ({ id, decision, retryAt }) => ({ method: 'PATCH', url: `${path('trips', id)}/failed-attempt`, body: { decision, retryAt } }), invalidatesTags: success([...operations, 'Notifications']) }),
    resolveTripDispute: builder.mutation({ query: ({ id, resolvedAmount, reason }) => ({ method: 'PATCH', url: `${path('trips', id)}/resolve-dispute`, body: { resolvedAmount, reason } }), invalidatesTags: success([...operations, 'Notifications']) }),
    createMaintenance: builder.mutation({ query: (body) => ({ method: 'POST', url: '/maintenance', body }), invalidatesTags: success(vehicleChanges) }),
    updateMaintenance: builder.mutation({ query: ({ id, changes }) => ({ method: 'PUT', url: path('maintenance', id), body: changes }), invalidatesTags: success(vehicleChanges) }),
    deleteMaintenance: builder.mutation({ query: (id) => ({ method: 'DELETE', url: path('maintenance', id) }), invalidatesTags: success(vehicleChanges) }),
    createDocument: builder.mutation({ query: (body) => ({ method: 'POST', url: '/documents', body }), invalidatesTags: success(['Documents', 'Drivers', 'Notifications']) }),
    updateDocument: builder.mutation({ query: ({ id, changes }) => ({ method: 'PUT', url: path('documents', id), body: changes }), invalidatesTags: success(['Documents', 'Drivers', 'Notifications']) }),
    deleteDocument: builder.mutation({ query: (id) => ({ method: 'DELETE', url: path('documents', id) }), invalidatesTags: success(['Documents', 'Drivers', 'Notifications']) }),
    updateUser: builder.mutation({ query: ({ id, changes }) => ({ method: 'PUT', url: path('users', id), body: changes }), invalidatesTags: success(['Users', 'Dashboard']) }),
    markPayoutPaid: builder.mutation({ query: (id) => ({ method: 'PATCH', url: `${path('payouts/driver', id)}/paid` }), invalidatesTags: success(financeChanges) }),
    updateRateCard: builder.mutation({ query: (body) => ({ method: 'PUT', url: '/payouts/rate-card/mine', body }), invalidatesTags: success(['RateCard', 'Statement', 'Analytics']) }),
    markNotification: builder.mutation({ query: ({ id, read }) => ({ method: 'PATCH', url: path('notifications', id), body: { read } }), invalidatesTags: success(['Notifications']) }),
    markAllNotificationsRead: builder.mutation({ query: () => ({ method: 'PATCH', url: '/notifications/mark-read' }), invalidatesTags: success(['Notifications']) }),
    deleteNotification: builder.mutation({ query: (id) => ({ method: 'DELETE', url: path('notifications', id) }), invalidatesTags: success(['Notifications']) }),
  }),
});

export const {
  useGetServiceRoutesQuery,
  useGetDashboardQuery, useGetAnalyticsQuery, useGetVehiclesQuery, useGetVehicleQuery,
  useGetDriversQuery, useGetDriverQuery, useLazyGetDriverQuery, useGetDriverUsersQuery, useGetUserQuery,
  useGetTripsQuery, useGetTripQuery, useGetDeliveryQuery, useGetMaintenanceQuery, useGetMaintenanceRecordQuery, useGetMechanicsQuery,
  useGetDocumentsQuery, useGetDocumentQuery, useGetPaymentsQuery, useGetInvoicesQuery,
  useGetDriverPayoutsQuery, useGetStatementQuery, useGetRateCardQuery, useGetPlatformQuery,
  useGetPermissionsQuery, useGetNotificationsQuery, useCreateDriverMutation,
  useUpdateDriverMutation, useDeleteDriverMutation, useNotifyDriverComplianceMutation,
  useCreateVehicleMutation, useUpdateVehicleMutation, useDeleteVehicleMutation,
  useReassignTripMutation, useDecideFailedAttemptMutation, useResolveTripDisputeMutation, useCreateMaintenanceMutation,
  useUpdateMaintenanceMutation, useDeleteMaintenanceMutation, useCreateDocumentMutation,
  useUpdateDocumentMutation, useDeleteDocumentMutation, useUpdateUserMutation,
  useMarkPayoutPaidMutation, useUpdateRateCardMutation, useMarkNotificationMutation,
  useMarkAllNotificationsReadMutation, useDeleteNotificationMutation,
} = fleetManagerApi;

export const EMPTY_LIST = Object.freeze([]);
