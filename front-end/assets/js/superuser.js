(function(){
  const DS = window.DeliverySyncData;
  const page = document.body.dataset.page;
  const role = 'superuser';

  // Local showToast – utils.js is not loaded in superuser pages
  function showToast(message){
    let t = document.getElementById('su-toast');
    if(!t){
      t = document.createElement('div');
      t.id = 'su-toast';
      t.style.cssText = 'position:fixed;top:24px;right:24px;background:#1e1e2f;color:#fff;padding:14px 28px;border-radius:12px;font-size:14px;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,.4);transform:translateY(-20px);opacity:0;transition:all .3s ease;border-left:4px solid #f7d10a;pointer-events:none';
      document.body.appendChild(t);
    }
    t.textContent = message;
    t.style.opacity = '1';
    t.style.transform = 'translateY(0)';
    clearTimeout(showToast._tid);
    showToast._tid = setTimeout(function(){ t.style.opacity = '0'; t.style.transform = 'translateY(-20px)'; }, 2800);
  }

  function roleLabelToValue(role){
    const value = String(role || '').trim().toLowerCase();
    if (value === 'fleet manager' || value === 'fleet-manager') return 'fleet-manager';
    if (value === 'business client' || value === 'business-client') return 'business-client';
    if (value === 'super user' || value === 'superuser') return 'superuser';
    if (value === 'driver') return 'driver';
    return value;
  }

  function roleValueToLabel(role){
    const value = roleLabelToValue(role);
    return ({
      'superuser':'Super User',
      'fleet-manager':'Fleet Manager',
      'business-client':'Business Client',
      'driver':'Driver'
    })[value] || role || 'User';
  }

  function createUsernameFromName(name){
    const base = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'user';
    const st = DS.readState();
    let candidate = base;
    let index = 1;
    while ((st.users || []).some(u => (u.username || '').toLowerCase() === candidate)) {
      candidate = `${base}${index++}`;
    }
    return candidate;
  }

  function mapCoreUserToSuperuserUser(user){
    const pd = user.profileDetails || {};
    const displayName = String(user.role || '').toLowerCase() === 'business-client'
      ? (pd.fullName || user.fullName || user.name)
      : user.name;
    return {
      id: user.id,
      username: user.username || createUsernameFromName(displayName || user.name),
      name: displayName,
      email: user.email,
      role: roleValueToLabel(user.role),
      phone: user.phone || user.contact || '',
      lastLogin: user.lastLogin || '--',
      notifications: user.notifications || ['Email'],
      status: user.status || 'Active',
      profileDetails: pd
    };
  }

  function syncUsersToSuperuserPanel(state){
    state.superuser = state.superuser || {};
    const existing = Array.isArray(state.superuser.users) ? state.superuser.users : [];
    const existingById = Object.fromEntries(existing.map(user => [user.id, user]));
    state.superuser.users = (state.users || []).map((user) => {
      const previous = existingById[user.id] || {};
      return {
        ...previous,
        ...mapCoreUserToSuperuserUser(user),
        profileDetails: user.profileDetails || previous.profileDetails || {}
      };
    });
  }

  function ensureState(){
    DS.seed();
    const s = DS.readState();
    if(!s.superuser){
      s.superuser = {};
    }
    syncUsersToSuperuserPanel(s);
    s.superuser.deliveryRequests = s.superuser.deliveryRequests || [
      {id:'DR-2024-001',customer:'Tech Solutions',contact:'Sarah Johnson',pickup:'16-3, bsk, hyd',dropoff:'12-234,bheemla, hyd',package:'Electronics - 2 Laptops, 15kg',type:'Express',requestTime:'2024-03-08 09:30 AM',status:'Pending',priority:'High',items:2,driver:'Rahul'},
      {id:'DR-2024-002',customer:'UrbanKart Retail',contact:'Meera Kapoor',pickup:'Madhapur, hyd',dropoff:'Begumpet, hyd',package:'Documents - 6 envelopes',type:'Standard',requestTime:'2024-03-08 11:00 AM',status:'Approved',priority:'Medium',items:6,driver:'Pooja Nair'},
      {id:'DR-2024-003',customer:'BlueMed',contact:'Karan Patel',pickup:'Ameerpet, hyd',dropoff:'Gachibowli, hyd',package:'Medical supplies - 12kg',type:'Express',requestTime:'2024-03-08 01:10 PM',status:'In Review',priority:'High',items:8,driver:'Riya Sharma'}
    ];
    s.superuser.trips = s.superuser.trips || [
      {id:'TRP-2024-001',assignment:'ASN-2024-156',driver:'Rahul',phone:'+91 98765 43210',vehicle:'DL-01-AB-1234',vehicleType:'Cargo Van',pickup:'Gurgaon, Haryana',destination:'Connaught Place, New Delhi',startTime:'2024-03-08 09:00 AM',distance:'28.5 km',status:'In Transit',request:'DR-2024-001'},
      {id:'TRP-2024-002',assignment:'ASN-2024-157',driver:'Sana Khan',phone:'+91 90012 45210',vehicle:'TS-09-QA-2345',vehicleType:'Mini Truck',pickup:'Madhapur, Hyderabad',destination:'Secunderabad, Hyderabad',startTime:'2024-03-08 10:15 AM',distance:'22.1 km',status:'Queued',request:'DR-2024-002'},
      {id:'TRP-2024-003',assignment:'ASN-2024-158',driver:'Raghav',phone:'+91 95555 98210',vehicle:'KA-09-LM-4567',vehicleType:'Tempo',pickup:'Porur, Chennai',destination:'Airport, Chennai',startTime:'2024-03-08 12:00 PM',distance:'31.2 km',status:'Delayed',request:'DR-2024-003'}
    ];
    s.superuser.notifications = s.superuser.notifications || [
      {title:'New delivery request assigned',desc:'DR-2024-001 requires super user review.',time:'Just now'},
      {title:'Policy updated successfully',desc:'Fleet manager permissions were changed.',time:'12 mins ago'},
      {title:'Driver compliance warning',desc:'One driver document is expiring soon.',time:'40 mins ago'}
    ];
    s.superuser.permissions = s.superuser.permissions || {
      'fleet-manager':[
        ['Dashboard Access','View platform overview',true],['Fleet Management Access','Manage assigned fleets',true],['User Management Access','Create and update operational users',true],['Reports Access','Access operational reports',true],['System Configuration Access','View configuration settings',false],['Role & Permissions Access','Edit role policies',false]
      ],
      'business-client':[
        ['Dashboard Access','View account overview',true],['Track Requests','Track assigned delivery requests',true],['Manage Contacts','Manage business contacts',true],['Reports Access','Access order reports',true],['System Configuration Access','No configuration access',false],['Role & Permissions Access','No permission control',false]
      ],
      'driver':[
        ['Dashboard Access','View trip overview',true],['Trip Monitoring','Access assigned trip details',true],['Reports Access','View trip reports',true],['Manage Users','No user management',false],['System Configuration Access','No configuration access',false],['Role & Permissions Access','No permission control',false]
      ]
    };
    s.superuser.platform = s.superuser.platform || {name:'DeliverSync',timezone:'Asia/Kolkata',language:'English',logo:''};
    s.superuser.security = s.superuser.security || {passwordLength:8,failedAttempts:5,sessionTimeout:30,twoFactor:true};
    
    // Shared maintenance schedules (created by Fleet Manager, visible to Super User)
    s.maintenanceSchedules = s.maintenanceSchedules || [
      {id:'MT-2026-001',vehicle:'TN-09-AB-2345',issue:'Engine Oil Change',priority:'High',status:'Scheduled',date:'Mar 10, 2026',mechanic:'Ravi Auto Service',cost:'₹1200'},
      {id:'MT-2026-002',vehicle:'KA-01-CD-7890',issue:'Brake Pad Replacement',priority:'Critical',status:'In Progress',date:'Mar 06, 2026',mechanic:'SpeedFix Workshop',cost:'₹2800'},
      {id:'MT-2026-003',vehicle:'MH-12-EF-4321',issue:'Tire Rotation & Balance',priority:'Medium',status:'Scheduled',date:'Mar 12, 2026',mechanic:'AutoCare Pro',cost:'₹800'},
      {id:'MT-2026-004',vehicle:'DL-08-GH-5678',issue:'Air Filter Replacement',priority:'Low',status:'Completed',date:'Mar 02, 2026',mechanic:'Ravi Auto Service',cost:'₹4500'},
      {id:'MT-2026-005',vehicle:'TN-05-IJ-9012',issue:'Transmission Service',priority:'Critical',status:'Overdue',date:'Feb 28, 2026',mechanic:'AutoCare Pro',cost:'₹670'}
    ];
    DS.saveState(s);
    return s;
  }

  function sessionGuard(){
    const sess = DS.getSession();
    if(!sess || sess.role !== role){
      window.location.href = '../login.html';
      return null;
    }
    return sess;
  }

  const $ = (s,r=document)=>r.querySelector(s);
  const params = ()=>new URLSearchParams(location.search);
  const icon = {
    brand:`<svg viewBox="0 0 24 24"><rect x="4" y="5" width="10" height="14" rx="2"></rect><path d="M14 9h2.5A2.5 2.5 0 0 1 19 11.5V15a2 2 0 0 1-2 2h-3"></path><circle cx="8" cy="18.5" r="1.5"></circle><circle cx="17" cy="18.5" r="1.5"></circle></svg>`,
    dashboard:`<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6"></rect><rect x="14" y="4" width="6" height="6"></rect><rect x="4" y="14" width="6" height="6"></rect><rect x="14" y="14" width="6" height="6"></rect></svg>`,
    cube:`<svg viewBox="0 0 24 24"><path d="M12 3l8 4.5-8 4.5-8-4.5 8-4.5z"></path><path d="M4 7.5V16.5L12 21l8-4.5V7.5"></path></svg>`,
    pin:`<svg viewBox="0 0 24 24"><path d="M12 21s6-5.33 6-11a6 6 0 1 0-12 0c0 5.67 6 11 6 11z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>`,
    users:`<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path><circle cx="9.5" cy="7" r="3"></circle><path d="M20 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 4.13a3 3 0 0 1 0 5.74"></path></svg>`,
    shield:`<svg viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z"></path></svg>`,
    gear:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 4.4 16.9l.06-.06A1.65 1.65 0 0 0 4.79 15a1.65 1.65 0 0 0-1.51-1H3.2a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82L4.4 7.12A2 2 0 1 1 7.23 4.3l.06.06A1.65 1.65 0 0 0 9.1 4a1.65 1.65 0 0 0 1-1.51V2.4a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06A2 2 0 1 1 19.8 7.1l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.61.78 1.02 1.43 1.02h.17a2 2 0 1 1 0 4h-.17c-.65 0-1.23.41-1.43 1.02z"></path></svg>`,
    report:`<svg viewBox="0 0 24 24"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"></path><path d="M14 2v5h5"></path><path d="M9 13h6"></path><path d="M9 17h6"></path></svg>`,
    profile:`<svg viewBox="0 0 24 24"><path d="M20 21a8 8 0 1 0-16 0"></path><circle cx="12" cy="8" r="4"></circle></svg>`,
    search:`<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>`,
    bell:`<svg viewBox="0 0 24 24"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-5-5.92V4a1 1 0 1 0-2 0v1.08A6 6 0 0 0 6 11v3.2a2 2 0 0 1-.6 1.4L4 17h5"></path><path d="M9 17a3 3 0 0 0 6 0"></path></svg>`,
    logout:`<svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5"></path><path d="M15 12H3"></path><path d="M20 20h-6a2 2 0 0 1-2-2v-3"></path><path d="M20 4h-6a2 2 0 0 0-2 2v3"></path></svg>`,
    doc:`<svg viewBox="0 0 24 24"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"></path><path d="M14 2v5h5"></path></svg>`,
    user:`<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M6 20a6 6 0 0 1 12 0"></path></svg>`,
    map:`<svg viewBox="0 0 24 24"><path d="M12 21s6-5.33 6-11a6 6 0 1 0-12 0c0 5.67 6 11 6 11z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>`,
    package:`<svg viewBox="0 0 24 24"><path d="M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z"></path><path d="M12 22V11"></path><path d="M20 6.5l-8 4.5-8-4.5"></path></svg>`,
    calendar:`<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4"></path><path d="M8 3v4"></path><path d="M3 11h18"></path></svg>`,
    wrench:`<svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0 3 5.7l-7.4 7.4a2 2 0 1 1-2.8-2.8l7.4-7.4a4 4 0 0 0-5.7-3"></path></svg>`,
    vehicle:`<svg viewBox="0 0 24 24"><rect x="1.5" y="6" width="11" height="10" rx="2"></rect><path d="M12.5 9H16l3 3v4h-6.5"></path><circle cx="6" cy="18" r="1.5"></circle><circle cx="17" cy="18" r="1.5"></circle></svg>`,
    upload:`<svg viewBox="0 0 24 24"><path d="M12 16V4"></path><path d="M7 9l5-5 5 5"></path><path d="M20 16v4H4v-4"></path></svg>`
  };
  const nav = [
    ['Dashboard','dashboard.html','dashboard'],
    ['Delivery Requests','delivery-requests.html','cube'],
    ['Trips Monitoring','trip-monitoring.html','pin'],
    ['Vehicles','vehicles.html','vehicle'],
    ['Maintenance','maintenance.html','wrench'],
    ['Manage Users','manage-users.html','users'],
    ['Roles & Permissions','roles-fleet-manager.html','shield'],
    ['System Configuration','system-configuration.html','gear'],
    ['Reports','reports.html','report'],
    ['Transactions','transactions.html','doc'],
    ['Notifications','notifications.html','bell'],
    ['Profile','profile.html','profile']
  ];

  function getWorkflowOrders(){
    try { return JSON.parse(localStorage.getItem('dsWorkflowOrders') || '[]') || []; }
    catch(e){ return []; }
  }

  function getBusinessClientCompanyName(){
    try{
      const st = DS.readState();
      const bc = (st.users||[]).find(u => String(u.role||'').toLowerCase()==='business-client') || {};
      const pd = bc.profileDetails || {};
      return pd.companyName || bc.companyName || bc.name || 'Acme Logistics Inc.';
    }catch(e){
      return 'Acme Logistics Inc.';
    }
  }


  function metric(label,val,delta){
    return `<div class="content-card kpi"><div class="label">${label}</div><div class="value">${val}</div><div class="delta">↗ ${delta}</div></div>`;
  }

  function barCard(title, values, labels, yTicks, cls=''){
    const max = Math.max(...values,1);
    const bars = values.map((v,i)=>`<div class="bar-wrap"><div class="bar" style="height:${Math.max(8,(v/max)*100)}%"></div><div class="bar-label">${labels[i]||''}</div></div>`).join('');
    const ticks = (yTicks||['100','75','50','25','0']).map(t=>`<div>${t}</div>`).join('');
    return `<div class="content-card chart-card ${cls}"><div class="chart-title">${title}</div><div class="chart-outer"><div class="chart-y">${ticks}</div><div class="chart-area">${bars}</div></div></div>`;
  }

  function statusClass(v){
    v = (v||'').toLowerCase();
    if(v.includes('active')||v.includes('approved')||v.includes('completed')||v.includes('transit')) return 'active';
    if(v.includes('pending')||v.includes('review')||v.includes('queue')) return 'pending';
    return 'blocked';
  }

  function pageLayout(title, active){
    const session = sessionGuard(); if(!session) return null;
    const s = ensureState();
    document.body.innerHTML = `
      <div class="su-shell">
        <aside class="su-sidebar">
          <div class="brand-wrap">
            <div class="ds-brand-logo" data-href="dashboard.html" data-size="sm" data-sub="Super User Portal"></div>
          </div>
          <nav class="nav-section">
            ${nav.map(([name,href,key])=>`<a class="nav-link ${active===name?'active':''}" href="${href}">${icon[key]}<span>${name}</span></a>`).join('')}
          </nav>
          <div class="side-footer">
            <button id="logoutBtn" class="logout-btn">${icon.logout}<span>Logout</span></button>
          </div>
        </aside>
        <main class="su-main">
          <header class="topbar">
            <div class="page-title">${title}</div>
            <div class="topbar-right">
              <div class="search-wrap">${icon.search}<input class="search" placeholder="Search..."></div>
              <button class="icon-btn" id="bellBtn">${icon.bell}<span class="badge-count">${s.superuser.notifications.length}</span></button>
              <button class="avatar-mini" id="profileBtn">${(session.name||'A').charAt(0).toUpperCase()}</button>
            </div>
          </header>
          <div class="page-scroll"><div id="pageRoot"></div></div>
        </main>
      </div>`;
    $('#logoutBtn').onclick = ()=>{ DS.clearSession(); location.href='../login.html'; };
    $('#bellBtn').onclick = ()=>{ location.href='notifications.html'; };
    $('#profileBtn').onclick = ()=>{ location.href='profile.html'; };
    if(window.DeliverSyncBrand) window.DeliverSyncBrand.init();
    return s;
  }

  function renderDashboard(){
    const s = pageLayout('Super User Control Center','Dashboard'); if(!s) return;
    const users = s.users || [];
    const totalUsers = users.length;
    const fleetManagers = users.filter(u => u.role === 'fleet-manager').length;
    const businessClients = users.filter(u => u.role === 'business-client').length;
    const drivers = users.filter(u => u.role === 'driver').length;
    $('#pageRoot').innerHTML = `
      <div class="kpi-grid">
        ${metric('Total Users', totalUsers.toLocaleString('en-IN'), 'Live')}
        ${metric('Fleet Managers', fleetManagers.toLocaleString('en-IN'), 'Live')}
        ${metric('Business Clients', businessClients.toLocaleString('en-IN'), 'Live')}
        ${metric('Drivers', drivers.toLocaleString('en-IN'), 'Live')}
        ${metric('Active Deliveries', ((s.superuser.deliveryRequests||[]).length + getWorkflowOrders().length).toLocaleString('en-IN'), 'Live')}
        ${metric('System Alerts', s.superuser.notifications.length.toString(), 'Live')}
      </div>
      <div class="grid-2">
        ${barCard('Delivery Performance',[680,720,850,790,920,640,580],['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],['1000','750','500','250','0'])}
        ${barCard('Revenue Trends',[42000,48000,51000,58000,62000,69000],['Jan','Feb','Mar','Apr','May','Jun'],['80000','60000','40000','20000','0'])}
      </div>
      ${barCard('Fleet Status Overview',[240,90,12,7],['Available','In Transit','Maintenance','Offline'],['240','180','120','60','0'],'full bar-row')}`;
  }

 async function renderUsers(){
  const s = pageLayout('Manage Users','Manage Users'); 
  if(!s) return;

  $('#pageRoot').innerHTML = `
    <div class="content-card table-card">
      <div class="table-head" style="align-items:flex-start;gap:16px;flex-wrap:wrap">
        <div>
          <h3>User Management</h3>
          <div class="subdued" style="margin-top:6px">
            Search, filter, and manage all created users.
          </div>
        </div>

        <div class="filters" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <input class="mini-input" id="userSearch" placeholder="Search by name, email, or role">

          <select class="mini-input" id="roleFilter" style="min-width:180px">
            <option value="">All Roles</option>
            <option value="superuser">Super User</option>
            <option value="fleet-manager">Fleet Manager</option>
            <option value="business-client">Business Client</option>
            <option value="driver">Driver</option>
          </select>

          <a class="btn-yellow" href="add-user.html">Add New User</a>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>User ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Login</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody id="usersBody">
          <tr>
            <td colspan="7" style="text-align:center;color:#b9b9b9;padding:24px">
              Loading users...
            </td>
          </tr>
        </tbody>
      </table>

      <div id="usersMeta" style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:18px;flex-wrap:wrap"></div>
    </div>
  `;

  const roleText = function(role){
    return roleValueToLabel(role);
  };

  const render = async function(){
    try {
      const q = ($('#userSearch').value || '').trim();
      const selectedRole = ($('#roleFilter').value || '').trim();

      const users = await DeliverySyncAPI.Users.getAll(selectedRole, q);

      $('#usersBody').innerHTML = (users || []).map(function(u){
        const userRole = roleText(u.role);
        const status = u.status || 'Active';

        return `
          <tr>
            <td>${u.id || '-'}</td>
            <td>${u.name || u.fullName || '-'}</td>
            <td>${u.email || '-'}</td>
            <td>${userRole}</td>
            <td>
              <span class="status-pill ${statusClass(status)}">
                ${status}
              </span>
            </td>
            <td>${u.lastLogin || '--'}</td>
            <td>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">
                <div class="action-menu-wrap">
                  <button class="action-trigger dots-trigger" aria-label="More actions" data-id="${u.id}">⋯</button>

                  <div class="action-menu" id="menu-${u.id}">
                    <a class="action-item" href="view-user.html?id=${u.id}">View User</a>
                    <a class="action-item" href="edit-user.html?id=${u.id}">Edit User</a>

                    <button class="action-item" data-disable="${u.id}" data-status="${status}">
                      ${status === 'Suspended' ? 'Enable User' : 'Disable User'}
                    </button>

                    <button class="action-item danger-link" data-delete="${u.id}">
                      Delete User
                    </button>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        `;
      }).join('') || `
        <tr>
          <td colspan="7" style="text-align:center;padding:24px;color:#9ca3af">
            No users found for the current search/filter.
          </td>
        </tr>
      `;

      $('#usersMeta').innerHTML = `
        <div class="subdued">
          Showing <strong>${(users || []).length}</strong> users
        </div>
      `;

      document.querySelectorAll('.action-trigger').forEach(function(btn){
        btn.onclick = function(e){
          e.preventDefault();
          e.stopPropagation();

          document.querySelectorAll('.action-menu').forEach(function(m){
            m.classList.remove('show');
          });

          const menu = document.getElementById('menu-' + btn.dataset.id);
          if(menu) menu.classList.toggle('show');
        };
      });

      document.querySelectorAll('[data-disable]').forEach(function(btn){
        btn.onclick = async function(e){
          e.preventDefault();
          e.stopPropagation();

          const session = DS.getSession();
          const id = btn.dataset.disable;

          if(session && session.userId === id){
            showToast('Cannot suspend your own account');
            return;
          }

          const currentStatus = btn.dataset.status || 'Active';
          const nextStatus = currentStatus === 'Suspended' ? 'Active' : 'Suspended';

          try {
            await DeliverySyncAPI.Users.updateStatus(id, nextStatus);
            showToast(nextStatus === 'Suspended' ? 'User disabled successfully' : 'User enabled successfully');
            await render();
          } catch(error) {
            console.error('Failed to update user status:', error);
            alert('Failed to update user status from backend');
          }
        };
      });

      document.querySelectorAll('[data-delete]').forEach(function(btn){
        btn.onclick = async function(e){
          e.preventDefault();
          e.stopPropagation();

          const session = DS.getSession();
          const id = btn.dataset.delete;

          if(session && session.userId === id){
            showToast('Cannot delete your own account');
            return;
          }

          const ok = confirm(`Delete user ${id}?`);
          if(!ok) return;

          try {
            await DeliverySyncAPI.Users.delete(id);
            showToast('User deleted successfully');
            await render();
          } catch(error) {
            console.error('Failed to delete user:', error);
            alert('Failed to delete user from backend');
          }
        };
      });

      document.addEventListener('click', function(){
        document.querySelectorAll('.action-menu').forEach(function(m){
          m.classList.remove('show');
        });
      });

    } catch(error) {
      console.error('Failed to load users from backend:', error);

      $('#usersBody').innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:24px;color:#ff6b6b">
            Failed to load users from backend.
          </td>
        </tr>
      `;
    }
  };

  $('#userSearch').oninput = render;
  $('#roleFilter').onchange = render;

  await render();
}
async function renderUserForm(editMode){
  const s = pageLayout(editMode ? 'Edit User' : 'Add New User', 'Manage Users');
  if(!s) return;

  const userId = params().get('id');
  let current = {};

  if(editMode && userId){
    try {
      current = await DeliverySyncAPI.Users.getOne(userId);
    } catch(error) {
      console.error('Failed to load user from backend:', error);
      $('#pageRoot').innerHTML = `
        <div class="content-card form-card">
          <h2>User Not Found</h2>
          <p style="color:#ff6b6b">Failed to load user from backend.</p>
          <a class="btn-yellow" href="manage-users.html">Back to Users</a>
        </div>
      `;
      return;
    }
  }

  const currentRole = roleValueToLabel(current.role || 'fleet-manager');

  $('#pageRoot').innerHTML = `
    <div class="content-card form-card">
      <h2>${editMode ? 'Edit User' : 'Add New User'}</h2>

      <div class="grid-2" style="gap:18px">
        <div class="field">
          <label>Full Name</label>
          <input id="name" value="${current.name || current.fullName || ''}" maxlength="60">
          <div class="error" id="err-name"></div>
        </div>

        <div class="field">
          <label>Email Address</label>
          <input id="email" value="${current.email || ''}" type="email" maxlength="100">
          <div class="error" id="err-email"></div>
        </div>
      </div>

      <div class="grid-2" style="gap:18px">
        <div class="field">
          <label>Password</label>
          <div style="position:relative">
            <input 
              id="password" 
              type="password" 
              value="${current.password || ''}" 
              placeholder="${editMode ? 'Leave same or enter new password' : 'Minimum 8 chars, 1 capital, 1 number, 1 special'}"
              style="width:100%;padding-right:52px"
            >
            <button 
              type="button" 
              id="togglePassword" 
              aria-label="Toggle password visibility" 
              style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:0;color:#9ca3af;font-size:20px;cursor:pointer;line-height:1"
            >👁</button>
          </div>
          <div class="error" id="err-password"></div>
        </div>

        <div class="field">
          <label>Phone Number</label>
          <input id="phone" value="${current.phone || ''}" maxlength="10" inputmode="numeric" placeholder="10-digit mobile number">
          <div class="error" id="err-phone"></div>
        </div>
      </div>

      <div class="grid-2" style="gap:18px">
        <div class="field">
          <label>Role</label>
          <select id="role">
            <option value="fleet-manager" ${roleLabelToValue(currentRole) === 'fleet-manager' ? 'selected' : ''}>Fleet Manager</option>
            <option value="business-client" ${roleLabelToValue(currentRole) === 'business-client' ? 'selected' : ''}>Business Client</option>
            <option value="driver" ${roleLabelToValue(currentRole) === 'driver' ? 'selected' : ''}>Driver</option>
            <option value="superuser" ${roleLabelToValue(currentRole) === 'superuser' ? 'selected' : ''}>Super User</option>
          </select>
          <div class="error" id="err-role"></div>
        </div>

        <div class="field">
          <label>Status</label>
          <select id="status">
            <option value="Active" ${(current.status || 'Active') === 'Active' ? 'selected' : ''}>Active</option>
            <option value="Pending" ${current.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Suspended" ${current.status === 'Suspended' ? 'selected' : ''}>Suspended</option>
            <option value="Rejected" ${current.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
          </select>
        </div>
      </div>

      <div class="content-card" style="margin-top:18px;background:rgba(255,255,255,0.02)">
        <div class="chart-title" style="margin-bottom:18px">Role-specific details</div>
        <div id="roleSpecificFields"></div>
      </div>

      <div class="form-actions">
        <a class="btn-dark" href="manage-users.html">Cancel</a>
        <button class="btn-yellow" id="saveUser">
          ${editMode ? 'Save Changes' : 'Create User'}
        </button>
      </div>
    </div>
  `;

  const details = current.profileDetails || {};

  function renderRoleFields(){
    const roleValue = $('#role').value;

    if(roleValue === 'fleet-manager'){
      $('#roleSpecificFields').innerHTML = `
        <div class="grid-2" style="gap:18px">
          <div class="field">
            <label>Company Name</label>
            <input id="detail-companyName" value="${details.companyName || ''}" maxlength="80">
            <div class="error" id="err-detail-companyName"></div>
          </div>

          <div class="field">
            <label>Company Address</label>
            <input id="detail-companyAddress" value="${details.companyAddress || ''}" maxlength="150">
            <div class="error" id="err-detail-companyAddress"></div>
          </div>
        </div>

        <div class="field">
          <label>Number of Vehicles</label>
          <input id="detail-numberOfVehicles" value="${details.numberOfVehicles || ''}" inputmode="numeric" maxlength="4">
          <div class="error" id="err-detail-numberOfVehicles"></div>
        </div>
      `;
    }

    else if(roleValue === 'business-client'){
      $('#roleSpecificFields').innerHTML = `
        <div class="grid-2" style="gap:18px">
          <div class="field">
            <label>Company Name</label>
            <input id="detail-companyName" value="${details.companyName || ''}" maxlength="80">
            <div class="error" id="err-detail-companyName"></div>
          </div>

          <div class="field">
            <label>Company Contact Number</label>
            <input id="detail-companyContactNumber" value="${details.companyContactNumber || ''}" maxlength="10" inputmode="numeric">
            <div class="error" id="err-detail-companyContactNumber"></div>
          </div>
        </div>

        <div class="field">
          <label>Business Address</label>
          <input id="detail-businessAddress" value="${details.businessAddress || ''}" maxlength="150">
          <div class="error" id="err-detail-businessAddress"></div>
        </div>
      `;
    }

    else if(roleValue === 'driver'){
      $('#roleSpecificFields').innerHTML = `
        <div class="grid-2" style="gap:18px">
          <div class="field">
            <label>Driver License Number</label>
            <input id="detail-licenseNumber" value="${details.licenseNumber || ''}" maxlength="25">
            <div class="error" id="err-detail-licenseNumber"></div>
          </div>

          <div class="field">
            <label>Account Holder Name</label>
            <input id="detail-accountHolderName" value="${details.accountHolderName || ''}" maxlength="80">
            <div class="error" id="err-detail-accountHolderName"></div>
          </div>
        </div>

        <div class="grid-2" style="gap:18px">
          <div class="field">
            <label>Account Number</label>
            <input id="detail-accountNumber" value="${details.accountNumber || ''}" inputmode="numeric" maxlength="18">
            <div class="error" id="err-detail-accountNumber"></div>
          </div>

          <div class="field">
            <label>IFSC Code</label>
            <input id="detail-ifscCode" value="${details.ifscCode || ''}" maxlength="11" style="text-transform:uppercase">
            <div class="error" id="err-detail-ifscCode"></div>
          </div>
        </div>

        <div class="field">
          <label>Bank Name</label>
          <input id="detail-bankName" value="${details.bankName || ''}" maxlength="80">
          <div class="error" id="err-detail-bankName"></div>
        </div>
      `;
    }

    else {
      $('#roleSpecificFields').innerHTML = `
        <div class="subdued">No extra details required for Super User.</div>
      `;
    }
  }

  renderRoleFields();

  $('#role').addEventListener('change', renderRoleFields);

  const togglePasswordBtn = $('#togglePassword');
  if(togglePasswordBtn){
    togglePasswordBtn.addEventListener('click', function(){
      const pwd = $('#password');
      pwd.type = pwd.type === 'password' ? 'text' : 'password';
    });
  }

  $('#saveUser').onclick = async function(){
    ['name','email','phone','role','password'].forEach(function(id){
      const el = $('#err-' + id);
      if(el) el.textContent = '';
    });

    document.querySelectorAll('#roleSpecificFields .error').forEach(function(el){
      el.textContent = '';
    });

    let ok = true;

    const name = $('#name').value.trim();
    const email = $('#email').value.trim();
    const phone = $('#phone').value.trim();
    const password = $('#password').value.trim();
    const role = $('#role').value;
    const status = $('#status').value;

    if(!/^[A-Za-z][A-Za-z\s]{2,59}$/.test(name)){
      $('#err-name').textContent = 'Full name must be 3-60 letters and spaces only';
      ok = false;
    }

    if(!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/.test(email)){
      $('#err-email').textContent = 'Enter a valid email address';
      ok = false;
    }

    if(!/^[6-9]\d{9}$/.test(phone)){
      $('#err-phone').textContent = 'Phone number must be 10 digits and start from 6, 7, 8, or 9';
      ok = false;
    }

    if(!editMode && !/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)){
      $('#err-password').textContent = 'Password must be at least 8 characters and include 1 capital letter, 1 number, and 1 special character';
      ok = false;
    }

    if(editMode && password && !/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)){
      $('#err-password').textContent = 'Password must be at least 8 characters and include 1 capital letter, 1 number, and 1 special character';
      ok = false;
    }

    const profileDetails = {};
    document.querySelectorAll('#roleSpecificFields input').forEach(function(input){
      profileDetails[input.id.replace('detail-', '')] = input.value.trim();
    });

    if(role === 'fleet-manager'){
      if(!profileDetails.companyName || profileDetails.companyName.length < 3){
        $('#err-detail-companyName').textContent = 'Enter a valid company name';
        ok = false;
      }

      if(!profileDetails.companyAddress || profileDetails.companyAddress.length < 5){
        $('#err-detail-companyAddress').textContent = 'Enter a valid company address';
        ok = false;
      }

      if(!/^[1-9]\d{0,3}$/.test(profileDetails.numberOfVehicles || '')){
        $('#err-detail-numberOfVehicles').textContent = 'Number of vehicles must be between 1 and 9999';
        ok = false;
      }
    }

    if(role === 'business-client'){
      if(!profileDetails.companyName || profileDetails.companyName.length < 3){
        $('#err-detail-companyName').textContent = 'Enter a valid company name';
        ok = false;
      }

      if(!/^[6-9]\d{9}$/.test(profileDetails.companyContactNumber || '')){
        $('#err-detail-companyContactNumber').textContent = 'Company contact number must be 10 digits and start from 6, 7, 8, or 9';
        ok = false;
      }

      if(!profileDetails.businessAddress || profileDetails.businessAddress.length < 5){
        $('#err-detail-businessAddress').textContent = 'Enter a valid business address';
        ok = false;
      }
    }

    if(role === 'driver'){
      if(!/^[A-Z0-9-]{5,25}$/i.test(profileDetails.licenseNumber || '')){
        $('#err-detail-licenseNumber').textContent = 'Enter a valid license number';
        ok = false;
      }

      if(!/^[A-Za-z][A-Za-z\s]{2,79}$/.test(profileDetails.accountHolderName || '')){
        $('#err-detail-accountHolderName').textContent = 'Enter valid account holder name';
        ok = false;
      }

      if(!/^\d{9,18}$/.test(profileDetails.accountNumber || '')){
        $('#err-detail-accountNumber').textContent = 'Account number must be 9-18 digits';
        ok = false;
      }

      if(!/^[A-Z]{4}0[A-Z0-9]{6}$/.test((profileDetails.ifscCode || '').toUpperCase())){
        $('#err-detail-ifscCode').textContent = 'Enter valid IFSC code';
        ok = false;
      }

      if(!/^[A-Za-z][A-Za-z\s.&-]{2,79}$/.test(profileDetails.bankName || '')){
        $('#err-detail-bankName').textContent = 'Enter valid bank name';
        ok = false;
      }

      profileDetails.ifscCode = (profileDetails.ifscCode || '').toUpperCase();
    }

    if(!ok) return;

    const payload = {
      name,
      email,
      role,
      status,
      phone,
      profileDetails
    };

    if(password){
      payload.password = password;
    }

    try {
      if(editMode){
        await DeliverySyncAPI.Users.update(userId, payload);
        showToast('User updated successfully');
      } else {
        await DeliverySyncAPI.Users.create(payload);
        showToast('User created successfully');
      }

      location.href = 'manage-users.html';
    } catch(error) {
      console.error('Failed to save user from backend:', error);
      alert('Failed to save user from backend');
    }
  };
}

 async function renderUserView(){
  const session = sessionGuard();
  if(!session) return;

  const userId = params().get('id');

  document.body.className = 'standalone-detail-page';
  document.body.innerHTML = `
    <div class="standalone-detail-wrap">
      <div class="content-card details-card user-modal-card standalone-modal">
        <div class="details-top">
          <div class="details-title">User Details</div>
          <button class="close-icon" onclick="location.href='manage-users.html'">×</button>
        </div>

        <div id="userViewBody" class="user-modal-body">
          <div style="text-align:center;color:#b9b9b9;padding:40px">
            Loading user details...
          </div>
        </div>

        <div class="detail-footer user-modal-footer">
          <a class="btn-dark modal-close-btn" href="manage-users.html">Close</a>
        </div>
      </div>
    </div>
  `;

  try {
    const u = await DeliverySyncAPI.Users.getOne(userId);

    const name = u.name || u.fullName || '-';
    const initials = name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'U';
    const roleLabel = roleValueToLabel(u.role);

    document.getElementById('userViewBody').innerHTML = `
      <div class="user-summary">
        <div class="user-avatar-box">${initials}</div>
        <div class="user-summary-copy">
          <div class="user-summary-name">${name}</div>
          <div class="user-status-line">
            <span class="status-dot"></span>
            <span>${u.status || 'Active'}</span>
          </div>
        </div>
      </div>

      <div class="user-info-grid">
        <div class="user-info-row">
          <div class="detail-label">User ID</div>
          <div class="user-info-value">${u.id || '-'}</div>
        </div>

        <div class="user-info-row">
          <div class="detail-label">Email Address</div>
          <div class="user-info-value">${u.email || '-'}</div>
        </div>

        <div class="user-info-row">
          <div class="detail-label">Phone Number</div>
          <div class="user-info-value">${u.phone || '-'}</div>
        </div>

        <div class="user-info-row">
          <div class="detail-label">Role</div>
          <div class="user-info-value">${roleLabel}</div>
        </div>

        <div class="user-info-row">
          <div class="detail-label">Status</div>
          <div class="user-info-value">${u.status || 'Active'}</div>
        </div>

        <div class="user-info-row">
          <div class="detail-label">Last Login</div>
          <div class="user-info-value">${u.lastLogin || '--'}</div>
        </div>
      </div>
    `;
  } catch(error) {
    console.error('Failed to load user from backend:', error);

    document.getElementById('userViewBody').innerHTML = `
      <div style="text-align:center;color:#ff6b6b;padding:40px">
        Failed to load user from backend.
      </div>
    `;
  }
}

async function renderReports(){
  const s = pageLayout('Reports','Reports');
  if(!s) return;

  $('#pageRoot').innerHTML = `
    <div id="reportsLoading" class="content-card" style="text-align:center;color:#b9b9b9;padding:30px">
      Loading reports from backend...
    </div>
  `;

  try {
    const [users, deliveries, vehicles, maintenance] = await Promise.all([
      DeliverySyncAPI.Users.getAll('', ''),
      DeliverySyncAPI.Deliveries.getAll(),
      DeliverySyncAPI.Vehicles.getAll(),
      DeliverySyncAPI.Maintenance.getAll('')
    ]);

    const totalUsers = (users || []).length;
    const totalDeliveries = (deliveries || []).length;
    const totalVehicles = (vehicles || []).length;
    const totalMaintenance = (maintenance || []).length;

    const completedDeliveries = (deliveries || []).filter(function(d){
      return String(d.status || '').toLowerCase().includes('delivered') ||
             String(d.status || '').toLowerCase().includes('completed');
    }).length;

    const activeVehicles = (vehicles || []).filter(function(v){
      return String(v.status || '').toLowerCase() === 'active';
    }).length;

    const blockedVehicles = (vehicles || []).filter(function(v){
      return String(v.status || '').toLowerCase() === 'blocked';
    }).length;

    const maintenanceVehicles = (vehicles || []).filter(function(v){
      return String(v.status || '').toLowerCase() === 'maintenance';
    }).length;

    const pendingDeliveries = (deliveries || []).filter(function(d){
      const st = String(d.status || '').toLowerCase();
      return st.includes('pending') || st.includes('review');
    }).length;

    const blockedDeliveries = (deliveries || []).filter(function(d){
      return String(d.status || '').toLowerCase() === 'blocked';
    }).length;

    const completionRate = totalDeliveries
      ? Math.round((completedDeliveries / totalDeliveries) * 100)
      : 0;

    const vehicleUtilization = totalVehicles
      ? Math.round((activeVehicles / totalVehicles) * 100)
      : 0;

    $('#pageRoot').innerHTML = `
      <div class="kpi-grid">
        ${metric('Total Users', totalUsers.toLocaleString('en-IN'), 'Backend')}
        ${metric('Total Deliveries', totalDeliveries.toLocaleString('en-IN'), 'Backend')}
        ${metric('Completed Deliveries', completedDeliveries.toLocaleString('en-IN'), `${completionRate}%`)}
        ${metric('Total Vehicles', totalVehicles.toLocaleString('en-IN'), 'Backend')}
        ${metric('Active Vehicles', activeVehicles.toLocaleString('en-IN'), `${vehicleUtilization}%`)}
        ${metric('Maintenance Records', totalMaintenance.toLocaleString('en-IN'), 'Backend')}
      </div>

      <div class="grid-2">
        ${barCard(
          'Delivery Status Report',
          [
            completedDeliveries,
            pendingDeliveries,
            blockedDeliveries,
            Math.max(totalDeliveries - completedDeliveries - pendingDeliveries - blockedDeliveries, 0)
          ],
          ['Completed','Pending','Blocked','Other'],
          ['100','75','50','25','0'],
          'bar-row'
        )}

        ${barCard(
          'Vehicle Status Report',
          [
            activeVehicles,
            maintenanceVehicles,
            blockedVehicles,
            Math.max(totalVehicles - activeVehicles - maintenanceVehicles - blockedVehicles, 0)
          ],
          ['Active','Maintenance','Blocked','Other'],
          ['100','75','50','25','0'],
          'bar-row'
        )}
      </div>

      <div class="content-card table-card" style="margin-top:24px">
        <div class="table-head">
          <h3>Report Summary</h3>
        </div>

        <table>
          <thead>
            <tr>
              <th>Module</th>
              <th>Total</th>
              <th>Important Count</th>
              <th>Remark</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>Users</td>
              <td>${totalUsers}</td>
              <td>${(users || []).filter(u => String(u.status || '').toLowerCase() === 'active').length} active</td>
              <td>User data loaded from backend</td>
            </tr>

            <tr>
              <td>Deliveries</td>
              <td>${totalDeliveries}</td>
              <td>${completedDeliveries} completed</td>
              <td>${completionRate}% completion rate</td>
            </tr>

            <tr>
              <td>Vehicles</td>
              <td>${totalVehicles}</td>
              <td>${activeVehicles} active</td>
              <td>${vehicleUtilization}% active vehicle ratio</td>
            </tr>

            <tr>
              <td>Maintenance</td>
              <td>${totalMaintenance}</td>
              <td>${maintenanceVehicles} vehicles under maintenance</td>
              <td>Maintenance records loaded from backend</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

  } catch(error) {
    console.error('Failed to load reports from backend:', error);

    $('#pageRoot').innerHTML = `
      <div class="content-card" style="text-align:center;color:#ff6b6b;padding:30px">
        Failed to load reports from backend.
      </div>
    `;
  }
}

 async function renderRoles(roleKey, title){
  const s = pageLayout('Roles & Permissions','Roles & Permissions'); 
  if(!s) return;

  const roleMap = {
    'fleet-manager': 'Fleet Manager',
    'business-client': 'Business Client',
    'driver': 'Driver'
  };

  $('#pageRoot').innerHTML = `
    <div class="permissions-top">
      ${Object.entries(roleMap).map(function([key, label]){
        return `
          <a class="role-tile ${roleKey === key ? 'active' : ''}" href="roles-${key}.html">
            <div class="brand-box" style="width:42px;height:42px;border-radius:14px">
              ${icon.shield}
            </div>
            <div class="role-name">${label}</div>
            <div class="role-count">Role permissions</div>
          </a>
        `;
      }).join('')}
    </div>

    <div class="content-card" id="permissionsCard">
      <div style="text-align:center;color:#b9b9b9;padding:30px">
        Loading permissions...
      </div>
    </div>
  `;

  try {
    const permissions = await DeliverySyncAPI.Settings.getPermissions(roleKey);

    const permissionList = Array.isArray(permissions)
      ? permissions
      : (permissions.permissions || []);

    document.getElementById('permissionsCard').innerHTML = `
      ${permissionList.map(function(permission, index){
        const name = permission.name || permission.title || permission[0] || `Permission ${index + 1}`;
        const description = permission.description || permission.desc || permission[1] || '';
        const enabled = typeof permission.enabled === 'boolean'
          ? permission.enabled
          : Boolean(permission[2]);

        return `
          <div class="toggle-row">
            <div>
              <div class="toggle-label">${name}</div>
              <div class="toggle-sub">${description}</div>
            </div>

            <button 
              class="toggle ${enabled ? 'on' : ''}" 
              data-index="${index}"
            ></button>
          </div>
        `;
      }).join('')}

      <div style="padding:20px;text-align:right">
        <button class="btn-yellow" id="savePerms">Save Changes</button>
      </div>
    `;

    document.querySelectorAll('.toggle').forEach(function(toggle){
      toggle.onclick = function(){
        toggle.classList.toggle('on');
      };
    });

    document.getElementById('savePerms').onclick = async function(){
      const updatedPermissions = permissionList.map(function(permission, index){
        const toggle = document.querySelector(`.toggle[data-index="${index}"]`);
        const enabled = toggle ? toggle.classList.contains('on') : false;

        if(Array.isArray(permission)){
          return [permission[0], permission[1], enabled];
        }

        return {
          ...permission,
          enabled
        };
      });

      try {
        await DeliverySyncAPI.Settings.updatePermissions(roleKey, updatedPermissions);
        showToast('Permissions updated successfully');
      } catch(error) {
        console.error('Failed to update permissions:', error);
        alert('Failed to update permissions from backend');
      }
    };

  } catch(error) {
    console.error('Failed to load permissions from backend:', error);

    document.getElementById('permissionsCard').innerHTML = `
      <div style="text-align:center;color:#ff6b6b;padding:30px">
        Failed to load permissions from backend.
      </div>
    `;
  }
}

  function renderSettings(){
    const s = pageLayout('System Configuration','System Configuration'); if(!s) return;
    const p = s.superuser.platform; const sec = s.superuser.security;
    $('#pageRoot').innerHTML = `
      <div class="content-card settings-section">
        <div class="settings-head"><div class="settings-icon">${icon.gear}</div><div><strong>Platform Settings</strong><span>Configure general platform parameters</span></div></div>
        <div class="settings-body">
          <div class="field"><label>Platform Name</label><input id="platformName" value="${p.name}"><div class="form-note">This name appears across the platform</div></div>
          <div class="field"><label>Company Logo</label><div class="upload-box">${p.logo?`<img src="${p.logo}" class="logo-preview">`:''}<div class="upload-icon-box">${icon.upload}</div><strong>Upload Company Logo</strong><div class="subdued">PNG, JPG or SVG (max 2MB)</div><label class="btn-yellow btn-small" for="logoInput">Choose File</label><input id="logoInput" type="file" accept="image/*" style="display:none"></div></div>
          <div class="field"><label>Default Timezone</label><select id="timezone"><option ${p.timezone==='Asia/Kolkata'?'selected':''}>Asia/Kolkata</option><option ${p.timezone==='UTC'?'selected':''}>UTC</option><option ${p.timezone==='America/New_York'?'selected':''}>America/New_York</option><option ${p.timezone==='Europe/London'?'selected':''}>Europe/London</option></select></div>
          <div class="field"><label>Default Language</label><select id="language"><option ${p.language==='English'?'selected':''}>English</option><option ${p.language==='Hindi'?'selected':''}>Hindi</option><option ${p.language==='Telugu'?'selected':''}>Telugu</option></select></div>
          <button class="btn-yellow" id="savePlatform">Save Platform Settings</button>
        </div>
      </div>
      <div class="content-card settings-section">
        <div class="settings-head"><div class="settings-icon">${icon.shield}</div><div><strong>Security Settings</strong><span>Manage system security and authentication</span></div></div>
        <div class="settings-body">
          <div class="field"><label>Password Minimum Length</label><input id="minPass" type="number" value="${sec.passwordLength}"><div class="form-note">Minimum characters required for passwords</div></div>
          <div class="field"><label>Failed Login Attempts</label><input id="failAttempts" type="number" value="${sec.failedAttempts}"><div class="form-note">Maximum login attempts before account lock</div></div>
          <div class="field"><label>Session Timeout (minutes)</label><input id="sessionTimeout" type="number" value="${sec.sessionTimeout}"><div class="form-note">Automatic logout after inactivity period</div></div>
          <div class="switch-row"><div class="switch-copy"><strong>Two-Factor Authentication</strong><span>Require 2FA for all admin users</span></div><button class="toggle ${sec.twoFactor?'on':''}" id="twoFactor"></button></div>
          <div style="margin-top:22px"><button class="btn-yellow" id="saveSecurity">Save Security Settings</button></div>
        </div>
      </div>`;
    $('#twoFactor').onclick=()=>$('#twoFactor').classList.toggle('on');
    $('#logoInput').onchange=e=>{
      const file = e.target.files[0]; if(!file) return;
      const reader = new FileReader(); reader.onload = ()=>{ const st = DS.readState(); st.superuser.platform.logo = reader.result; DS.saveState(st); renderSettings(); }; reader.readAsDataURL(file);
    };
    $('#savePlatform').onclick=()=>{ const st = DS.readState(); st.superuser.platform = {name:$('#platformName').value.trim(),timezone:$('#timezone').value.trim(),language:$('#language').value.trim(),logo:st.superuser.platform.logo||''}; DS.saveState(st); if (DS.applyPlatformBranding) DS.applyPlatformBranding(document); showToast('Platform settings saved'); };
    $('#saveSecurity').onclick=()=>{ const st = DS.readState(); st.superuser.security = {passwordLength:+$('#minPass').value||8,failedAttempts:+$('#failAttempts').value||5,sessionTimeout:+$('#sessionTimeout').value||30,twoFactor:$('#twoFactor').classList.contains('on')}; DS.saveState(st); showToast('Security settings saved'); };
  }

async function renderDeliveryRequests(){
  const s = pageLayout('Delivery Requests','Delivery Requests'); 
  if(!s) return;

  $('#pageRoot').innerHTML = `
    <div class="content-card table-card">
      <div class="table-head">
        <h3>Delivery Requests</h3>
        <div class="filters">
          <input id="rqSearch" class="mini-input" placeholder="Search requests">
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Client</th>
            <th>Pickup</th>
            <th>Drop Address</th>
            <th>Type</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="rqBody">
          <tr>
            <td colspan="7" style="text-align:center;color:#b9b9b9;padding:18px">
              Loading deliveries...
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  const render = async ()=>{
    try {
      const q = ($('#rqSearch').value || '').toLowerCase();

      const deliveries = await DeliverySyncAPI.Deliveries.getAll();

      const filtered = deliveries.filter(r =>
        JSON.stringify(r).toLowerCase().includes(q)
      );

      $('#rqBody').innerHTML = filtered.map(r=>{
        const isBlocked = String(r.status || '').toLowerCase() === 'blocked';

        const actionLink = isBlocked
          ? `<a class="action-item" href="unblock-order.html?id=${r.id}">Unblock Order</a>`
          : `<a class="action-item danger-link" href="block-order.html?id=${r.id}">Block Order</a>`;

        return `
          <tr>
            <td>${r.id || '-'}</td>
            <td>${r.customer || '-'}</td>
            <td>${r.pickup || '-'}</td>
            <td>${r.dropoff || '-'}</td>
            <td>${r.type || '-'}</td>
            <td>
              <span class="status-pill ${statusClass(r.status)}">
                ${r.status || '-'}
              </span>
            </td>
            <td>
              <div class="action-menu-wrap">
                <button class="action-trigger dots-trigger" aria-label="Actions">⋯</button>
                <div class="action-menu">
                  <a class="action-item" href="delivery-request-details.html?id=${r.id}">View</a>
                  ${actionLink}
                </div>
              </div>
            </td>
          </tr>
        `;
      }).join('') || `
        <tr>
          <td colspan="7" style="text-align:center;color:#b9b9b9;padding:18px">
            No delivery requests found.
          </td>
        </tr>
      `;

      document.querySelectorAll('.action-menu-wrap').forEach(w=>{
        const b = w.querySelector('.action-trigger');
        const m = w.querySelector('.action-menu');

        b.onclick = (e)=>{
          e.preventDefault();
          e.stopPropagation();
          document.querySelectorAll('.action-menu').forEach(x => x !== m && x.classList.remove('show'));
          m.classList.toggle('show');
        };

        m.onclick = (e)=>e.stopPropagation();
      });

      document.addEventListener('click', ()=>{
        document.querySelectorAll('.action-menu').forEach(m=>m.classList.remove('show'));
      });

    } catch(error) {
      console.error('Failed to load deliveries from backend:', error);

      $('#rqBody').innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;color:#ff6b6b;padding:18px">
            Failed to load deliveries from backend.
          </td>
        </tr>
      `;
    }
  };

  $('#rqSearch').oninput = render;
  await render();
}


async function renderBlockOrder(){
  const session = sessionGuard(); 
  if(!session) return;

  const requestId = params().get('id');

  document.body.className = 'standalone-detail-page';
  document.body.innerHTML = `
    <div class="standalone-detail-wrap">
      <div class="content-card details-card modal-detail-card standalone-modal">
        <div class="details-top">
          <div class="details-title">Block Order</div>
          <button class="close-icon" onclick="location.href='delivery-requests.html'">×</button>
        </div>

        <div class="details-body modal-detail-body one-col" id="blockOrderBody">
          <div style="text-align:center;color:#b9b9b9;padding:30px">
            Loading order details...
          </div>
        </div>

        <div class="detail-footer">
          <a class="btn-dark close-wide" href="delivery-requests.html">Cancel</a>
          <button class="btn-yellow close-wide" id="confirmBlockOrder">Block Order</button>
        </div>
      </div>
    </div>
  `;

  try {
    const r = await DeliverySyncAPI.Deliveries.getOne(requestId);

    document.getElementById('blockOrderBody').innerHTML = `
      <div class="detail-block full">
        <div class="detail-label">Request ID</div>
        <div class="detail-main">${icon.doc}${r.id || '-'}</div>
      </div>

      <div class="detail-block full">
        <div class="detail-label">Client Company</div>
        <div class="detail-main">${icon.user}${r.customer || '-'}</div>
      </div>

      <div class="detail-block full">
        <div class="detail-label">Pickup Address</div>
        <div class="detail-main">${icon.map}${r.pickup || '-'}</div>
      </div>

      <div class="detail-block full">
        <div class="detail-label">Drop Address</div>
        <div class="detail-main">${icon.map}${r.dropoff || '-'}</div>
      </div>

      <div class="detail-block full">
        <div class="detail-label">Current Status</div>
        <div class="detail-main"><span>${r.status || '-'}</span></div>
      </div>

      <div class="field">
        <label>Reason for Blocking</label>
        <textarea id="blockReason" style="width:100%;min-height:140px;resize:vertical;display:block" placeholder="Enter reason for blocking this order"></textarea>
        <div class="error" id="blockReasonError"></div>
      </div>
    `;

    document.getElementById('confirmBlockOrder').onclick = async ()=>{
      const reason = (document.getElementById('blockReason').value || '').trim();

      if(!reason){
        document.getElementById('blockReasonError').textContent = 'Please enter reason for blocking';
        return;
      }

      try {
        await DeliverySyncAPI.Deliveries.block(r.id, reason);
        location.href = 'delivery-requests.html';
      } catch(error) {
        console.error('Failed to block order:', error);
        document.getElementById('blockReasonError').textContent = 'Failed to block order from backend';
      }
    };

  } catch(error) {
    console.error('Failed to load order:', error);

    document.getElementById('blockOrderBody').innerHTML = `
      <div style="text-align:center;color:#ff6b6b;padding:30px">
        Failed to load order details from backend.
      </div>
    `;
  }
}


async function renderUnblockOrder(){
  const session = sessionGuard(); 
  if(!session) return;

  const requestId = params().get('id');

  document.body.className = 'standalone-detail-page';
  document.body.innerHTML = `
    <div class="standalone-detail-wrap">
      <div class="content-card details-card modal-detail-card standalone-modal">
        <div class="details-top">
          <div class="details-title">Unblock Order</div>
          <button class="close-icon" onclick="location.href='delivery-requests.html'">×</button>
        </div>

        <div class="details-body modal-detail-body one-col" id="unblockOrderBody">
          <div style="text-align:center;color:#b9b9b9;padding:30px">
            Loading order details...
          </div>
        </div>

        <div class="detail-footer">
          <a class="btn-dark close-wide" href="delivery-requests.html">Cancel</a>
          <button class="btn-yellow close-wide" id="confirmUnblockOrder">Unblock Order</button>
        </div>
      </div>
    </div>
  `;

  try {
    const r = await DeliverySyncAPI.Deliveries.getOne(requestId);

    document.getElementById('unblockOrderBody').innerHTML = `
      <div class="detail-block full">
        <div class="detail-label">Request ID</div>
        <div class="detail-main">${icon.doc}${r.id || '-'}</div>
      </div>

      <div class="detail-block full">
        <div class="detail-label">Client Company</div>
        <div class="detail-main">${icon.user}${r.customer || '-'}</div>
      </div>

      <div class="detail-block full">
        <div class="detail-label">Pickup Address</div>
        <div class="detail-main">${icon.map}${r.pickup || '-'}</div>
      </div>

      <div class="detail-block full">
        <div class="detail-label">Drop Address</div>
        <div class="detail-main">${icon.map}${r.dropoff || '-'}</div>
      </div>

      <div class="detail-block full">
        <div class="detail-label">Current Status</div>
        <div class="detail-main"><span>${r.status || '-'}</span></div>
      </div>

      <div class="field">
        <label>Reason for Unblocking</label>
        <textarea id="unblockReason" style="width:100%;min-height:140px;resize:vertical;display:block" placeholder="Enter reason for unblocking this order"></textarea>
        <div class="error" id="unblockReasonError"></div>
      </div>
    `;

    document.getElementById('confirmUnblockOrder').onclick = async ()=>{
      const reason = (document.getElementById('unblockReason').value || '').trim();

      if(!reason){
        document.getElementById('unblockReasonError').textContent = 'Please enter reason for unblocking';
        return;
      }

      try {
        await DeliverySyncAPI.Deliveries.unblock(r.id, reason);
        location.href = 'delivery-requests.html';
      } catch(error) {
        console.error('Failed to unblock order:', error);
        document.getElementById('unblockReasonError').textContent = 'Failed to unblock order from backend';
      }
    };

  } catch(error) {
    console.error('Failed to load order:', error);

    document.getElementById('unblockOrderBody').innerHTML = `
      <div style="text-align:center;color:#ff6b6b;padding:30px">
        Failed to load order details from backend.
      </div>
    `;
  }
}
  function renderRequestDetail(){
    const session = sessionGuard(); if(!session) return;
    const s = ensureState();
    const requestId = params().get('id');
    const wf = getWorkflowOrders().find(x=>x.id===requestId);
    const raw = wf || s.superuser.deliveryRequests.find(x=>x.id===requestId) || s.superuser.deliveryRequests[0] || {};
    const mappedStatus = ({ASSIGNED:'Assigned',ACCEPTED:'Accepted',PICKED_UP:'Picked Up',IN_TRANSIT:'In Transit',DELIVERED:'Delivered',INCIDENT_REPORTED:'Incident Reported',BLOCKED:'Blocked'}[String(raw.status||'').toUpperCase()] || raw.status || 'Pending');
    const requestTimeValue = raw.requestTime || raw.time || raw.createdAt || '2024-03-08 09:30 AM';
    const r = {
      id: raw.id || raw.requestId || requestId || 'DR-2024-001',
      customer: raw.customer || raw.clientCompany || raw.client || 'Tech Solutions',
      contact: raw.contact || raw.contactName || raw.fullName || '--',
      pickup: raw.pickup || raw.pickupAddress || '--',
      dropoff: raw.dropoff || raw.dropAddress || raw.drop || raw.destination || '--',
      package: raw.package || raw.packageDetails || raw.instructions || '--',
      type: raw.type || raw.deliveryType || 'Standard',
      requestTime: requestTimeValue,
      status: mappedStatus
    };
    document.body.className = 'standalone-detail-page';
    document.body.innerHTML = `
      <div class="standalone-detail-wrap">
        <div class="content-card details-card modal-detail-card standalone-modal">
          <div class="details-top"><div class="details-title">Request Details</div><button class="close-icon" onclick="location.href='delivery-requests.html'">×</button></div>
          <div class="details-body modal-detail-body one-col">
            <div class="detail-block full"><div class="detail-label">Request ID</div><div class="detail-main">${icon.doc}${r.id}</div></div>
            <div class="detail-block full"><div class="detail-label">Client Company</div><div class="detail-main">${icon.user}${r.customer}</div><div class="detail-sub">${r.contact}</div></div>
            <div class="detail-block full"><div class="detail-label">Pickup Address</div><div class="detail-main">${icon.map}${r.pickup}</div></div>
            <div class="detail-block full"><div class="detail-label">Drop Address</div><div class="detail-main">${icon.map}${r.dropoff}</div></div>
            <div class="detail-block full"><div class="detail-label">Package Details</div><div class="detail-main">${icon.package}${r.package}</div></div>
            <div class="detail-block full"><div class="detail-label">Delivery Type</div><div class="detail-main"><span class="small-pill">${r.type}</span></div></div>
            <div class="detail-block full"><div class="detail-label">Request Time</div><div class="detail-main">${icon.calendar}${r.requestTime}</div></div>
            <div class="detail-block full"><div class="detail-label">Current Status</div><div class="detail-main">${icon.map}<span>${r.status}</span></div></div>
          </div>
          <div class="detail-footer"><a class="btn-yellow close-wide" href="delivery-requests.html">Close</a></div>
        </div>
      </div>`;
  }

  async function renderTrips(){
  const s = pageLayout('Trips Monitoring','Trips Monitoring'); 
  if(!s) return;

  $('#pageRoot').innerHTML = `
    <div class="content-card table-card">
      <div class="table-head">
        <h3>Trip Monitoring</h3>
        <div class="filters">
          <input id="tripSearch" class="mini-input" placeholder="Search trips">
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Trip ID</th>
            <th>Driver</th>
            <th>Vehicle</th>
            <th>Pickup</th>
            <th>Destination</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="tripBody">
          <tr>
            <td colspan="7" style="text-align:center;color:#b9b9b9;padding:18px">
              Loading trips...
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  const render = async ()=>{
    try {
      const q = ($('#tripSearch').value || '').toLowerCase();

      const trips = await DeliverySyncAPI.Trips.getAll();

      const filtered = trips.filter(t =>
        JSON.stringify(t).toLowerCase().includes(q)
      );

      $('#tripBody').innerHTML = filtered.map(t=>`
        <tr>
          <td>${t.id || '-'}</td>
          <td>${t.driver || '-'}</td>
          <td>${t.vehicle || '-'}</td>
          <td>${t.pickup || '-'}</td>
          <td>${t.destination || '-'}</td>
          <td>
            <span class="status-pill ${statusClass(t.status)}">
              ${t.status || '-'}
            </span>
          </td>
          <td>
            <div class="action-menu-wrap">
              <button class="action-trigger dots-trigger" aria-label="Actions">⋯</button>
              <div class="action-menu">
                <a class="action-item" href="trip-details.html?id=${t.id}">View Trip</a>
                <a class="action-item" href="trip-details.html?id=${t.id}">Reassign Driver</a>
              </div>
            </div>
          </td>
        </tr>
      `).join('') || `
        <tr>
          <td colspan="7" style="text-align:center;color:#b9b9b9;padding:18px">
            No trips found.
          </td>
        </tr>
      `;

      document.querySelectorAll('.action-menu-wrap').forEach(w=>{
        const b = w.querySelector('.action-trigger');
        const m = w.querySelector('.action-menu');

        b.onclick = (e)=>{
          e.preventDefault();
          e.stopPropagation();
          document.querySelectorAll('.action-menu').forEach(x => x !== m && x.classList.remove('show'));
          m.classList.toggle('show');
        };

        m.onclick = (e)=>e.stopPropagation();
      });

      document.addEventListener('click', ()=>{
        document.querySelectorAll('.action-menu').forEach(m=>m.classList.remove('show'));
      });

    } catch(error) {
      console.error('Failed to load trips from backend:', error);

      $('#tripBody').innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;color:#ff6b6b;padding:18px">
            Failed to load trips from backend.
          </td>
        </tr>
      `;
    }
  };

  $('#tripSearch').oninput = render;
  await render();
}

async function renderVehicles(){
  const s = pageLayout('Vehicle Management','Vehicles');
  if(!s) return;

  $('#pageRoot').innerHTML = `
    <div class="content-card table-card">
      <div class="table-head">
        <h3>Vehicle Management</h3>
        <div class="filters">
          <input id="vehicleSearch" class="mini-input" placeholder="Search vehicles...">
          <button class="btn-yellow" id="addVehicleBtn">+ Add Vehicle</button>
        </div>
      </div>

      <div style="display:flex;gap:12px;flex-wrap:wrap;padding:0 20px 20px">
        <button class="btn-dark vehicle-filter active" data-filter="all">All Vehicles</button>
        <button class="btn-dark vehicle-filter" data-filter="active">Active</button>
        <button class="btn-dark vehicle-filter" data-filter="on trip">On Trip</button>
        <button class="btn-dark vehicle-filter" data-filter="maintenance">Maintenance</button>
        <button class="btn-dark vehicle-filter" data-filter="blocked">Blocked</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Vehicle ID</th>
            <th>Plate Number</th>
            <th>Type</th>
            <th>Status</th>
            <th>Last Maintenance</th>
            <th>Availability</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="vehicleBody">
          <tr>
            <td colspan="7" style="text-align:center;color:#b9b9b9;padding:18px">
              Loading vehicles...
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  let currentFilter = 'all';

  function getAvailability(status){
    const value = String(status || '').toLowerCase();
    if(value.includes('active')) return 'Available';
    if(value.includes('on trip')) return 'Unavailable';
    if(value.includes('maintenance')) return 'Unavailable';
    if(value.includes('blocked')) return 'Unavailable';
    return 'Unavailable';
  }

  async function render(){
    try {
      const q = ($('#vehicleSearch').value || '').toLowerCase();
      const vehicles = await DeliverySyncAPI.Vehicles.getAll();

      const filtered = (vehicles || []).filter(function(v){
        const text = JSON.stringify(v || {}).toLowerCase();
        const status = String((v || {}).status || '').toLowerCase();
        const matchesSearch = text.includes(q);
        const matchesFilter = currentFilter === 'all' || status === currentFilter;
        return matchesSearch && matchesFilter;
      });

      $('#vehicleBody').innerHTML = filtered.map(function(v){
        const availability = v.availability || getAvailability(v.status);
        return `
          <tr>
            <td>${v.id || '-'}</td>
            <td>${v.plate || v.plateNumber || '-'}</td>
            <td>${v.type || '-'}</td>
            <td>
              <span class="status-pill ${statusClass(v.status)}">
                ${v.status || '-'}
              </span>
            </td>
            <td>${v.maintenance || v.lastMaintenance || '—'}</td>
            <td>
              <span class="status-pill ${availability === 'Available' ? 'active' : 'blocked'}">
                ${availability}
              </span>
            </td>
            <td>
              <div class="action-menu-wrap">
                <button class="action-trigger dots-trigger" aria-label="Actions">⋯</button>
                <div class="action-menu">
                  <a class="action-item" href="vehicle-details.html?id=${v.id}">View Vehicle</a>
                  <a class="action-item" href="edit-vehicle.html?id=${v.id}">Edit Vehicle</a>
                  <button class="action-item danger-link delete-vehicle-btn" data-id="${v.id}">
    Delete Vehicle
  </button>
                </div>
              </div>
            </td>
          </tr>
        `;
      }).join('') || `
        <tr>
          <td colspan="7" style="text-align:center;color:#b9b9b9;padding:18px">
            No vehicles found.
          </td>
        </tr>
      `;

      document.querySelectorAll('.action-menu-wrap').forEach(function(w){
        const b = w.querySelector('.action-trigger');
        const m = w.querySelector('.action-menu');
        if(!b || !m) return;

        b.onclick = function(e){
          e.preventDefault();
          e.stopPropagation();
          document.querySelectorAll('.action-menu').forEach(function(menu){
            if(menu !== m) menu.classList.remove('show');
          });
          m.classList.toggle('show');
        };

        m.onclick = function(e){
          e.stopPropagation();
        };
      });
      document.querySelectorAll('.delete-vehicle-btn').forEach(function(btn){
  btn.onclick = async function(e){
    e.preventDefault();
    e.stopPropagation();

    const id = btn.dataset.id;

    if(!id){
      alert('Vehicle ID not found');
      return;
    }

    const ok = confirm(`Delete vehicle ${id}?`);
    if(!ok) return;

    try {
      await DeliverySyncAPI.Vehicles.delete(id);
      showToast('Vehicle deleted successfully');
      await render();
    } catch(error) {
      console.error('Failed to delete vehicle:', error);
      alert('Failed to delete vehicle from backend');
    }
  };
});
    } catch(error) {
      console.error('Failed to load vehicles from backend:', error);
      $('#vehicleBody').innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;color:#ff6b6b;padding:18px">
            Failed to load vehicles from backend.
          </td>
        </tr>
      `;
    }
  }

  $('#vehicleSearch').oninput = render;

  document.querySelectorAll('.vehicle-filter').forEach(function(btn){
    btn.onclick = function(){
      document.querySelectorAll('.vehicle-filter').forEach(function(b){
        b.classList.remove('active');
      });
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render();
    };
  });

  const addBtn = $('#addVehicleBtn');
  if(addBtn){
    addBtn.onclick = function(){
      location.href = 'add-vehicle.html';
    };
  }

  document.addEventListener('click', function(){
    document.querySelectorAll('.action-menu').forEach(function(m){
      m.classList.remove('show');
    });
  });

  await render();
}

