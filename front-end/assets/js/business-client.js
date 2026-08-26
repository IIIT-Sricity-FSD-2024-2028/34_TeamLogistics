
(function(){
  const DS = window.DeliverySyncData;
  if(DS && typeof DS.seed === 'function') DS.seed();

  (function(){
    var session = DS && DS.getSession ? DS.getSession() : null;
    if(!session || session.role !== 'business-client'){
      window.location.href = '../login.html';
      return;
    }
  })();

  function bcToast(msg){
    var t=document.getElementById('bcToastEl');
    if(!t){t=document.createElement('div');t.id='bcToastEl';t.style.cssText='position:fixed;top:24px;right:24px;background:#1e1e2f;color:#fff;padding:14px 28px;border-radius:12px;font-size:14px;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,.4);transform:translateY(-20px);opacity:0;transition:all .3s ease;border-left:4px solid #facc15;pointer-events:none';document.body.appendChild(t);}
    t.textContent=msg;t.style.opacity='1';t.style.transform='translateY(0)';
    clearTimeout(t._tid);t._tid=setTimeout(function(){t.style.opacity='0';t.style.transform='translateY(-20px)';},2800);
  }

  function getSessionUser(){
    if(!DS || !DS.getSession) return null;
    const session = DS.getSession();
    if(!session || session.role !== 'business-client') return null;
    const state = DS.readState ? DS.readState() : {users:[]};
    const users = state.users || [];
    return users.find(u => (u.email||'').toLowerCase() === (session.email||'').toLowerCase()) || null;
  }

  function getBusinessClientProfile(){
    const u = getSessionUser();
    if(!u) return null;
    const pd = u.profileDetails || {};
    return {
      companyName: pd.companyName || pd.businessName || u.companyName || '',
      fullName: pd.fullName || u.fullName || u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      address: pd.businessAddress || pd.address || u.address || ''
    };
  }

  function applyBusinessClientBranding(){
    const p = getBusinessClientProfile();
    if(!p) return;
    document.querySelectorAll('.bc-topbar .company, .bc-topbar .title, .bc-topbar .client-name').forEach(el=>{
      el.textContent = p.companyName || el.textContent;
    });
    document.querySelectorAll('[data-bc-company]').forEach(el=>{ el.textContent = p.companyName; });
    const nameEl = document.querySelector('.profile-card h2, [data-bc-company]');
    if(nameEl) nameEl.textContent = p.companyName || nameEl.textContent;
    const avatar = document.querySelector('.profile-card .avatar-square');
    if(avatar){
      const initials = (p.companyName||'').trim().split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase();
      avatar.textContent = initials || avatar.textContent;
    }
  }


  function refreshBusinessClientProfileFields(){
    const p = getBusinessClientProfile();
    if(!p) return;
    const map = {
      'company-name': ['profile-company-name', p.companyName],
      'full-name': ['profile-full-name', p.fullName],
      'email': ['profile-email', p.email],
      'phone': ['profile-phone', p.phone],
      'address': ['profile-address', p.address]
    };
    Object.entries(map).forEach(([key,[id,val]])=>{
      const input = document.getElementById(id);
      if(input) input.value = val || '';
      const span = document.querySelector(`.value-box[data-field="${key}"] .profile-value-text`);
      if(span) span.textContent = val || '';
    });
  }

  const CREATED_DELIVERIES_KEY = 'bcCreatedDeliveries';
  function getCreatedDeliveries(){
    try { return JSON.parse(localStorage.getItem(CREATED_DELIVERIES_KEY) || '[]'); } catch(e){ return []; }
  }
  function saveCreatedDeliveries(items){
    localStorage.setItem(CREATED_DELIVERIES_KEY, JSON.stringify(items));
  }
  function generateDeliveryId(){
    const items = getCreatedDeliveries();
    const nums = items.map(item => Number(String(item.id || '').replace(/\D/g,''))).filter(Boolean);
    const next = (nums.length ? Math.max(...nums) : 2045) + 1;
    return `DS-${next}`;
  }
  function renderCreatedDeliveryCard(item){
    return `<div class="delivery-item" data-order-id="${item.id}"><div><div class="delivery-id">#${item.id}</div><span class="pill bright">${item.status}</span></div><div><div class="delivery-meta-label">From</div><div class="delivery-meta-value">${item.pickup}</div></div><div><div class="delivery-meta-label">To</div><div class="delivery-meta-value">${item.drop}</div></div><div><div class="delivery-meta-label">Driver</div><div class="delivery-meta-value">${item.driver}</div><div class="delivery-meta-sub">${item.deliveryType}</div></div><div><div class="delivery-meta-label">ETA</div><div class="eta-big">${item.eta}</div><div class="eta-unit">mins</div></div><a class="btn yellow" href="live-tracking.html"><svg viewBox="0 0 24 24"><path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11z"></path><circle cx="12" cy="10" r="2"></circle></svg> Track Live</a><a class="btn outline-red" href="cancel-order.html?order=${item.id}" data-cancel-order="${item.id}">× Cancel Order</a></div>`;
  }

  function ensureNotificationsNav(){
    const nav = document.querySelector('.bc-nav');
    if(!nav || nav.querySelector('[data-nav="notifications"]')) return;
    const active = location.pathname.endsWith('/business-client/notifications.html') ? 'active' : '';
    const a = document.createElement('a');
    a.href = 'notifications.html';
    a.setAttribute('data-nav','notifications');
    a.className = active;
    a.innerHTML = `<span class="ico"><svg viewBox="0 0 24 24"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"></path><path d="M10 20a2 2 0 0 0 4 0"></path></svg></span><span>Notifications</span>`;
    const profileLink = nav.querySelector('[data-nav="profile"]');
    if(profileLink) nav.insertBefore(a, profileLink);
    else nav.appendChild(a);
  }

  function getWorkflowBusinessNotifications(){
    try{
      const items = JSON.parse(localStorage.getItem('dsWorkflowNotifications') || '[]');
      return Array.isArray(items) ? items.filter(item => item && item.to === 'business-client') : [];
    }catch(e){
      return [];
    }
  }

  function updateBusinessClientNotificationUI(){
    const workflowItems = getWorkflowBusinessNotifications();
    const newCount = workflowItems.filter(item => item.read !== true).length;
    const totalVisible = 3 + newCount;

    document.querySelectorAll('.bc-bell .badge').forEach(badge => {
      badge.textContent = String(totalVisible);
    });

    const bannerPill = document.querySelector('.section-banner .pill.bright');
    if(bannerPill){
      bannerPill.textContent = `${newCount} New`;
    }

    const tabs = document.querySelectorAll('.tab-row .tab');
    if(tabs[1]){
      tabs[1].textContent = `Unread (${newCount})`;
    }
  }
  const page = document.body.dataset.page || '';
  ensureNotificationsNav();
  updateBusinessClientNotificationUI();
  applyBusinessClientBranding();
  refreshBusinessClientProfileFields();
  window.addEventListener('storage', (e)=>{
    if(e.key === 'deliverysync-state-v1' || e.key === 'deliverysync-session-v1'){
      applyBusinessClientBranding();
      refreshBusinessClientProfileFields();
    }
    if(e.key === 'dsWorkflowNotifications'){
      updateBusinessClientNotificationUI();
    }
  });
  window.addEventListener('ds-notifications-updated', updateBusinessClientNotificationUI);
  document.querySelectorAll('[data-nav]').forEach(a=>{ if(a.dataset.nav===page || (a.dataset.nav==='notifications' && location.pathname.endsWith('/business-client/notifications.html'))){ a.classList.add('active'); } });
  document.querySelectorAll('[data-back]').forEach(el=>el.addEventListener('click',e=>{ if(el.getAttribute('href')==='#'){ e.preventDefault(); history.back(); }}));
  document.querySelectorAll('[data-mark-read]').forEach(btn=>btn.addEventListener('click',()=>{ bcToast('All notifications marked as read'); }));
  document.querySelectorAll('[data-download]').forEach(btn=>btn.addEventListener('click',(e)=>{e.preventDefault(); bcToast('Prototype: download started');}));
  document.querySelectorAll('[data-print]').forEach(btn=>btn.addEventListener('click',(e)=>{e.preventDefault(); window.print();}));
  const payForm=document.getElementById('bc-payment-form');
  if(payForm){ payForm.addEventListener('submit',function(e){ e.preventDefault(); bcToast('Transaction submitted successfully'); location.href='invoices.html'; }); }
  document.querySelectorAll('[data-cancel-order]').forEach(btn=>btn.addEventListener('click',(e)=>{ e.preventDefault(); location.href='cancel-order.html'; }));
  document.querySelectorAll('[data-track-live]').forEach(btn=>btn.addEventListener('click',(e)=>{ e.preventDefault(); location.href='live-tracking.html'; }));
  document.querySelectorAll('[data-open-invoice]').forEach(btn=>btn.addEventListener('click',(e)=>{ e.preventDefault(); location.href='invoice-view.html'; }));
  document.querySelectorAll('[data-open-feedback]').forEach(btn=>btn.addEventListener('click',(e)=>{ e.preventDefault(); location.href='feedback.html'; }));
})();


