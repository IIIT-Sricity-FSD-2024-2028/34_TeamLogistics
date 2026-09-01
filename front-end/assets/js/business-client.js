
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

  function updateBusinessClientNotificationUI(){
    const api = window.DeliverySyncAPI;
    if(!api || !api.Notifications || typeof api.Notifications.getAll !== 'function') return;

    api.Notifications.getAll().then(function(list){
      const newCount = (list || []).filter(function(n){
        return !(n.read === true || String(n.status||'').toLowerCase() === 'read');
      }).length;

      document.querySelectorAll('.bc-bell .badge').forEach(function(badge){
        badge.textContent = String(newCount);
        badge.style.display = newCount > 0 ? '' : 'none';
      });

      const bannerPill = document.querySelector('.section-banner .pill.bright');
      if(bannerPill){
        bannerPill.textContent = `${newCount} New`;
      }

      const tabs = document.querySelectorAll('.tab-row .tab');
      if(tabs[1]){
        tabs[1].textContent = `Unread (${newCount})`;
      }
    }).catch(function(){});
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
})();