async function renderAddVehicle(){
  const session = sessionGuard();
  if(!session) return;

  const today = new Date().toISOString().split('T')[0];

  document.body.className = 'standalone-detail-page';
  document.body.innerHTML = `
    <div class="standalone-detail-wrap">
      <div class="content-card form-card standalone-modal" style="max-width:760px;margin:0 auto">
        <div class="details-top">
          <div class="details-title">Add Vehicle</div>
          <button class="close-icon" onclick="location.href='vehicles.html'">×</button>
        </div>

        <div style="padding:20px">
          <div class="grid-2" style="gap:18px">
            <div class="field">
              <label>Plate Number</label>
              <input id="plateNumber" placeholder="e.g. TN09AB1234">
              <div class="error" id="err-plateNumber"></div>
            </div>

            <div class="field">
              <label>Type</label>
              <select id="vehicleType">
                <option value="">Select type</option>
                <option>Mini Truck</option>
                <option>Van</option>
                <option>Truck</option>
                <option>Bike</option>
                <option>SUV</option>
                <option>Cargo Van</option>
              </select>
              <div class="error" id="err-vehicleType"></div>
            </div>
          </div>

          <div class="grid-2" style="gap:18px">
            <div class="field">
              <label>Capacity</label>
              <input id="capacity" placeholder="e.g. 2 Tons">
            </div>

            <div class="field">
              <label>Status</label>
              <select id="vehicleStatus">
                <option>Active</option>
                <option>On Trip</option>
                <option>Maintenance</option>
                <option>Blocked</option>
              </select>
            </div>
          </div>

          <div class="field">
            <label>Last Maintenance</label>
            <input id="lastMaintenance" type="date" max="${today}">
            <div class="error" id="err-lastMaintenance"></div>
          </div>

          <div class="form-actions">
            <a class="btn-dark" href="vehicles.html">Cancel</a>
            <button class="btn-yellow" id="saveVehicleBtn">Add Vehicle</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('saveVehicleBtn').onclick = async function(){
    const plate = document.getElementById('plateNumber').value.trim();
    const type = document.getElementById('vehicleType').value.trim();
    const capacity = document.getElementById('capacity').value.trim();
    const status = document.getElementById('vehicleStatus').value;
    const lastMaintenance = document.getElementById('lastMaintenance').value.trim();

    document.getElementById('err-plateNumber').textContent = '';
    document.getElementById('err-vehicleType').textContent = '';
    document.getElementById('err-lastMaintenance').textContent = '';

    let ok = true;

    if(!plate){
      document.getElementById('err-plateNumber').textContent = 'Plate number is required';
      ok = false;
    }

    if(!type){
      document.getElementById('err-vehicleType').textContent = 'Vehicle type is required';
      ok = false;
    }

    if(lastMaintenance && lastMaintenance > today){
      document.getElementById('err-lastMaintenance').textContent = 'Future maintenance date is not allowed';
      ok = false;
    }

    if(!ok) return;

    const payload = {
      plate,
      type,
      capacity,
      status,
      assignedDriver: '',
      maintenance: lastMaintenance
    };

    try {
      await DeliverySyncAPI.Vehicles.create(payload);
      location.href = 'vehicles.html';
    } catch(error) {
      console.error('Failed to add vehicle:', error);
      alert('Failed to add vehicle from backend');
    }
  };
}

async function renderVehicleDetails(){
  const session = sessionGuard();
  if(!session) return;

  const vehicleId = params().get('id');

  document.body.className = 'standalone-detail-page';
  document.body.innerHTML = `
    <div class="standalone-detail-wrap">
      <div class="content-card details-card modal-detail-card standalone-modal">
        <div class="details-top">
          <div class="details-title">Vehicle Details</div>
          <button class="close-icon" onclick="location.href='vehicles.html'">×</button>
        </div>

        <div class="details-body modal-detail-body one-col" id="vehicleDetailsBody">
          <div style="text-align:center;color:#b9b9b9;padding:30px">
            Loading vehicle details...
          </div>
        </div>

        <div class="detail-footer">
          <a class="btn-yellow close-wide" href="vehicles.html">Back to Vehicles</a>
        </div>
      </div>
    </div>
  `;

  try {
    const v = await DeliverySyncAPI.Vehicles.getOne(vehicleId);
    const statusValue = String((v || {}).status || '').toLowerCase();
    const availability = (v || {}).availability || (statusValue.includes('active') ? 'Available' : 'Unavailable');

    document.getElementById('vehicleDetailsBody').innerHTML = `
      <div class="detail-block full">
        <div class="detail-label">Vehicle ID</div>
        <div class="detail-main">${v.id || '-'}</div>
      </div>

      <div class="detail-block full">
        <div class="detail-label">Plate Number</div>
        <div class="detail-main">${v.plate || v.plateNumber || '-'}</div>
      </div>

      <div class="detail-block full">
        <div class="detail-label">Type</div>
        <div class="detail-main">${v.type || '-'}</div>
      </div>

      <div class="detail-block full">
        <div class="detail-label">Status</div>
        <div class="detail-main">
          <span class="status-pill ${statusClass(v.status)}">${v.status || '-'}</span>
        </div>
      </div>

      <div class="detail-block full">
        <div class="detail-label">Last Maintenance</div>
        <div class="detail-main">${v.maintenance || v.lastMaintenance || '—'}</div>
      </div>

      <div class="detail-block full">
        <div class="detail-label">Availability</div>
        <div class="detail-main">
          <span class="status-pill ${availability === 'Available' ? 'active' : 'blocked'}">
            ${availability}
          </span>
        </div>
      </div>
    `;
  } catch(error) {
    console.error('Failed to load vehicle details:', error);
    document.getElementById('vehicleDetailsBody').innerHTML = `
      <div style="text-align:center;color:#ff6b6b;padding:30px">
        Failed to load vehicle details from backend.
      </div>
    `;
  }
}

async function renderEditVehicle(){
  const session = sessionGuard();
  if(!session) return;

  const vehicleId = params().get('id');
  const today = new Date().toISOString().split('T')[0];

  document.body.className = 'standalone-detail-page';
  document.body.innerHTML = `
    <div class="standalone-detail-wrap">
      <div class="content-card form-card standalone-modal" style="max-width:760px;margin:0 auto">
        <div class="details-top">
          <div class="details-title">Edit Vehicle</div>
          <button class="close-icon" onclick="location.href='vehicles.html'">×</button>
        </div>

        <div id="editVehicleBody" style="padding:20px">
          <div style="text-align:center;color:#b9b9b9;padding:30px">
            Loading vehicle...
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const v = await DeliverySyncAPI.Vehicles.getOne(vehicleId);

    document.getElementById('editVehicleBody').innerHTML = `
      <div class="grid-2" style="gap:18px">
        <div class="field">
          <label>Vehicle ID</label>
          <input id="vehicleId" value="${v.id || ''}" disabled>
        </div>

        <div class="field">
          <label>Plate Number</label>
          <input id="plateNumber" value="${v.plate || v.plateNumber || ''}">
          <div class="error" id="err-plateNumber"></div>
        </div>
      </div>

      <div class="grid-2" style="gap:18px">
        <div class="field">
          <label>Type</label>
          <input id="vehicleType" value="${v.type || ''}">
          <div class="error" id="err-vehicleType"></div>
        </div>

        <div class="field">
          <label>Status</label>
          <select id="vehicleStatus">
            <option ${v.status === 'Active' ? 'selected' : ''}>Active</option>
            <option ${v.status === 'On Trip' ? 'selected' : ''}>On Trip</option>
            <option ${v.status === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
            <option ${v.status === 'Blocked' ? 'selected' : ''}>Blocked</option>
          </select>
        </div>
      </div>

      <div class="field">
        <label>Last Maintenance</label>
        <input id="lastMaintenance" type="date" value="${v.maintenance || v.lastMaintenance || ''}" max="${today}">
        <div class="error" id="err-lastMaintenance"></div>
      </div>

      <div class="form-actions">
        <a class="btn-dark" href="vehicles.html">Cancel</a>
        <button class="btn-yellow" id="saveVehicleBtn">Save Changes</button>
      </div>
    `;

    document.getElementById('saveVehicleBtn').onclick = async function(){
      const plate = document.getElementById('plateNumber').value.trim();
      const type = document.getElementById('vehicleType').value.trim();
      const status = document.getElementById('vehicleStatus').value;
      const lastMaintenance = document.getElementById('lastMaintenance').value.trim();

      document.getElementById('err-plateNumber').textContent = '';
      document.getElementById('err-vehicleType').textContent = '';
      document.getElementById('err-lastMaintenance').textContent = '';

      let ok = true;

      if(!plate){
        document.getElementById('err-plateNumber').textContent = 'Plate number is required';
        ok = false;
      }

      if(!type){
        document.getElementById('err-vehicleType').textContent = 'Vehicle type is required';
        ok = false;
      }

      if(!lastMaintenance){
        document.getElementById('err-lastMaintenance').textContent = 'Last maintenance date is required';
        ok = false;
      }

      if(lastMaintenance && lastMaintenance > today){
        document.getElementById('err-lastMaintenance').textContent = 'Future date is not allowed';
        ok = false;
      }

      if(!ok) return;

      const payload = {
        plate,
        type,
        status,
        capacity: v.capacity || '',
        assignedDriver: v.assignedDriver || '',
        maintenance: lastMaintenance
      };

      try {
        await DeliverySyncAPI.Vehicles.update(v.id, payload);
        location.href = 'vehicles.html';
      } catch(error) {
        console.error('Failed to update vehicle:', error);
        alert('Failed to update vehicle from backend');
      }
    };
  } catch(error) {
    console.error('Failed to load vehicle:', error);
    document.getElementById('editVehicleBody').innerHTML = `
      <div style="text-align:center;color:#ff6b6b;padding:30px">
        Failed to load vehicle from backend.
      </div>
    `;
  }
}

