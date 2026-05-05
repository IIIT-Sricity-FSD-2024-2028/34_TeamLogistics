/**
 * DeliverSync API Client
 * Replaces localStorage-based mock data with backend API calls.
 * Include this file BEFORE data.js and role-specific JS files.
 */
(function () {
  const API_BASE = 'http://localhost:3000/api';

  // Get current user role from session or default
  function getCurrentRole() {
    try {
      const session = JSON.parse(localStorage.getItem('deliverysync-session-v1') || 'null');
      return session ? session.role : 'superuser';
    } catch (e) {
      return 'superuser';
    }
  }

  function getCurrentUserId() {
    try {
      const session = JSON.parse(localStorage.getItem('deliverysync-session-v1') || 'null');
      return session ? session.userId : '';
    } catch (e) {
      return '';
    }
  }

  // Standard headers for all API calls
  function getHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-user-role': getCurrentRole(),
      'x-user-id': getCurrentUserId(),
    };
  }

  // Generic fetch wrapper with error handling
  async function apiRequest(method, endpoint, body = null) {
    const options = {
      method,
      headers: getHeaders(),
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, options);

      let data = null;

      try {
        data = await response.json();
      } catch (jsonError) {
        data = null;
      }

      if (!response.ok) {
        console.error(`API Error [${response.status}]:`, data?.message || data);
        throw new Error(data?.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // ─── Users API ───
  const UsersAPI = {
    getAll: (role, search) => {
      const params = new URLSearchParams();

      if (role) params.set('role', role);
      if (search) params.set('search', search);

      const qs = params.toString();

      return apiRequest('GET', `/users${qs ? '?' + qs : ''}`);
    },

    getOne: (id) =>
      apiRequest('GET', `/users/${encodeURIComponent(id)}`),

    create: (data) =>
      apiRequest('POST', '/users', data),

    update: (id, data) =>
      apiRequest('PUT', `/users/${encodeURIComponent(id)}`, data),

    updateStatus: (id, status) =>
      apiRequest('PATCH', `/users/${encodeURIComponent(id)}/status`, { status }),

    delete: (id) =>
      apiRequest('DELETE', `/users/${encodeURIComponent(id)}`),
  };

  // ─── Vehicles API ───
  const VehiclesAPI = {
    getAll: (search, status) => {
      const params = new URLSearchParams();

      if (search) params.set('search', search);
      if (status) params.set('status', status);

      const qs = params.toString();

      return apiRequest('GET', `/vehicles${qs ? '?' + qs : ''}`);
    },

    getOne: (id) =>
      apiRequest('GET', `/vehicles/${encodeURIComponent(id)}`),

    create: (data) =>
      apiRequest('POST', '/vehicles', data),

    update: (id, data) =>
      apiRequest('PUT', `/vehicles/${encodeURIComponent(id)}`, data),

    delete: (id) =>
      apiRequest('DELETE', `/vehicles/${encodeURIComponent(id)}`),
  };

  // ─── Drivers API ───
  const DriversAPI = {
    getAll: (search) => {
      const params = new URLSearchParams();

      if (search) params.set('search', search);

      const qs = params.toString();

      return apiRequest('GET', `/drivers${qs ? '?' + qs : ''}`);
    },

    getOne: (id) =>
      apiRequest('GET', `/drivers/${encodeURIComponent(id)}`),

    create: (data) =>
      apiRequest('POST', '/drivers', data),

    update: (id, data) =>
      apiRequest('PUT', `/drivers/${encodeURIComponent(id)}`, data),

    delete: (id) =>
      apiRequest('DELETE', `/drivers/${encodeURIComponent(id)}`),
  };

  // ─── Deliveries API ───
  const DeliveriesAPI = {
    getAll: (search, status) => {
      const params = new URLSearchParams();

      if (search) params.set('search', search);
      if (status) params.set('status', status);

      const qs = params.toString();

      return apiRequest('GET', `/deliveries${qs ? '?' + qs : ''}`);
    },

    getOne: (id) =>
      apiRequest('GET', `/deliveries/${encodeURIComponent(id)}`),

    create: (data) =>
      apiRequest('POST', '/deliveries', data),

    block: (id, reason) =>
      apiRequest('PATCH', `/deliveries/${encodeURIComponent(id)}/block`, { reason }),

    unblock: (id, reason) =>
      apiRequest('PATCH', `/deliveries/${encodeURIComponent(id)}/unblock`, { reason }),

    cancel: (id, reason) =>
      apiRequest('PATCH', `/deliveries/${encodeURIComponent(id)}/cancel`, { reason }),
  };

  // ─── Trips API ───
  const TripsAPI = {
    getAll: (search) => {
      const params = new URLSearchParams();

      if (search) params.set('search', search);

      const qs = params.toString();

      return apiRequest('GET', `/trips${qs ? '?' + qs : ''}`);
    },

    getOne: (id) =>
      apiRequest('GET', `/trips/${encodeURIComponent(id)}`),

    reassign: (id, driver) =>
      apiRequest('PATCH', `/trips/${encodeURIComponent(id)}/reassign`, { driver }),

    updateStatus: (id, status) =>
      apiRequest('PATCH', `/trips/${encodeURIComponent(id)}/status`, { status }),

    reportIssue: (id, issue) =>
      apiRequest('PATCH', `/trips/${encodeURIComponent(id)}/report-issue`, { issue }),
  };

  // ─── Maintenance API ───
  const MaintenanceAPI = {
    getAll: (search) => {
      const params = new URLSearchParams();

      if (search) params.set('search', search);

      const qs = params.toString();

      return apiRequest('GET', `/maintenance${qs ? '?' + qs : ''}`);
    },

    getOne: (id) =>
      apiRequest('GET', `/maintenance/${encodeURIComponent(id)}`),

    create: (data) =>
      apiRequest('POST', '/maintenance', data),

    update: (id, data) =>
      apiRequest('PUT', `/maintenance/${encodeURIComponent(id)}`, data),

    delete: (id) =>
      apiRequest('DELETE', `/maintenance/${encodeURIComponent(id)}`),
  };

  // ─── Documents API ───
  const DocumentsAPI = {
    getAll: (search) => {
      const params = new URLSearchParams();

      if (search) params.set('search', search);

      const qs = params.toString();

      return apiRequest('GET', `/documents${qs ? '?' + qs : ''}`);
    },

    getOne: (id) =>
      apiRequest('GET', `/documents/${encodeURIComponent(id)}`),

    create: (data) =>
      apiRequest('POST', '/documents', data),

    update: (id, data) =>
      apiRequest('PUT', `/documents/${encodeURIComponent(id)}`, data),

    delete: (id) =>
      apiRequest('DELETE', `/documents/${encodeURIComponent(id)}`),
  };

  // ─── Notifications API ───
  const NotificationsAPI = {
    getAll: () =>
      apiRequest('GET', '/notifications'),

    create: (data) =>
      apiRequest('POST', '/notifications', data),

    markAllRead: () =>
      apiRequest('PATCH', '/notifications/mark-read'),
  };

  // ─── Transactions API ───
  const TransactionsAPI = {
    // Used by Superuser Transactions page
    // Backend returns: { transactions: [...], invoices: [...] }
    getAll: (search) => {
      const params = new URLSearchParams();

      if (search) params.set('search', search);

      const qs = params.toString();

      return apiRequest('GET', `/transactions${qs ? '?' + qs : ''}`);
    },

    // Used when only payment/transaction records are needed
    getPayments: (search) => {
      const params = new URLSearchParams();

      if (search) params.set('search', search);

      const qs = params.toString();

      return apiRequest('GET', `/transactions/payments${qs ? '?' + qs : ''}`);
    },

    // Used by Business Client invoices page and invoice-view page
    getInvoices: (search) => {
      const params = new URLSearchParams();

      if (search) params.set('search', search);

      const qs = params.toString();

      return apiRequest('GET', `/transactions/invoices${qs ? '?' + qs : ''}`);
    },

    // Business Client submits payment transaction
    createPayment: (data) =>
      apiRequest('POST', '/transactions', data),

    // Superuser can create invoice manually if needed
    createInvoice: (data) =>
      apiRequest('POST', '/transactions/invoices', data),

    // Business Client invoice-view can auto-generate invoice for completed delivery
    generateInvoiceForDelivery: (deliveryId) =>
      apiRequest(
        'POST',
        `/transactions/invoices/generate/${encodeURIComponent(deliveryId)}`
      ),

    // Superuser approves/rejects submitted payment.
    // This syncs transaction status and linked invoice status in backend.
    updatePaymentStatus: (transactionId, status) =>
      apiRequest(
        'PATCH',
        `/transactions/payments/${encodeURIComponent(transactionId)}/status`,
        { status }
      ),
  };

  // ─── Settings API ───
  const SettingsAPI = {
    getPlatform: () =>
      apiRequest('GET', '/settings/platform'),

    updatePlatform: (data) =>
      apiRequest('PUT', '/settings/platform', data),

    getSecurity: () =>
      apiRequest('GET', '/settings/security'),

    updateSecurity: (data) =>
      apiRequest('PUT', '/settings/security', data),

    getPermissions: (role) =>
      apiRequest('GET', `/settings/permissions/${encodeURIComponent(role)}`),

    getAllPermissions: () =>
      apiRequest('GET', '/settings/permissions'),

    updatePermissions: (role, permissions) =>
      apiRequest('PUT', `/settings/permissions/${encodeURIComponent(role)}`, {
        permissions,
      }),
  };

  // ─── Dashboard API ───
  const DashboardAPI = {
    getSuperuser: () =>
      apiRequest('GET', '/dashboard/superuser'),

    getBusinessClient: () =>
      apiRequest('GET', '/dashboard/business-client'),

    getFleetManager: () =>
      apiRequest('GET', '/dashboard/fleet-manager'),

    getDriver: () =>
      apiRequest('GET', '/dashboard/driver'),
  };

  // Expose globally
  window.DeliverySyncAPI = {
    API_BASE,
    getCurrentRole,
    getCurrentUserId,
    getHeaders,
    apiRequest,

    Users: UsersAPI,
    Vehicles: VehiclesAPI,
    Drivers: DriversAPI,
    Deliveries: DeliveriesAPI,
    Trips: TripsAPI,
    Documents: DocumentsAPI,
    Maintenance: MaintenanceAPI,
    Notifications: NotificationsAPI,
    Transactions: TransactionsAPI,
    Settings: SettingsAPI,
    Dashboard: DashboardAPI,
  };
})();