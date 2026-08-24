/*
DeliverySync – Demo Workflow Glue (localStorage)
----------------------------------------------
This script implements an end-to-end demo workflow for a static frontend.
It stores data in localStorage so it works without a backend.

Keys:
- dsWorkflowOrders
- dsWorkflowInvoices
- dsWorkflowTransactions
- dsWorkflowNotifications

It injects small panels into existing pages and wires button actions.
*/

(function () {
  const ORDERS_KEY = 'dsWorkflowOrders';
  const INVOICES_KEY = 'dsWorkflowInvoices';
  const TXN_KEY = 'dsWorkflowTransactions';
  const NOTIF_KEY = 'dsWorkflowNotifications';
  const INCIDENT_KEY = 'dsWorkflowIncidents';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function wfToast(msg){
    var t=document.getElementById('wfToastEl');
    if(!t){t=document.createElement('div');t.id='wfToastEl';t.style.cssText='position:fixed;top:24px;right:24px;background:#1e1e2f;color:#fff;padding:14px 28px;border-radius:12px;font-size:14px;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,.4);transform:translateY(-20px);opacity:0;transition:all .3s ease;border-left:4px solid #facc15;pointer-events:none';document.body.appendChild(t);}
    t.textContent=msg;t.style.opacity='1';t.style.transform='translateY(0)';
    clearTimeout(t._tid);t._tid=setTimeout(function(){t.style.opacity='0';t.style.transform='translateY(-20px)';},2800);
  }

  function readJSON(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function pad(n, len) {
    const s = String(n);
    return s.length >= len ? s : '0'.repeat(len - s.length) + s;
  }

  function nextId(prefix, start = 2000) {
    const orders = readJSON(ORDERS_KEY, []);
    const nums = orders
      .map((o) => Number(String(o.id || '').replace(/\D/g, '')))
      .filter(Boolean);
    const next = (nums.length ? Math.max(...nums) : start) + 1;
    return `${prefix}-${next}`;
  }

  function currency(n) {
    const num = Number(n) || 0;
    return `₹${num.toLocaleString('en-IN')}`;
  }

  function getOrders() {
    return readJSON(ORDERS_KEY, []);
  }

  function saveOrders(orders) {
    writeJSON(ORDERS_KEY, orders);
  }

  function getInvoices() {
    return readJSON(INVOICES_KEY, []);
  }

  function saveInvoices(items) {
    writeJSON(INVOICES_KEY, items);
  }

  function getTxns() {
    return readJSON(TXN_KEY, []);
  }

  function ensureInvoicesForDeliveredOrders() {
    const orders = getOrders();
    const invoices = getInvoices();
    let changed = false;

    orders
      .filter((o) => String(o.status || '').toUpperCase() === 'DELIVERED')
      .forEach((order) => {
        if (invoices.some((inv) => inv.orderId === order.id)) return;
        const deliveredAt = order.steps?.deliveredAt || order.createdAt || nowISO();
        const due = new Date(new Date(deliveredAt).getTime() + 7 * 24 * 3600 * 1000);
        invoices.unshift({
          id: `INV-${String(order.id).replace(/\D/g, '')}`,
          orderId: order.id,
          client: order.client,
          amount: Number(order.pricing?.total || 145),
          status: 'Unpaid',
          createdAt: deliveredAt,
          dueDate: due.toISOString().slice(0, 10)
        });
        changed = true;
      });

    if (changed) saveInvoices(invoices);
    return invoices;
  }

  function getInvoicesForCurrentBusinessClient() {
    const companyName = getCurrentBusinessClientCompany();
    const orders = getOrders();

    return ensureInvoicesForDeliveredOrders()
      .filter((inv) => {
        const order = orders.find((o) => o.id === inv.orderId);
        const orderClient = String(order?.client || '').trim().toLowerCase();
        const invoiceClient = String(inv.client || '').trim().toLowerCase();
        const current = String(companyName || '').trim().toLowerCase();
        if (!current) return true;
        if (orderClient && orderClient === current) return true;
        if (invoiceClient && invoiceClient === current) return true;
        return !orderClient && !invoiceClient;
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  function getCurrentBusinessClientCompany() {
    try {
      const state = JSON.parse(localStorage.getItem('deliverysync-state-v1') || '{}');
      const session = JSON.parse(localStorage.getItem('deliverysync-session-v1') || 'null');
      const fallbackSaved = JSON.parse(localStorage.getItem('bcProfileData') || '{}');
      const users = Array.isArray(state.users) ? state.users : [];
      const user = session ? users.find(u => String(u.email || '').toLowerCase() === String(session.email || '').toLowerCase()) : null;
      const pd = user && user.profileDetails ? user.profileDetails : {};
      return pd.companyName || user?.companyName || fallbackSaved.companyName || fallbackSaved['company-name'] || user?.name || 'Acme Logistics Inc.';
    } catch (e) {
      return 'Acme Logistics Inc.';
    }
  }
  function getCurrentBusinessClientFullName() {
    try {
      const state = JSON.parse(localStorage.getItem('deliverysync-state-v1') || '{}');
      const session = JSON.parse(localStorage.getItem('deliverysync-session-v1') || 'null');
      const fallbackSaved = JSON.parse(localStorage.getItem('bcProfileData') || '{}');
      const users = Array.isArray(state.users) ? state.users : [];
      const user = session ? users.find(u => String(u.email || '').toLowerCase() === String(session.email || '').toLowerCase()) : null;
      const pd = user && user.profileDetails ? user.profileDetails : {};
      return pd.fullName || user?.fullName || fallbackSaved.fullName || fallbackSaved['full-name'] || user?.name || 'Business Client';
    } catch (e) {
      return 'Business Client';
    }
  }


  function saveTxns(items) {
    writeJSON(TXN_KEY, items);
  }

  function getNotifs() {
    return readJSON(NOTIF_KEY, []);
  }

  function saveNotifs(items) {
    writeJSON(NOTIF_KEY, items);
  }

  function getIncidents() {
    return readJSON(INCIDENT_KEY, []);
  }

  function saveIncidents(items) {
    writeJSON(INCIDENT_KEY, items);
  }

  function statusLabel(status) {
    switch (status) {
      case 'CREATED':
        return 'Submitted';
      case 'SENT':
        return 'Sent to Fleet';
      case 'ASSIGNED':
        return 'Assigned';
      case 'ACCEPTED':
        return 'Accepted';
      case 'PICKED_UP':
        return 'Picked Up';
      case 'IN_TRANSIT':
        return 'In Transit';
      case 'DELIVERED':
        return 'Delivered';
      default:
        return status || 'Unknown';
    }
  }

  function bcPill(status) {
    if (status === 'ASSIGNED') return 'ASSIGNING';
    if (status === 'ACCEPTED') return 'ACCEPTED';
    if (status === 'PICKED_UP') return 'PICKED UP';
    if (status === 'IN_TRANSIT') return 'IN TRANSIT';
    if (status === 'DELIVERED') return 'DELIVERED';
    if (status === 'BLOCKED') return 'BLOCKED';
    if (status === 'INCIDENT_REPORTED') return 'INCIDENT REPORTED';
    if (status === 'ON_HOLD') return 'ON HOLD';
    return 'IN TRANSIT';
  }

  function ensureSeed() {
    // Create at least one demo driver name list for reassignment.
    if (!localStorage.getItem('dsDemoDrivers')) {
      writeJSON('dsDemoDrivers', ['Raghav Reddy', 'Srujan', 'Sarath', 'David', 'Rajesh']);
    }
  }

  function createOrderFromBCForm() {
    const form = $('#bc-create-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      // Let existing handler run, but ensure our storage exists.
      // We intercept and do the redirect ourselves for reliability.
      e.preventDefault();
      e.stopImmediatePropagation();

      const inputs = $$('.input', form);
      const pickup = (inputs[0]?.value || '').trim();
      const drop = (inputs[1]?.value || '').trim();
      const packageDetails = (inputs[2]?.value || '').trim();
      const preferredDate = (inputs[3]?.value || '').trim();
      const preferredTime = (inputs[4]?.value || '').trim();
      const instructions = ($('.textarea', form)?.value || '').trim();
      const deliveryTypeValue = ($('#delivery-type-input')?.value || 'standard').trim();
      const deliveryType = deliveryTypeValue === 'express' ? 'Express' : 'Standard';

      if (!pickup || !drop || !packageDetails || !preferredDate || !preferredTime) {
        wfToast('Please fill all required delivery fields.');
        return;
      }

      const orders = getOrders();
      const id = nextId('DS', 2040);
      const assignedDriver = 'Raghav Reddy';
      const amount = deliveryType === 'Express' ? 80 : 40;

      const currentBusinessProfile = getBusinessClientProfileData();
      orders.unshift({
        id,
        client: getCurrentBusinessClientCompany(),
        clientFullName: getCurrentBusinessClientFullName(),
        clientAddress: currentBusinessProfile.address || '',
        pickup,
        drop,
        packageDetails,
        preferredDate,
        preferredTime,
        instructions,
        deliveryType,
        status: 'ASSIGNED',
        assignedDriver,
        eta: deliveryType === 'Express' ? 18 : 35,
        createdAt: nowISO(),
        steps: {
          createdAt: nowISO(),
          assignedAt: nowISO()
        },
        pricing: {
          base: amount,
          total: deliveryType === 'Express' ? 1900 : 145 // for demo visuals
        }
      });

      saveOrders(orders);

      wfToast('Delivery request submitted successfully');
      const params = new URLSearchParams({ created: '1', order: id });
      location.href = `active-deliveries.html?${params.toString()}`;
    }, true);
  }

  function renderBCActiveDeliveries() {
    const container = $('.delivery-list');
    if (!container) return;

    const cancelled = readJSON('bcCancelledOrders', []);
    const orders = getOrders().filter((o) => !cancelled.includes(o.id));

    // Remove previously injected cards
    $$('[data-workflow-card="1"]', container).forEach((n) => n.remove());

    orders.slice().reverse().forEach((o) => {
      const isBlocked = String(o.status || '').toUpperCase() === 'BLOCKED';
      const card = `
        <div class="delivery-item" data-order-id="${o.id}" data-workflow-card="1">
          <div>
            <div class="delivery-id">#${o.id}</div>
            <span class="pill bright">${bcPill(o.status)}</span>
          </div>
          <div><div class="delivery-meta-label">From</div><div class="delivery-meta-value">${o.pickup}</div></div>
          <div><div class="delivery-meta-label">To</div><div class="delivery-meta-value">${o.drop}</div></div>
          <div>
            <div class="delivery-meta-label">Driver</div>
            <div class="delivery-meta-value">${o.assignedDriver || 'Assigning'}</div>
            <div class="delivery-meta-sub">${o.deliveryType}</div>
          </div>
          <div>
            <div class="delivery-meta-label">ETA</div>
            <div class="eta-big">${o.eta}</div>
            <div class="eta-unit">mins</div>
          </div>
          <a class="btn yellow" href="live-tracking.html?order=${encodeURIComponent(o.id)}">
            <svg viewBox="0 0 24 24"><path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11z"></path><circle cx="12" cy="10" r="2"></circle></svg>
            Track Live
          </a>
          <a class="btn outline-red" href="cancel-order.html?order=${encodeURIComponent(o.id)}" data-cancel-order="${o.id}" ${isBlocked ? 'style="pointer-events:none;opacity:.55"' : ''}>× Cancel Order</a>
        </div>
      `;
      container.insertAdjacentHTML('afterbegin', card);
    });

    const count = container.querySelectorAll('.delivery-item[data-order-id]').length;
    const subtitle = document.querySelector('.bc-active-title + .page-subtitle');
    if (subtitle) subtitle.textContent = `${count} deliveries in progress`;
  }

  function renderBCLiveTracking() {
    // Use order id query param to show progress.
    const params = new URLSearchParams(location.search);
    const orderId = params.get('order');
    if (!orderId) return;

    const order = getOrders().find((o) => o.id === orderId);
    if (!order) return;

    // Update tracking id
    const trackingIdEl = document.querySelector('.kv .v[style*="yellow"], .kv .v');
    if (trackingIdEl && trackingIdEl.textContent.includes('#DS-')) {
      trackingIdEl.textContent = `#${order.id}`;
    }

    // Update driver name
    const driverNameEl = document.querySelector('.driver-head div[style*="font-size:18px"], .driver-head div');
    if (driverNameEl) driverNameEl.textContent = order.assignedDriver || 'Assigning';

    // Update timeline pills
    const tItems = $$('.timeline .t-item');
    if (tItems.length >= 3) {
      const picked = order.status === 'PICKED_UP' || order.status === 'IN_TRANSIT' || order.status === 'DELIVERED';
      const transit = order.status === 'IN_TRANSIT' || order.status === 'DELIVERED';
      const delivered = order.status === 'DELIVERED';

      // 1) picked up
      const pill1 = $('.pill', tItems[0]);
      if (pill1) pill1.textContent = picked ? 'Complete' : 'Pending';

      // 2) in transit
      const pill2 = $('.pill', tItems[1]);
      if (pill2) pill2.textContent = transit ? 'Active' : (picked ? 'Pending' : 'Pending');

      // 3) delivered
      const pill3 = $('.pill', tItems[2]);
      if (pill3) pill3.textContent = delivered ? 'Complete' : 'Pending';
    }

    // ETA banner
    const etaBig = document.querySelector('.yellow-banner .big');
    if (etaBig) etaBig.textContent = `${order.eta} minutes`;
  }

  function injectDriverTasks() {
    // Driver tasks page in the new driver portal is simple HTML.
    const isTasks = location.pathname.endsWith('/driver/tasks.html');
    const isDetails = location.pathname.endsWith('/driver/task-details.html');
    const isAccepted = location.pathname.endsWith('/driver/delivery-accepted.html');
    const isP1 = location.pathname.endsWith('/driver/delivery-progress-1.html');
    const isP2 = location.pathname.endsWith('/driver/delivery-progress-2.html');
    const isPOD = location.pathname.endsWith('/driver/proof-of-delivery.html');

    const params = new URLSearchParams(location.search);
    const orderId = params.get('order');

    function setStatus(orderId, status) {
      const orders = getOrders();
      const o = orders.find((x) => x.id === orderId);
      if (!o) return;
      o.status = status;
      o.eta = status === 'IN_TRANSIT' ? 12 : o.eta;
      o.steps = o.steps || {};
      if (status === 'ACCEPTED') o.steps.acceptedAt = nowISO();
      if (status === 'PICKED_UP') o.steps.pickedUpAt = nowISO();
      if (status === 'IN_TRANSIT') o.steps.inTransitAt = nowISO();
      if (status === 'DELIVERED') o.steps.deliveredAt = nowISO();
      saveOrders(orders);
    }

    function ensureInvoiceForOrder(orderId) {
      const orders = getOrders();
      const o = orders.find((x) => x.id === orderId);
      if (!o) return;
      const invoices = getInvoices();
      if (invoices.some((inv) => inv.orderId === orderId)) return;
      const invId = `INV-${String(orderId).replace(/\D/g, '')}`;
      const amount = o.pricing?.total || 145;
      const due = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      invoices.unshift({
        id: invId,
        orderId,
        client: o.client,
        amount,
        status: 'Unpaid',
        createdAt: nowISO(),
        dueDate: due.toISOString().slice(0, 10)
      });
      saveInvoices(invoices);
    }

    function injectPanel(title, bodyHTML) {
      const root = document.getElementById('driver-content') || document.querySelector('.driver-main') || document.body;
      if (!root || $('[data-demo-panel="1"]')) return;
      const wrap = document.createElement('div');
      wrap.setAttribute('data-demo-panel', '1');
      wrap.style.cssText = 'margin:0 0 18px 0; padding:18px; border:1px solid rgba(255,255,255,0.08); border-radius:18px; background:linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.02)); color:#f5f5f5; max-width:none;';
      wrap.innerHTML = `<div style="font-weight:800;font-size:18px;margin-bottom:10px;color:#fff">${title}</div>${bodyHTML}`;
      root.insertBefore(wrap, root.firstChild);
    }

    if (isTasks) {
      return;
      const orders = getOrders().filter((o) => o.status !== 'DELIVERED');
      const list = orders
        .map(
          (o) => `
        <div style="display:flex;gap:12px;align-items:center;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.08);padding:12px 0;flex-wrap:wrap">
          <div>
            <div style="font-weight:800;color:#fff">${o.id} • ${statusLabel(o.status)}</div>
            <div style="color:#b5b5b5;font-size:13px">${o.pickup} → ${o.drop} • Driver: <strong style="color:#fff">${o.assignedDriver}</strong></div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
            ${o.status === 'ASSIGNED' ? `<button data-act="accept" data-order="${o.id}" style="padding:10px 14px;border-radius:12px;background:#f5d10d;border:0;color:#111;font-weight:800;cursor:pointer">Accept</button>` : ''}
            ${(o.status === 'ACCEPTED') ? `<button data-act="pickup" data-order="${o.id}" style="padding:10px 14px;border-radius:12px;background:#f5d10d;border:0;color:#111;font-weight:800;cursor:pointer">Picked Up</button>` : ''}
            ${(o.status === 'PICKED_UP') ? `<button data-act="transit" data-order="${o.id}" style="padding:10px 14px;border-radius:12px;background:#f5d10d;border:0;color:#111;font-weight:800;cursor:pointer">In Transit</button>` : ''}
            ${(o.status === 'IN_TRANSIT') ? `<button data-act="deliver" data-order="${o.id}" style="padding:10px 14px;border-radius:12px;background:#22c55e;border:0;color:#08110a;font-weight:800;cursor:pointer">Delivered</button>` : ''}
            <a href="task-details.html?order=${encodeURIComponent(o.id)}" style="padding:10px 14px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#fff;text-decoration:none;font-weight:800">View</a>
          </div>
        </div>`
        )
        .join('');

      injectPanel(
        'Assigned Orders',
        `<div style="color:#b5b5b5;font-size:13px;margin-bottom:10px">Accept and move each assigned order through its delivery stages from here.</div>${list || '<div style="color:#9ca3af">No active orders.</div>'}`
      );

      $$('button[data-act]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const act = btn.getAttribute('data-act');
          const oid = btn.getAttribute('data-order');
          if (!oid) return;
          if (act === 'accept') {
            setStatus(oid, 'ACCEPTED');
            location.href = `delivery-accepted.html?order=${encodeURIComponent(oid)}`;
          } else if (act === 'pickup') {
            setStatus(oid, 'PICKED_UP');
            location.href = `delivery-progress-1.html?order=${encodeURIComponent(oid)}`;
          } else if (act === 'transit') {
            setStatus(oid, 'IN_TRANSIT');
            location.href = `delivery-progress-2.html?order=${encodeURIComponent(oid)}`;
          } else if (act === 'deliver') {
            setStatus(oid, 'DELIVERED');
            ensureInvoiceForOrder(oid);
            location.href = `proof-of-delivery.html?order=${encodeURIComponent(oid)}`;
          }
        });
      });
    }

    if (isDetails || isAccepted || isP1 || isP2 || isPOD) {
      if (!orderId) return;
      const o = getOrders().find((x) => x.id === orderId);
      if (!o) return;

      const actions = [];
      if (o.status === 'ASSIGNED') actions.push(`<button data-demo-next="accept" style="padding:10px 14px;border-radius:12px;background:#f5d10d;border:0;color:#111;font-weight:800;cursor:pointer">Accept</button>`);
      if (o.status === 'ACCEPTED') actions.push(`<button data-demo-next="pickup" style="padding:10px 14px;border-radius:12px;background:#f5d10d;border:0;color:#111;font-weight:800;cursor:pointer">Picked Up</button>`);
      if (o.status === 'PICKED_UP') actions.push(`<button data-demo-next="transit" style="padding:10px 14px;border-radius:12px;background:#f5d10d;border:0;color:#111;font-weight:800;cursor:pointer">In Transit</button>`);
      if (o.status === 'IN_TRANSIT') actions.push(`<button data-demo-next="deliver" style="padding:10px 14px;border-radius:12px;background:#22c55e;border:0;color:#08110a;font-weight:800;cursor:pointer">Delivered</button>`);
      if (o.status === 'DELIVERED') actions.push(`<a href="../business-client/invoices.html" style="padding:10px 14px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#fff;text-decoration:none;font-weight:800">Go to Business Client Invoices</a>`);

      injectPanel(
        `${o.id} • ${statusLabel(o.status)}`,
        `<div style="color:#b5b5b5;font-size:13px;margin-bottom:10px"><strong style="color:#fff">Route:</strong> ${o.pickup} → ${o.drop}<br><strong style="color:#fff">Assigned:</strong> ${o.assignedDriver} • <strong style="color:#fff">Type:</strong> ${o.deliveryType}</div><div style="display:flex;gap:10px;flex-wrap:wrap">${actions.join('')}</div>`
      );

      const nextBtn = $('[data-demo-next]');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          const act = nextBtn.getAttribute('data-demo-next');
          if (act === 'accept') {
            setStatus(orderId, 'ACCEPTED');
            location.href = `delivery-accepted.html?order=${encodeURIComponent(orderId)}`;
          } else if (act === 'pickup') {
            setStatus(orderId, 'PICKED_UP');
            location.href = `delivery-progress-1.html?order=${encodeURIComponent(orderId)}`;
          } else if (act === 'transit') {
            setStatus(orderId, 'IN_TRANSIT');
            location.href = `delivery-progress-2.html?order=${encodeURIComponent(orderId)}`;
          } else if (act === 'deliver') {
            setStatus(orderId, 'DELIVERED');
            ensureInvoiceForOrder(orderId);
            location.href = `proof-of-delivery.html?order=${encodeURIComponent(orderId)}`;
          }
        });
      }
    }
  }

  function injectMonitoringTable(where) {
    // where: 'fm' | 'su'
    const orders = getOrders();
    if (!orders.length) return;

    const table = `
      <div data-workflow-monitor="1" style="margin:16px 0;padding:14px;border:1px solid rgba(255,255,255,0.08);border-radius:16px;background:rgba(255,255,255,0.02)">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
          <div>
            <div style="font-weight:900;font-size:18px">Live Orders</div>
            <div style="color:#b5b5b5;font-size:13px;margin-top:4px">This panel updates as the driver progresses through steps.</div>
          </div>
          <button data-workflow-refresh class="btn-yellow" style="padding:10px 14px;border-radius:12px">Refresh</button>
        </div>
        <div style="overflow:auto;margin-top:12px">
          <table style="width:100%;border-collapse:collapse;min-width:860px">
            <thead>
              <tr style="text-align:left;color:#9ca3af;font-size:12px">
                <th style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,0.08)">Order</th>
                <th style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,0.08)">Client</th>
                <th style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,0.08)">Route</th>
                <th style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,0.08)">Driver</th>
                <th style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,0.08)">Status</th>
                <th style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,0.08)">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${orders
                .map(
                  (o) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
                  <td style="padding:10px 8px;font-weight:800">${o.id}</td>
                  <td style="padding:10px 8px">${o.client}</td>
                  <td style="padding:10px 8px">${o.pickup} → ${o.drop}</td>
                  <td style="padding:10px 8px"><strong>${o.assignedDriver}</strong></td>
                  <td style="padding:10px 8px">${statusLabel(o.status)}</td>
                  <td style="padding:10px 8px">
                    <button data-reassign="${o.id}" class="btn-dark" style="padding:8px 10px;border-radius:10px">Reassign</button>
                    <a href="${where === 'fm' ? 'live-tracking.html' : 'trip-details.html'}?order=${encodeURIComponent(o.id)}" class="btn-dark" style="padding:8px 10px;border-radius:10px;margin-left:6px;display:inline-block">View</a>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    return table;
  }

  function wireMonitoringActions(container) {
    if (!container) return;
    const refreshBtn = $('[data-workflow-refresh]', container);
    if (refreshBtn) refreshBtn.addEventListener('click', () => location.reload());

    $$('button[data-reassign]', container).forEach((btn) => {
      btn.addEventListener('click', () => {
        const orderId = btn.getAttribute('data-reassign');
        const drivers = readJSON('dsDemoDrivers', ['Raghav Reddy', 'Srujan', 'Sarath']);
        const choice = prompt('Reassign driver (enter name):\n' + drivers.join(', '), drivers[0]);
        if (!choice) return;
        const orders = getOrders();
        const o = orders.find((x) => x.id === orderId);
        if (o) {
          o.assignedDriver = choice.trim();
          o.steps = o.steps || {};
          o.steps.reassignedAt = nowISO();
          saveOrders(orders);
          wfToast(`Order ${orderId} reassigned to ${o.assignedDriver}`);
          location.reload();
        }
      });
    });
  }



  function renderFleetManagerTripsSection() {
    if (!location.pathname.endsWith('/fleet-manager/trips.html')) return;

    // Remove old injected monitoring panel if present
    const oldPanel = document.querySelector('[data-workflow-monitor="1"]');
    if (oldPanel) oldPanel.remove();

    const orders = getOrders();
    const section = document.querySelector('section.panel');
    const table = section ? section.querySelector('table.table') : null;
    const tbody = table ? table.querySelector('tbody') : null;
    const theadRow = table ? table.querySelector('thead tr') : null;
    const searchInput = document.querySelector('.toolbar .search-sm input');
    const headerSearchInput = document.querySelector('.toptools .search input');
    const chipRow = document.querySelector('.chiprow');
    if (!section || !table || !tbody || !theadRow) return;

    const vehicleByDriver = {
      'Raghav Reddy': 'TN-09-AB-2345',
      'Srujan': 'KA-01-CD-7890',
      'Sarath': 'MH-12-EF-4321',
      'David': 'DL-08-GH-5678',
      'Rajesh': 'TN-05-IJ-9012',
      'Rajesh Kumar': 'TN-05-IJ-9012'
    };

    const tripStatus = (s) => {
      if (s === 'ASSIGNED') return 'Assigning';
      if (s === 'PICKED_UP') return 'Picked Up';
      if (s === 'IN_TRANSIT') return 'In Transit';
      if (s === 'DELIVERED') return 'Delivered';
      if (s === 'ACCEPTED') return 'Picked Up';
      return 'Assigning';
    };

    const statusClass = (s) => {
      if (s === 'DELIVERED') return 'pill-green';
      if (s === 'IN_TRANSIT') return 'pill-blue';
      if (s === 'PICKED_UP' || s === 'ACCEPTED') return 'pill-yellow';
      return 'pill-yellow';
    };

    const makeTripId = (orderId) => {
      const num = String(orderId || '').replace(/\D/g, '') || '0000';
      return 'TR-' + num.slice(-4).padStart(4, '0');
    };

    const renderRows = (query='') => {
      const q = query.trim().toLowerCase();
      const filtered = orders.filter(o => {
        if (!q) return true;
        const fields = [
          makeTripId(o.id),
          o.id,
          o.client,
          o.assignedDriver,
          vehicleByDriver[o.assignedDriver] || 'TN-09-AB-2345',
          o.pickup,
          o.drop,
          `${o.pickup} ${o.drop}`,
          tripStatus(o.status)
        ].map(v => String(v || '').toLowerCase());
        return fields.some(field => field.split(/\s+/).some(token => token.startsWith(q)) || field.startsWith(q));
      });

      theadRow.innerHTML = '<th>Trip ID</th><th>Order ID</th><th>Client</th><th>Driver</th><th>Vehicle</th><th>Route</th><th>Status</th><th>Actions</th>';
      tbody.innerHTML = filtered.length ? filtered.map((o, idx) => {
        const menuId = `tripMenu_${idx}_${String(o.id).replace(/[^a-zA-Z0-9]/g,'')}`;
        return `
          <tr data-trip-row="1">
            <td class="em">${makeTripId(o.id)}</td>
            <td class="em">${o.id}</td>
            <td>${o.client}</td>
            <td>${o.assignedDriver || 'Assigning'}</td>
            <td class="em">${vehicleByDriver[o.assignedDriver] || 'TN-09-AB-2345'}</td>
            <td>${o.pickup} → ${o.drop}</td>
            <td><span class="pill ${statusClass(o.status)}">${tripStatus(o.status)}</span></td>
            <td style="position:relative">
              <button class="btn btn-small btn-ghost workflow-menu-btn" data-menu-target="${menuId}" style="padding:8px 12px;font-weight:800">⋯</button>
              <div id="${menuId}" class="workflow-menu" style="display:none;position:absolute;right:0;top:44px;background:#05070b;border:1px solid #1f2937;border-radius:14px;min-width:150px;box-shadow:0 16px 32px rgba(0,0,0,.45);z-index:20;overflow:hidden">
                <a href="live-tracking.html?order=${encodeURIComponent(o.id)}" style="display:block;padding:12px 14px;color:#ffffff;text-decoration:none;border-bottom:1px solid #1f2937;background:#05070b">View</a>
                <button data-open-reassign="${o.id}" data-submenu-target="${menuId}_drivers" style="display:block;width:100%;text-align:left;padding:12px 14px;background:#05070b;border:0;color:#ffffff;cursor:pointer">Reassign</button>
              </div>
              <div id="${menuId}_drivers" class="workflow-submenu" style="display:none;position:fixed;background:#05070b;border:1px solid #1f2937;border-radius:14px;min-width:190px;max-height:260px;overflow-y:auto;box-shadow:0 16px 32px rgba(0,0,0,.45);z-index:21"></div>
            </td>
          </tr>`;
      }).join('') : '<tr><td colspan="6" style="padding:16px;color:#8f8f8f">No trips found.</td></tr>';

      // counts
      if (chipRow) {
        const assigned = orders.filter(o => o.status === 'ASSIGNED').length;
        const picked = orders.filter(o => o.status === 'PICKED_UP' || o.status === 'ACCEPTED').length;
        const transit = orders.filter(o => o.status === 'IN_TRANSIT').length;
        const delivered = orders.filter(o => o.status === 'DELIVERED').length;
        chipRow.innerHTML = `
          <div class="btn btn-ghost btn-small">${orders.length} Total Trips</div>
          <div class="btn btn-ghost btn-small">${assigned} Assigning</div>
          <div class="btn btn-ghost btn-small">${picked} Picked Up</div>
          <div class="btn btn-ghost btn-small">${transit} In Transit</div>
          <div class="btn btn-ghost btn-small">${delivered} Delivered</div>`;
      }

    };

    renderRows();

    // replace footer summary text if present
    const footer = Array.from(section.children).find(el => el.tagName === 'DIV' && el.textContent.includes('Showing'));
    if (footer) footer.innerHTML = `<span>Showing workflow trips</span><span class="btn btn-yellow btn-small">Live</span>`;

    if (searchInput) {
      searchInput.addEventListener('input', () => renderRows(searchInput.value));
    }
    if (headerSearchInput) {
      headerSearchInput.addEventListener('input', () => renderRows(headerSearchInput.value));
    }

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.workflow-menu-btn');
      const openReassignBtn = e.target.closest('[data-open-reassign]');
      const pickDriverBtn = e.target.closest('[data-pick-driver]');

      if (!e.target.closest('.workflow-menu') && !e.target.closest('.workflow-submenu') && !btn) {
        document.querySelectorAll('.workflow-menu, .workflow-submenu').forEach(menu => menu.style.display = 'none');
      }

      if (btn) {
        e.preventDefault();
        document.querySelectorAll('.workflow-submenu').forEach(menu => menu.style.display = 'none');
        const menu = document.getElementById(btn.getAttribute('data-menu-target'));
        document.querySelectorAll('.workflow-menu').forEach(m => { if (m !== menu) m.style.display = 'none'; });
        if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
      }

      if (openReassignBtn) {
        e.preventDefault();
        const orderId = openReassignBtn.getAttribute('data-open-reassign');
        const targetId = openReassignBtn.getAttribute('data-submenu-target');
        const submenu = document.getElementById(targetId);
        const drivers = readJSON('dsDemoDrivers', ['Raghav Reddy','Srujan','Sarath','David','Rajesh Kumar','Kiran Teja']);
        if (submenu) {
          submenu.innerHTML = drivers.map(driver => `<button data-pick-driver="${driver}" data-order-id="${orderId}" style="display:block;width:100%;text-align:left;padding:11px 14px;background:#05070b;border:0;border-bottom:1px solid #1f2937;color:#ffffff;cursor:pointer">${driver}</button>`).join('');
          document.querySelectorAll('.workflow-submenu').forEach(m => { if (m !== submenu) m.style.display = 'none'; });
          submenu.style.display = submenu.style.display === 'block' ? 'none' : 'block';
        }
      }

      if (pickDriverBtn) {
        e.preventDefault();
        const orderId = pickDriverBtn.getAttribute('data-order-id');
        const driver = pickDriverBtn.getAttribute('data-pick-driver');
        const order = getOrders().find(o => o.id === orderId);
        if (!order) return;
        order.assignedDriver = driver;
        saveOrders(getOrders().map(o => o.id === orderId ? order : o));
        document.querySelectorAll('.workflow-menu, .workflow-submenu').forEach(menu => menu.style.display = 'none');
        renderRows(searchInput ? searchInput.value : (headerSearchInput ? headerSearchInput.value : ''));
      }
    });
  }





  function renderFleetManagerDashboardLiveOrders() {
    if (!location.pathname.endsWith('/fleet-manager/dashboard.html')) return;
    const orders = getOrders();
    if (!orders.length) return;
    const panels = Array.from(document.querySelectorAll('section.panel'));
    const target = panels.find(p => p.textContent.includes('Auto-Assignments'));
    if (!target) return;

    const vehicleByDriver = {
      'Raghav Reddy': 'TN-09-AB-2345',
      'Srujan': 'KA-01-CD-7890',
      'Sarath': 'MH-12-EF-4321',
      'David': 'DL-08-GH-5678',
      'Rajesh': 'TN-05-IJ-9012',
      'Rajesh Kumar': 'TN-05-IJ-9012'
    };
    const makeTripId = (oid) => {
      const num = String(oid || '').replace(/\D/g, '') || '0000';
      return 'TR-' + num.slice(-4).padStart(4, '0');
    };
    const tripStatus = (s) => {
      if (s === 'ASSIGNED') return {label:'Assigning', cls:'pill-yellow'};
      if (s === 'PICKED_UP' || s === 'ACCEPTED') return {label:'Picked Up', cls:'pill-yellow'};
      if (s === 'IN_TRANSIT') return {label:'In Transit', cls:'pill-blue'};
      if (s === 'DELIVERED') return {label:'Delivered', cls:'pill-green'};
      return {label:'Assigning', cls:'pill-yellow'};
    };

    target.innerHTML = `
      <div class="panel-head">
        <div class="panel-title">Live Orders</div>
        <span class="pill pill-yellow">${orders.length} Active in Workflow</span>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Trip ID</th><th>Order ID</th><th>Client</th><th>Driver</th><th>Vehicle</th><th>Route</th><th>Status</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map((o, idx) => {
            const status = tripStatus(o.status);
            const menuId = `dashMenu_${idx}_${String(o.id).replace(/[^a-zA-Z0-9]/g,'')}`;
            return `
              <tr>
                <td class="em">${makeTripId(o.id)}</td>
                <td class="em">${o.id}</td>
                <td>${o.client}</td>
                <td>${o.assignedDriver || 'Assigning'}</td>
                <td class="em">${vehicleByDriver[o.assignedDriver] || 'TN-09-AB-2345'}</td>
                <td>${o.pickup} → ${o.drop}</td>
                <td><span class="pill ${status.cls}">${status.label}</span></td>
                <td style="position:relative">
                  <button class="btn btn-small btn-ghost workflow-menu-btn" data-menu-target="${menuId}" style="padding:8px 12px;font-weight:800">⋯</button>
                  <div id="${menuId}" class="workflow-menu" style="display:none;position:absolute;right:0;top:44px;background:#05070b;border:1px solid #1f2937;border-radius:14px;min-width:150px;box-shadow:0 16px 32px rgba(0,0,0,.45);z-index:20;overflow:hidden">
                    <a href="live-tracking.html?order=${encodeURIComponent(o.id)}" style="display:block;padding:12px 14px;color:#ffffff;text-decoration:none;border-bottom:1px solid #1f2937;background:#05070b">View</a>
                    <button data-open-reassign="${o.id}" data-submenu-target="${menuId}_drivers" style="display:block;width:100%;text-align:left;padding:12px 14px;background:#05070b;border:0;color:#ffffff;cursor:pointer">Reassign</button>
                  </div>
                  <div id="${menuId}_drivers" class="workflow-submenu" style="display:none;position:fixed;background:#05070b;border:1px solid #1f2937;border-radius:14px;min-width:190px;max-height:260px;overflow-y:auto;box-shadow:0 16px 32px rgba(0,0,0,.45);z-index:21"></div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;

    target.addEventListener('click', (e) => {
      const btn = e.target.closest('.workflow-menu-btn');
      const openReassignBtn = e.target.closest('[data-open-reassign]');
      const pickDriverBtn = e.target.closest('[data-pick-driver]');

      if (!e.target.closest('.workflow-menu') && !e.target.closest('.workflow-submenu') && !btn) {
        document.querySelectorAll('.workflow-menu, .workflow-submenu').forEach(menu => menu.style.display = 'none');
      }
      if (btn) {
        e.preventDefault();
        document.querySelectorAll('.workflow-submenu').forEach(menu => menu.style.display = 'none');
        const menu = document.getElementById(btn.getAttribute('data-menu-target'));
        document.querySelectorAll('.workflow-menu').forEach(m => { if (m !== menu) m.style.display = 'none'; });
        if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
      }
      if (openReassignBtn) {
        e.preventDefault();
        const orderId = openReassignBtn.getAttribute('data-open-reassign');
        const targetId = openReassignBtn.getAttribute('data-submenu-target');
        const submenu = document.getElementById(targetId);
        const drivers = readJSON('dsDemoDrivers', ['Raghav Reddy','Srujan','Sarath','David','Rajesh Kumar','Kiran Teja']);
        if (submenu) {
          submenu.innerHTML = drivers.map(driver => `<button data-pick-driver=\"${driver}\" data-order-id=\"${orderId}\" style=\"display:block;width:100%;text-align:left;padding:11px 14px;background:#05070b;border:0;border-bottom:1px solid #1f2937;color:#ffffff;cursor:pointer\">${driver}</button>`).join('');
          const rect = openReassignBtn.getBoundingClientRect();
          const submenuWidth = 220; const submenuMaxHeight = 260;
          const left = Math.min(window.innerWidth - submenuWidth - 16, Math.max(16, rect.left - submenuWidth + rect.width));
          const top = Math.min(window.innerHeight - submenuMaxHeight - 16, Math.max(16, rect.top));
          submenu.style.top = `${top}px`;
          submenu.style.left = `${left}px`;
          submenu.style.maxHeight = `${submenuMaxHeight}px`;
          submenu.style.overflowY = 'auto';
          document.querySelectorAll('.workflow-submenu').forEach(m => { if (m !== submenu) m.style.display = 'none'; });
          submenu.style.display = submenu.style.display === 'block' ? 'none' : 'block';
        }
      }
      if (pickDriverBtn) {
        e.preventDefault();
        const orderId = pickDriverBtn.getAttribute('data-order-id');
        const driver = pickDriverBtn.getAttribute('data-pick-driver');
        const updated = getOrders().map(o => o.id === orderId ? { ...o, assignedDriver: driver } : o);
        saveOrders(updated);
        location.reload();
      }
    });
  }

  function renderFleetManagerTripDetail() {
    if (!location.pathname.endsWith('/fleet-manager/live-tracking.html')) return;
    const oldPanel = document.querySelector('[data-workflow-monitor="1"]');
    if (oldPanel) oldPanel.remove();

    const params = new URLSearchParams(location.search);
    const orderId = params.get('order');
    const order = orderId ? getOrders().find(o => o.id === orderId) : getOrders()[0];
    if (!order) return;

    const makeTripId = (oid) => {
      const num = String(oid || '').replace(/\D/g, '') || '0000';
      return 'TR-' + num.slice(-4).padStart(4, '0');
    };
    const vehicleByDriver = {
      'Raghav Reddy': 'TN-09-AB-2345',
      'Srujan': 'KA-01-CD-7890',
      'Sarath': 'MH-12-EF-4321',
      'David': 'DL-08-GH-5678',
      'Rajesh': 'TN-05-IJ-9012',
      'Rajesh Kumar': 'TN-05-IJ-9012'
    };
    const tripStatus = (s) => {
      if (s === 'ASSIGNED') return {label:'Assigning', cls:'pill-yellow'};
      if (s === 'PICKED_UP' || s === 'ACCEPTED') return {label:'Picked Up', cls:'pill-yellow'};
      if (s === 'IN_TRANSIT') return {label:'In Transit', cls:'pill-blue'};
      if (s === 'DELIVERED') return {label:'Delivered', cls:'pill-green'};
      return {label:'Assigning', cls:'pill-yellow'};
    };
    const initials = (name) => String(name||'DR').split(/\s+/).map(x=>x[0]||'').join('').slice(0,2).toUpperCase();

    const headTitle = document.querySelector('.pagehead h1');
    const headSub = document.querySelector('.pagehead p');
    if (headTitle) headTitle.textContent = 'Trip Detail';
    if (headSub) headSub.textContent = `Detailed view of trip ${makeTripId(order.id)}`;

    const summary = document.querySelector('.content > section.panel');
    if (summary) {
      const status = tripStatus(order.status);
      const title = summary.querySelector('div[style*="font-size:18px"]');
      const meta = summary.querySelector('.muted');
      if (title) title.innerHTML = `${makeTripId(order.id)} <span class="pill ${status.cls}" style="margin-left:8px">${status.label}</span>`;
      if (meta) meta.textContent = `◉ ${order.pickup} → ${order.drop} · ${order.eta || 35} km · ${order.deliveryType}`;
      const btns = summary.querySelectorAll('button');
      if (btns[1]) btns[1].remove();
    }

    const routeSubtitle = Array.from(document.querySelectorAll('.muted')).find(el => /NH-|Chennai|Bangalore|km/.test(el.textContent));
    if (routeSubtitle && routeSubtitle.textContent.includes('NH-')) {
      routeSubtitle.textContent = `${order.pickup} → ${order.drop} · ${order.eta || 35} km`;
    }

    const driverCard = Array.from(document.querySelectorAll('.detail-card')).find(card => card.textContent.includes('Driver'));
    if (driverCard) {
      const avatar = driverCard.querySelector('.avatar');
      const strong = driverCard.querySelector('strong');
      if (avatar) avatar.textContent = initials(order.assignedDriver);
      if (strong) strong.textContent = order.assignedDriver;
      const muted = driverCard.querySelectorAll('.muted');
      if (muted[0]) muted[0].textContent = `DRV-${String(order.id).replace(/\D/g,'').slice(-4)} · ★ 4.7`;
    }

    const vehicleCard = Array.from(document.querySelectorAll('.detail-card')).find(card => card.textContent.includes('Vehicle'));
    if (vehicleCard) {
      const minis = vehicleCard.querySelectorAll('.mini');
      if (minis[0]) minis[0].innerHTML = `<strong>Plate</strong>${vehicleByDriver[order.assignedDriver] || 'TN-09-AB-2345'}`;
    }

    const routeMapPanel = Array.from(document.querySelectorAll('.panel')).find(panel => panel.textContent.includes('Route Map'));
    if (routeMapPanel) {
      const centerMuted = Array.from(routeMapPanel.querySelectorAll('.muted')).find(el => el.textContent.includes('·'));
      if (centerMuted) centerMuted.textContent = `${order.pickup} → ${order.drop} · ${order.eta || 35} km`;
      const stats = routeMapPanel.querySelectorAll('.mini-stat .big');
      if (stats[0]) stats[0].textContent = `${order.eta || 35} km`;
    }

    const timelineCard = Array.from(document.querySelectorAll('.detail-card')).find(card => card.textContent.includes('Trip Timeline'));
    if (timelineCard) {
      const timeline = timelineCard.querySelector('.trip-timeline');
      if (timeline) {
        const items = [
          `<div class="item"><strong>Order Created</strong><div class="muted">${order.steps?.createdAt ? new Date(order.steps.createdAt).toLocaleString() : '—'} · ${order.pickup}</div></div>`,
          `<div class="item"><strong>Driver Assigned</strong><div class="muted">${order.assignedDriver} · ${vehicleByDriver[order.assignedDriver] || 'TN-09-AB-2345'}</div></div>`,
          `<div class="item"><strong>Picked Up</strong><div class="muted">${order.steps?.pickedUpAt ? new Date(order.steps.pickedUpAt).toLocaleString() : 'Pending'}</div></div>`,
          `<div class="item"><strong>In Transit</strong><div class="muted">${order.steps?.inTransitAt ? new Date(order.steps.inTransitAt).toLocaleString() : 'Pending'}</div></div>`,
          `<div class="item"><strong>Delivered</strong><div class="muted">${order.steps?.deliveredAt ? new Date(order.steps.deliveredAt).toLocaleString() : 'Pending'}</div></div>`
        ];
        timeline.innerHTML = items.join('');
      }
    }
  }

  function injectFleetManagerMonitoring() {
    return;
    const isTrips = location.pathname.endsWith('/fleet-manager/trips.html');
    const isLive = location.pathname.endsWith('/fleet-manager/live-tracking.html');
    if (isTrips || isLive) return;

    const main = document.querySelector('main') || document.body;
    if (!main || $('[data-workflow-monitor="1"]')) return;
    main.insertAdjacentHTML('afterbegin', injectMonitoringTable('fm'));
    wireMonitoringActions(main);
  }

  function injectSuperuserMonitoring() {
    return;
    const isReq = location.pathname.endsWith('/superuser/delivery-requests.html');
    const isTrip = location.pathname.endsWith('/superuser/trip-monitoring.html');
    if (!isReq && !isTrip) return;

    const root = document.querySelector('#pageRoot') || document.body;
    if (!root || $('[data-workflow-monitor="1"]')) return;
    root.insertAdjacentHTML('afterbegin', injectMonitoringTable('su'));
    wireMonitoringActions(root);
  }


  function getSharedAppState() {
    try { return JSON.parse(localStorage.getItem('deliverysync-state-v1') || '{}') || {}; }
    catch(e){ return {}; }
  }

  function saveSharedAppState(state) {
    localStorage.setItem('deliverysync-state-v1', JSON.stringify(state));
  }



  function renderFleetManagerDashboardStats() {
    if (!location.pathname.endsWith('/fleet-manager/dashboard.html')) return;
    const stats = document.querySelectorAll('.stats .stat');
    if (stats.length < 4) return;
    const state = getSharedAppState();
    const vehicles = Array.isArray(state.vehicles) ? state.vehicles : [];
    const maint = Array.isArray(state.maintenanceSchedules) ? state.maintenanceSchedules : [];
    const orders = getOrders();
    const totalVehicles = vehicles.length;
    const totalMaint = maint.length;
    const totalTrips = orders.length;
    const completedTrips = orders.filter(o => String(o.status||'').toUpperCase() === 'DELIVERED').length;

    const values = [totalVehicles, totalMaint, totalTrips, completedTrips];
    const subs = ['Fleet registered','Scheduled records','All assigned trips','Closed successfully'];
    stats.forEach((card, idx) => {
      const v = card.querySelector('.v');
      const s = card.querySelector('.s');
      if (v && values[idx] != null) v.textContent = String(values[idx]);
      if (s && subs[idx]) s.textContent = subs[idx];
    });
  }

  function renderFleetManagerVehiclesShared() {
    if (!location.pathname.endsWith('/fleet-manager/vehicles.html')) return;
    const tbody = document.getElementById('vehicle-body');
    if (!tbody) return;
    const state = getSharedAppState();
    const vehicles = Array.isArray(state.vehicles) ? state.vehicles : [];
    const searchInput = document.querySelector('.search-sm input');
    const filterButtons = Array.from(document.querySelectorAll('.chips .chip, .toolbar + .chips .chip, .chip'));
    let currentFilter = 'all';
    const pill = (v) => {
      const s = String(v || '').toLowerCase();
      if (s.includes('blocked')) return 'pill-red';
      if (s.includes('maint')) return 'pill-orange';
      if (s.includes('trip')) return 'pill-yellow';
      return 'pill-green';
    };
    const render = () => {
      const q = (searchInput?.value || '').trim().toLowerCase();
      const filtered = vehicles.filter(v => {
        const matchQ = JSON.stringify(v).toLowerCase().includes(q);
        const matchF = currentFilter === 'all' ? true : String(v.status || '').toLowerCase() === currentFilter;
        return matchQ && matchF;
      });
      tbody.innerHTML = filtered.map(v=>`<tr><td class='em'>${v.id}</td><td>${v.plate}</td><td>${v.type}</td><td><span class='pill ${pill(v.status)}'>${v.status}</span></td><td>${v.maintenance || '—'}</td><td><span class='pill ${pill(v.availability || (v.status==='Active'?'Available':'Unavailable'))}'>${v.availability || (v.status==='Active'?'Available':'Unavailable')}</span></td><td><div class='actions'><button class='dots'>⋮</button><div class='menu'><a href='edit-vehicle.html?id=${v.id}'>Edit</a><a href='schedule-maintenance.html?id=${v.id}'>Schedule Maint.</a><button class='danger'>Block</button></div></div></td></tr>`).join('') || `<tr><td colspan="7" style="text-align:center;color:#8f8f8f;padding:18px">No vehicles found.</td></tr>`;
    };
    if (searchInput && !searchInput.dataset.workflowVehicles) { searchInput.dataset.workflowVehicles='1'; searchInput.addEventListener('input', render); }
    filterButtons.forEach(btn=>{
      const txt = btn.textContent.trim().toLowerCase();
      if(['all vehicles','active','on trip','maintenance','blocked'].includes(txt)){
        btn.addEventListener('click', ()=>{ currentFilter = txt === 'all vehicles' ? 'all' : txt; render(); });
      }
    });
    render();
  }

  function wireFleetManagerAddVehicle() {
    if (!location.pathname.endsWith('/fleet-manager/add-vehicle.html')) return;
    const panel = document.querySelector('.panel-body');
    if (!panel) return;
    const inputs = panel.querySelectorAll('input');
    const selects = panel.querySelectorAll('select');
    const plate = inputs[0], model = inputs[1], capacity = inputs[2], color = inputs[3], insurance = inputs[4];
    const type = selects[0];
    if (plate) plate.placeholder = 'e.g. AP09CD4567';
    if (capacity) capacity.placeholder = 'e.g. 2 Tons or 500 Kg';
    if (color) color.placeholder = 'e.g. White';
    const buttons = panel.querySelectorAll('.footer-actions button');
    const cancelBtn = buttons[0], createBtn = buttons[1];
    panel.querySelectorAll('.field').forEach((field)=>{ if(!field.querySelector('.helper.error-inline')){ const err=document.createElement('div'); err.className='helper error-inline'; err.style.color='#ff8d8d'; err.style.marginTop='6px'; field.appendChild(err);} });
    const errs = panel.querySelectorAll('.error-inline');
    if (cancelBtn) cancelBtn.onclick = ()=>location.href='vehicles.html';
    if (createBtn && !createBtn.dataset.workflowVehicle) {
      createBtn.dataset.workflowVehicle='1';
      createBtn.onclick = ()=>{
        errs.forEach(e=>e.textContent='');
        const plateVal = (plate?.value || '').trim().toUpperCase();
        const typeVal = (type?.value || '').trim();
        const modelVal = (model?.value || '').trim();
        const capacityVal = (capacity?.value || '').trim();
        const colorVal = (color?.value || '').trim();
        const insuranceVal = (insurance?.value || '').trim();
        let ok = true;
        if (!/^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$/.test(plateVal)) { errs[0].textContent='Enter a valid plate number like TN09AB1234'; ok=false; }
        if (!typeVal) { errs[1].textContent='Select vehicle type'; ok=false; }
        if (!/^[A-Za-z0-9][A-Za-z0-9\s-]{1,39}$/.test(modelVal)) { errs[2].textContent='Enter a valid model name'; ok=false; }
        if (!/^\d+(?:\.\d+)?\s?(?:Tons?|Kg|kgs?)$/i.test(capacityVal)) { errs[3].textContent='Enter valid capacity like 2 Tons or 500 Kg'; ok=false; }
        if (!/^[A-Za-z][A-Za-z\s-]{2,19}$/.test(colorVal)) { errs[4].textContent='Enter a valid color'; ok=false; }
        if (!insuranceVal) { errs[5].textContent='Select last maintenance date'; ok=false; }
        if (insuranceVal && new Date(insuranceVal) <= new Date()) { errs[5].textContent='Last maintenance date must be a future date'; ok=false; }
        const state = getSharedAppState();
        state.vehicles = Array.isArray(state.vehicles) ? state.vehicles : [];
        if (state.vehicles.some(v => String(v.plate).toUpperCase() === plateVal)) { errs[0].textContent='Plate number already exists'; ok=false; }
        if (!ok) return;
        const nextNum = 1000 + state.vehicles.length + 1;
        state.vehicles.push({
          id: `VH-${nextNum}`,
          plate: plateVal,
          type: typeVal,
          model: modelVal,
          capacity: capacityVal,
          color: colorVal,
          status: 'Active',
          maintenance: insuranceVal,
          availability: 'Available'
        });
        saveSharedAppState(state);
        location.href='vehicles.html';
      };
    }
  }

  function renderFleetManagerMaintenanceShared() {
    if (!location.pathname.endsWith('/fleet-manager/maintenance.html')) return;
    const tbody = document.querySelector('table.table tbody');
    if (!tbody) return;
    const state = getSharedAppState();
    const list = Array.isArray(state.maintenanceSchedules) ? state.maintenanceSchedules : [];
    if (!list.length) return;

    const render = () => {
      const q = (document.querySelector('.search-sm input')?.value || '').trim().toLowerCase();
      const filtered = list.filter(item => JSON.stringify(item).toLowerCase().includes(q));
      const pill = (v) => {
        const s = String(v || '').toLowerCase();
        if (s.includes('critical') || s.includes('overdue')) return 'pill-red';
        if (s.includes('high') || s.includes('maintenance')) return 'pill-orange';
        if (s.includes('medium') || s.includes('scheduled') || s.includes('progress')) return 'pill-yellow';
        return 'pill-green';
      };
      tbody.innerHTML = filtered.map(r => `<tr>
        <td class="em">${r.vehicle}</td>
        <td>${r.issue}</td>
        <td><span class="pill ${pill(r.priority)}">${r.priority}</span></td>
        <td>${r.date}</td>
        <td>${r.mechanic}</td>
        <td class="em">${r.cost || '--'}</td>
      </tr>`).join('') || `<tr><td colspan="6" style="text-align:center;color:#8f8f8f;padding:18px">No maintenance records found.</td></tr>`;

      const stats = document.querySelectorAll('.stats .stat .v');
      if (stats.length >= 3) {
        stats[0].textContent = String(list.length);
        stats[1].textContent = String(list.filter(i => String(i.status).toLowerCase().includes('completed')).length);
        const total = list.reduce((sum, i) => sum + (parseFloat(String(i.cost || '').replace(/[^\d.]/g, '')) || 0), 0);
        stats[2].textContent = `₹${Math.round(total).toLocaleString('en-IN')}`;
      }
    };

    const search = document.querySelector('.search-sm input');
    if (search && !search.dataset.workflowMaint) {
      search.dataset.workflowMaint = '1';
      search.addEventListener('input', render);
    }
    render();
  }

  function wireFleetManagerScheduleMaintenance() {
    if (!location.pathname.endsWith('/fleet-manager/schedule-maintenance.html')) return;
    const content = document.querySelector('.content');
    if (!content) return;

    const vehicles = ['TN09AB1234','KA03PQ9876','TS08XY2045'];
    const issueTypes = ['Engine Oil Change','Brake Pad Replacement','Tire Rotation & Balance','Air Filter Replacement','Transmission Service'];
    const priorities = ['Low','Medium','High','Critical'];
    const mechanics = ['Ravi Auto Service','SpeedFix Workshop','AutoCare Pro'];
    const state = getSharedAppState();
    state.maintenanceSchedules = Array.isArray(state.maintenanceSchedules) ? state.maintenanceSchedules : [];
    const editId = new URLSearchParams(location.search).get('id');
    const existing = state.maintenanceSchedules.find(x => x.id === editId) || null;

    content.innerHTML = `
      <div class="split">
        <div class="stack">
          <div class="info-card">
            <h3>Vehicle &amp; Issue Details</h3>
            <div class="field"><label>Vehicle *</label><select id="fmMaintVehicle">${vehicles.map(v => `<option ${existing&&existing.vehicle===v?'selected':''}>${v}</option>`).join('')}</select><div class="helper" id="err-fmMaintVehicle" style="color:#ff8d8d"></div></div>
            <div class="field"><label>Issue Type *</label><select id="fmMaintIssue">${issueTypes.map(v => `<option ${existing&&existing.issue===v?'selected':''}>${v}</option>`).join('')}</select><div class="helper" id="err-fmMaintIssue" style="color:#ff8d8d"></div></div>
            <div class="field"><label>Priority *</label><select id="fmMaintPriority">${priorities.map(v => `<option ${existing&&existing.priority===v?'selected':''} ${!existing&&v==='Medium'?'selected':''}>${v}</option>`).join('')}</select></div>
          </div>
          <div class="info-card">
            <h3>Additional Notes</h3>
            <div class="field"><textarea id="fmMaintNotes" style="min-height:200px" placeholder="Enter any special instructions or notes for the mechanic...">${existing&&existing.notes?existing.notes:''}</textarea></div>
          </div>
        </div>
        <div class="stack">
          <div class="info-card">
            <h3>Scheduling &amp; Assignment</h3>
            <div class="field"><label>Scheduled Date *</label><input id="fmMaintDate" type="date" value="${existing?existing.date:''}"><div class="helper" id="err-fmMaintDate" style="color:#ff8d8d"></div></div>
            <div class="field"><label>Assigned Mechanic *</label><select id="fmMaintMechanic">${mechanics.map(v => `<option ${existing&&existing.mechanic===v?'selected':''}>${v}</option>`).join('')}</select><div class="helper" id="err-fmMaintMechanic" style="color:#ff8d8d"></div></div>
            <div class="field"><label>Estimated Cost (₹)</label><input id="fmMaintCost" placeholder="e.g. 2500" value="${existing?String(existing.cost).replace(/[^\d.]/g,''):''}"><div class="helper" id="err-fmMaintCost" style="color:#ff8d8d"></div></div>
          </div>
          <div class="info-card">
            <h3>Summary Preview</h3>
            <div class="summary-list">
              <div class="summary-row"><span>Vehicle</span><span id="sumFmVehicle">—</span></div>
              <div class="summary-row"><span>Issue</span><span id="sumFmIssue">—</span></div>
              <div class="summary-row"><span>Priority</span><span id="sumFmPriority">—</span></div>
              <div class="summary-row"><span>Date</span><span id="sumFmDate">—</span></div>
              <div class="summary-row"><span>Mechanic</span><span id="sumFmMechanic">—</span></div>
              <div class="summary-row"><span>Est. Cost</span><span id="sumFmCost">—</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="foot-actions"><div></div><div class="right-actions"><a class="btn btn-ghost" href="maintenance.html">✕ Cancel</a><button class="btn btn-yellow" id="fmMaintSave">👜 Schedule Maintenance</button></div></div>`;

    if (!document.getElementById('fmMaintDatePickerTheme')) {
      const style = document.createElement('style');
      style.id = 'fmMaintDatePickerTheme';
      style.textContent = `#fmMaintDate{color-scheme:dark;background-image:none;}#fmMaintDate::-webkit-calendar-picker-indicator{filter:invert(1) brightness(3);opacity:1;cursor:pointer;}#fmMaintDate::-webkit-date-and-time-value{color:#fff;}`;
      document.head.appendChild(style);
    }

    const update = () => {
      const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.textContent = val || '—'; };
      set('sumFmVehicle', document.getElementById('fmMaintVehicle').value);
      set('sumFmIssue', document.getElementById('fmMaintIssue').value);
      set('sumFmPriority', document.getElementById('fmMaintPriority').value);
      set('sumFmDate', document.getElementById('fmMaintDate').value.trim() || '—');
      set('sumFmMechanic', document.getElementById('fmMaintMechanic').value);
      const cost = document.getElementById('fmMaintCost').value.trim();
      set('sumFmCost', cost ? `₹${cost}` : '—');
    };
    ['fmMaintVehicle','fmMaintIssue','fmMaintPriority','fmMaintDate','fmMaintMechanic','fmMaintCost'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.addEventListener('input', update); el.addEventListener('change', update); }
    });
    update();

    document.getElementById('fmMaintSave').addEventListener('click', () => {
      ['fmMaintVehicle','fmMaintIssue','fmMaintDate','fmMaintMechanic','fmMaintCost'].forEach(id => { const err = document.getElementById('err-'+id); if (err) err.textContent = ''; });
      const vehicle = document.getElementById('fmMaintVehicle').value;
      const issue = document.getElementById('fmMaintIssue').value;
      const priority = document.getElementById('fmMaintPriority').value;
      const date = document.getElementById('fmMaintDate').value.trim();
      const mechanic = document.getElementById('fmMaintMechanic').value;
      const cost = document.getElementById('fmMaintCost').value.trim();
      const notes = document.getElementById('fmMaintNotes').value.trim();
      let ok = true;
      if (!vehicles.includes(vehicle)) { document.getElementById('err-fmMaintVehicle').textContent = 'Select a valid vehicle'; ok = false; }
      if (!issueTypes.includes(issue)) { document.getElementById('err-fmMaintIssue').textContent = 'Select a valid issue type'; ok = false; }
      if (!date) { document.getElementById('err-fmMaintDate').textContent = 'Date is required'; ok = false; }
      if (!mechanics.includes(mechanic)) { document.getElementById('err-fmMaintMechanic').textContent = 'Select an assigned mechanic'; ok = false; }
      if (cost && !/^\d{2,7}(?:\.\d{1,2})?$/.test(cost)) { document.getElementById('err-fmMaintCost').textContent = 'Enter a valid cost in rupees'; ok = false; }
      if (notes.length > 300) { wfToast('Additional notes should be 300 characters or less.'); ok = false; }
      if (!ok) return;
      const state2 = getSharedAppState();
      state2.maintenanceSchedules = Array.isArray(state2.maintenanceSchedules) ? state2.maintenanceSchedules : [];
      const id = existing ? existing.id : `MT-2026-${String(Date.now()).slice(-4)}`;
      const payload = { id, vehicle, issue, priority, status: existing ? (existing.status || 'Scheduled') : 'Scheduled', date, mechanic, cost: cost ? `₹${cost}` : '--', notes };
      const idx = state2.maintenanceSchedules.findIndex(x => x.id === id);
      if (idx >= 0) state2.maintenanceSchedules[idx] = payload; else state2.maintenanceSchedules.unshift(payload);
      saveSharedAppState(state2);
      location.href = 'maintenance.html';
    });
  }


  const FEEDBACK_KEY = 'dsWorkflowFeedback';
  function getFeedbacks(){ return readJSON(FEEDBACK_KEY, []); }
  function saveFeedbacks(items){ writeJSON(FEEDBACK_KEY, items); }
  function getBusinessClientProfileData(){
    try {
      const state = JSON.parse(localStorage.getItem('deliverysync-state-v1') || '{}');
      const session = JSON.parse(localStorage.getItem('deliverysync-session-v1') || 'null');
      const fallbackSaved = JSON.parse(localStorage.getItem('bcProfileData') || '{}');
      let user = null;
      if (session && Array.isArray(state.users)) {
        user = state.users.find(u => String(u.email||'').toLowerCase() === String(session.email||'').toLowerCase());
      }
      const pd = user && user.profileDetails ? user.profileDetails : {};
      return {
        companyName: pd.companyName || user?.companyName || fallbackSaved.companyName || fallbackSaved['company-name'] || 'Acme Logistics Inc.',
        address: pd.businessAddress || pd.address || user?.address || fallbackSaved.address || fallbackSaved['address'] || '123 Business Avenue'
      };
    } catch (e) {
      return { companyName:'Acme Logistics Inc.', address:'123 Business Avenue' };
    }
  }
  function renderBCCompletedDeliveriesDynamic() {
    if (!location.pathname.endsWith('/business-client/completed-deliveries.html')) return;
    const orders = getOrders().filter(o => String(o.status||'').toUpperCase() === 'DELIVERED');
    const sorted = orders.slice().sort((a,b)=> new Date(b.steps?.deliveredAt || b.createdAt || 0) - new Date(a.steps?.deliveredAt || a.createdAt || 0));
    const subtitle = document.querySelector('.page-subtitle');
    if (subtitle) subtitle.textContent = `${sorted.length} most recent deliveries`;
    const stats = document.querySelector('.stats-row');
    if (stats) {
      const cards = Array.from(stats.querySelectorAll('.card'));
      cards.forEach((card, idx) => { if (idx > 1) card.remove(); });
      const now = new Date();
      const weekAgo = new Date(); weekAgo.setDate(now.getDate()-6); weekAgo.setHours(0,0,0,0);
      const thisWeek = sorted.filter(o => new Date(o.steps?.deliveredAt || o.createdAt || 0) >= weekAgo).length;
      const thisMonth = sorted.filter(o => {
        const d = new Date(o.steps?.deliveredAt || o.createdAt || 0);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;
      if (cards[0]) {
        const label = cards[0].querySelector('.stat-label'); if (label) label.textContent = 'This Week';
        const value = cards[0].querySelector('.stat-value'); if (value) value.textContent = String(thisWeek);
      }
      if (cards[1]) {
        const label = cards[1].querySelector('.stat-label'); if (label) label.textContent = 'This Month';
        const value = cards[1].querySelector('.stat-value'); if (value) value.textContent = String(thisMonth);
      }
    }
    const thead = document.querySelector('.table-card thead tr');
    if (thead) thead.innerHTML = '<th>Delivery ID</th><th>Date</th><th>Driver</th><th>Route</th><th>Status</th><th>Invoice</th><th>Feedback</th>';
    const tbody = document.querySelector('.table-card tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const feedbacks = getFeedbacks();
    const invoices = getInvoices();
    sorted.forEach(o => {
      const inv = invoices.find(i => i.orderId === o.id) || { id: `INV-${String(o.id).replace(/\D/g,'')}` };
      const dt = new Date(o.steps?.deliveredAt || o.createdAt || Date.now());
      const dateText = dt.toLocaleDateString('en-US',{month:'short', day:'numeric', year:'numeric'});
      const route = `${o.pickup} → ${o.drop}`;
      const fb = feedbacks.find(f => f.orderId === o.id);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>#${String(o.id).replace(/^[A-Z]+-/, '')}</td>
        <td>${dateText}</td>
        <td>${o.assignedDriver || 'Assigning'}</td>
        <td>${route}</td>
        <td><span class="pill yellow">Delivered</span></td>
        <td><a class="btn sm outline-yellow" href="invoice-view.html?order=${encodeURIComponent(o.id)}"><svg viewBox="0 0 24 24"><path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1V3z"></path><path d="M9 8h6"></path><path d="M9 12h6"></path></svg> View</a></td>
        <td>${fb ? `<span class="btn sm" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#d4d4d4;pointer-events:none">Submitted</span>` : `<a class="btn sm yellow" href="feedback.html?order=${encodeURIComponent(o.id)}">Provide Feedback</a>`}</td>`;
      tbody.appendChild(tr);
    });
  }
  function renderBCInvoiceDynamic() {
    if (!location.pathname.endsWith('/business-client/invoice-view.html')) return;

    const params = new URLSearchParams(location.search);
    const orderId = params.get('order');
    const invoiceId = params.get('invoice');

    const invoices = getInvoices();
    const orders = getOrders();

    let invoice = invoiceId ? invoices.find(i => i.id === invoiceId) : null;
    let order = orderId ? (orders.find(o => o.id === orderId) || null) : null;
    if (!invoice && orderId) invoice = invoices.find(i => i.orderId === orderId);
    if (!order && invoice && invoice.orderId) order = orders.find(o => o.id === invoice.orderId) || null;
    if (!order) order = {};
    if (!invoice) {
      const fallbackOrderId = order.id || orderId || 'DS-2045';
      invoice = {
        id: `INV-${String(fallbackOrderId).replace(/\D/g,'')}`,
        orderId: fallbackOrderId,
        amount: order.pricing?.total || 145,
        createdAt: order.steps?.deliveredAt || order.createdAt || new Date().toISOString(),
        dueDate: new Date(Date.now()+7*24*3600*1000).toISOString().slice(0,10),
        status: 'Unpaid',
        client: order.client
      };
    }

    const prof = getBusinessClientProfileData();
    const billedToName = invoice.client || order.client || prof.companyName;
    const billedToAddress = invoice.clientAddress || order.clientAddress || prof.address;
    const created = new Date(invoice.createdAt || order.steps?.deliveredAt || order.createdAt || Date.now());
    const due = new Date(invoice.dueDate || created);
    const createdText = created.toLocaleDateString('en-US',{month:'short', day:'numeric', year:'numeric'});
    const dueText = due.toLocaleDateString('en-US',{month:'short', day:'numeric', year:'numeric'});

    const total = Number(invoice.amount || order.pricing?.total || 145);
    const base = Math.max(0, Math.round((total/1.1)*100)/100);
    const tax = Math.round((total-base)*100)/100;
    const shell = document.querySelector('.invoice-shell');
    if (!shell) return;

    const orderCode = String(invoice.orderId || order.id || orderId || '').replace(/^[A-Z]+-/, '') || '2045';
    const driver = order.assignedDriver || 'Assigning';
    const pickup = order.pickup || '--';
    const drop = order.drop || '--';
    const distance = order.distance || `${order.eta || 0} mins`;

    shell.innerHTML = `<div class="invoice-top"><div><div class="invoice-logo">DeliverSync</div><div class="invoice-sub">Logistics Technology Platform</div><div style="height:36px"></div><div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px">Billed To</div><div class="invoice-mini"><div class="value" style="font-size:28px">${billedToName}</div><div style="margin-top:12px;font-size:18px">${billedToAddress}</div></div></div><div><div style="display:flex;justify-content:space-between;align-items:flex-start"><div></div><div><div class="invoice-chip"><svg viewBox="0 0 24 24"><path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1V3z"></path><path d="M9 8h6"></path><path d="M9 12h6"></path></svg> INVOICE</div><div class="invoice-number">${invoice.id}</div></div></div><div class="invoice-grid-top"><div class="invoice-mini"><div class="label">Invoice Date</div><div class="value">${createdText}</div></div><div class="invoice-mini"><div class="label">Due Date</div><div class="value">${dueText}</div></div></div></div></div><div class="invoice-section"><h2>Delivery Details</h2><div class="detail-card"><div class="detail-row"><div class="left">Delivery ID</div><div class="right yellow">#${orderCode}</div></div><div class="detail-row"><div class="left">Driver</div><div class="right">${driver}</div></div><div class="detail-row"><div class="left">Pickup Location</div><div class="right">${pickup}</div></div><div class="detail-row"><div class="left">Drop Location</div><div class="right">${drop}</div></div><div class="detail-row"><div class="left">Distance Traveled</div><div class="right yellow">${distance}</div></div></div></div><div class="invoice-section"><h2>Cost Breakdown</h2><div class="detail-card"><div class="detail-row"><div class="left">Base Cost</div><div class="right">₹${base.toFixed(2)}</div></div><div class="detail-row"><div class="left">Tax (10%)</div><div class="right">₹${tax.toFixed(2)}</div></div><div class="total-row"><span>Total Amount</span><span>₹${total.toFixed(2)}</span></div></div></div><div class="invoice-section"><h2>Payment Status</h2><div class="status-card"><div class="status-ico">${String(invoice.status||'').toLowerCase()==='paid' ? '✓' : '!'}</div><div><div style="font-size:18px;font-weight:800;color:${String(invoice.status||'').toLowerCase()==='paid' ? '#69e38f' : '#ffe27a'}">${String(invoice.status||'').toLowerCase()==='paid' ? 'Payment Received' : 'Payment Pending'}</div><div style="margin-top:8px;color:${String(invoice.status||'').toLowerCase()==='paid' ? '#d4f5db' : '#f1e0a6'}">${String(invoice.status||'').toLowerCase()==='paid' ? 'Paid successfully and recorded in the system.' : 'Please submit transaction details to complete payment.'}</div></div></div></div><div class="invoice-section"><h2>Payment Instructions</h2><div class="detail-card"><div style="padding:18px 0;color:#a8a8a8">For future payments, please make transfers to the following account:</div><div class="detail-row"><div class="left">Bank Name</div><div class="right">First National Bank</div></div><div class="detail-row"><div class="left">Account Name</div><div class="right">DeliverSync Inc.</div></div><div class="detail-row"><div class="left">Account Number</div><div class="right">**** **** **** 2741</div></div><div class="detail-row"><div class="left">Reference</div><div class="right">${invoice.id}</div></div></div></div>`;
  }

  function renderBCFeedbackDynamic() {
    if (!location.pathname.endsWith('/business-client/feedback.html')) return;
    const params = new URLSearchParams(location.search);
    const orderId = params.get('order');
    const orders = getOrders();
    const order = (orderId ? orders.find(o => o.id === orderId) : null) || orders.filter(o => String(o.status||'').toUpperCase() === 'DELIVERED').sort((a,b)=>new Date(b.steps?.deliveredAt||b.createdAt)-new Date(a.steps?.deliveredAt||a.createdAt))[0];
    if (!order) return;
    const content = document.querySelector('.bc-content');
    if (!content) return;
    content.innerHTML = `<div class="feedback-shell"><a href="completed-deliveries.html" class="back-btn">Back</a><h1 class="page-title small">Provide Feedback</h1><p class="page-subtitle">Rate your completed delivery experience</p><div class="card feedback-card"><div class="field-label">Delivery ID</div><div class="value-box">#${String(order.id).replace(/^[A-Z]+-/, '')}</div><div class="field-label">Driver</div><div class="value-box">${order.assignedDriver || 'Assigning'}</div><div class="field-label">Overall Rating</div><div class="stars" id="feedbackStars">${[1,2,3,4,5].map(n=>`<span data-star="${n}" class="${n<=4?'active':''}">★</span>`).join('')}</div><div class="field-label">Share your experience</div><textarea class="textarea" id="feedbackMessage" placeholder="Tell us what went well and what can be improved"></textarea><div class="field-label">Delivery Quality</div><select class="input" id="feedbackQuality"><option>Excellent</option><option>Good</option><option>Average</option><option>Poor</option></select><div style="margin-top:22px"><button class="btn yellow full" id="feedbackSubmitBtn">Submit Feedback</button></div><div id="feedbackErr" style="margin-top:12px;color:#ff6b6b;font-size:13px"></div></div></div>`;
    let rating = 4;
    const paint = () => document.querySelectorAll('#feedbackStars [data-star]').forEach(el => el.classList.toggle('active', Number(el.dataset.star) <= rating));
    paint();
    document.querySelectorAll('#feedbackStars [data-star]').forEach(el => el.addEventListener('click', ()=>{ rating = Number(el.dataset.star); paint(); }));
    const btn = document.getElementById('feedbackSubmitBtn');
    if (btn) btn.addEventListener('click', ()=>{
      const message = (document.getElementById('feedbackMessage').value || '').trim();
      const quality = document.getElementById('feedbackQuality').value;
      const err = document.getElementById('feedbackErr');
      if (!message) { if(err) err.textContent = 'Please share your experience.'; return; }
      const feedbacks = getFeedbacks().filter(f => f.orderId !== order.id);
      feedbacks.unshift({ id:`FDB-${Date.now()}`, orderId: order.id, driver: order.assignedDriver || '', rating, message, quality, createdAt: nowISO() });
      saveFeedbacks(feedbacks);
      location.href = 'completed-deliveries.html';
    });
  }

  function renderBCInvoices() {
    if (!location.pathname.endsWith('/business-client/invoices.html')) return;

    const filtered = getInvoicesForCurrentBusinessClient();

    const tbody = document.querySelector('table.table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const statsRow = document.querySelector('.stats-row');
    if (statsRow) {
      statsRow.style.gap = '14px';
      statsRow.style.alignItems = 'stretch';
    }
    const cards = $$('.stats-row .card');
    const totalInvoices = filtered.length;
    const totalPaid = filtered.filter((inv) => inv.status === 'Paid').reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const totalUnpaid = filtered.filter((inv) => inv.status !== 'Paid').reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const stats = [
      { label: 'Total Invoices', value: String(totalInvoices), foot: `${totalInvoices} Invoice${totalInvoices === 1 ? '' : 's'}` },
      { label: 'Total Paid', value: currency(totalPaid), foot: `${filtered.filter((inv) => inv.status === 'Paid').length} Paid Invoice${filtered.filter((inv) => inv.status === 'Paid').length === 1 ? '' : 's'}` },
      { label: 'Total Unpaid', value: currency(totalUnpaid), foot: `${filtered.filter((inv) => inv.status !== 'Paid').length} Pending Invoice${filtered.filter((inv) => inv.status !== 'Paid').length === 1 ? '' : 's'}` }
    ];
    cards.slice(0, 3).forEach((card, idx) => {
      const stat = stats[idx];
      if (!stat) return;
      card.style.padding = '16px 18px';
      card.style.minHeight = '118px';
      const label = card.querySelector('.stat-label');
      const value = card.querySelector('.stat-value');
      const foot = card.querySelector('.stat-foot');
      if (label) label.textContent = stat.label;
      if (value) {
        value.textContent = stat.value;
        value.style.fontSize = idx === 0 ? '36px' : '28px';
        value.style.lineHeight = '1.1';
      }
      if (foot) foot.textContent = stat.foot;
    });

    if (!filtered.length) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="6" style="text-align:center;color:#a3a3a3;padding:24px 12px">No delivered invoices available yet.</td>';
      tbody.appendChild(row);
      return;
    }

    filtered.forEach((inv) => {
      const row = document.createElement('tr');
      row.setAttribute('data-workflow-invoice', '1');
      const created = new Date(inv.createdAt || Date.now());
      const dateText = created.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
      const dueText = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : dateText;
      const pill = inv.status === 'Paid' ? 'yellow' : 'red';
      row.innerHTML = `
        <td><strong>${inv.id}</strong></td>
        <td>${dateText}</td>
        <td>${currency(inv.amount)}</td>
        <td>${dueText}</td>
        <td><span class="pill ${pill}">${inv.status}</span></td>
        <td>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <a class="btn sm yellow" href="invoice-view.html?invoice=${encodeURIComponent(inv.id)}">
              <svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              View
            </a>
            <a class="btn sm outline-yellow" href="#" data-download>
              <svg viewBox="0 0 24 24"><path d="M12 3v12"></path><path d="M7 10l5 5 5-5"></path><path d="M5 21h14"></path></svg>
              Download
            </a>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  function wireSubmitTransaction() {
    if (!location.pathname.endsWith('/business-client/submit-transaction.html')) return;
    const form = $('#bc-payment-form');
    if (!form) return;

    const allClientInvoices = getInvoicesForCurrentBusinessClient();
    const unpaidInvoices = allClientInvoices.filter((inv) => inv.status !== 'Paid');
    const params = new URLSearchParams(location.search);
    const requestedInvoiceId = (params.get('invoice') || '').trim();

    const inputs = $$('.input', form);
    const invoiceIdInput = inputs[0];
    const amountInput = $('#transaction-amount');
    const unpaidCard = document.querySelector('.card.side-card');

    if (invoiceIdInput) {
      invoiceIdInput.readOnly = true;
      invoiceIdInput.setAttribute('aria-readonly', 'true');
      invoiceIdInput.style.cursor = 'not-allowed';
      invoiceIdInput.title = 'Select an invoice from the unpaid invoices list';
    }

    function formatDueDate(dateStr) {
      if (!dateStr) return '--';
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) return '--';
      return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    }

    function renderUnpaidInvoiceList(selectedInvoiceId) {
      if (!unpaidCard) return;

      const cardsHtml = unpaidInvoices.length
        ? unpaidInvoices
            .map((inv) => {
              const isSelected = inv.id === selectedInvoiceId;
              return `
                <div class="driver-box" data-select-invoice="${inv.id}" tabindex="0" role="button" style="cursor:pointer;border:${isSelected ? '1px solid rgba(245,209,13,0.95)' : '1px solid transparent'};box-shadow:${isSelected ? '0 0 0 1px rgba(245,209,13,0.22) inset' : 'none'};transition:border-color .2s ease, box-shadow .2s ease">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
                    <div>
                      <div style="font-weight:700">${inv.id}</div>
                      <div class="muted">Due ${formatDueDate(inv.dueDate)}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end">
                      ${isSelected ? '<span class="pill yellow">Selected</span>' : ''}
                      <a class="btn sm outline-yellow" href="invoice-view.html?invoice=${encodeURIComponent(inv.id)}">View</a>
                    </div>
                  </div>
                  <div style="margin-top:10px;font-size:24px;font-weight:800">${currency(inv.amount)}</div>
                </div>`;
            })
            .join('')
        : '<div class="driver-box" style="color:#a3a3a3">No unpaid invoices available.</div>';

      unpaidCard.innerHTML = `
        <h3>Unpaid Invoices</h3>
        <div id="bc-unpaid-invoices-list">${cardsHtml}</div>
        <div style="margin-top:18px;color:#b5b5b5"><strong>Important</strong><ul><li>Attach a clear screenshot or receipt.</li><li>Reference number must match the payment transaction.</li><li>Verification status will update after review.</li></ul></div>`;

      $$('[data-select-invoice]', unpaidCard).forEach((card) => {
        const selectInvoice = () => {
          const invoiceId = card.getAttribute('data-select-invoice') || '';
          const invoice = unpaidInvoices.find((inv) => inv.id === invoiceId);
          if (!invoice) return;
          if (invoiceIdInput) invoiceIdInput.value = invoice.id;
          if (amountInput) amountInput.value = String(invoice.amount || '');
          renderUnpaidInvoiceList(invoice.id);
        };

        card.addEventListener('click', (event) => {
          if (event.target.closest('a')) return;
          selectInvoice();
        });

        card.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          if (event.target.closest('a')) return;
          event.preventDefault();
          selectInvoice();
        });
      });
    }

    const defaultInvoice = unpaidInvoices.find((inv) => inv.id === requestedInvoiceId) || unpaidInvoices[0] || null;
    if (defaultInvoice) {
      if (invoiceIdInput) invoiceIdInput.value = defaultInvoice.id;
      if (amountInput) amountInput.value = String(defaultInvoice.amount || '');
    } else {
      if (invoiceIdInput) invoiceIdInput.value = '';
    }
    renderUnpaidInvoiceList(defaultInvoice?.id || '');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();

      const invoiceField = form.querySelector('input.input[placeholder="Invoice ID"]');
      const dateField = form.querySelector('input.input[type="date"]');
      const modeField = form.querySelector('select.input');
      const txnField = form.querySelector('input.input[placeholder="Enter payment reference"]');

      const invoiceId = (invoiceField?.value || '').trim();
      const date = (dateField?.value || '').trim();
      const mode = (modeField?.value || 'Bank Transfer').trim();
      const txnId = (txnField?.value || '').trim();
      const amount = (amountInput?.value || '').trim();
      const receiptName = ($('#receipt-file-name')?.textContent || '').trim();

      if (!invoiceId || !date || !txnId || !amount) {
        wfToast('Please fill invoice id, date, transaction id and amount.');
        return;
      }

      const txns = getTxns();
      txns.unshift({
        id: `TXN-${Date.now()}`,
        invoiceId,
        date,
        mode,
        txnId,
        amount: Number(amount) || 0,
        receiptName: receiptName && receiptName !== 'No file selected' ? receiptName : '',
        status: 'Submitted',
        createdAt: nowISO()
      });
      saveTxns(txns);

      const invoices = getInvoices();
      const inv = invoices.find((i) => i.id === invoiceId);
      if (inv) inv.status = 'Paid';
      saveInvoices(invoices);

      wfToast('Transaction submitted successfully');
      location.href = 'invoices.html';
    }, true);
  }




  function renderFleetManagerNotificationSearch() {
    if (!location.pathname.endsWith('/fleet-manager/notifications.html')) return;
    const filters = document.querySelector('.notif-filters');
    const list = document.querySelector('.notif-list');
    const filterBtn = document.querySelector('.filter-action');
    if (filterBtn) filterBtn.remove();
    if (!filters || !list) return;
    filters.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;width:100%">
        <label class="search-sm" style="flex:1;max-width:none"><span>⌕</span><input id="fmNotifSearch" placeholder="Search notifications..."></label>
        <button class="btn btn-ghost btn-small" id="fmNotifSearchBtn" type="button">Search</button>
      </div>`;
    const run = () => {
      const q = (document.getElementById('fmNotifSearch')?.value || '').trim().toLowerCase();
      list.querySelectorAll('.notif-card').forEach(card => {
        card.style.display = !q || card.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    };
    document.getElementById('fmNotifSearchBtn')?.addEventListener('click', run);
    document.getElementById('fmNotifSearch')?.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); run(); }});
  }

  function renderFleetManagerIncidents() {
    if (!location.pathname.endsWith('/fleet-manager/notifications.html')) return;
    const list = document.querySelector('.notif-list');
    if (!list) return;
    const incidents = getIncidents();
    // remove existing static and previously injected cards on Fleet Manager notifications page
    list.innerHTML = '';
    if (!incidents.length) { list.innerHTML = '<div style="padding:18px;color:#9ca3af">No notifications available.</div>'; return; }

    const drivers = readJSON('dsDemoDrivers', ['Raghav Reddy','Srujan','Sarath','David','Rajesh Kumar','Kiran Teja']);

    incidents.slice().reverse().forEach((i, idx) => {
      const menuId = `fmIncidentDrivers_${idx}_${String(i.id)}`;
      const card = document.createElement('article');
      card.className = 'notif-card tone-dark';
      card.setAttribute('data-incident-card','fm');
      card.style.position = 'relative';
      card.innerHTML = `
        <div class="notif-card-icon icon-critical"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.3 3.9 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path></svg></div>
        <div class="notif-card-main">
          <div class="notif-card-title-row">
            <h3>${i.type}<span class="title-dot"></span></h3>
            <span class="notif-level critical">Incident</span>
          </div>
          <p>${i.description}</p>
          <div class="notif-tags">
            <span class="tag red">Order ${i.orderId}</span>
            <span class="meta-code">Status: ${i.status}</span>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
            <button data-open-reassign-inc="${i.id}" data-submenu-target="${menuId}" class="btn btn-ghost btn-small" style="background:#05070b;color:#fff;border:1px solid #1f2937">Reassign</button>
            <button data-contact-client="${i.id}" class="btn btn-ghost btn-small" style="background:#05070b;color:#fff;border:1px solid #1f2937">Contact Business Client</button>
          </div>
          <div id="${menuId}" class="workflow-submenu" style="display:none;position:fixed;background:#05070b;border:1px solid #1f2937;border-radius:14px;min-width:190px;max-height:260px;overflow-y:auto;box-shadow:0 16px 32px rgba(0,0,0,.45);z-index:21"></div>
        </div>
        <div class="notif-time">
          <span>${i.createdAt}</span>
          <span>${i.status}</span>
          <button aria-label="Dismiss notification" type="button" data-dismiss-incident="${i.id}">×</button>
        </div>`;
      list.insertBefore(card, list.firstChild);
    });

    list.addEventListener('click', (e) => {
      const openBtn = e.target.closest('[data-open-reassign-inc]');
      const pickBtn = e.target.closest('[data-pick-driver-inc]');
      const contactBtn = e.target.closest('[data-contact-client]');
      const dismissBtn = e.target.closest('[data-dismiss-incident]');

      if (!e.target.closest('.workflow-submenu') && !openBtn) {
        document.querySelectorAll('.workflow-submenu').forEach(m => m.style.display = 'none');
      }
      if (openBtn) {
        const incId = openBtn.getAttribute('data-open-reassign-inc');
        const targetId = openBtn.getAttribute('data-submenu-target');
        const submenu = document.getElementById(targetId);
        if (submenu) {
          submenu.innerHTML = drivers.map(driver => `<button data-pick-driver-inc=\"${driver}\" data-inc-id=\"${incId}\" style=\"display:block;width:100%;text-align:left;padding:11px 14px;background:#05070b;border:0;border-bottom:1px solid #1f2937;color:#ffffff;cursor:pointer\">${driver}</button>`).join('');
          const rect = openBtn.getBoundingClientRect();
          const submenuWidth = 220; const submenuMaxHeight = 260;
          const left = Math.min(window.innerWidth - submenuWidth - 16, Math.max(16, rect.left - submenuWidth + rect.width));
          const top = Math.min(window.innerHeight - submenuMaxHeight - 16, Math.max(16, rect.top));
          submenu.style.top = `${top}px`;
          submenu.style.left = `${left}px`;
          submenu.style.maxHeight = `${submenuMaxHeight}px`;
          submenu.style.overflowY = 'auto';
          document.querySelectorAll('.workflow-submenu').forEach(m => { if (m !== submenu) m.style.display = 'none'; });
          submenu.style.display = submenu.style.display === 'block' ? 'none' : 'block';
        }
      }
      if (pickBtn) {
        const incId = pickBtn.getAttribute('data-inc-id');
        const driver = pickBtn.getAttribute('data-pick-driver-inc');
        const incidents = getIncidents();
        const inc = incidents.find(x => String(x.id) === String(incId));
        const orders = getOrders();
        const order = orders.find(o => String(o.id).replace(/\D/g,'') === String(inc.orderId).replace(/\D/g,''));
        if (order) { order.assignedDriver = driver; order.status = 'ASSIGNED'; saveOrders(orders); }
        if (inc) { inc.status = 'Reassigned'; saveIncidents(incidents); }
        const notifs = getNotifs();
        notifs.unshift({id:`N-${Date.now()}`,to:'business-client',title:'Driver Reassigned',message:`Order ${inc.orderId} has been reassigned to ${driver}.`,createdAt:nowISO()});
        saveNotifs(notifs);
        location.reload();
      }
      if (contactBtn) {
        const incId = contactBtn.getAttribute('data-contact-client');
        const incidents = getIncidents();
        const inc = incidents.find(x => String(x.id) === String(incId));
        const notifs = getNotifs();
        notifs.unshift({id:`N-${Date.now()}`,to:'business-client',title:'Incident Update',message:`Fleet Manager is reviewing the reported incident for order ${inc.orderId}. We will keep you updated.`,createdAt:nowISO()});
        saveNotifs(notifs);
        wfToast('Business client notification sent.');
      }
      if (dismissBtn) {
        const incId = dismissBtn.getAttribute('data-dismiss-incident');
        const incidents = getIncidents().filter(x => String(x.id) !== String(incId));
        saveIncidents(incidents);
        location.reload();
      }
    }, { once:false });
  }

  function renderSuperuserIncidentMonitor() {
    if (!location.pathname.endsWith('/superuser/notifications.html')) return;
    const root = document.querySelector('#pageRoot') || document.body;
    if (!root) return;
    root.querySelectorAll('[data-su-incident-notif="1"]').forEach(n=>n.remove());
    const incidents = getIncidents();
    const suNotifs = getNotifs().filter(n => n.to === 'super-user');
    const items = incidents.map(i=>({title:`${i.type} reported`,message:`Driver reported an incident for order ${i.orderId}. Status: ${i.status}.`,time:i.createdAt})).concat(suNotifs.map(n=>({title:n.title,message:n.message,time:new Date(n.createdAt).toLocaleString()})));
    if (!items.length) return;
    const card = document.createElement('div');
    card.setAttribute('data-su-incident-notif','1');
    card.className = 'content-card profile-card';
    card.style.maxWidth = '860px';
    card.innerHTML = `<div style="font-weight:800;font-size:20px;margin-bottom:14px">Incident Notifications</div>${items.map(n=>`<div class="notify-item"><strong>${n.title}</strong><span>${n.message}</span><span>${n.time}</span></div>`).join('')}<div style="text-align:right;margin-top:18px"><button class="btn-yellow" id="suMarkReadWorkflow">Mark all as read</button></div>`;
    root.insertAdjacentElement('afterbegin', card);
    const btn = document.getElementById('suMarkReadWorkflow'); if(btn) btn.onclick=()=>wfToast('Incident notifications marked as read.');
  }

  

  function renderBusinessClientNotifications() {
    if (!location.pathname.endsWith('/business-client/notifications.html')) return;
    const container = document.querySelector('.notif-card');
    if (!container) return;

    // Remove previously injected workflow items
    container.querySelectorAll('[data-workflow-notif="1"]').forEach(n => n.remove());

    const notifs = getNotifs().filter((n) => n.to === 'business-client');
    const newCount = notifs.filter((n) => n.read !== true).length;

    const countPill = document.querySelector('.section-banner .pill.bright');
    if (countPill) countPill.textContent = `${newCount} New`;

    const unreadTab = document.querySelectorAll('.tab-row .tab')[1];
    if (unreadTab) unreadTab.textContent = `Unread (${newCount})`;

    if (!notifs.length) return;

    const ico = `<svg viewBox="0 0 24 24"><path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2z"></path><path d="M18 16v-5a6 6 0 0 0-5-5.9V4a1 1 0 1 0-2 0v1.1A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z"></path></svg>`;

    // Prepend newest first in the same style as existing Business Client notifications
    notifs.slice().reverse().forEach((n) => {
      const item = document.createElement('div');
      item.className = 'notif-item';
      item.setAttribute('data-workflow-notif', '1');
      item.innerHTML = `
        <div class="notif-ico">${ico}</div>
        <div>
          <div class="notif-title">${n.title}</div>
          <div class="notif-desc">${n.message}</div>
          <div class="notif-time">◷ ${new Date(n.createdAt).toLocaleString()}</div>
        </div>
        <div class="notif-dot"></div>
      `;
      container.insertBefore(item, container.firstChild);
    });
  }
  function init() {
    ensureSeed();

    // Business client
    if (location.pathname.endsWith('/business-client/create-delivery.html')) {
      createOrderFromBCForm();
    }
    if (location.pathname.endsWith('/business-client/active-deliveries.html')) {
      document.addEventListener('DOMContentLoaded', renderBCActiveDeliveries);
      window.addEventListener('storage', (e) => {
        if (e.key === 'dsWorkflowOrders' || e.key === 'bcCancelledOrders') {
          renderBCActiveDeliveries();
        }
      });
      window.addEventListener('focus', renderBCActiveDeliveries);
      window.addEventListener('pageshow', renderBCActiveDeliveries);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) renderBCActiveDeliveries();
      });
    }
    if (location.pathname.endsWith('/business-client/live-tracking.html')) {
      document.addEventListener('DOMContentLoaded', renderBCLiveTracking);
    }
    document.addEventListener('DOMContentLoaded', renderBCCompletedDeliveriesDynamic);
    document.addEventListener('DOMContentLoaded', renderBCInvoiceDynamic);
    window.addEventListener('focus', renderBCInvoiceDynamic);
    window.addEventListener('pageshow', renderBCInvoiceDynamic);
    document.addEventListener('DOMContentLoaded', renderBCFeedbackDynamic);
    document.addEventListener('DOMContentLoaded', renderBCInvoices);
    document.addEventListener('DOMContentLoaded', wireSubmitTransaction);
    document.addEventListener('DOMContentLoaded', renderBusinessClientNotifications);

    // Driver
    document.addEventListener('DOMContentLoaded', injectDriverTasks);

    // Fleet manager & superuser
    document.addEventListener('DOMContentLoaded', renderFleetManagerDashboardLiveOrders);
    document.addEventListener('DOMContentLoaded', renderFleetManagerDashboardStats);
    document.addEventListener('DOMContentLoaded', renderFleetManagerTripsSection);
    document.addEventListener('DOMContentLoaded', renderFleetManagerTripDetail);
    document.addEventListener('DOMContentLoaded', injectFleetManagerMonitoring);
    document.addEventListener('DOMContentLoaded', renderFleetManagerNotificationSearch);
    document.addEventListener('DOMContentLoaded', renderFleetManagerIncidents);
    document.addEventListener('DOMContentLoaded', renderFleetManagerVehiclesShared);
    document.addEventListener('DOMContentLoaded', wireFleetManagerAddVehicle);
    document.addEventListener('DOMContentLoaded', renderFleetManagerMaintenanceShared);
    document.addEventListener('DOMContentLoaded', wireFleetManagerScheduleMaintenance);
    document.addEventListener('DOMContentLoaded', injectSuperuserMonitoring);
    document.addEventListener('DOMContentLoaded', renderSuperuserIncidentMonitor);
    document.addEventListener('DOMContentLoaded', renderSuperuserReportsAndNotifications);
  }

  init();
})();