async function renderMaintenance(){
  const s = pageLayout('Maintenance','Maintenance');
  if(!s) return;

  $('#pageRoot').innerHTML = `
    <div class="content-card table-card">
      <div class="table-head">
        <h3>Maintenance Management</h3>
        <div class="filters">
          <input id="maintSearch" class="mini-input" placeholder="Search maintenance...">
          <a class="btn-yellow" href="schedule-maintenance.html">Schedule Maintenance</a>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Vehicle</th>
            <th>Issue</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Scheduled Date</th>
            <th>Mechanic</th>
            <th>Est. Cost</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="maintBody">
          <tr>
            <td colspan="9" style="text-align:center;color:#b9b9b9;padding:18px">
              Loading maintenance records...
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  async function render(){
    try {
      const q = ($('#maintSearch').value || '').trim();

      const list = await DeliverySyncAPI.Maintenance.getAll(q);

      $('#maintBody').innerHTML = (list || []).map(function(r){
        return `
          <tr>
            <td>${r.id || '-'}</td>
            <td>${r.vehicle || r.vehicleId || '-'}</td>
            <td>${r.issue || '-'}</td>
            <td>
              <span class="status-pill ${statusClass(r.priority)}">
                ${r.priority || '-'}
              </span>
            </td>
            <td>
              <span class="status-pill ${statusClass(r.status)}">
                ${r.status || '-'}
              </span>
            </td>
            <td>${r.date || r.scheduledDate || '-'}</td>
            <td>${r.mechanic || '-'}</td>
            <td>${r.cost || r.estimatedCost || '-'}</td>
            <td>
              <div class="action-menu-wrap">
                <button class="action-trigger dots-trigger" aria-label="Actions">⋯</button>
                <div class="action-menu">
                  <a class="action-item" href="schedule-maintenance.html?id=${r.id}">Edit</a>
                  <button class="action-item delete-maint danger-link" data-id="${r.id}">
                    Delete
                  </button>
                </div>
              </div>
            </td>
          </tr>
        `;
      }).join('') || `
        <tr>
          <td colspan="9" style="text-align:center;color:#b9b9b9;padding:18px">
            No maintenance records found.
          </td>
        </tr>
      `;

      document.querySelectorAll('.action-menu-wrap').forEach(function(w){
        const b = w.querySelector('.action-trigger');
        const m = w.querySelector('.action-menu');

        if(!b || !m) return;

        b.onclick = function(e){
          e.preventDefault();
          e.stopPropagation();

          document.querySelectorAll('.action-menu').forEach(function(menu){
            if(menu !== m) menu.classList.remove('show');
          });

          m.classList.toggle('show');
        };

        m.onclick = function(e){
          e.stopPropagation();
        };
      });

      document.querySelectorAll('.delete-maint').forEach(function(btn){
        btn.onclick = async function(e){
          e.preventDefault();
          e.stopPropagation();

          const id = btn.dataset.id;

          if(!id){
            alert('Maintenance ID not found');
            return;
          }

          const ok = confirm(`Delete maintenance record ${id}?`);
          if(!ok) return;

          try {
            await DeliverySyncAPI.Maintenance.delete(id);
            showToast('Maintenance record deleted successfully');
            await render();
          } catch(error) {
            console.error('Failed to delete maintenance record:', error);
            alert('Failed to delete maintenance record from backend');
          }
        };
      });

      document.addEventListener('click', function(){
        document.querySelectorAll('.action-menu').forEach(function(m){
          m.classList.remove('show');
        });
      });

    } catch(error) {
      console.error('Failed to load maintenance records from backend:', error);

      $('#maintBody').innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center;color:#ff6b6b;padding:18px">
            Failed to load maintenance records from backend.
          </td>
        </tr>
      `;
    }
  }

  $('#maintSearch').oninput = render;
  await render();
}

