(function () {
  const STORAGE_KEY = 'deliverysync-state-v1';
  const SESSION_KEY = 'deliverysync-session-v1';

  const initialState = {
    users: [
      { id: 'SU-001', username: 'superuser', name: 'Aarav Menon', email: 'superuser@deliverysync.com', password: 'Super@123', role: 'superuser', status: 'Active' },
      { id: 'FM-101', username: 'fleetmanager', name: 'Riya Sharma', email: 'fleet@deliverysync.com', password: 'Fleet@123', role: 'fleet-manager', status: 'Active' },
      { id: 'BC-201', username: 'businessclient', name: 'Acme Logistics', email: 'client@deliverysync.com', password: 'Client@123', role: 'business-client', status: 'Active' },
      { id: 'DR-301', username: 'driver', name: 'Raghav Reddy', email: 'driver@deliverysync.com', password: 'Driver@123', role: 'driver', status: 'Active' }
    ],
    fleets: [
      { id: 'FL-001', company: 'Acme Logistics', manager: 'Riya Sharma', vehicles: 24, zone: 'Chennai North', status: 'Active' },
      { id: 'FL-002', company: 'UrbanCart Retail', manager: 'Vikram Rao', vehicles: 17, zone: 'Bengaluru South', status: 'Scaling' },
      { id: 'FL-003', company: 'NorthBay Logistics', manager: 'Dev Malhotra', vehicles: 31, zone: 'Hyderabad Hub', status: 'Active' }
    ],
    clients: [
      { id: 'CL-001', company: 'Acme Logistics', contact: '+91 9988776655', address: 'OMR, Chennai', requests: 28, status: 'Active' },
      { id: 'CL-002', company: 'UrbanCart Retail', contact: '+91 9123456780', address: 'Koramangala, Bengaluru', requests: 15, status: 'Active' },
      { id: 'CL-003', company: 'Cascade Distribution', contact: '+91 9340011223', address: 'Gachibowli, Hyderabad', requests: 11, status: 'Pending' }
    ],
    drivers: [
      { id: 'DR-301', name: 'Raghav Reddy', phone: '+91 9440011223', zone: 'Chennai North', vehicle: 'TN09AB1234', status: 'On Duty' },
      { id: 'DR-302', name: 'Kiran Teja', phone: '+91 9555500011', zone: 'Bengaluru South', vehicle: 'KA03PQ9876', status: 'Available' },
      { id: 'DR-303', name: 'Manoj Kumar', phone: '+91 9666677788', zone: 'Hyderabad Hub', vehicle: 'TS08XY2045', status: 'Document Review' }
    ],
    vehicles: [
      { id: 'VH-1001', plate: 'TN09AB1234', type: 'Mini Truck', capacity: '2 Tons', assignedDriver: 'Raghav Reddy', status: 'Active' },
      { id: 'VH-1002', plate: 'KA03PQ9876', type: 'Van', capacity: '1 Ton', assignedDriver: 'Kiran Teja', status: 'Active' },
      { id: 'VH-1003', plate: 'TS08XY2045', type: 'Bike', capacity: '30 Kg', assignedDriver: 'Manoj Kumar', status: 'Maintenance' }
    ],
    shipments: [
      { id: 'SH-501', client: 'Acme Logistics', route: 'Chennai → Sriperumbudur', priority: 'High', status: 'In Transit', amount: '₹18,500' },
      { id: 'SH-502', client: 'UrbanCart Retail', route: 'Bengaluru → Mysuru', priority: 'Medium', status: 'Pending Pickup', amount: '₹9,800' },
      { id: 'SH-503', client: 'Cascade Distribution', route: 'Hyderabad → Vijayawada', priority: 'High', status: 'Delivered', amount: '₹21,300' }
    ],
    assignments: [
      { id: 'AS-801', shipment: 'SH-501', driver: 'Raghav Reddy', eta: '2h 10m', status: 'Assigned' },
      { id: 'AS-802', shipment: 'SH-502', driver: 'Kiran Teja', eta: '5h 00m', status: 'Queued' },
      { id: 'AS-803', shipment: 'SH-503', driver: 'Manoj Kumar', eta: 'Completed', status: 'Delivered' }
    ],
    requests: [
      { id: 'RQ-901', title: 'Electronics Batch', pickup: 'OMR, Chennai', drop: 'Tambaram', size: 'Large', status: 'Draft' },
      { id: 'RQ-902', title: 'Retail Boxes', pickup: 'Koramangala', drop: 'Whitefield', size: 'Medium', status: 'Submitted' },
      { id: 'RQ-903', title: 'Medical Supplies', pickup: 'Gachibowli', drop: 'Secunderabad', size: 'Urgent', status: 'Approved' }
    ],
    documents: [
      { id: 'DOC-01', type: 'Driving License', owner: 'Raghav Reddy', review: 'Approved', updated: '2026-03-25' },
      { id: 'DOC-02', type: 'Bank Book', owner: 'Raghav Reddy', review: 'Pending', updated: '2026-03-26' },
      { id: 'DOC-03', type: 'Insurance', owner: 'Kiran Teja', review: 'Approved', updated: '2026-03-20' }
    ],
    settings: [
      { id: 'CFG-01', key: 'Auto Assignment', value: 'Enabled', scope: 'System', status: 'Active' },
      { id: 'CFG-02', key: 'SLA Threshold', value: '30 mins', scope: 'Operations', status: 'Active' },
      { id: 'CFG-03', key: 'Document Policy', value: 'Mandatory', scope: 'Driver Onboarding', status: 'Active' }
    ]
  };

  const roleRoutes = {
    superuser: 'superuser/dashboard.html',
    'fleet-manager': 'fleet-manager/dashboard.html',
    'business-client': 'business-client/dashboard.html',
    driver: 'driver/dashboard.html'
  };

  const roleLabels = {
    superuser: 'Super User',
    'fleet-manager': 'Fleet Manager',
    'business-client': 'Business Client',
    driver: 'Driver'
  };

  function readState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
      return structuredClone(initialState);
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
      return structuredClone(initialState);
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function setSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function seed() {
    const state = readState();
    let changed = false;

    if (!Array.isArray(state.users)) {
      state.users = [];
      changed = true;
    }

    initialState.users.forEach((requiredUser) => {
      const exists = state.users.some((user) =>
        user && (user.id === requiredUser.id || (user.email && user.email.toLowerCase() === requiredUser.email.toLowerCase()) || (user.username && requiredUser.username && user.username.toLowerCase() === requiredUser.username.toLowerCase()))
      );
      if (!exists) {
        state.users.push({ ...requiredUser });
        changed = true;
      }
    });

    if (changed) saveState(state);
    return state;
  }


  function getPlatformSettings() {
    const state = readState();
    const platform = state.superuser && state.superuser.platform ? state.superuser.platform : {};
    return {
      name: platform.name || 'DeliverSync',
      logo: platform.logo || ''
    };
  }

  function applyPlatformBranding(scope = document) {
    const { name, logo } = getPlatformSettings();
    const prettyName = String(name || 'DeliverSync').trim();
    const parts = prettyName.split(/\s+/).filter(Boolean);
    const brandHTML = parts.length > 1
      ? `${parts.slice(0, -1).join(' ')}<span>${parts[parts.length - 1]}</span>`
      : prettyName.replace(/([A-Z][a-zA-Z0-9]*)$/, '<span>$1</span>');

    scope.querySelectorAll('.brand-word').forEach((el) => {
      el.innerHTML = brandHTML;
    });

    scope.querySelectorAll('.brand span:not(.brand-badge), .footer .brand em').forEach((el) => {
      if (el.closest('.brand-word')) return;
    });

    scope.querySelectorAll('.brand').forEach((brand) => {
      const spans = brand.querySelectorAll('span');
      if (spans.length === 1 && !brand.classList.contains('brand-image') && !brand.querySelector('.brand-badge')) {
        spans[0].textContent = prettyName;
      }
      if (spans.length >= 2 && brand.querySelector('.brand-badge')) {
        spans[1].innerHTML = prettyName.replace(/Sync/g, '<em>Sync</em>');
      }
    });

    if (logo) {
      scope.querySelectorAll('.brand-image img, img[alt*="Logo"]').forEach((img) => {
        img.src = logo;
      });
      scope.querySelectorAll('.brand-box').forEach((box) => {
        if (box.closest('.role-tile')) return;
        box.innerHTML = `<img src="${logo}" alt="${prettyName} Logo" style="width:100%;height:100%;object-fit:contain;border-radius:inherit;">`;
      });
    }

    const currentTitle = document.title || '';
    if (currentTitle.includes('|')) {
      document.title = `${prettyName} | ${currentTitle.split('|')[1].trim()}`;
    } else if (currentTitle) {
      document.title = currentTitle.replace(/DeliverSync/g, prettyName);
    }
  }

  function initBrandingObserver() {
    if (window.__deliverySyncBrandObserver) return;
    const apply = () => applyPlatformBranding(document);
    document.addEventListener('DOMContentLoaded', apply);
    if (document.body) {
      const observer = new MutationObserver(() => {
        clearTimeout(window.__deliverySyncBrandTick);
        window.__deliverySyncBrandTick = setTimeout(apply, 0);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      window.__deliverySyncBrandObserver = observer;
    } else {
      window.addEventListener('load', () => {
        if (!window.__deliverySyncBrandObserver && document.body) initBrandingObserver();
      }, { once: true });
    }
  }

  window.DeliverySyncData = {
    STORAGE_KEY,
    SESSION_KEY,
    initialState,
    roleRoutes,
    roleLabels,
    readState,
    saveState,
    getSession,
    setSession,
    clearSession,
    seed,
    getPlatformSettings,
    applyPlatformBranding,
    initBrandingObserver
  };
})();

window.DeliverySyncData.initBrandingObserver();
