(function () {
  const Data = window.DeliverySyncData;
  const Utils = window.DeliverySyncUtils;
  const { $, $all, generateId, showToast, setError, clearErrors, validateEmail, validatePhone } = Utils;

  const schemas = {
    users: {
      title: 'User Access Control',
      idPrefix: 'US',
      empty: 'No users available.',
      columns: ['id', 'name', 'email', 'role', 'status'],
      labels: { id: 'ID', name: 'Name', email: 'Email', role: 'Role', status: 'Status' },
      form: [
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'role', label: 'Role', type: 'select', options: ['superuser', 'fleet-manager', 'business-client', 'driver'], required: true },
        { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Pending', 'Suspended'], required: true }
      ],
      validate(values, form, state, editingId) {
        let ok = true;
        if (values.name.trim().length < 2) { setError($('[name="name"]', form), 'Enter a valid name'); ok = false; }
        if (!validateEmail(values.email)) { setError($('[name="email"]', form), 'Enter a valid email'); ok = false; }
        const duplicate = state.users.find((item) => item.email.toLowerCase() === values.email.toLowerCase() && item.id !== editingId);
        if (duplicate) { setError($('[name="email"]', form), 'Email already exists'); ok = false; }
        return ok;
      },
      normalize(values, original) {
        return { ...original, ...values, password: original.password || 'Temp@123' };
      }
    },
    fleets: {
      title: 'Fleet Operations',
      idPrefix: 'FL',
      empty: 'No fleet data available.',
      columns: ['id', 'company', 'manager', 'vehicles', 'zone', 'status'],
      labels: { id: 'ID', company: 'Company', manager: 'Manager', vehicles: 'Vehicles', zone: 'Zone', status: 'Status' },
      form: [
        { name: 'company', label: 'Company', type: 'text', required: true },
        { name: 'manager', label: 'Manager', type: 'text', required: true },
        { name: 'vehicles', label: 'Vehicles', type: 'number', required: true },
        { name: 'zone', label: 'Zone', type: 'text', required: true },
        { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Scaling', 'Pending'], required: true }
      ],
      validate(values, form) {
        let ok = true;
        if (values.company.trim().length < 2) { setError($('[name="company"]', form), 'Enter company name'); ok = false; }
        if (values.manager.trim().length < 2) { setError($('[name="manager"]', form), 'Enter manager name'); ok = false; }
        if (!(Number(values.vehicles) > 0)) { setError($('[name="vehicles"]', form), 'Vehicles must be more than 0'); ok = false; }
        return ok;
      },
      normalize(values, original) { return { ...original, ...values, vehicles: Number(values.vehicles) }; }
    },
    clients: {
      title: 'Business Clients',
      idPrefix: 'CL',
      empty: 'No business clients found.',
      columns: ['id', 'company', 'contact', 'address', 'requests', 'status'],
      labels: { id: 'ID', company: 'Company', contact: 'Contact', address: 'Address', requests: 'Requests', status: 'Status' },
      form: [
        { name: 'company', label: 'Company', type: 'text', required: true },
        { name: 'contact', label: 'Contact', type: 'text', required: true },
        { name: 'address', label: 'Address', type: 'text', required: true },
        { name: 'requests', label: 'Requests', type: 'number', required: true },
        { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Pending', 'Inactive'], required: true }
      ],
      validate(values, form) {
        let ok = true;
        if (values.company.trim().length < 2) { setError($('[name="company"]', form), 'Enter company'); ok = false; }
        if (!validatePhone(values.contact)) { setError($('[name="contact"]', form), 'Enter valid contact number'); ok = false; }
        return ok;
      },
      normalize(values, original) { return { ...original, ...values, requests: Number(values.requests) }; }
    },
    drivers: {
      title: 'Driver Directory',
      idPrefix: 'DR',
      empty: 'No drivers found.',
      columns: ['id', 'name', 'phone', 'zone', 'vehicle', 'status'],
      labels: { id: 'ID', name: 'Name', phone: 'Phone', zone: 'Zone', vehicle: 'Vehicle', status: 'Status' },
      form: [
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'phone', label: 'Phone', type: 'text', required: true },
        { name: 'zone', label: 'Zone', type: 'text', required: true },
        { name: 'vehicle', label: 'Vehicle', type: 'text', required: true },
        { name: 'status', label: 'Status', type: 'select', options: ['On Duty', 'Available', 'Document Review', 'Inactive'], required: true }
      ],
      validate(values, form) {
        let ok = true;
        if (values.name.trim().length < 2) { setError($('[name="name"]', form), 'Enter valid name'); ok = false; }
        if (!validatePhone(values.phone)) { setError($('[name="phone"]', form), 'Enter valid phone number'); ok = false; }
        return ok;
      },
      normalize(values, original) { return { ...original, ...values }; }
    },
    vehicles: {
      title: 'Vehicle Registry',
      idPrefix: 'VH',
      empty: 'No vehicles found.',
      columns: ['id', 'plate', 'type', 'capacity', 'assignedDriver', 'status'],
      labels: { id: 'ID', plate: 'Plate', type: 'Type', capacity: 'Capacity', assignedDriver: 'Assigned Driver', status: 'Status' },
      form: [
        { name: 'plate', label: 'Plate', type: 'text', required: true },
        { name: 'type', label: 'Type', type: 'text', required: true },
        { name: 'capacity', label: 'Capacity', type: 'text', required: true },
        { name: 'assignedDriver', label: 'Assigned Driver', type: 'text', required: true },
        { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Maintenance', 'Inactive'], required: true }
      ],
      validate(values, form) {
        let ok = true;
        if (values.plate.trim().length < 6) { setError($('[name="plate"]', form), 'Enter valid plate number'); ok = false; }
        return ok;
      },
      normalize(values, original) { return { ...original, ...values }; }
    },
    shipments: {
      title: 'Shipments',
      idPrefix: 'SH',
      empty: 'No shipments found.',
      columns: ['id', 'client', 'route', 'priority', 'status', 'amount'],
      labels: { id: 'ID', client: 'Client', route: 'Route', priority: 'Priority', status: 'Status', amount: 'Amount' },
      form: [
        { name: 'client', label: 'Client', type: 'text', required: true },
        { name: 'route', label: 'Route', type: 'text', required: true },
        { name: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High'], required: true },
        { name: 'status', label: 'Status', type: 'select', options: ['Pending Pickup', 'In Transit', 'Delivered'], required: true },
        { name: 'amount', label: 'Amount', type: 'text', required: true }
      ],
      validate(values, form) {
        let ok = true;
        if (values.client.trim().length < 2) { setError($('[name="client"]', form), 'Enter client name'); ok = false; }
        if (values.route.trim().length < 6) { setError($('[name="route"]', form), 'Enter route'); ok = false; }
        return ok;
      },
      normalize(values, original) { return { ...original, ...values }; }
    },
    assignments: {
      title: 'Delivery Assignments',
      idPrefix: 'AS',
      empty: 'No assignments found.',
      columns: ['id', 'shipment', 'driver', 'eta', 'status'],
      labels: { id: 'ID', shipment: 'Shipment', driver: 'Driver', eta: 'ETA', status: 'Status' },
      form: [
        { name: 'shipment', label: 'Shipment', type: 'text', required: true },
        { name: 'driver', label: 'Driver', type: 'text', required: true },
        { name: 'eta', label: 'ETA', type: 'text', required: true },
        { name: 'status', label: 'Status', type: 'select', options: ['Queued', 'Assigned', 'Delivered'], required: true }
      ],
      validate(values, form) {
        let ok = true;
        if (!values.shipment.trim()) { setError($('[name="shipment"]', form), 'Enter shipment ID'); ok = false; }
        if (!values.driver.trim()) { setError($('[name="driver"]', form), 'Enter driver name'); ok = false; }
        return ok;
      },
      normalize(values, original) { return { ...original, ...values }; }
    },
    requests: {
      title: 'Delivery Requests',
      idPrefix: 'RQ',
      empty: 'No requests yet.',
      columns: ['id', 'title', 'pickup', 'drop', 'size', 'status'],
      labels: { id: 'ID', title: 'Title', pickup: 'Pickup', drop: 'Drop', size: 'Size', status: 'Status' },
      form: [
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'pickup', label: 'Pickup', type: 'text', required: true },
        { name: 'drop', label: 'Drop', type: 'text', required: true },
        { name: 'size', label: 'Size', type: 'select', options: ['Small', 'Medium', 'Large', 'Urgent'], required: true },
        { name: 'status', label: 'Status', type: 'select', options: ['Draft', 'Submitted', 'Approved'], required: true }
      ],
      validate(values, form) {
        let ok = true;
        if (values.title.trim().length < 2) { setError($('[name="title"]', form), 'Enter request title'); ok = false; }
        if (values.pickup.trim().length < 2) { setError($('[name="pickup"]', form), 'Enter pickup location'); ok = false; }
        if (values.drop.trim().length < 2) { setError($('[name="drop"]', form), 'Enter drop location'); ok = false; }
        return ok;
      },
      normalize(values, original) { return { ...original, ...values }; }
    },
    documents: {
      title: 'Documents & Compliance',
      idPrefix: 'DOC',
      empty: 'No documents found.',
      columns: ['id', 'type', 'owner', 'review', 'updated'],
      labels: { id: 'ID', type: 'Type', owner: 'Owner', review: 'Review', updated: 'Updated' },
      form: [
        { name: 'type', label: 'Type', type: 'text', required: true },
        { name: 'owner', label: 'Owner', type: 'text', required: true },
        { name: 'review', label: 'Review', type: 'select', options: ['Pending', 'Approved', 'Rejected'], required: true },
        { name: 'updated', label: 'Updated', type: 'date', required: true }
      ],
      validate(values, form) {
        let ok = true;
        if (values.type.trim().length < 2) { setError($('[name="type"]', form), 'Enter document type'); ok = false; }
        return ok;
      },
      normalize(values, original) { return { ...original, ...values }; }
    },
    settings: {
      title: 'Configuration Controls',
      idPrefix: 'CFG',
      empty: 'No settings found.',
      columns: ['id', 'key', 'value', 'scope', 'status'],
      labels: { id: 'ID', key: 'Key', value: 'Value', scope: 'Scope', status: 'Status' },
      form: [
        { name: 'key', label: 'Key', type: 'text', required: true },
        { name: 'value', label: 'Value', type: 'text', required: true },
        { name: 'scope', label: 'Scope', type: 'text', required: true },
        { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], required: true }
      ],
      validate(values, form) {
        let ok = true;
        if (values.key.trim().length < 2) { setError($('[name="key"]', form), 'Enter setting key'); ok = false; }
        return ok;
      },
      normalize(values, original) { return { ...original, ...values }; }
    }
  };

  const roleConfigs = {
    superuser: {
      title: 'Super User Control Center',
      subtitle: 'Full system visibility with CRUD access across users, clients, fleets, operations, and configurations.',
      modules: ['users', 'fleets', 'clients', 'drivers', 'vehicles', 'shipments', 'settings'],
      stats(state) {
        return [
          ['Total Users', state.users.length],
          ['Live Shipments', state.shipments.length],
          ['Fleet Accounts', state.fleets.length],
          ['Config Rules', state.settings.length]
        ];
      }
    },
    'fleet-manager': {
      title: 'Fleet Manager Operations Portal',
      subtitle: 'Operational control over drivers, vehicles, delivery assignments, and shipment execution.',
      modules: ['drivers', 'vehicles', 'assignments', 'shipments'],
      stats(state) {
        return [
          ['Drivers', state.drivers.length],
          ['Vehicles', state.vehicles.length],
          ['Assignments', state.assignments.length],
          ['Shipments', state.shipments.length]
        ];
      }
    },
    'business-client': {
      title: 'Business Client Workspace',
      subtitle: 'Create delivery requests, track orders, and review shipment status with role-based access.',
      modules: ['requests', 'shipments'],
      stats(state) {
        return [
          ['Open Requests', state.requests.length],
          ['Shipments', state.shipments.length],
          ['Approved Orders', state.requests.filter((r) => r.status === 'Approved').length],
          ['Priority Loads', state.shipments.filter((s) => s.priority === 'High').length]
        ];
      }
    },
    driver: {
      title: 'Driver Delivery Portal',
      subtitle: 'Review assignments, maintain documents, and stay updated on route execution.',
      modules: ['assignments', 'documents'],
      stats(state) {
        return [
          ['Assignments', state.assignments.length],
          ['Delivered', state.assignments.filter((a) => a.status === 'Delivered').length],
          ['Pending Docs', state.documents.filter((d) => d.review === 'Pending').length],
          ['Approved Docs', state.documents.filter((d) => d.review === 'Approved').length]
        ];
      }
    }
  };

  let currentModule = null;
  let currentRole = null;
  let currentState = null;

  function getBadgeClass(value) {
    const text = String(value).toLowerCase();
    if (['active', 'approved', 'delivered', 'on duty'].includes(text)) return 'success';
    if (['pending', 'queued', 'draft', 'medium', 'scaling', 'document review', 'pending pickup'].includes(text)) return 'warning';
    if (['in transit', 'submitted', 'available'].includes(text)) return 'info';
    if (['inactive', 'rejected', 'suspended', 'maintenance'].includes(text)) return 'danger';
    return 'info';
  }

  function ensureAuth(role) {
    const session = Data.getSession();
    if (!session || session.role !== role) {
      window.location.href = '../login.html';
      return null;
    }
    return session;
  }

  function buildSidebar(config) {
    const nav = $('#module-nav');
    nav.innerHTML = config.modules
      .map((module, index) => `<button class="nav-item ${index === 0 ? 'active' : ''}" data-module="${module}">${schemas[module].title}</button>`)
      .join('');

    $all('.nav-item', nav).forEach((button) => {
      button.addEventListener('click', () => {
        $all('.nav-item', nav).forEach((node) => node.classList.remove('active'));
        button.classList.add('active');
        renderModule(button.dataset.module);
      });
    });
  }

  function renderStats(config) {
    const stats = config.stats(currentState);
    $('#kpis').innerHTML = stats.map(([label, value]) => `
      <div class="kpi-card">
        <div class="label">${label}</div>
        <div class="value">${value}</div>
      </div>
    `).join('');
  }

  // Roles that have full CRUD (edit + delete) access
  const fullCrudRoles = ['superuser', 'fleet-manager'];

  function canEditDelete(role) {
    return fullCrudRoles.includes(role);
  }

  // Modules where each role is allowed to add new records
  const addAllowed = {
    superuser: true,  // all modules
    'fleet-manager': true,  // all modules
    'business-client': { requests: true },  // only requests
    driver: false  // no modules
  };

  function canAddRecord(role, moduleName) {
    const perm = addAllowed[role];
    if (perm === true) return true;
    if (perm === false || !perm) return false;
    return !!perm[moduleName];
  }

  function buildTable(moduleName, records) {
    const schema = schemas[moduleName];
    if (!records.length) {
      return `<div class="empty-state">${schema.empty}</div>`;
    }
    const headers = schema.columns.map((col) => `<th>${schema.labels[col] || col}</th>`).join('');
    const hasEditDelete = canEditDelete(currentRole);
    const rows = records.map((record) => {
      const tds = schema.columns.map((col) => {
        const value = record[col] ?? '-';
        if (['status', 'priority', 'review'].includes(col)) {
          return `<td><span class="badge ${getBadgeClass(value)}">${value}</span></td>`;
        }
        return `<td>${value}</td>`;
      }).join('');
      let actionButtons = `<button class="btn btn-secondary btn-small" data-action="view" data-id="${record.id}">View</button>`;
      if (hasEditDelete) {
        actionButtons += `
            <button class="btn btn-outline btn-small" data-action="edit" data-id="${record.id}">Edit</button>
            <button class="btn btn-danger btn-small" data-action="delete" data-id="${record.id}">Delete</button>`;
      }
      return `<tr>
        ${tds}
        <td>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${actionButtons}
          </div>
        </td>
      </tr>`;
    }).join('');

    return `<div class="table-wrap"><table class="table"><thead><tr>${headers}<th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderModule(moduleName) {
    currentModule = moduleName;
    const schema = schemas[moduleName];
    const records = currentState[moduleName] || [];
    $('#module-title').textContent = schema.title;
    $('#module-subtitle').textContent = 'Add, view, edit, delete, and filter records with instant UI updates using browser storage.';
    const addBtn = $('#add-record-btn');
    if (addBtn) addBtn.style.display = canAddRecord(currentRole, moduleName) ? '' : 'none';
    const search = $('#module-search').value.trim().toLowerCase();
    const filtered = records.filter((record) => JSON.stringify(record).toLowerCase().includes(search));
    $('#module-panel').innerHTML = buildTable(moduleName, filtered);
    attachTableActions(moduleName);
  }

  function attachTableActions(moduleName) {
    $all('[data-action="view"]').forEach((button) => button.addEventListener('click', () => openViewModal(moduleName, button.dataset.id)));
    $all('[data-action="edit"]').forEach((button) => button.addEventListener('click', () => openFormModal(moduleName, button.dataset.id)));
    $all('[data-action="delete"]').forEach((button) => button.addEventListener('click', () => handleDelete(moduleName, button.dataset.id)));
  }

  function openViewModal(moduleName, id) {
    const schema = schemas[moduleName];
    const record = currentState[moduleName].find((item) => String(item.id) === String(id));
    if (!record) return;
    const html = schema.columns.map((key) => `
      <div class="view-item">
        <span>${schema.labels[key] || key}</span>
        <strong>${record[key] ?? '-'}</strong>
      </div>
    `).join('');
    openModal(`${schema.title} Details`, `<div class="view-grid">${html}</div>`);
  }

  function buildForm(moduleName, record) {
    const schema = schemas[moduleName];
    const fields = schema.form.map((field) => {
      const value = record?.[field.name] ?? '';
      let control = '';
      if (field.type === 'select') {
        control = `<select name="${field.name}">${field.options.map((option) => `<option value="${option}" ${String(value) === String(option) ? 'selected' : ''}>${option}</option>`).join('')}</select>`;
      } else {
        control = `<input type="${field.type}" name="${field.name}" value="${value}">`;
      }
      return `<div class="form-control"><label>${field.label}</label>${control}<div class="error-message"></div></div>`;
    }).join('');
    return `
      <form id="crud-form">
        <div class="form-grid">${fields}</div>
        <div class="form-actions" style="justify-content:flex-end;gap:12px;margin-top:22px;">
          <button type="button" class="btn btn-outline" id="cancel-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">${record ? 'Save Changes' : 'Add Record'}</button>
        </div>
      </form>
    `;
  }

  function openFormModal(moduleName, id = null) {
    const record = id ? currentState[moduleName].find((item) => String(item.id) === String(id)) : null;
    openModal(record ? `Edit ${schemas[moduleName].title}` : `Add to ${schemas[moduleName].title}`, buildForm(moduleName, record));
    $('#cancel-modal').addEventListener('click', closeModal);
    $('#crud-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      clearErrors(form);
      const values = Object.fromEntries(new FormData(form).entries());
      const schema = schemas[moduleName];
      const editingId = record ? record.id : null;
      if (!schema.validate(values, form, currentState, editingId)) return;
      const normalized = schema.normalize(values, record || {});
      if (record) {
        currentState[moduleName] = currentState[moduleName].map((item) => item.id === record.id ? { ...normalized, id: record.id } : item);
        if (moduleName === 'users') syncUserChanges(record.id, normalized);
        showToast('Record updated successfully');
      } else {
        const newRecord = { ...normalized, id: generateId(schema.idPrefix, currentState[moduleName]) };
        currentState[moduleName].unshift(newRecord);
        showToast('Record added successfully');
      }
      Data.saveState(currentState);
      closeModal();
      renderStats(roleConfigs[currentRole]);
      renderModule(moduleName);
    });
  }

  function syncUserChanges(userId, normalized) {
    const session = Data.getSession();
    if (session && session.userId === userId) {
      Data.setSession({ ...session, name: normalized.name, email: normalized.email, role: normalized.role });
    }
  }

  function handleDelete(moduleName, id) {
    const confirmed = window.confirm('Delete this record? This action updates the UI immediately.');
    if (!confirmed) return;
    currentState[moduleName] = currentState[moduleName].filter((item) => String(item.id) !== String(id));
    Data.saveState(currentState);
    renderStats(roleConfigs[currentRole]);
    renderModule(moduleName);
    showToast('Record deleted successfully');
  }

  function openModal(title, content) {
    const backdrop = $('#modal-backdrop');
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = content;
    backdrop.classList.add('show');
  }

  function closeModal() {
    $('#modal-backdrop').classList.remove('show');
  }

  function attachGlobalActions(config, session) {
    $('#portal-title').textContent = config.title;
    $('#portal-subtitle').textContent = config.subtitle;
    $('#current-user-name').textContent = session.name;
    $('#current-user-role').textContent = Data.roleLabels[session.role];
    const addBtn = $('#add-record-btn');
    addBtn.addEventListener('click', () => openFormModal(currentModule));
    addBtn.style.display = canAddRecord(currentRole, config.modules[0]) ? '' : 'none';
    $('#module-search').addEventListener('input', () => renderModule(currentModule));
    $('#logout-btn').addEventListener('click', () => {
      Data.clearSession();
      window.location.href = '../login.html';
    });
    const sidebar = $('#sidebar');
    ['#sidebar-toggle', '#sidebar-open-btn'].forEach((selector) => {
      const button = $(selector);
      if (button) button.addEventListener('click', () => sidebar.classList.toggle('open'));
    });
    $('#close-modal').addEventListener('click', closeModal);
    $('#modal-backdrop').addEventListener('click', (event) => {
      if (event.target.id === 'modal-backdrop') closeModal();
    });
  }

  function initPortal() {
    const root = document.body.dataset.role;
    if (!root) return;
    currentRole = root;
    currentState = Data.readState();
    const session = ensureAuth(root);
    if (!session) return;
    const config = roleConfigs[root];
    buildSidebar(config);
    renderStats(config);
    renderModule(config.modules[0]);
    attachGlobalActions(config, session);
  }

  document.addEventListener('DOMContentLoaded', initPortal);
})();