async function renderScheduleMaintenance(){
  const s = pageLayout('Schedule Maintenance','Maintenance'); 
  if(!s) return;

  const editId = params().get('id');

  const mechanics = ['Ravi Auto Service','SpeedFix Workshop','AutoCare Pro'];
  const issueTypes = [
    'Engine Oil Change',
    'Brake Pad Replacement',
    'Tire Rotation & Balance',
    'Air Filter Replacement',
    'Transmission Service'
  ];

  let existing = null;
  let vehicles = [];

  try {
    vehicles = await DeliverySyncAPI.Vehicles.getAll();

    if(editId){
      existing = await DeliverySyncAPI.Maintenance.getOne(editId);
    }
  } catch(error) {
    console.error('Failed to load schedule maintenance data:', error);
  }

  const vehicleOptions = (vehicles || []).map(function(v){
    const plate = v.plate || v.plateNumber || v.id || '';
    return `
      <option value="${plate}" ${existing && (existing.vehicle === plate || existing.vehicleId === plate) ? 'selected' : ''}>
        ${plate}
      </option>
    `;
  }).join('');

  $('#pageRoot').innerHTML = `
    <div class="schedule-grid" style="display:grid;grid-template-columns:1.9fr 1fr;gap:24px;align-items:start">
      <div style="display:grid;gap:24px">
        <div class="content-card form-card" style="padding:28px;border-radius:24px">
          <h3 style="margin:0 0 22px 0;color:#f7d10a;font-size:18px;font-weight:800">
            Vehicle & Issue Details
          </h3>

          <div class="field">
            <label>Vehicle *</label>
            <select id="mVehicle">
              <option value="">Select vehicle</option>
              ${vehicleOptions}
            </select>
            <div class="error" id="err-mVehicle"></div>
          </div>

          <div class="field">
            <label>Issue Type *</label>
            <select id="mIssue">
              <option value="">Select issue</option>
              ${issueTypes.map(function(v){
                return `<option value="${v}" ${existing && existing.issue === v ? 'selected' : ''}>${v}</option>`;
              }).join('')}
            </select>
            <div class="error" id="err-mIssue"></div>
          </div>

          <div class="field">
            <label>Priority *</label>
            <select id="mPriority">
              ${['Low','Medium','High','Critical'].map(function(v){
                const selected = existing 
                  ? existing.priority === v 
                  : v === 'Medium';
                return `<option value="${v}" ${selected ? 'selected' : ''}>${v}</option>`;
              }).join('')}
            </select>
          </div>
        </div>

        <div class="content-card form-card" style="padding:28px;border-radius:24px">
          <h3 style="margin:0 0 22px 0;color:#f7d10a;font-size:18px;font-weight:800">
            Additional Notes
          </h3>

          <div class="field" style="margin-bottom:0">
            <textarea 
              id="mNotes" 
              placeholder="Enter any special instructions or notes for the mechanic..." 
              style="min-height:210px;height:210px;resize:vertical;border-radius:20px;padding:18px"
            >${existing && existing.notes ? existing.notes : ''}</textarea>
          </div>
        </div>
      </div>

      <div style="display:grid;gap:24px">
        <div class="content-card form-card" style="padding:28px;border-radius:24px">
          <h3 style="margin:0 0 22px 0;color:#f7d10a;font-size:18px;font-weight:800">
            Scheduling & Assignment
          </h3>

          <div class="field">
            <label>Scheduled Date *</label>
            <input 
              id="mDate" 
              type="date" 
              value="${existing ? (existing.date || existing.scheduledDate || '') : ''}"
            >
            <div class="error" id="err-mDate"></div>
          </div>

          <div class="field">
            <label>Assigned Mechanic *</label>
            <select id="mMechanic">
              <option value="">Select mechanic</option>
              ${mechanics.map(function(v){
                return `<option value="${v}" ${existing && existing.mechanic === v ? 'selected' : ''}>${v}</option>`;
              }).join('')}
            </select>
            <div class="error" id="err-mMechanic"></div>
          </div>

          <div class="field">
            <label>Estimated Cost (₹)</label>
            <input 
              id="mCost" 
              placeholder="e.g. 2500" 
              value="${existing && existing.cost ? String(existing.cost).replace(/[₹,]/g,'') : ''}"
            >
            <div class="error" id="err-mCost"></div>
          </div>
        </div>

        <div class="content-card form-card" style="padding:28px;border-radius:24px">
          <h3 style="margin:0 0 22px 0;color:#f7d10a;font-size:18px;font-weight:800">
            Summary Preview
          </h3>

          <div class="summary-row">
            <span>Vehicle</span>
            <strong id="sumVehicle">—</strong>
          </div>
          <div class="summary-row">
            <span>Issue</span>
            <strong id="sumIssue">—</strong>
          </div>
          <div class="summary-row">
            <span>Priority</span>
            <strong id="sumPriority">—</strong>
          </div>
          <div class="summary-row">
            <span>Date</span>
            <strong id="sumDate">—</strong>
          </div>
          <div class="summary-row">
            <span>Mechanic</span>
            <strong id="sumMechanic">—</strong>
          </div>
          <div class="summary-row">
            <span>Cost</span>
            <strong id="sumCost">—</strong>
          </div>

          <div class="form-actions" style="margin-top:24px">
            <a class="btn-dark" href="maintenance.html">Cancel</a>
            <button class="btn-yellow" id="saveMaint">
              ${existing ? 'Update Maintenance' : 'Schedule Maintenance'}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll('#pageRoot input, #pageRoot select, #pageRoot textarea').forEach(function(el){
    el.style.background = '#1f1f22';
    el.style.border = '1px solid #2c2c31';
    el.style.borderRadius = '18px';
    if(el.tagName !== 'TEXTAREA') el.style.minHeight = '58px';
  });

  document.querySelectorAll('#pageRoot .field').forEach(function(f){
    f.style.marginBottom = '18px';
  });

  function updateSummary(){
    const vehicle = $('#mVehicle')?.value || '—';
    const issue = $('#mIssue')?.value || '—';
    const priority = $('#mPriority')?.value || '—';
    const date = $('#mDate')?.value || '—';
    const mechanic = $('#mMechanic')?.value || '—';
    const costRaw = $('#mCost')?.value.trim() || '';
    const cost = costRaw ? `₹${costRaw}` : '—';

    if($('#sumVehicle')) $('#sumVehicle').textContent = vehicle;
    if($('#sumIssue')) $('#sumIssue').textContent = issue;
    if($('#sumPriority')) $('#sumPriority').textContent = priority;
    if($('#sumDate')) $('#sumDate').textContent = date;
    if($('#sumMechanic')) $('#sumMechanic').textContent = mechanic;
    if($('#sumCost')) $('#sumCost').textContent = cost;
  }

  ['mVehicle','mIssue','mPriority','mDate','mMechanic','mCost'].forEach(function(id){
    const el = document.getElementById(id);
    if(el){
      el.addEventListener('input', updateSummary);
      el.addEventListener('change', updateSummary);
    }
  });

  updateSummary();

  $('#saveMaint').onclick = async function(){
    ['mVehicle','mIssue','mDate','mMechanic','mCost'].forEach(function(id){
      const err = $('#err-' + id);
      if(err) err.textContent = '';
    });

    let ok = true;

    const vehicle = $('#mVehicle').value.trim();
    const issue = $('#mIssue').value.trim();
    const priority = $('#mPriority').value.trim();
    const date = $('#mDate').value.trim();
    const mechanic = $('#mMechanic').value.trim();
    const cost = $('#mCost').value.trim();
    const notes = $('#mNotes').value.trim();

    if(!vehicle){
      $('#err-mVehicle').textContent = 'Select a valid vehicle';
      ok = false;
    }

    if(!issueTypes.includes(issue)){
      $('#err-mIssue').textContent = 'Select a valid issue type';
      ok = false;
    }

    if(!date){
      $('#err-mDate').textContent = 'Date is required';
      ok = false;
    }

    if(!mechanics.includes(mechanic)){
      $('#err-mMechanic').textContent = 'Select an assigned mechanic';
      ok = false;
    }

   if(cost && !/^\d{1,7}(\.\d{1,2})?$/.test(cost)){
  $('#err-mCost').textContent = 'Enter a valid cost in rupees';
  ok = false;
}

    if(notes.length > 300){
      showToast('Additional notes should be 300 characters or less.');
      ok = false;
    }

    if(!ok) return;

    const payload = {
      vehicle,
      issue,
      priority,
      date,
      mechanic,
      cost: cost ? `₹${cost}` : '--',
      notes
    };

    try {
      if(existing && existing.id){
        await DeliverySyncAPI.Maintenance.update(existing.id, payload);
      } else {
        await DeliverySyncAPI.Maintenance.create(payload);
      }

      location.href = 'maintenance.html';
    } catch(error) {
      console.error('Failed to save maintenance from backend:', error);
      alert('Failed to save maintenance from backend');
    }
  };
}
function renderTripDetail(){
  const session = sessionGuard(); 
  if(!session) return;

  const s = ensureState();
  const orderId = params().get('order');

  const wf = orderId ? getWorkflowOrders().find(x => x.id === orderId) : null;

  const raw = wf ? {
    id: params().get('id') || `TR-${String(wf.id).replace(/\D/g,'')}`,
    assignment: `ASN-${String(wf.id).replace(/\D/g,'')}`,
    driver: wf.assignedDriver || 'Assigning',
    phone: '',
    vehicle: 'TN-09-AB-2345',
    vehicleType: wf.deliveryType || 'Standard',
    pickup: wf.pickup || '--',
    destination: wf.drop || '--',
    startTime: wf.createdAt || '--',
    distance: `${wf.eta || 35} mins`,
    status: ({
      ASSIGNED:'Assigning',
      ACCEPTED:'Accepted',
      PICKED_UP:'Picked Up',
      IN_TRANSIT:'In Transit',
      DELIVERED:'Delivered',
      INCIDENT_REPORTED:'Incident Reported',
      BLOCKED:'Blocked'
    }[wf.status] || 'Pending'),
    _workflowOrderId: wf.id
  } : (s.superuser.trips.find(x => x.id === params().get('id')) || s.superuser.trips[0] || {});

  const r = {
    id: raw.id || raw.tripId || 'TRP-2024-001',
    assignment: raw.assignment || raw.assignmentId || 'ASN-2024-156',
    driver: raw.driver || raw.driverName || 'Rahul',
    phone: raw.phone || raw.driverPhone || '+91 98765 43210',
    vehicle: raw.vehicle || raw.vehicleNumber || 'DL-01-AB-1234',
    vehicleType: raw.vehicleType || raw.vehicleModel || 'Cargo Van',
    pickup: raw.pickup || raw.pickupLocation || 'Gurgaon, Haryana',
    destination: raw.destination || raw.dropoff || 'Connaught Place, New Delhi',
    startTime: raw.startTime || raw.time || '2024-03-08 09:00 AM',
    distance: raw.distance || '28.5 km',
    status: raw.status || 'In Transit'
  };

  document.body.className = 'standalone-detail-page';

  document.body.innerHTML = `
    <div class="standalone-detail-wrap">
      <div class="content-card details-card modal-detail-card trip-modal-card standalone-modal">
        <div class="details-top">
          <div class="details-title">Trip Details</div>

          <div class="action-menu-wrap" style="margin-left:auto;margin-right:10px">
            <button class="action-trigger" id="tripActionsBtn">Actions ▾</button>
            <div class="action-menu" id="tripActionsMenu">
              <button class="action-item" id="reassignBtn">Reassign Driver</button>
            </div>
          </div>

          <button class="close-icon" onclick="location.href='trip-monitoring.html'">×</button>
        </div>

        <div class="details-body modal-detail-body">
          <div class="detail-block">
            <div class="detail-label">Trip ID</div>
            <div class="detail-main">${icon.vehicle}${r.id}</div>
          </div>

          <div class="detail-block">
            <div class="detail-label">Assignment ID</div>
            <div class="detail-main">${icon.doc}${r.assignment}</div>
          </div>

          <div class="detail-block full">
            <div class="detail-label">Driver Information</div>
            <div class="value-box">
              <div class="detail-main">${icon.user}${r.driver}</div>
              <div class="detail-sub">${r.phone}</div>
            </div>
          </div>

          <div class="detail-block full">
            <div class="detail-label">Vehicle Details</div>
            <div class="value-box">
              <div class="detail-main">${icon.vehicle}${r.vehicle}</div>
              <div class="detail-sub">${r.vehicleType}</div>
            </div>
          </div>

          <div class="detail-block full">
            <div class="detail-label">Pickup Location</div>
            <div class="detail-main">${icon.map}${r.pickup}</div>
          </div>

          <div class="detail-block full">
            <div class="detail-label">Destination</div>
            <div class="detail-main">${icon.map}${r.destination}</div>
          </div>

          <div class="detail-block">
            <div class="detail-label">Start Time</div>
            <div class="detail-main">${icon.calendar}${r.startTime}</div>
          </div>

          <div class="detail-block">
            <div class="detail-label">Distance</div>
            <div class="detail-main"><span class="small-pill">${r.distance}</span></div>
          </div>

          <div class="detail-block full">
            <div class="detail-label">Trip Status</div>
            <div class="detail-main">${icon.vehicle}${r.status}</div>
          </div>
        </div>

        <div class="detail-footer">
          <a class="btn-yellow close-wide" href="trip-monitoring.html">Close</a>
        </div>
      </div>

      <div class="modal-overlay" id="reassignModal" style="display:none">
        <div class="content-card form-card" style="max-width:520px;margin:0 auto">
          <h2 style="margin-bottom:8px">Reassign Driver</h2>

          <div class="field">
            <label>Select Driver</label>
            <select id="newDriver"></select>
            <div class="error" id="err-newDriver"></div>
          </div>

          <div class="form-actions">
            <button class="btn-dark" id="cancelReassign" type="button">Cancel</button>
            <button class="btn-yellow" id="saveReassign" type="button">Save</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Trip actions menu
  const actBtn = document.getElementById('tripActionsBtn');
  const actMenu = document.getElementById('tripActionsMenu');

  if(actBtn && actMenu){
    actBtn.onclick = (e)=>{
      actMenu.classList.toggle('show');
      e.stopPropagation();
    };

    document.addEventListener('click', ()=>{
      actMenu.classList.remove('show');
    });
  }

  const modal = document.getElementById('reassignModal');
  const reBtn = document.getElementById('reassignBtn');

  if(reBtn && modal){
    reBtn.onclick = async ()=>{
      actMenu && actMenu.classList.remove('show');

      const sel = document.getElementById('newDriver');
      const err = document.getElementById('err-newDriver');

      if(err) err.textContent = '';

      sel.innerHTML = `<option value="">Loading drivers...</option>`;
      modal.style.display = 'block';

      try {
        const drivers = await DeliverySyncAPI.Drivers.getAll();

        const availableDrivers = drivers.filter(d => {
          const status = String(d.status || '').toLowerCase();
          return status.includes('available') || status.includes('active') || !status;
        });

        sel.innerHTML = `
          <option value="">Choose driver</option>
          ${availableDrivers.map(d => `
            <option value="${d.name || d.driver || d.id}">
              ${d.name || d.driver || d.id}
            </option>
          `).join('')}
        `;
      } catch(error) {
        console.error('Failed to load drivers from backend:', error);

        sel.innerHTML = `<option value="">Failed to load drivers</option>`;

        if(err){
          err.textContent = 'Failed to load drivers from backend';
        }
      }
    };
  }

  const closeModal = ()=>{
    if(modal) modal.style.display = 'none';
  };

  document.getElementById('cancelReassign')?.addEventListener('click', closeModal);

  document.getElementById('saveReassign')?.addEventListener('click', async ()=>{
    const sel = document.getElementById('newDriver');
    const name = (sel?.value || '').trim();
    const err = document.getElementById('err-newDriver');

    if(err) err.textContent = '';

    if(!name){
      if(err) err.textContent = 'Please select a driver';
      return;
    }

    try {
      await DeliverySyncAPI.Trips.reassign(r.id, name);

      showToast('Driver reassigned successfully');
      closeModal();

      location.href = 'trip-monitoring.html';
    } catch(error) {
      console.error('Failed to reassign driver:', error);

      if(err){
        err.textContent = 'Failed to reassign driver from backend';
      }
    }
  });
}

 async function renderTransactions(){
  const s = pageLayout('Transactions','Transactions'); 
  if(!s) return;

  $('#pageRoot').innerHTML = `
    <div class="content-card table-card">
      <div class="table-head">
        <div>
          <h3>Billing & Payments</h3>
          <div class="subdued" style="margin-top:6px">
            Invoices and submitted payment transactions loaded from backend.
          </div>
        </div>
      </div>

      <div style="margin-top:18px">
        <h3 style="font-size:16px;margin-bottom:12px">Unpaid invoices</h3>

        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Client</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody id="invoiceBody">
            <tr>
              <td colspan="5" style="text-align:center;color:#b9b9b9;padding:18px">
                Loading invoices...
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="margin-top:24px">
        <h3 style="font-size:16px;margin-bottom:12px">Submitted transactions</h3>

        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Date</th>
              <th>Mode</th>
              <th>Transaction ID</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody id="paymentBody">
            <tr>
              <td colspan="6" style="text-align:center;color:#b9b9b9;padding:18px">
                Loading transactions...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="content-card table-card" style="margin-top:24px">
      <div class="table-head">
        <h3>Transactions & Invoices</h3>
        <div class="filters">
          <input id="txnSearch" class="mini-input" placeholder="Search transactions...">
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Client</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>

        <tbody id="txnBody">
          <tr>
            <td colspan="6" style="text-align:center;color:#b9b9b9;padding:18px">
              Loading all transactions...
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  function money(value){
    if(value === undefined || value === null || value === '') return '--';

    const raw = String(value).replace(/[₹,]/g, '').trim();

    if(!raw || isNaN(Number(raw))){
      return String(value).startsWith('₹') ? String(value) : value;
    }

    return `₹${Number(raw).toLocaleString('en-IN')}`;
  }

  function dateText(value){
    if(!value) return '--';

    const d = new Date(value);

    if(!isNaN(d.getTime())){
      return d.toLocaleDateString('en-IN');
    }

    return value;
  }

  async function render(){
    try {
      const q = ($('#txnSearch')?.value || '').trim();

      const [transactions, invoices] = await Promise.all([
        DeliverySyncAPI.Transactions.getPayments(q),
        DeliverySyncAPI.Transactions.getInvoices(q)
      ]);

      const invoiceRows = (invoices || []).filter(function(inv){
        return String(inv.status || '').toLowerCase() !== 'paid';
      });

      $('#invoiceBody').innerHTML = invoiceRows.map(function(inv){
        return `
          <tr>
            <td>${inv.id || inv.invoiceId || '-'}</td>
            <td>${inv.client || inv.customer || inv.businessClient || '-'}</td>
            <td>${money(inv.amount)}</td>
            <td>${inv.dueDate || dateText(inv.createdAt) || '-'}</td>
            <td>
              <span class="status-pill ${statusClass(inv.status)}">
                ${inv.status || 'Unpaid'}
              </span>
            </td>
          </tr>
        `;
      }).join('') || `
        <tr>
          <td colspan="5" style="text-align:center;color:#b9b9b9;padding:18px">
            No unpaid invoices.
          </td>
        </tr>
      `;

      $('#paymentBody').innerHTML = (transactions || []).map(function(t){
        return `
          <tr>
            <td>${t.invoice || t.invoiceId || '-'}</td>
            <td>${t.date || dateText(t.createdAt)}</td>
            <td>${t.mode || t.paymentMode || 'Payment'}</td>
            <td>${t.transactionId || t.id || '-'}</td>
            <td>${money(t.amount)}</td>
            <td>
              <span class="status-pill ${statusClass(t.status)}">
                ${t.status || 'Completed'}
              </span>
            </td>
          </tr>
        `;
      }).join('') || `
        <tr>
          <td colspan="6" style="text-align:center;color:#b9b9b9;padding:18px">
            No transactions submitted yet.
          </td>
        </tr>
      `;

      const allRows = [
        ...(transactions || []).map(function(t){
          return {
            id: t.id || t.transactionId || '-',
            type: t.type || 'Payment',
            client: t.client || t.customer || '-',
            amount: money(t.amount),
            status: t.status || 'Completed',
            date: t.date || dateText(t.createdAt)
          };
        }),

        ...(invoices || []).map(function(inv){
          return {
            id: inv.id || inv.invoiceId || '-',
            type: 'Invoice',
            client: inv.client || inv.customer || inv.businessClient || '-',
            amount: money(inv.amount),
            status: inv.status || 'Unpaid',
            date: inv.dueDate || dateText(inv.createdAt)
          };
        })
      ];

      $('#txnBody').innerHTML = allRows.map(function(r){
        return `
          <tr>
            <td>${r.id}</td>
            <td>${r.type}</td>
            <td>${r.client}</td>
            <td>${r.amount}</td>
            <td>
              <span class="status-pill ${statusClass(r.status)}">
                ${r.status}
              </span>
            </td>
            <td>${r.date}</td>
          </tr>
        `;
      }).join('') || `
        <tr>
          <td colspan="6" style="text-align:center;color:#b9b9b9;padding:18px">
            No transactions found. Complete a delivery workflow to generate transaction records.
          </td>
        </tr>
      `;

    } catch(error) {
      console.error('Failed to load transactions from backend:', error);

      $('#invoiceBody').innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;color:#ff6b6b;padding:18px">
            Failed to load invoices from backend.
          </td>
        </tr>
      `;

      $('#paymentBody').innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;color:#ff6b6b;padding:18px">
            Failed to load transactions from backend.
          </td>
        </tr>
      `;

      $('#txnBody').innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;color:#ff6b6b;padding:18px">
            Failed to load transactions and invoices from backend.
          </td>
        </tr>
      `;
    }
  }

  $('#txnSearch').oninput = render;

  await render();
}

