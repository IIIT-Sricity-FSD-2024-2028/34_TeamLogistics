import { apiFileRequest, apiRequest, qs } from './client';

export const Auth = {
  login: (email, password) => apiRequest('POST', '/auth/login', { email, password }),
  register: (payload) => apiRequest('POST', '/auth/register', payload),
};

export const Users = {
  getAll: (role, search) => apiRequest('GET', `/users${qs({ role, search })}`),
  getById: (id) => apiRequest('GET', `/users/${encodeURIComponent(id)}`),
  getOne: (id) => apiRequest('GET', `/users/${encodeURIComponent(id)}`),
  create: (data) => apiRequest('POST', '/users', data),
  update: (id, data) => apiRequest('PUT', `/users/${encodeURIComponent(id)}`, data),
  updateStatus: (id, status) => apiRequest('PATCH', `/users/${encodeURIComponent(id)}/status`, { status }),
  delete: (id) => apiRequest('DELETE', `/users/${encodeURIComponent(id)}`),
};

export const Approvals = {
  getPending: () => apiRequest('GET', '/users/approvals/pending'),
  review: (id, decision) => apiRequest('PATCH', `/users/${encodeURIComponent(id)}/approval`, { decision }),
};

export const Vehicles = {
  getAll: (search, status) => apiRequest('GET', `/vehicles${qs({ search, status })}`),
  getOne: (id) => apiRequest('GET', `/vehicles/${encodeURIComponent(id)}`),
  create: (data) => apiRequest('POST', '/vehicles', data),
  update: (id, data) => apiRequest('PUT', `/vehicles/${encodeURIComponent(id)}`, data),
  delete: (id) => apiRequest('DELETE', `/vehicles/${encodeURIComponent(id)}`),
};

export const Drivers = {
  getAll: (search) => apiRequest('GET', `/drivers${qs({ search })}`),
  getOne: (id) => apiRequest('GET', `/drivers/${encodeURIComponent(id)}`),
  create: (data) => apiRequest('POST', '/drivers', data),
  update: (id, data) => apiRequest('PUT', `/drivers/${encodeURIComponent(id)}`, data),
  notifyCompliance: (id, message) => apiRequest('POST', `/drivers/${encodeURIComponent(id)}/compliance-notification`, { message }),
  delete: (id) => apiRequest('DELETE', `/drivers/${encodeURIComponent(id)}`),
};

export const Deliveries = {
  getAll: (search, status) => apiRequest('GET', `/deliveries${qs({ search, status })}`),
  getOne: (id) => apiRequest('GET', `/deliveries/${encodeURIComponent(id)}`),
  create: (data) => apiRequest('POST', '/deliveries', data),
  block: (id, reason) => apiRequest('PATCH', `/deliveries/${encodeURIComponent(id)}/block`, { reason }),
  unblock: (id, reason) => apiRequest('PATCH', `/deliveries/${encodeURIComponent(id)}/unblock`, { reason }),
  cancel: (id, reason) => apiRequest('PATCH', `/deliveries/${encodeURIComponent(id)}/cancel`, { reason }),
  feedback: (id, payload) => apiRequest('PATCH', `/deliveries/${encodeURIComponent(id)}/feedback`, payload),
};

export const Trips = {
  updateLocation: (id, position) => apiRequest('PATCH', `/trips/${encodeURIComponent(id)}/location`, position),
  getAll: (search) => apiRequest('GET', `/trips${qs({ search })}`),
  getOne: (id) => apiRequest('GET', `/trips/${encodeURIComponent(id)}`),
  reassign: (id, driver) => apiRequest('PATCH', `/trips/${encodeURIComponent(id)}/reassign`, { driver }),
  updateStatus: (id, status, details = {}) => apiRequest('PATCH', `/trips/${encodeURIComponent(id)}/status`, { status, ...details }),
  reportIssue: (id, issueType, description, status) =>
    apiRequest('PATCH', `/trips/${encodeURIComponent(id)}/report-issue`, { issueType, description, status }),
  addNote: (id, text) => apiRequest('PATCH', `/trips/${encodeURIComponent(id)}/notes`, { text }),
  resolveDispute: (id, resolvedAmount, reason) =>
    apiRequest('PATCH', `/trips/${encodeURIComponent(id)}/resolve-dispute`, { resolvedAmount, reason }),
};

