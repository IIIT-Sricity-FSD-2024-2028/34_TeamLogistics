(function () {
  const API_BASE = 'http://localhost:3000/api';

  function getCurrentToken() {
    try {
      const session = JSON.parse(localStorage.getItem('deliverysync-session-v1') || 'null');
      return session ? session.token : '';
    } catch (e) {
      return '';
    }
  }

  function getCurrentRole() {
    try {
      const session = JSON.parse(localStorage.getItem('deliverysync-session-v1') || 'null');
      return session ? session.role : '';
    } catch (e) {
      return '';
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

  function getHeaders(isFormData) {
    const headers = {};
    const token = getCurrentToken();

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  async function apiRequest(method, endpoint, body = null) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

    const options = {
      method,
      headers: getHeaders(isFormData),
      cache: 'no-store',
    };

    if (body && method !== 'GET') {
      options.body = isFormData ? body : JSON.stringify(body);
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

  const AuthAPI = {
    login: (email, password) =>
      apiRequest('POST', '/auth/login', { email, password }),

    register: (payload) =>
      apiRequest('POST', '/auth/register', payload),
  };

  const UsersAPI = {
    getAll: (role, search) => {
      const params = new URLSearchParams();

      if (role) params.set('role', role);
      if (search) params.set('search', search);

      const qs = params.toString();

      return apiRequest('GET', `/users${qs ? '?' + qs : ''}`);
    },

    getById: (id) =>
      apiRequest('GET', `/users/${encodeURIComponent(id)}`),

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

    reportIssue: (id, issueType, description, status) =>
      apiRequest('PATCH', `/trips/${encodeURIComponent(id)}/report-issue`, { issueType, description, status }),

    addNote: (id, text) =>
      apiRequest('PATCH', `/trips/${encodeURIComponent(id)}/notes`, { text }),

    resolveDispute: (id, resolvedAmount, reason) =>
      apiRequest('PATCH', `/trips/${encodeURIComponent(id)}/resolve-dispute`, { resolvedAmount, reason }),
  };

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

  const NotificationsAPI = {
    getAll: () =>
      apiRequest('GET', '/notifications'),

    create: (data) =>
      apiRequest('POST', '/notifications', data),

    markAllRead: () =>
      apiRequest('PATCH', '/notifications/mark-read'),

    markOne: (id, read) =>
      apiRequest('PATCH', `/notifications/${encodeURIComponent(id)}`, { read }),

    delete: (id) =>
      apiRequest('DELETE', `/notifications/${encodeURIComponent(id)}`),
  };

  const TransactionsAPI = {
    getAll: (search) => {
      const params = new URLSearchParams();

      if (search) params.set('search', search);

      const qs = params.toString();

      return apiRequest('GET', `/transactions${qs ? '?' + qs : ''}`);
    },

    getPayments: (search) => {
      const params = new URLSearchParams();

      if (search) params.set('search', search);

      const qs = params.toString();

      return apiRequest('GET', `/transactions/payments${qs ? '?' + qs : ''}`);
    },

    getInvoices: (search) => {
      const params = new URLSearchParams();

      if (search) params.set('search', search);

      const qs = params.toString();

      return apiRequest('GET', `/transactions/invoices${qs ? '?' + qs : ''}`);
    },

    createPayment: (data) =>
      apiRequest('POST', '/transactions', data),

    createInvoice: (data) =>
      apiRequest('POST', '/transactions/invoices', data),

    generateInvoiceForDelivery: (deliveryId) =>
      apiRequest(
        'POST',
        `/transactions/invoices/generate/${encodeURIComponent(deliveryId)}`
      ),

    updatePaymentStatus: (transactionId, status) =>
      apiRequest(
        'PATCH',
        `/transactions/payments/${encodeURIComponent(transactionId)}/status`,
        { status }
      ),

    payDelivery: (data) =>
      apiRequest('POST', '/transactions/pay-delivery', data),

    getRevenueSummary: () =>
      apiRequest('GET', '/transactions/revenue-summary'),

    refund: (id, amount, reason) =>
      apiRequest('POST', `/transactions/${encodeURIComponent(id)}/refund`, { amount, reason }),
  };

  const PayoutsAPI = {
    getPlatformRateCard: () =>
      apiRequest('GET', '/payouts/rate-card/platform'),

    setPlatformRateCard: (data) =>
      apiRequest('PUT', '/payouts/rate-card/platform', data),

    getMyRateCard: () =>
      apiRequest('GET', '/payouts/rate-card/mine'),

    setMyRateCard: (data) =>
      apiRequest('PUT', '/payouts/rate-card/mine', data),

    getMyPayouts: () =>
      apiRequest('GET', '/payouts/driver/mine'),

    getFleetManagerStatement: (month, fleetManagerId) => {
      const params = new URLSearchParams();

      if (month) params.set('month', month);
      if (fleetManagerId) params.set('fleetManagerId', fleetManagerId);

      const qs = params.toString();

      return apiRequest('GET', `/payouts/fleet-manager/statement${qs ? '?' + qs : ''}`);
    },

    listSettlements: (fleetManagerId) => {
      const params = new URLSearchParams();

      if (fleetManagerId) params.set('fleetManagerId', fleetManagerId);

      const qs = params.toString();

      return apiRequest('GET', `/payouts/fleet-manager/settlements${qs ? '?' + qs : ''}`);
    },

    lockSettlement: (fleetManagerId, month) =>
      apiRequest('POST', '/payouts/fleet-manager/settlement/lock', { fleetManagerId, month }),
  };

  const SettingsAPI = {
    getPlatform: () =>
      apiRequest('GET', '/settings/platform'),

    getCommission: () =>
      apiRequest('GET', '/settings/commission'),

    updateCommission: (commissionRate) =>
      apiRequest('PUT', '/settings/commission', { commissionRate }),

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

  const DashboardAPI = {
    getSuperuser: () =>
      apiRequest('GET', '/dashboard/superuser'),

    getBusinessClient: () =>
      apiRequest('GET', '/dashboard/business-client'),

    getFleetManager: () =>
      apiRequest('GET', '/dashboard/fleet-manager'),

    getFleetManagerAnalytics: () =>
      apiRequest('GET', '/dashboard/fleet-manager/analytics'),

    getDriver: () =>
      apiRequest('GET', '/dashboard/driver'),
  };

  window.DeliverySyncAPI = {
    API_BASE,
    getCurrentRole,
    getCurrentUserId,
    getHeaders,
    apiRequest,

    Auth: AuthAPI,
    Users: UsersAPI,
    Vehicles: VehiclesAPI,
    Drivers: DriversAPI,
    Deliveries: DeliveriesAPI,
    Trips: TripsAPI,
    Documents: DocumentsAPI,
    Maintenance: MaintenanceAPI,
    Notifications: NotificationsAPI,
    Transactions: TransactionsAPI,
    Payouts: PayoutsAPI,
    Settings: SettingsAPI,
    Dashboard: DashboardAPI,
  };
})();