async function renderNotifications(){
  const s = pageLayout('Notifications','Notifications');
  if(!s) return;

  $('#pageRoot').innerHTML = `
    <div class="content-card profile-card" style="max-width:760px">
      <div id="notificationsBody" style="color:#b9b9b9;padding:18px">
        Loading notifications...
      </div>

      <div style="text-align:right;margin-top:18px">
        <button class="btn-yellow" id="markRead">Mark all as read</button>
      </div>
    </div>
  `;

  async function loadNotifications(){
    try {
      const notifications = await DeliverySyncAPI.Notifications.getAll();

      $('#notificationsBody').innerHTML = (notifications || []).map(function(n){
        return `
          <div class="notify-item">
            <strong>${n.title || 'Notification'}</strong>
            <span>${n.desc || n.message || '-'}</span>
            <span>${n.time || n.createdAt || '--'}</span>
          </div>
        `;
      }).join('') || `
        <div style="text-align:center;color:#b9b9b9;padding:24px">
          No notifications found.
        </div>
      `;
    } catch(error) {
      console.error('Failed to load notifications from backend:', error);

      $('#notificationsBody').innerHTML = `
        <div style="text-align:center;color:#ff6b6b;padding:24px">
          Failed to load notifications from backend.
        </div>
      `;
    }
  }

  $('#markRead').onclick = async function(){
    try {
      await DeliverySyncAPI.Notifications.markAllRead();
      showToast('All notifications marked as read.');
      await loadNotifications();
    } catch(error) {
      console.error('Failed to mark notifications as read:', error);
      alert('Failed to mark notifications as read from backend');
    }
  };

  await loadNotifications();
}