export const MaintenanceAPI = {
  getAll: (search) => apiRequest('GET', `/maintenance${qs({ search })}`),
  getOne: (id) => apiRequest('GET', `/maintenance/${encodeURIComponent(id)}`),
  create: (data) => apiRequest('POST', '/maintenance', data),
  update: (id, data) => apiRequest('PUT', `/maintenance/${encodeURIComponent(id)}`, data),
  delete: (id) => apiRequest('DELETE', `/maintenance/${encodeURIComponent(id)}`),
};

export const Documents = {
  getAll: (search) => apiRequest('GET', `/documents${qs({ search })}`),
  getOne: (id) => apiRequest('GET', `/documents/${encodeURIComponent(id)}`),
  getFile: (id) => apiFileRequest(`/documents/${encodeURIComponent(id)}/file`),
  create: (data) => apiRequest('POST', '/documents', data),
  update: (id, data) => apiRequest('PUT', `/documents/${encodeURIComponent(id)}`, data),
  delete: (id) => apiRequest('DELETE', `/documents/${encodeURIComponent(id)}`),
};

export const Notifications = {
  getAll: () => apiRequest('GET', '/notifications'),
  create: (data) => apiRequest('POST', '/notifications', data),
  markAllRead: () => apiRequest('PATCH', '/notifications/mark-read'),
  markOne: (id, read) => apiRequest('PATCH', `/notifications/${encodeURIComponent(id)}`, { read }),
  delete: (id) => apiRequest('DELETE', `/notifications/${encodeURIComponent(id)}`),
};

export const Transactions = {
  getAll: (search) => apiRequest('GET', `/transactions${qs({ search })}`),
  getPayments: (search) => apiRequest('GET', `/transactions/payments${qs({ search })}`),
  getInvoices: (search) => apiRequest('GET', `/transactions/invoices${qs({ search })}`),
  createPayment: (data) => apiRequest('POST', '/transactions', data),
  createInvoice: (data) => apiRequest('POST', '/transactions/invoices', data),
  generateInvoiceForDelivery: (deliveryId) =>
    apiRequest('POST', `/transactions/invoices/generate/${encodeURIComponent(deliveryId)}`),
  updatePaymentStatus: (transactionId, status) =>
    apiRequest('PATCH', `/transactions/payments/${encodeURIComponent(transactionId)}/status`, { status }),
  getRevenueSummary: () => apiRequest('GET', '/transactions/revenue-summary'),
};

export const Payouts = {
  getPlatformRateCard: () => apiRequest('GET', '/payouts/rate-card/platform'),
  setPlatformRateCard: (data) => apiRequest('PUT', '/payouts/rate-card/platform', data),
  getMyRateCard: () => apiRequest('GET', '/payouts/rate-card/mine'),
  setMyRateCard: (data) => apiRequest('PUT', '/payouts/rate-card/mine', data),
  getMyPayouts: () => apiRequest('GET', '/payouts/driver/mine'),
  listDriverPayouts: () => apiRequest('GET', '/payouts/driver'),
  markPayoutPaid: (id) => apiRequest('PATCH', `/payouts/driver/${encodeURIComponent(id)}/paid`),
  getFleetManagerStatement: (month, fleetManagerId) =>
    apiRequest('GET', `/payouts/fleet-manager/statement${qs({ month, fleetManagerId })}`),
};

export const Settings = {
  getPlatform: () => apiRequest('GET', '/settings/platform'),
  getCommission: () => apiRequest('GET', '/settings/commission'),
  updateCommission: (commissionRate) => apiRequest('PUT', '/settings/commission', { commissionRate }),
  getEconomics: () => apiRequest('GET', '/settings/economics'),
  updateEconomics: (data) => apiRequest('PUT', '/settings/economics', data),
  updatePlatform: (data) => apiRequest('PUT', '/settings/platform', data),
  getSecurity: () => apiRequest('GET', '/settings/security'),
  updateSecurity: (data) => apiRequest('PUT', '/settings/security', data),
  getPermissions: (role) => apiRequest('GET', `/settings/permissions/${encodeURIComponent(role)}`),
  getAllPermissions: () => apiRequest('GET', '/settings/permissions'),
  updatePermissions: (role, permissions) => apiRequest('PUT', `/settings/permissions/${encodeURIComponent(role)}`, { permissions }),
};

export const Dashboard = {
  getSuperuser: () => apiRequest('GET', '/dashboard/superuser'),
  getBusinessClient: () => apiRequest('GET', '/dashboard/business-client'),
  getFleetManager: () => apiRequest('GET', '/dashboard/fleet-manager'),
  getFleetManagerAnalytics: () => apiRequest('GET', '/dashboard/fleet-manager/analytics'),
  getDriver: () => apiRequest('GET', '/dashboard/driver'),
};