document.addEventListener('DOMContentLoaded', function () {
  const typeCards = document.querySelectorAll('.option-card[data-delivery-type]');
  const typeInput = document.querySelector('#delivery-type-input');
  if (typeCards.length && typeInput) {
    typeCards.forEach(card => {
      card.addEventListener('click', function () {
        typeCards.forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        typeInput.value = this.getAttribute('data-delivery-type') || '';
      });
    });
  }
});


document.addEventListener("DOMContentLoaded", function(){
  const deliveryUpload = document.getElementById("delivery-list-upload");
  const deliveryName = document.getElementById("delivery-list-file-name");
  if(deliveryUpload && deliveryName){ deliveryUpload.addEventListener("change", ()=>{ deliveryName.textContent = deliveryUpload.files && deliveryUpload.files[0] ? deliveryUpload.files[0].name : "No file selected"; }); }

  const receiptUpload = document.getElementById("receipt-upload");
  const receiptName = document.getElementById("receipt-file-name");
  if(receiptUpload && receiptName){ receiptUpload.addEventListener("change", ()=>{ receiptName.textContent = receiptUpload.files && receiptUpload.files[0] ? receiptUpload.files[0].name : "No file selected"; }); }

  const amt = document.getElementById("transaction-amount");
  if(amt){ amt.addEventListener("input", ()=>{ amt.value = amt.value.replace(/[^0-9]/g, ""); }); }

  const cancelBtn = document.getElementById("confirm-cancel-order");
  if(cancelBtn){ cancelBtn.addEventListener("click", function(e){ e.preventDefault(); const params = new URLSearchParams(location.search); const order = params.get("order") || "DS-2045"; const cancelled = JSON.parse(localStorage.getItem("bcCancelledOrders")||"[]"); if(!cancelled.includes(order)) cancelled.push(order); localStorage.setItem("bcCancelledOrders", JSON.stringify(cancelled)); location.href = "active-deliveries.html"; }); }

  const activeContainer = document.querySelector('.delivery-list');
  if(activeContainer){
    const cancelled = JSON.parse(localStorage.getItem("bcCancelledOrders")||"[]");
    const params = new URLSearchParams(location.search);
    if(params.get('created') === '1'){
      const freshItem = {
        id: params.get('id') || generateDeliveryId(),
        pickup: params.get('pickup') || 'New Pickup',
        drop: params.get('drop') || 'New Drop',
        driver: params.get('driver') || 'Assigning',
        eta: params.get('eta') || '35',
        status: params.get('status') || 'IN TRANSIT',
        deliveryType: params.get('deliveryType') || 'Standard',
        createdAt: new Date().toISOString()
      };
      const saved = window.bcGetCreatedDeliveries ? window.bcGetCreatedDeliveries() : [];
      if(!saved.some(item => item.id === freshItem.id)){
        saved.unshift(freshItem);
        localStorage.setItem('bcCreatedDeliveries', JSON.stringify(saved));
      }
    }
    const created = (window.bcGetCreatedDeliveries ? window.bcGetCreatedDeliveries() : []).filter(item => !cancelled.includes(item.id));
    const existingIds = new Set(Array.from(activeContainer.querySelectorAll('.delivery-item[data-order-id]')).map(item => item.dataset.orderId));
    created.slice().reverse().forEach(item => {
      if(!existingIds.has(item.id) && window.bcRenderCreatedDeliveryCard){
        activeContainer.insertAdjacentHTML('afterbegin', window.bcRenderCreatedDeliveryCard(item));
      }
    });
    activeContainer.querySelectorAll('.delivery-item[data-order-id]').forEach(item=>{ if(cancelled.includes(item.dataset.orderId)){ item.remove(); } });
    const count = activeContainer.querySelectorAll('.delivery-item[data-order-id]').length;
    const subtitle = document.querySelector('.bc-active-title + .page-subtitle');
    if(subtitle) subtitle.textContent = `${count} deliveries in progress`;
  }

  const profileBtn = document.getElementById("profile-edit-btn");
  if(profileBtn){
    const fields = [
      ["company-name","profile-company-name"],
      ["full-name","profile-full-name"],
      ["email","profile-email"],
      ["phone","profile-phone"],
      ["address","profile-address"]
    ];
    const sessionUser = getSessionUser && getSessionUser();
    const profileFromState = (function(){
      if(!sessionUser) return null;
      const pd = sessionUser.profileDetails || {};
      return {
        "company-name": (pd.companyName || sessionUser.companyName || pd.company || sessionUser.company || ""),
        "full-name": (pd.fullName || sessionUser.fullName || sessionUser.name || ""),
        "email": (sessionUser.email || ""),
        "phone": (sessionUser.phone || ""),
        "address": (pd.businessAddress || pd.address || sessionUser.address || "")
      };
    })();

    const fallbackSaved = JSON.parse(localStorage.getItem("bcProfileData")||"{}");
    const initial = profileFromState || fallbackSaved;
    fields.forEach(([key,inputId])=>{
      const box = document.querySelector(`.value-box[data-field="${key}"] .profile-value-text`);
      const inp = document.getElementById(inputId);
      if(initial && Object.prototype.hasOwnProperty.call(initial, key)){
        if(box) box.textContent = initial[key] || '';
        if(inp) inp.value = initial[key] || '';
      }
    });
    const EMAIL_RE = /^(?=.{1,64}@)(?=.{6,320}$)(?!\.)(?!.*\.\.)([A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+(?:\.[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+)*)@([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)$/;
    const COMPANY_RE = /^[A-Za-z0-9 ]+$/;
    const NAME_RE = /^[A-Za-z ]+$/;
    const PHONE_RE = /^[6-9][0-9]{9}$/;

    function ensureFieldError(input){
      if(!input) return null;
      let err = input.parentElement.querySelector('.field-error');
      if(!err){
        err = document.createElement('div');
        err.className = 'field-error';
        err.style.color = '#ef4444';
        err.style.fontSize = '14px';
        err.style.marginTop = '8px';
        input.insertAdjacentElement('afterend', err);
      }
      return err;
    }

    function setFieldError(input, message){
      const err = ensureFieldError(input);
      if(err) err.textContent = message || '';
    }

    function clearFieldError(input){
      const err = input && input.parentElement ? input.parentElement.querySelector('.field-error') : null;
      if(err) err.textContent = '';
    }

    function normalizePhone(value){
      const digits = String(value || '').replace(/\D/g, '');
      if(digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
      return digits;
    }
    let editing = false;
    profileBtn.addEventListener("click", ()=>{
      if(editing){
        const companyInput = document.getElementById('profile-company-name');
        const fullNameInput = document.getElementById('profile-full-name');
        const emailInput = document.getElementById('profile-email');
        const phoneInput = document.getElementById('profile-phone');
        const addressInput = document.getElementById('profile-address');

        [companyInput, fullNameInput, emailInput, phoneInput, addressInput].forEach(inp => clearFieldError(inp));

        const companyValue = (companyInput?.value || '').trim();
        const fullNameValue = (fullNameInput?.value || '').trim();
        const emailValue = (emailInput?.value || '').trim();
        const phoneValue = normalizePhone(phoneInput?.value || '');
        const addressValue = (addressInput?.value || '').trim();
        let hasError = false;

        if(companyValue && !COMPANY_RE.test(companyValue)){
          setFieldError(companyInput, 'Company name should contain only letters, numbers, and spaces.');
          hasError = true;
        }
        if(!NAME_RE.test(fullNameValue)){
          setFieldError(fullNameInput, 'Full name should contain only letters and spaces.');
          hasError = true;
        }
        if(!EMAIL_RE.test(emailValue)){
          setFieldError(emailInput, 'Enter a valid email address in personal_info@domain format.');
          hasError = true;
        }
        if(!PHONE_RE.test(phoneValue)){
          setFieldError(phoneInput, 'Phone number should start with 9, 8, 7, or 6 and contain exactly 10 digits.');
          hasError = true;
        }
        if(hasError) return;

        if(phoneInput) phoneInput.value = phoneValue;

        const payload={
          "company-name": companyValue,
          "full-name": fullNameValue,
          "email": emailValue,
          "phone": phoneValue,
          "address": addressValue
        };

        fields.forEach(([key,inputId])=>{ const box = document.querySelector(`.value-box[data-field="${key}"]`); const inp = document.getElementById(inputId); if(!box || !inp) return; box.style.display = "flex"; inp.hidden = true; const span = box.querySelector('.profile-value-text'); if(span) span.textContent = payload[key] || ''; });

        if(sessionUser && DS && DS.readState && DS.saveState){
          const state = DS.readState();
          const user = (state.users||[]).find(u => u.id === sessionUser.id) || (state.users||[]).find(u => u.email === sessionUser.email);
          if(user){
            user.name = payload["full-name"];
            user.fullName = payload["full-name"];
            user.email = payload["email"];
            user.phone = payload["phone"];
            user.profileDetails = user.profileDetails || {};
            user.profileDetails.companyName = payload["company-name"];
            user.profileDetails.fullName = payload["full-name"];
            user.profileDetails.businessAddress = payload["address"];
            user.profileDetails.address = payload["address"];
            user.companyName = payload["company-name"];
            user.address = payload["address"];
          }
          DS.saveState(state);
          localStorage.setItem("bcProfileData", JSON.stringify({companyName:payload["company-name"],fullName:payload["full-name"],email:payload["email"],phone:payload["phone"],address:payload["address"]}));
          if(typeof applyBusinessClientBranding === 'function') applyBusinessClientBranding();
          refreshBusinessClientProfileFields();
        } else {
          localStorage.setItem("bcProfileData", JSON.stringify({companyName:payload["company-name"],fullName:payload["full-name"],email:payload["email"],phone:payload["phone"],address:payload["address"]}));
        }

        editing = false;
        profileBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg> Edit`;
        return;
      }

      editing = true;
      fields.forEach(([key,inputId])=>{ const box = document.querySelector(`.value-box[data-field="${key}"]`); const inp = document.getElementById(inputId); if(!box || !inp) return; box.style.display = "none"; inp.hidden = false; });
      profileBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg> Save`;
    });
  }
});


document.addEventListener("DOMContentLoaded", function(){
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch(e){ return fallback; } }
  function currentBusinessClientCompany(){
    try{
      const state = JSON.parse(localStorage.getItem('deliverysync-state-v1') || '{}');
      const session = JSON.parse(localStorage.getItem('deliverysync-session-v1') || 'null');
      const users = Array.isArray(state.users) ? state.users : [];
      const user = session ? users.find(u => String(u.email||'').toLowerCase() === String(session.email||'').toLowerCase()) : null;
      const pd = user && user.profileDetails ? user.profileDetails : {};
      return (pd.companyName || user?.companyName || user?.name || '').trim().toLowerCase();
    }catch(e){ return ''; }
  }
  function formatCurrency(amount){ const n = Number(amount) || 0; return '₹' + n.toLocaleString('en-IN'); }
  function formatStatusPill(status){
    const s = String(status || '').toUpperCase();
    if(s === 'PICKUP' || s === 'PICKED_UP') return 'Pickup';
    if(s === 'IN_TRANSIT') return 'In Transit';
    if(s === 'PREPARING') return 'Preparing';
    if(s === 'ACCEPTED') return 'Accepted';
    return s.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()) || 'In Transit';
  }
  function dashboardTrackHref(id){ return 'live-tracking.html' + (id ? ('?order=' + encodeURIComponent(id)) : ''); }
  function parseDefaultActiveRows(tbody){
    return Array.from(tbody.querySelectorAll('tr')).map(function(tr, idx){
      const cells = tr.querySelectorAll('td');
      if(cells.length < 7) return null;
      const locationDivs = cells[2].querySelectorAll('div');
      const etaText = cells[5].textContent.replace(/\s+/g,' ').trim();
      return {
        id: cells[0].textContent.trim() || ('STATIC-' + idx),
        customer: cells[1].textContent.trim(),
        location1: (locationDivs[0]?.textContent || '').replace(/\s+/g,' ').trim(),
        location2: (locationDivs[1]?.textContent || '').replace(/\s+/g,' ').trim(),
        status: cells[3].textContent.trim(),
        driver: cells[4].textContent.trim(),
        eta: etaText,
        href: cells[6].querySelector('a')?.getAttribute('href') || 'live-tracking.html',
        source: 'default'
      };
    }).filter(Boolean);
  }
  function renderDashboardActiveRow(item){
    const statusText = formatStatusPill(item.status);
    return `<tr>
      <td>${item.id}</td>
      <td>${item.customer}</td>
      <td><div><svg viewBox="0 0 24 24"><path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11z"></path><circle cx="12" cy="10" r="2"></circle></svg> ${item.location1}</div><div class="muted">${item.location2}</div></td>
      <td><span class="pill bright">${statusText}</span></td>
      <td>${item.driver}</td>
      <td><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg> ${item.eta}</td>
      <td><a class="btn sm outline-yellow" href="${item.href}">Track</a></td>
    </tr>`;
  }
  function renderBusinessClientDashboardDynamic(){
    if((document.body.dataset.page || '') !== 'dashboard') return;
    const tbody = document.getElementById('bc-dashboard-active-tbody');
    if(!tbody) return;

    const company = currentBusinessClientCompany();
    const cancelled = readJSON('bcCancelledOrders', []);
    const workflowOrders = readJSON('dsWorkflowOrders', []).filter(function(order){
      const client = String(order.client || '').trim().toLowerCase();
      return !cancelled.includes(order.id) && String(order.status || '').toUpperCase() !== 'DELIVERED' && (!company || !client || client === company);
    });
    const workflowInvoicesAll = readJSON('dsWorkflowInvoices', []).filter(function(inv){
      const client = String(inv.client || '').trim().toLowerCase();
      return (!company || !client || client === company);
    });
    const unpaidInvoices = workflowInvoicesAll.filter(inv => String(inv.status || '').toLowerCase() !== 'paid');

    const defaultActive = parseDefaultActiveRows(tbody);
    const workflowActive = workflowOrders.map(function(order){
      const pickup = String(order.pickup || '').trim();
      const parts = pickup.split(',');
      return {
        id: order.id,
        customer: order.client || 'Business Client',
        location1: pickup,
        location2: String(order.drop || '').trim(),
        status: order.status,
        driver: order.assignedDriver || 'Assigning',
        eta: String(order.eta || 35).includes('min') ? String(order.eta) : `${order.eta || 35} mins`,
        href: dashboardTrackHref(order.id),
        source: 'workflow'
      };
    });

    const seen = new Set();
    const merged = [];
    workflowActive.concat(defaultActive).forEach(function(item){
      const key = String(item.id || '').trim();
      if(!key || seen.has(key)) return;
      seen.add(key);
      merged.push(item);
    });

    tbody.innerHTML = merged.map(renderDashboardActiveRow).join('');

    const activeCount = merged.length;
    const completedCount = workflowInvoicesAll.length;
    const totalCount = activeCount + completedCount;
    const unpaidCount = unpaidInvoices.length;
    const unpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);

    const setText = (id, value) => { const el = document.getElementById(id); if(el) el.textContent = value; };
    setText('bc-stat-total-deliveries', String(totalCount));
    setText('bc-stat-active-deliveries', String(activeCount));
    setText('bc-stat-completed-deliveries', String(completedCount));
    setText('bc-stat-unpaid-invoices', String(unpaidCount));
    setText('bc-stat-total-foot', totalCount === 1 ? '1 Delivery' : 'All Deliveries');
    setText('bc-stat-active-foot', activeCount === 1 ? '1 In Progress' : 'In Progress');
    setText('bc-stat-completed-foot', completedCount === 1 ? '1 Delivered' : 'Delivered Orders');
    setText('bc-stat-unpaid-foot', formatCurrency(unpaidAmount) + ' Due');

    const heroSubtitle = document.querySelector('.hero-card .page-subtitle');
    if(heroSubtitle) heroSubtitle.textContent = `${activeCount} active deliveries in progress.`;
  }

  renderBusinessClientDashboardDynamic();
});