async function renderProfile(){
  const s = pageLayout('Profile','Profile');
  if(!s) return;

  const session = DS.getSession() || {};
  const userId = session.userId;

  $('#pageRoot').innerHTML = `
    <div class="content-card profile-card" style="max-width:760px">
      <div style="text-align:center;color:#b9b9b9;padding:30px">
        Loading profile from backend...
      </div>
    </div>
  `;

  try {
    const user = await DeliverySyncAPI.Users.getOne(userId);

    const profileName = user.name || user.fullName || session.name || 'Super User';
    const profileEmail = user.email || session.email || '--';
    const profilePhone = user.phone || '--';
    const profileInitials = profileName
      .split(/\s+/)
      .map(function(p){ return p[0]; })
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SU';

    $('#pageRoot').innerHTML = `
      <div class="profile-layout">
        <div class="content-card profile-card">
          <div class="profile-hero">
            <div class="avatar-big">${profileInitials}</div>
            <div>
              <div class="profile-name">${profileName}</div>
              <div class="profile-role">${roleValueToLabel(user.role || session.role || 'superuser')}</div>
            </div>
          </div>

          <div class="profile-item">
            <div class="detail-label">Email</div>
            <div class="detail-main">${profileEmail}</div>
          </div>

          <div class="profile-item">
            <div class="detail-label">Phone</div>
            <div class="detail-main">${profilePhone}</div>
          </div>

          <div class="profile-item">
            <div class="detail-label">Permissions</div>
            <div class="detail-main">Full system control</div>
          </div>

          <div class="profile-item">
            <div class="detail-label">Last Login</div>
            <div class="detail-main">${user.lastLogin || (session.loggedInAt ? new Date(session.loggedInAt).toLocaleString() : '--')}</div>
          </div>

          <div style="text-align:right;margin-top:20px">
            <button class="btn-yellow" id="editProfileBtn">Edit Profile</button>
          </div>
        </div>

        <div class="profile-grid">
          <div class="content-card profile-block">
            <strong>Security</strong>
            <div class="profile-item">
              <div class="detail-label">Account Status</div>
              <div class="detail-main">${user.status || 'Active'}</div>
            </div>
            <div class="profile-item">
              <div class="detail-label">Password Changed</div>
              <div class="detail-main">Backend managed</div>
            </div>
          </div>

          <div class="content-card profile-block">
            <strong>System Access</strong>
            <div class="profile-item">
              <div class="detail-label">Current Role</div>
              <div class="detail-main">${roleValueToLabel(user.role || 'superuser')}</div>
            </div>
            <div class="profile-item">
              <div class="detail-label">Environment</div>
              <div class="detail-main">Production Prototype</div>
            </div>
          </div>

          <div class="content-card profile-block" style="grid-column:1 / -1">
            <strong>Profile Update</strong>

            <div class="field">
              <label>Name</label>
              <input id="profileNameInput" value="${profileName}">
              <div class="error" id="err-profileNameInput"></div>
            </div>

            <div class="field">
              <label>Phone</label>
              <input id="profilePhoneInput" value="${profilePhone === '--' ? '' : profilePhone}" maxlength="10" inputmode="numeric">
              <div class="error" id="err-profilePhoneInput"></div>
            </div>

            <div class="form-actions">
              <button class="btn-yellow" id="saveProfileBtn">Save Profile</button>
            </div>
          </div>
        </div>
      </div>
    `;

    $('#editProfileBtn').onclick = function(){
      document.getElementById('profileNameInput').focus();
    };

    $('#saveProfileBtn').onclick = async function(){
      $('#err-profileNameInput').textContent = '';
      $('#err-profilePhoneInput').textContent = '';

      const name = $('#profileNameInput').value.trim();
      const phone = $('#profilePhoneInput').value.trim();

      let ok = true;

      if(!/^[A-Za-z][A-Za-z\s]{2,59}$/.test(name)){
        $('#err-profileNameInput').textContent = 'Name must be 3-60 letters and spaces only';
        ok = false;
      }

      if(phone && !/^[6-9]\d{9}$/.test(phone)){
        $('#err-profilePhoneInput').textContent = 'Phone must be 10 digits and start from 6, 7, 8, or 9';
        ok = false;
      }

      if(!ok) return;

      const payload = {
        name,
        email: user.email,
        role: user.role,
        status: user.status || 'Active',
        phone
      };

      try {
        await DeliverySyncAPI.Users.update(user.id, payload);
        showToast('Profile updated successfully');
        await renderProfile();
      } catch(error) {
        console.error('Failed to update profile from backend:', error);
        alert('Failed to update profile from backend');
      }
    };

  } catch(error) {
    console.error('Failed to load profile from backend:', error);

    $('#pageRoot').innerHTML = `
      <div class="content-card profile-card" style="max-width:760px;text-align:center;color:#ff6b6b;padding:30px">
        Failed to load profile from backend.
      </div>
    `;
  }
}

  document.addEventListener('DOMContentLoaded',()=>{
    const routes = {
      'dashboard':renderDashboard,
      'manage-users':renderUsers,
      'add-user':()=>renderUserForm(false),
      'edit-user':()=>renderUserForm(true),
      'view-user':renderUserView,
      'reports':renderReports,
      'roles-fleet-manager':()=>renderRoles('fleet-manager','Fleet Manager'),
      'roles-business-client':()=>renderRoles('business-client','Business Client'),
      'roles-driver':()=>renderRoles('driver','Driver'),
      'system-configuration':renderSettings,
      'delivery-requests':renderDeliveryRequests,
      'delivery-request-details':renderRequestDetail,
      'block-order':renderBlockOrder,
      'unblock-order':renderUnblockOrder,
      'trip-monitoring':renderTrips,
      'trip-details':renderTripDetail,
      'vehicles':renderVehicles,
      'add-vehicle': renderAddVehicle,
      'vehicle-details': renderVehicleDetails,
      'edit-vehicle': renderEditVehicle,
      'maintenance':renderMaintenance,
      'schedule-maintenance':renderScheduleMaintenance,
      'transactions':renderTransactions,
      'notifications':renderNotifications,
      'profile':renderProfile
    };
    (routes[page]||renderDashboard)();

    // Live refresh across tabs when other portals update shared state
    window.addEventListener('storage', (e)=>{
      // Only re-render safe views (lists/details). Avoid clobbering forms in progress.
      if(e.key === 'deliverysync-state-v1'){
        if(page === 'manage-users') renderUsers();
        if(page === 'view-user') renderUserView();
      }
      if(e.key === 'dsWorkflowOrders'){
        if(page === 'delivery-requests') renderDeliveryRequests();
        if(page === 'trip-monitoring') renderTrips();
        if(page === 'trip-details') renderTripDetail();
        if(page === 'delivery-request-details') renderRequestDetail();
      }
    });
    window.addEventListener('focus', ()=>{
      if(page === 'delivery-requests') renderDeliveryRequests();
      if(page === 'trip-monitoring') renderTrips();
      if(page === 'trip-details') renderTripDetail();
      if(page === 'delivery-request-details') renderRequestDetail();
    });
    window.addEventListener('pageshow', ()=>{
      if(page === 'delivery-requests') renderDeliveryRequests();
      if(page === 'trip-monitoring') renderTrips();
      if(page === 'trip-details') renderTripDetail();
      if(page === 'delivery-request-details') renderRequestDetail();
    });
  });
})();
