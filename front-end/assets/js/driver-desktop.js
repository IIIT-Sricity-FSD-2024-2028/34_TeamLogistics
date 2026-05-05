(function(){
  const STORAGE_KEY = 'deliverysync-driver-desktop-v2';
  // Shared state used across portals (Superuser/Fleet Manager/Business Client)
  // See: front-end/assets/js/data.js
  const CORE_STORAGE_KEY = 'deliverysync-state-v1';
  const SESSION_KEY = 'deliverysync-session-v1';
  const DRIVER_USER_ID = 'DR-301';

  // ---- Session Guard ----
  (function(){
    var raw = localStorage.getItem(SESSION_KEY);
    var session = null;
    try { session = raw ? JSON.parse(raw) : null; } catch(e) { session = null; }
    if(!session || session.role !== 'driver'){
      window.location.href = '../login.html';
      return;
    }
  })();

  const seedData = {currentOrderId:322,profile:{name:'Raghava',fullName:'Raghava Reddy',email:'driver@deliverysync.com',phone:'+91 94400 11223',vehicle:'TN09AB1234',zone:'Chennai North',status:'Available',licenseNumber:'TN03201800034521'},orders:[{id:321,customer:'Icecream Store',pickup:'Warehouse',drop:'IIIT SRICITY BH-1',package:'Frozen Goods',weight:'8.2 kg',eta:'35 mins',distance:'12.4 km',status:'assigned',amount:850,instructions:'Deliver to hostel BH-1 reception. Keep package upright.',proofRecipient:'',proofNote:'',proofTime:'',note:'Morning slot'},{id:322,customer:'Laxmi Pvt Ltd.',pickup:'Sullurupeta Warehouse',drop:'BH1, IIIT Sri City',package:'Apparel',weight:'11.5 kg',eta:'42 mins',distance:'15.8 km',status:'assigned',amount:560.75,instructions:'Call customer on arrival. Deliver at main gate and collect signature.',proofRecipient:'',proofNote:'',proofTime:'',note:'Handle with care'},{id:323,customer:'Retail Store Ltd.',pickup:'Warehouse A, Industrial Zone',drop:'Tada Main Road',package:'Electronics',weight:'8.5 kg',eta:'31 mins',distance:'12.4 km',status:'accepted',amount:1040,instructions:'Ask for manager Mr. Patel. Fragile electronics.',proofRecipient:'',proofNote:'',proofTime:'',note:''},{id:324,customer:'Green Mart',pickup:'Central Warehouse',drop:'Sunrise Apartments',package:'Groceries',weight:'5.3 kg',eta:'18 mins',distance:'5.3 km',status:'in_transit',amount:420,instructions:'Deliver at security desk.',proofRecipient:'',proofNote:'',proofTime:'',note:''},{id:325,customer:'MediCare',pickup:'Pharma Hub',drop:'Clinic Block A',package:'Medical Supplies',weight:'6.2 kg',eta:'Delivered',distance:'9.0 km',status:'completed',amount:900,instructions:'Temperature-sensitive cargo.',proofRecipient:'Nurse Anita',proofNote:'Delivered safely',proofTime:'09:40 AM',note:''}],notifications:[{id:1,title:'New Delivery Assigned',message:'Delivery #322 has been assigned to you.',time:'2 mins ago'},{id:2,title:'Delivery Completed',message:'Delivery #325 was marked as delivered successfully.',time:'50 mins ago'},{id:3,title:'Route Update',message:'Traffic cleared on NH16. ETA improved by 8 mins.',time:'1 hour ago'}],messages:[{id:1,from:'Dispatch',subject:'Urgent',body:'Please prioritize Delivery #322 after acceptance.',time:'10:45 AM'},{id:2,from:'Fleet Manager',subject:'Vehicle Check',body:'Upload the fuel receipt after today\'s route.',time:'Yesterday'}],issues:[{id:1,orderId:322,type:'Delay Risk',description:'Heavy traffic near toll plaza.',photo:'',createdAt:'Today, 10:20 AM',status:'Open'}],notes:[{id:1,orderId:322,text:'Customer prefers call before arrival.',createdAt:'Today, 09:30 AM'},{id:2,orderId:321,text:'Pickup dock opens at 11 AM.',createdAt:'Today, 08:10 AM'}],earnings:[{id:1,label:'Today',amount:560.75},{id:2,label:'This Week',amount:3240.00},{id:3,label:'This Month',amount:12480.50}],history:[{id:1,orderId:325,event:'Order delivered',time:'09:40 AM',detail:'Proof uploaded and customer signature collected.'},{id:2,orderId:323,event:'Order accepted',time:'08:15 AM',detail:'Driver accepted assignment.'}]};

  // ---- Toast utility (replaces alert for non-blocking UX) ----
  function driverToast(msg){
    var t=document.getElementById('driverToastEl');
    if(!t){t=document.createElement('div');t.id='driverToastEl';t.style.cssText='position:fixed;top:24px;right:24px;background:#1e1e2f;color:#fff;padding:14px 28px;border-radius:12px;font-size:14px;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,.4);transform:translateY(-20px);opacity:0;transition:all .3s ease;border-left:4px solid #facc15;pointer-events:none';document.body.appendChild(t);}
    t.textContent=msg;t.style.opacity='1';t.style.transform='translateY(0)';
    clearTimeout(t._tid);t._tid=setTimeout(function(){t.style.opacity='0';t.style.transform='translateY(-20px)';},2800);
  }

  // ---- Shared profile sync (Driver <-> Superuser Manage Users) ----
  function readCoreState(){
    try{
      if(window.DeliverySyncData && typeof window.DeliverySyncData.readState==='function'){
        return window.DeliverySyncData.readState();
      }
    }catch(e){}
    try{
      return JSON.parse(localStorage.getItem(CORE_STORAGE_KEY)||'null');
    }catch(e){
      return null;
    }
  }
  function writeCoreState(core){
    try{
      if(window.DeliverySyncData && typeof window.DeliverySyncData.writeState==='function'){
        window.DeliverySyncData.writeState(core);
        return;
      }
    }catch(e){}
    try{ localStorage.setItem(CORE_STORAGE_KEY, JSON.stringify(core)); }catch(e){}
  }
  function readSession(){
    try{ return JSON.parse(localStorage.getItem(SESSION_KEY)||'null'); }catch(e){ return null; }
  }
  function deriveInitials(name){
    const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
    if(!parts.length) return 'D';
    return (parts[0][0]||'D').toUpperCase();
  }
  function syncProfileFromCore(driverState){
    const core=readCoreState();
    if(!core || !Array.isArray(core.users)) return driverState;
    const session = readSession();
    let u = null;
    if(session && String(session.role||'').toLowerCase()==='driver'){
      u = core.users.find(x=>String(x.id)===String(session.userId)) || core.users.find(x=>String(x.email||'').toLowerCase()===String(session.email||'').toLowerCase());
    }
    if(!u && !(driverState.profile && (driverState.profile.fullName || driverState.profile.name))) u = core.users.find(x=>x.id===DRIVER_USER_ID) || core.users.find(x=>String(x.role||'').toLowerCase()==='driver');
    if(!u) return driverState;
    // Map shared fields into driver portal profile
    driverState.profile = driverState.profile || {};
    driverState.profile.fullName = u.name || driverState.profile.fullName;
    driverState.profile.name = (u.name||driverState.profile.fullName||driverState.profile.name||'Driver').split(' ')[0];
    driverState.profile.email = u.email || driverState.profile.email;
    driverState.profile.phone = u.phone || driverState.profile.phone;
    driverState.profile.licenseNumber = (u.profileDetails && u.profileDetails.licenseNumber) || driverState.profile.licenseNumber;
    if (u.status) driverState.profile.status = u.status;
    if (Array.isArray(u.notifications)) {
      driverState.notifications = Array.isArray(driverState.notifications) ? driverState.notifications : [];
      const existingKeys = new Set(driverState.notifications.map(n => `${n.id||''}|${n.title||''}|${n.message||''}`));
      u.notifications.slice().reverse().forEach((n) => {
        const mapped = { id: Number(String(n.id || '').replace(/\D/g,'')) || Date.now(), title: n.title || 'Notification', message: n.message || '', time: n.time || 'Just now' };
        const key = `${n.id||''}|${mapped.title}|${mapped.message}`;
        if (!existingKeys.has(key)) {
          driverState.notifications.unshift(mapped);
          existingKeys.add(key);
        }
      });
    }
    return driverState;
  }
  function syncProfileToCore(profileOrState){
    const core=readCoreState();
    if(!core || !Array.isArray(core.users)) return;
    const session = readSession();
    let idx = -1;
    if(session && String(session.role||'').toLowerCase()==='driver'){
      idx = core.users.findIndex(x=>String(x.id)===String(session.userId) || String(x.email||'').toLowerCase()===String(session.email||'').toLowerCase());
    }
    if(idx<0) idx = core.users.findIndex(x=>x.id===DRIVER_USER_ID);
    if(idx<0) return;
    const p = (profileOrState && profileOrState.profile) ? (profileOrState.profile||{}) : (profileOrState||{});
    const u = core.users[idx];
    core.users[idx] = {
      ...u,
      name: p.fullName || u.name,
      email: p.email || u.email,
      phone: p.phone || u.phone,
      profileDetails: {
        ...(u.profileDetails||{}),
        licenseNumber: p.licenseNumber || (u.profileDetails && u.profileDetails.licenseNumber) || ''
      }
    };
    // Also update driver roster (if present) so other mock screens reflect latest name/phone.
    if(Array.isArray(core.drivers)){
      const did = (u.profileDetails && u.profileDetails.driverId) || 'DRV-1032';
      const dIdx = core.drivers.findIndex(d=>String(d.id)===String(did));
      if(dIdx>=0){
        core.drivers[dIdx] = {
          ...core.drivers[dIdx],
          name: p.fullName || core.drivers[dIdx].name,
          phone: p.phone || core.drivers[dIdx].phone,
          licenseNumber: p.licenseNumber || core.drivers[dIdx].licenseNumber
        };
      }
    }
    writeCoreState(core);
  }


  function syncWorkflowOrders(data){
    let workflow=[];
    try{workflow=JSON.parse(localStorage.getItem('dsWorkflowOrders')||'[]')||[]}catch(e){workflow=[]}
    const mapStatus=s=>{const v=String(s||'').toUpperCase().replace(/[\s-]+/g,'_'); return (v==='ASSIGNED'||v==='ASSIGNING')?'assigned':(v==='ACCEPTED'||v==='PICKED_UP')?'accepted':v==='IN_TRANSIT'?'in_transit':(v==='DELIVERED'||v==='COMPLETED')?'completed':v==='REJECTED'?'rejected':'assigned';};
    workflow.forEach(w=>{
      const numericId=Number(String(w.id||'').replace(/\D/g,''))||Date.now();
      const mapped={
        id:numericId,
        customer:w.client||'Business Client',
        pickup:w.pickup||'Pickup',
        drop:w.drop||'Drop',
        package:w.packageDetails||w.package||'Package',
        weight:w.weight||'5.0 kg',
        eta:w.status==='DELIVERED'?'Delivered':`${w.eta||25} mins`,
        distance:w.distance||`${w.eta||25} km`,
        status:mapStatus(w.status),
        amount:(w.pricing&&w.pricing.total)||w.amount||850,
        instructions:w.instructions||'Handle with care.',
        proofRecipient:'',proofNote:'',proofTime:'',note:'Workflow order'
      };
      const existing=data.orders.find(o=>String(o.id)===String(mapped.id));
      if(existing){Object.assign(existing,mapped)}else{data.orders.unshift(mapped)}
    });
    return data;
  }
  function load(){
    const clone = JSON.parse(JSON.stringify(seedData));
    const raw = localStorage.getItem(STORAGE_KEY);
    let data = clone;
    if(raw){
      try{ data = JSON.parse(raw) || clone; }catch(e){ data = clone; }
    }

    // basic shape guarantees
    if(!Array.isArray(data.orders) || !data.orders.length) data.orders = clone.orders;
    if(!Array.isArray(data.notes)) data.notes = clone.notes;
    if(!Array.isArray(data.notifications)) data.notifications = clone.notifications;
    if(!data.profile) data.profile = clone.profile;
    if(!data.ui) data.ui = { profileEdit: false };
    if(typeof data.ui.profileEdit !== 'boolean') data.ui.profileEdit = false;

    let workflowOrders = [];
    try{workflowOrders=JSON.parse(localStorage.getItem('dsWorkflowOrders')||'[]')||[]}catch(e){workflowOrders=[]}

    // Keep a few seeded active orders present only when workflow orders are absent so real workflow data is not blocked.
    const active = data.orders.filter(o=>['assigned','accepted','in_transit'].includes(o.status));
    if(!workflowOrders.length && active.length < 3){
      clone.orders.slice(0,3).forEach(seed=>{
        const found = data.orders.find(x=>x.id===seed.id);
        if(found){
          Object.assign(found,{
            status:seed.status,pickup:seed.pickup,drop:seed.drop,customer:seed.customer,
            eta:seed.eta,distance:seed.distance,package:seed.package,weight:seed.weight,
            instructions:seed.instructions,amount:seed.amount
          });
        }else{
          data.orders.push(seed);
        }
      });
    }

    data = syncWorkflowOrders(data);

    // Pull latest driver details from the shared core store (updated by Superuser)
    data = syncProfileFromCore(data);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }
  function save(state){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
  let state=load();
  const page=document.body.dataset.page||'dashboard',content=document.getElementById('driver-content'),pageTitle=document.getElementById('page-title'),pageSubtitle=document.getElementById('page-subtitle'),notifBtn=document.getElementById('notifBtn'),profileBtn=document.getElementById('profileBtn'),notifMenu=document.getElementById('notifMenu'),profileMenu=document.getElementById('profileMenu'),profileInitial=document.getElementById('profileInitial'); if(profileInitial){profileInitial.textContent=(state.profile.name||'D')[0].toUpperCase();}
  function rupee(n){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n)}
  function orderById(id){return state.orders.find(o=>String(o.id)===String(id))}
  function statusLabel(s){return s==='in_transit'?'In Transit':s.charAt(0).toUpperCase()+s.slice(1)}
  
  function deleteNotification(id){state.notifications=state.notifications.filter(n=>n.id!==Number(id)); save(state); render();}
  function counts(){return {deliveries:state.orders.filter(o=>['assigned','accepted','in_transit'].includes(o.status)).length,completed:state.orders.filter(o=>o.status==='completed').length,pending:state.orders.filter(o=>o.status==='assigned').length,active:state.profile.status}}
  function setOrderStatus(id,status){const order=orderById(id); if(!order) return; order.status=status; if(status==='accepted') state.currentOrderId=Number(id); if(status==='completed'){order.proofTime=order.proofTime||new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} try{const wf=JSON.parse(localStorage.getItem('dsWorkflowOrders')||'[]')||[]; const target=wf.find(o=>String(o.id).replace(/\D/g,'')===String(id)); if(target){ let activeDriver=''; try{const session=JSON.parse(localStorage.getItem(SESSION_KEY)||'null'); if(session && String(session.role||'').toLowerCase()==='driver'){ activeDriver=String(session.name||'').trim(); }}catch(e){} activeDriver=activeDriver||state.profile.fullName||state.profile.name||target.assignedDriver||'Assigning'; target.status=status==='assigned'?'ASSIGNED':status==='accepted'?'ACCEPTED':status==='in_transit'?'IN_TRANSIT':status==='completed'?'DELIVERED':String(status).toUpperCase(); if(['accepted','in_transit','completed'].includes(status)) target.assignedDriver=activeDriver; localStorage.setItem('dsWorkflowOrders',JSON.stringify(wf)); if(status==='completed'){ const invoices=JSON.parse(localStorage.getItem('dsWorkflowInvoices')||'[]')||[]; if(!invoices.some(inv=>String(inv.orderId)===String(target.id))){ const deliveredAt=(target.steps&&target.steps.deliveredAt)||new Date().toISOString(); const due=new Date(new Date(deliveredAt).getTime()+7*24*3600*1000); invoices.unshift({ id:'INV-'+String(target.id).replace(/\D/g,''), orderId:target.id, client:target.client||order.customer||'Business Client', amount:(target.pricing&&Number(target.pricing.total))||Number(target.amount)||Number(order.amount)||145, status:'Unpaid', createdAt:deliveredAt, dueDate:due.toISOString() }); localStorage.setItem('dsWorkflowInvoices',JSON.stringify(invoices)); } } }}catch(e){} state.history.unshift({id:Date.now(),orderId:Number(id),event:`Order ${statusLabel(status)}`,time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),detail:`Delivery #${id} is now ${statusLabel(status).toLowerCase()}.`}); state.notifications.unshift({id:Date.now(),title:`Delivery #${id} updated`,message:`Status changed to ${statusLabel(status)}.`,time:'Just now'}); save(state); render();}
  function hasOngoingOrder(exceptId){const names=[state.profile&&state.profile.fullName,state.profile&&state.profile.name]; try{const session=JSON.parse(localStorage.getItem(SESSION_KEY)||'null'); if(session){names.push(session.name,session.username,session.email);}}catch(e){} const normalized=names.filter(Boolean).map(v=>String(v).trim().toLowerCase()); try{const wf=JSON.parse(localStorage.getItem('dsWorkflowOrders')||'[]')||[]; if(wf.length){return wf.some(o=>{const idMatch=String(String(o.id||'').replace(/\D/g,''))!==String(exceptId); const statusOk=['ACCEPTED','IN_TRANSIT','PICKED_UP'].includes(String(o.status||'').toUpperCase().replace(/[\s-]+/g,'_')); const assigned=String(o.assignedDriver||'').trim().toLowerCase(); const belongs=!assigned || normalized.includes(assigned); return idMatch && statusOk && belongs;});}}catch(e){} return state.orders.some(o=>String(o.id)!==String(exceptId) && ['accepted','in_transit'].includes(o.status));}
  function deleteIssue(id){state.issues=state.issues.filter(i=>i.id!==id); save(state); render();}
  function upsertNote(orderId,noteId,text){if(noteId){const note=state.notes.find(n=>n.id===noteId); if(note) note.text=text;} else {state.notes.unshift({id:Date.now(),orderId:Number(orderId),text,createdAt:'Just now'})} save(state); render();}
  function deleteNote(id){state.notes=state.notes.filter(n=>n.id!==id); save(state); render();}
  function shellTitle(title,subtitle){if(pageTitle) pageTitle.textContent=title; if(pageSubtitle) pageSubtitle.textContent=subtitle||''; const activeNav=['delivery-accepted','delivery-progress-1','delivery-progress-2','proof-of-delivery'].includes(page)?'map':page; document.querySelectorAll('.nav-link').forEach(a=>a.classList.toggle('active',a.dataset.nav===activeNav));}
  function orderCard(o){const primary=o.status==='assigned'?`<button class="btn yellow" data-action="accept" data-id="${o.id}">Accept</button><button class="btn danger" data-action="reject" data-id="${o.id}">Reject</button>`:''; const secondary=o.status==='accepted'?`<button class="btn light" data-action="open-progress" data-id="${o.id}">Start Trip</button>`:o.status==='in_transit'?`<button class="btn light" data-action="map" data-id="${o.id}">Open Map</button>`:`<button class="btn light" data-action="view" data-id="${o.id}">View Details</button>`; return `<div class="card order-card"><div><div class="inline"><h3>Delivery #${o.id}</h3><span class="pill ${o.status}">${statusLabel(o.status)}</span></div><div class="route-list"><div class="route-item"><div class="route-dot">●</div><div><div class="route-label">Pickup</div><div class="route-value">${o.pickup}</div></div></div><div class="route-item"><div class="route-dot">●</div><div><div class="route-label">Drop</div><div class="route-value">${o.drop}</div></div></div></div><div class="meta-row"><div><div class="meta-label">Customer</div><div class="meta-value">${o.customer}</div></div><div><div class="meta-label">ETA</div><div class="meta-value">${o.eta}</div></div><div><div class="meta-label">Distance</div><div class="meta-value">${o.distance}</div></div></div></div><div class="summary-panel"><div class="card theme-panel"><div class="meta-label">Package</div><div class="meta-value">${o.package}</div><div class="meta-label" style="margin-top:10px">Weight</div><div class="meta-value">${o.weight}</div><div class="meta-label" style="margin-top:10px">Instructions</div><div class="helper">${o.instructions}</div></div><div class="actions-2">${primary}${secondary}</div></div></div>`; }
  function renderDashboard(){shellTitle(`Hello, ${state.profile.name}`,`Ready for today's deliveries`); const c=counts(); const q=(new URLSearchParams(location.search).get('q')||'').toLowerCase(); let visible=state.orders.filter(o=>String(o.id||'').toLowerCase().startsWith(q)); if(!q){visible=state.orders.filter(o=>['assigned','accepted','in_transit','completed','rejected'].includes(o.status)).slice(0,3);} return `<div class="grid-4"><div class="card"><div class="metric-icon metric-deliveries"></div><div class="metric-value">${c.deliveries}</div><div class="metric-label">Today's Deliveries</div></div><div class="card"><div class="metric-icon metric-completed"></div><div class="metric-value">${c.completed}</div><div class="metric-label">Completed</div></div><div class="card"><div class="metric-icon metric-pending"></div><div class="metric-value">${c.pending}</div><div class="metric-label">Pending</div></div><div class="card yellow"><div class="metric-icon metric-status status-dark"></div><div class="metric-value" style="font-size:34px">${c.active}</div><div class="metric-label" style="color:#222">Driver Status</div></div></div><div class="section-head" style="margin-top:22px"><div><h2>Assigned Deliveries</h2><div class="subtext">Accept or reject every delivery directly from the dashboard.</div></div></div><div class="card" style="margin-top:18px"><div class="filter-row"><label class="search-sm" style="flex:1;max-width:320px"><span>⌕</span><input id="taskSearch" value="${q.replace(/"/g,'&quot;')}" placeholder="Search by ID, customer, location..."></label></div></div><div class="list" style="margin-top:18px">${visible.length?visible.map(orderCard).join(''):`<div class="empty">No orders found for this filter.</div>`}</div>`; }
  function renderTasks(){const q=(new URLSearchParams(location.search).get('q')||'').toLowerCase(); const activeStatus=(new URLSearchParams(location.search).get('status')||'all'); let orders=state.orders.filter(o=>activeStatus==='all'?true:o.status===activeStatus); if(q) orders=orders.filter(o=>`${o.id} ${o.customer} ${o.pickup} ${o.drop} ${o.package} ${o.instructions} ${o.weight} ${o.status}`.toLowerCase().includes(q)); shellTitle('Tasks','Manage your delivery assignments'); const tabs=[['all','All'],['assigned','Assigned'],['accepted','Accepted'],['in_transit','In Transit'],['completed','Completed'],['rejected','Rejected']]; return `<div class="card"><div class="filter-row"><input class="search" id="taskSearch" value="${q.replace(/"/g,'&quot;')}" placeholder="Search by ID, customer, location..."><button class="btn dark" id="applySearch">Search</button></div><div class="tabs" style="margin-top:16px">${tabs.map(([k,v])=>`<button class="tab-btn ${activeStatus===k?'active':''}" data-filter="${k}">${v}</button>`).join('')}</div></div><div class="section-head" style="margin-top:18px"><div><h2>Orders</h2><div class="subtext">${orders.length} task(s) found • assigned orders can be accepted or rejected directly</div></div></div><div class="list">${orders.length?orders.map(orderCard).join(''):`<div class="empty">No tasks found for this filter.</div>`}</div>`; }
  function detailsOrder(){const id=new URLSearchParams(location.search).get('id')||state.currentOrderId||state.orders[0].id; return orderById(id)||state.orders[0];}
  function renderTaskDetails(){const o=detailsOrder(); state.currentOrderId=o.id; save(state); const notes=state.notes.filter(n=>n.orderId===o.id); shellTitle(`Delivery #${o.id}`,'Delivery details and driver actions'); return `<div class="grid-2"><div><div class="card"><div class="inline"><h2 style="margin:0;font-size:28px">Delivery #${o.id}</h2><span class="pill ${o.status}">${statusLabel(o.status)}</span></div><div class="route-list"><div class="route-item"><div class="route-dot">●</div><div><div class="route-label">Pickup</div><div class="route-value">${o.pickup}</div></div></div><div class="route-item"><div class="route-dot">●</div><div><div class="route-label">Drop-Off</div><div class="route-value">${o.drop}</div></div></div></div><div class="meta-row"><div><div class="meta-label">Customer</div><div class="meta-value">${o.customer}</div></div><div><div class="meta-label">ETA</div><div class="meta-value">${o.eta}</div></div><div><div class="meta-label">Distance</div><div class="meta-value">${o.distance}</div></div></div><div class="card theme-panel"><div class="meta-label">Package</div><div class="meta-value">${o.package} — ${o.weight}</div><div class="meta-label" style="margin-top:10px">Instructions</div><div class="helper">${o.instructions}</div></div><div class="actions-3">${o.status==='assigned'?`<button class="btn yellow" data-action="accept" data-id="${o.id}">Accept Order</button><button class="btn danger" data-action="reject" data-id="${o.id}">Reject</button>`:''}${['accepted','in_transit','completed'].includes(o.status)?`<button class="btn dark" data-action="map" data-id="${o.id}">Open Map</button>`:''}${o.status==='accepted'?`<button class="btn yellow" data-action="open-progress" data-id="${o.id}">Start Trip</button>`:''}${o.status==='in_transit'?`<button class="btn yellow" data-action="proof" data-id="${o.id}">Upload Proof</button>`:''}<button class="btn light" onclick="location.href='report-issue.html?id=${o.id}'">Report Issue</button></div></div></div><div><div class="map-card"><div class="map-surface"><div class="map-road road-a"></div><div class="map-road road-b"></div><div class="map-road road-c"></div><div class="map-road road-d"></div><div class="map-park park-a"></div><div class="map-park park-b"></div><div class="map-water water-a"></div><div class="map-water water-b"></div><div class="map-label label-a">Doddathoguru</div><div class="map-label label-b">Electronics City Phase 1</div><div class="map-label label-c">Indra Nagar</div><div class="map-label label-d">Gollahalli</div><div class="map-label label-e">Shikaripalya</div><div class="map-label label-f">Maragondanahalli</div><div class="map-road-tag">44</div><div class="map-road-tag small">Infosys Avenue</div></div><div class="fake-map-grid"></div><div class="map-path"></div><div class="map-chip">${o.distance} • ${o.eta}</div><div class="map-pin pick"></div><div class="map-pin current"></div><div class="map-pin drop"></div><div class="mini-stat"><div class="card"><div class="meta-label">Current Speed</div><div class="metric-value" style="font-size:28px">45 km/h</div></div><div class="card"><div class="meta-label">Amount</div><div class="metric-value" style="font-size:28px">${rupee(o.amount)}</div></div></div></div></div></div><div class="section-head" style="margin-top:20px"><div><h2>Delivery Notes</h2><div class="subtext">CRUD enabled: create, read, update, delete notes for this order.</div></div></div><div class="grid-2"><div class="card"><form id="noteForm"><input type="hidden" id="noteId"><div class="form-field"><label>Note</label><textarea id="noteText" class="textarea" placeholder="Add a delivery note for this order"></textarea></div><div class="inline" style="margin-top:14px"><button class="btn yellow" type="submit">Save Note</button><button class="btn light" type="button" id="clearNoteBtn">Clear</button></div></form></div><div class="card">${notes.length?notes.map(n=>`<div class="note-item"><div style="font-weight:700">${n.text}</div><div class="helper" style="margin-top:6px">${n.createdAt}</div><div class="note-actions"><button class="btn light" data-action="edit-note" data-note-id="${n.id}" data-order-id="${o.id}">Edit</button><button class="btn danger" data-action="delete-note" data-note-id="${n.id}">Delete</button></div></div>`).join(''):`<div class="empty">No notes yet for Delivery #${o.id}.</div>`}</div></div>`; }
  function renderProgress(step){const o=detailsOrder(); shellTitle('Active Delivery',`Track progress for Delivery #${o.id}`); const steps=[['accepted','Accepted'],['picked','Picked Up'],['transit','In Transit'],['delivered','Delivered']]; return `<div class="map-layout"><div class="map-card"><div class="map-surface"><div class="map-road road-a"></div><div class="map-road road-b"></div><div class="map-road road-c"></div><div class="map-road road-d"></div><div class="map-park park-a"></div><div class="map-park park-b"></div><div class="map-water water-a"></div><div class="map-water water-b"></div><div class="map-label label-a">Doddathoguru</div><div class="map-label label-b">Electronics City Phase 1</div><div class="map-label label-c">Indra Nagar</div><div class="map-label label-d">Gollahalli</div><div class="map-label label-e">Shikaripalya</div><div class="map-label label-f">Maragondanahalli</div><div class="map-road-tag">44</div><div class="map-road-tag small">Infosys Avenue</div></div><div class="fake-map-grid"></div><div class="map-path"></div><div class="map-chip">${o.distance} remaining</div><div class="map-pin pick"></div><div class="map-pin current"></div><div class="map-pin drop"></div><div class="mini-stat"><div class="card"><div class="meta-label">Current Speed</div><div class="metric-value" style="font-size:28px">45 km/h</div></div><div class="card"><div class="meta-label">ETA</div><div class="metric-value" style="font-size:28px">${o.eta}</div></div></div></div><div class="card"><h2 style="margin-top:0">Delivery Progress</h2><div class="progress-steps">${steps.map((s,idx)=>`<div class="step ${idx<step?'done':''} ${idx===step?'current':''}"><div class="step-bubble">${idx+1}</div><div class="step-label">${s[1]}</div></div>`).join('')}</div><div class="card theme-panel"><div class="meta-label">Customer</div><div class="meta-value">${o.customer}</div><div class="meta-label" style="margin-top:10px">Current Route</div><div class="helper">${o.pickup} → ${o.drop}</div></div><div class="actions-3"><button class="btn light" data-action="map" data-id="${o.id}">Navigate</button><button class="btn light" onclick="location.href='notifications.html'">Notifications</button><button class="btn light" onclick="location.href='report-issue.html?id=${o.id}'">Report Issue</button></div><div style="margin-top:16px">${step===0?`<button class="btn yellow full" data-action="mark-picked" data-id="${o.id}">Mark as Picked Up</button>`:''}${step===1?`<button class="btn yellow full" data-action="mark-transit" data-id="${o.id}">Mark as In Transit</button>`:''}${step===2?`<button class="btn yellow full" data-action="proof" data-id="${o.id}">Mark as Delivered / Upload Proof</button>`:''}${step===3?`<a class="btn yellow full" href="dashboard.html" style="display:inline-flex;justify-content:center">Back to Dashboard</a>`:''}</div></div></div>`; }
  function renderMap(){const o=detailsOrder(); shellTitle('Delivery Map',`Live route for Delivery #${o.id}`); return `<div class="map-layout"><div class="map-card"><div class="map-surface"><div class="map-road road-a"></div><div class="map-road road-b"></div><div class="map-road road-c"></div><div class="map-road road-d"></div><div class="map-park park-a"></div><div class="map-park park-b"></div><div class="map-water water-a"></div><div class="map-water water-b"></div><div class="map-label label-a">Doddathoguru</div><div class="map-label label-b">Electronics City Phase 1</div><div class="map-label label-c">Indra Nagar</div><div class="map-label label-d">Gollahalli</div><div class="map-label label-e">Shikaripalya</div><div class="map-label label-f">Maragondanahalli</div><div class="map-road-tag">44</div><div class="map-road-tag small">Infosys Avenue</div></div><div class="fake-map-grid"></div><div class="map-path"></div><div class="map-chip">Delivery #${o.id} • ${o.distance}</div><div class="map-pin pick"></div><div class="map-pin current"></div><div class="map-pin drop"></div><div class="mini-stat"><div class="card"><div class="meta-label">Current Speed</div><div class="metric-value" style="font-size:28px">45 km/h</div></div><div class="card"><div class="meta-label">ETA</div><div class="metric-value" style="font-size:28px">${o.eta}</div></div></div></div><div class="card"><h2 style="margin-top:0">Delivery Order Details</h2><div class="route-list"><div class="route-item"><div class="route-dot">●</div><div><div class="route-label">Pickup</div><div class="route-value">${o.pickup}</div></div></div><div class="route-item"><div class="route-dot">●</div><div><div class="route-label">Drop</div><div class="route-value">${o.drop}</div></div></div></div><table class="table"><tr><th>Order</th><td>#${o.id}</td></tr><tr><th>Customer</th><td>${o.customer}</td></tr><tr><th>Package</th><td>${o.package}</td></tr><tr><th>Weight</th><td>${o.weight}</td></tr><tr><th>Status</th><td><span class="pill ${o.status}">${statusLabel(o.status)}</span></td></tr><tr><th>Instructions</th><td>${o.instructions}</td></tr></table><div class="actions-3">${o.status==='assigned'?`<button class="btn yellow" data-action="accept" data-id="${o.id}">Accept Order</button><button class="btn danger" data-action="reject" data-id="${o.id}">Reject</button>`:`<button class="btn yellow" data-action="view" data-id="${o.id}">Open Details</button>`}<button class="btn light" onclick="location.href='history.html'">View History</button></div></div></div>`; }
  function renderNotifications(){shellTitle('Notifications','Recent alerts and order updates'); return `<div class="list">${state.notifications.length?state.notifications.map(n=>`<div class="notify-item"><button class="notify-close" data-action="delete-notification" data-notification-id="${n.id}" aria-label="Delete notification">×</button><div style="font-weight:800;padding-right:34px">${n.title}</div><div class="helper" style="margin-top:6px">${n.message}</div><div class="helper" style="margin-top:8px">${n.time}</div></div>`).join(''):`<div class="empty">No notifications available.</div>`}</div>`; }
  function renderMessages(){shellTitle('Messages','Communication with dispatch and managers'); return `<div class="grid-2"><div class="card"><h2 style="margin-top:0">Inbox</h2><div class="list">${state.messages.map(m=>`<div class="msg-item"><div class="inline" style="justify-content:space-between"><strong>${m.from}</strong><span class="helper">${m.time}</span></div><div style="margin-top:6px;font-weight:700">${m.subject}</div><div class="helper" style="margin-top:8px">${m.body}</div></div>`).join('')}</div></div><div class="card"><h2 style="margin-top:0">Send Quick Message</h2><form id="messageForm"><div class="form-field"><label>To</label><input class="input" id="msgTo" value="Dispatch"></div><div class="form-field"><label>Subject</label><input class="input" id="msgSubject" placeholder="Subject"></div><div class="form-field"><label>Message</label><textarea class="textarea" id="msgBody" placeholder="Type message"></textarea></div><button class="btn yellow" type="submit">Send Message</button></form></div></div>`; }
  function renderHistory(){shellTitle('History','Completed orders and action log'); return `<div class="grid-2"><div class="card"><h2 style="margin-top:0">Order History</h2><div class="timeline">${state.history.map(h=>`<div class="timeline-item"><div class="timeline-dot"></div><div><div style="font-weight:800">${h.event}</div><div class="helper" style="margin-top:6px">Delivery #${h.orderId} — ${h.detail}</div></div><div class="helper">${h.time}</div></div>`).join('')}</div></div><div class="card"><div class="inline" style="justify-content:space-between"><h2 style="margin-top:0">Issue Reports</h2><a class="btn dark" href="report-issue.html">New Issue</a></div><div class="list">${state.issues.length?state.issues.map(i=>`<div class="note-item"><div class="inline" style="justify-content:space-between"><strong>${i.type}</strong><span class="pill assigned">#${i.orderId}</span></div><div class="helper" style="margin-top:8px">${i.description}</div><div class="helper" style="margin-top:8px">${i.createdAt} • ${i.status}</div><div class="note-actions"><button class="btn danger" data-action="delete-issue" data-issue-id="${i.id}">Delete</button></div></div>`).join(''):`<div class="empty">No issue reports available.</div>`}</div></div></div>`; }
  function renderReportIssue(){const o=detailsOrder(); const issueOptions=['Delay Risk','Address Mismatch','Vehicle Issue','Customer Unreachable','Damage Report','Traffic Block']; shellTitle('Report Issue',`Submit an incident for Delivery #${o.id}`); return `<div class="grid-2"><div class="card"><h2 style="margin-top:0">Report an Issue</h2><p class="subtext">Please provide details about the issue you are experiencing with this delivery.</p><form id="issueForm"><div class="form-grid"><div class="form-field"><label>Delivery ID</label><input class="input" id="issueOrderId" value="${o.id}" readonly></div><div class="form-field" style="position:relative"><label>Issue Type *</label><input class="input" id="issueType" placeholder="Select issue type" readonly style="cursor:pointer"><div id="issueTypeMenu" style="display:none;position:absolute;left:0;right:0;top:88px;background:#05070b;border:1px solid #1f2937;border-radius:14px;overflow:hidden;box-shadow:0 16px 32px rgba(0,0,0,.45);z-index:20">${issueOptions.map(opt=>`<button type="button" data-issue-option="${opt}" style="display:block;width:100%;text-align:left;padding:12px 14px;background:#05070b;border:0;border-bottom:1px solid #1f2937;color:#ffffff;cursor:pointer">${opt}</button>`).join('')}</div></div></div><div class="form-field"><label>Issue Description *</label><textarea class="textarea" id="issueDesc" placeholder="Describe the issue in detail..."></textarea></div><div class="form-field"><label>Upload Photo Evidence (Optional)</label><label for="issueUpload" class="upload-box" style="cursor:pointer;display:block;text-align:center">Click to upload photo<br><span class="helper">PNG, JPG up to 10MB</span><div id="issueUploadName" class="helper" style="margin-top:8px;font-size:12px">No file chosen</div></label><input id="issueUpload" type="file" accept="image/png,image/jpeg,image/jpg" style="display:none"></div><div class="inline" style="margin-top:14px"><button class="btn yellow" type="submit">Submit Report</button><a class="btn light" href="task-details.html?id=${o.id}">Cancel</a></div></form></div><div class="card"><h2 style="margin-top:0">Open Reports</h2><div class="list">${state.issues.length?state.issues.map(i=>`<div class="notify-item"><strong>${i.type}</strong><div class="helper" style="margin-top:8px">${i.description}</div><div class="helper" style="margin-top:8px">Delivery #${i.orderId} • ${i.createdAt}</div></div>`).join(''):`<div class="empty">No reports created yet.</div>`}</div></div></div>`; }
  function renderProof(){const o=detailsOrder(); shellTitle('Proof of Delivery',`Complete Delivery #${o.id}`); return `<div class="grid-2"><div class="card"><h2 style="margin-top:0">Delivery Confirmation</h2><form id="proofForm"><div class="form-field"><label>Delivery ID</label><input class="input" value="${o.id}" readonly></div><div class="form-field"><label>Recipient Name *</label><input class="input" id="proofRecipient" value="${o.proofRecipient||''}" placeholder="Enter recipient name" required minlength="3" maxlength="50" pattern="[A-Za-z ]{3,50}" title="Use 3 to 50 letters only"></div><div class="form-field"><label>Delivery Notes</label><textarea class="textarea" id="proofNote" placeholder="Optional proof notes" maxlength="200">${o.proofNote||''}</textarea></div><div class="form-field"><label>Photo / Signature *</label><div style="display:flex;flex-direction:column;align-items:flex-start;gap:8px"><label for="proofUpload" class="btn yellow" style="cursor:pointer">Choose File</label><input id="proofUpload" type="file" accept="image/*,.png,.jpg,.jpeg,.webp" required style="display:none"><div id="proofUploadName" class="helper" style="font-size:12px;color:#9ca3af">No file chosen</div></div><div class="helper" style="margin-top:8px">Only image files up to 5 MB.</div></div><button class="btn yellow" type="submit">Complete Delivery</button></form></div><div class="card"><h2 style="margin-top:0">Order Summary</h2><table class="table"><tr><th>Customer</th><td>${o.customer}</td></tr><tr><th>Pickup</th><td>${o.pickup}</td></tr><tr><th>Drop</th><td>${o.drop}</td></tr><tr><th>Status</th><td><span class="pill ${o.status}">${statusLabel(o.status)}</span></td></tr><tr><th>Amount</th><td>${rupee(o.amount)}</td></tr></table></div></div>`; }
  function renderProfile(){
    shellTitle('Profile','Driver information and account settings');
    const editing = !!(state.ui && state.ui.profileEdit);
    const dis = editing ? '' : 'disabled';

    return `
      <div class="profile-layout">
        <div class="card text-center">
          <div class="profile-big">${(state.profile.name||'R')[0]}</div>
          <h2 style="margin:0">${state.profile.fullName}</h2>
          <div class="helper" style="margin-top:6px">${state.profile.email}</div>
          <div class="helper">${state.profile.phone}</div>
          <div style="margin-top:14px"><span class="pill assigned">${state.profile.status}</span></div>
        </div>

        <div>
          <div class="kpi-band">
            <div class="card">
              <div class="metric-value" style="font-size:28px">${state.orders.filter(o=>o.status==='completed').length}</div>
              <div class="metric-label">Completed Deliveries</div>
            </div>
            <div class="card">
              <div class="metric-value" style="font-size:28px">${rupee(state.earnings[0].amount)}</div>
              <div class="metric-label">Today's Earnings</div>
            </div>
            <div class="card">
              <div class="metric-value" style="font-size:28px">${state.profile.licenseNumber || '—'}</div>
              <div class="metric-label">License Number</div>
            </div>
          </div>

          <div class="card" style="margin-top:18px">
            <div class="inline" style="justify-content:space-between; align-items:center; gap:12px">
              <h2 style="margin:0">Profile Details</h2>
              <div class="inline" style="gap:10px">
                ${editing
                  ? `<button class="btn" id="profileCancelBtn" type="button">Cancel</button>`
                  : `<button class="btn yellow" id="profileEditBtn" type="button">Edit</button>`}
              </div>
            </div>

            <form id="profileForm" class="form-grid" style="margin-top:12px">
              <div class="form-field">
                <label>Full Name</label>
                <input class="input" id="profileName" value="${state.profile.fullName}" required minlength="3" maxlength="40" pattern="[A-Za-z ]+" title="Letters and spaces only" ${dis}>
              </div>
              <div class="form-field">
                <label>Email</label>
                <input class="input" id="profileEmail" type="email" value="${state.profile.email}" required maxlength="320" title="Enter a valid email address" ${dis}>
              </div>
              <div class="form-field">
                <label>Phone</label>
                <input class="input" id="profilePhone" type="tel" value="${state.profile.phone}" required pattern="[6-9][0-9]{9}" minlength="10" maxlength="10" inputmode="numeric" title="Start with 9, 8, 7, or 6 and use exactly 10 digits" ${dis}>
              </div>
              <div class="form-field">
                <label>License Number</label>
                <input class="input" id="profileLicense" value="${state.profile.licenseNumber||'AA-12-1234-1234567'}" required pattern="[A-Z]{2}-[0-9]{2}-[0-9]{4}-[0-9]{7}" minlength="17" maxlength="17" title="Use AA-12-1234-1234567 format" ${dis}>
              </div>
              <div class="form-field">
                <label>Status</label>
                <select class="select" id="profileStatus" required ${dis}>
                  <option ${state.profile.status==='Available'?'selected':''}>Available</option>
                  <option ${state.profile.status==='On Delivery'?'selected':''}>On Delivery</option>
                  <option ${state.profile.status==='Offline'?'selected':''}>Offline</option>
                </select>
              </div>
              <div class="inline" style="grid-column:1/-1">
                <button class="btn yellow" id="profileSaveBtn" type="submit" ${editing?'':'disabled'}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }
  function renderEarnings(){shellTitle('Earnings','Income summary and payouts'); return `<div class="grid-3">${state.earnings.map(e=>`<div class="card ${e.label==='Today'?'yellow':''}"><div class="meta-label">${e.label}</div><div class="metric-value" style="font-size:34px">${rupee(e.amount)}</div></div>`).join('')}</div><div class="card" style="margin-top:20px"><h2 style="margin-top:0">Completed Orders Revenue</h2><table class="table"><thead><tr><th>Delivery ID</th><th>Customer</th><th>Status</th><th>Amount</th></tr></thead><tbody>${state.orders.filter(o=>o.status==='completed').map(o=>`<tr><td>#${o.id}</td><td>${o.customer}</td><td><span class="pill completed">Completed</span></td><td>${rupee(o.amount)}</td></tr>`).join('')}</tbody></table></div>`; }
  function renderPage(){switch(page){case 'dashboard': return renderDashboard(); case 'tasks': location.href='dashboard.html'; return renderDashboard(); case 'task-details': return renderTaskDetails(); case 'delivery-accepted': return renderProgress(0); case 'delivery-progress-1': return renderProgress(1); case 'delivery-progress-2': return renderProgress(2); case 'map': return renderMap(); case 'notifications': return renderNotifications(); case 'messages': location.href='dashboard.html'; return renderDashboard(); case 'history': return renderHistory(); case 'report-issue': return renderReportIssue(); case 'proof-of-delivery': return renderProof(); case 'profile': return renderProfile(); case 'earnings': return renderEarnings(); default: return renderDashboard();}}
  function render(){if(!content) return; content.innerHTML=renderPage(); bindForms(); renderDropdowns();}
  function bindForms(){const noteForm=document.getElementById('noteForm'); if(noteForm){noteForm.addEventListener('submit', function(e){e.preventDefault(); const noteId=Number(document.getElementById('noteId').value||0)||null; const text=document.getElementById('noteText').value.trim(); if(!text) return driverToast('Enter a note first.'); upsertNote(detailsOrder().id,noteId,text)}); document.getElementById('clearNoteBtn').onclick=function(){document.getElementById('noteId').value=''; document.getElementById('noteText').value='';};}
    const issueForm=document.getElementById('issueForm'); if(issueForm){const issueType=document.getElementById('issueType'), issueMenu=document.getElementById('issueTypeMenu'), issueUpload=document.getElementById('issueUpload'), issueUploadName=document.getElementById('issueUploadName'); if(issueType&&issueMenu){issueType.addEventListener('click',()=>{issueMenu.style.display=issueMenu.style.display==='block'?'none':'block';}); document.querySelectorAll('[data-issue-option]').forEach(btn=>btn.addEventListener('click',()=>{issueType.value=btn.getAttribute('data-issue-option'); issueMenu.style.display='none';})); document.addEventListener('click',(e)=>{if(!e.target.closest('#issueType')&&!e.target.closest('#issueTypeMenu')) issueMenu.style.display='none';});} if(issueUpload&&issueUploadName){issueUpload.addEventListener('change',()=>{issueUploadName.textContent=issueUpload.files&&issueUpload.files[0]?issueUpload.files[0].name:'No file chosen';});} issueForm.addEventListener('submit', function(e){e.preventDefault(); const orderId=Number(document.getElementById('issueOrderId').value),type=document.getElementById('issueType').value.trim(),desc=document.getElementById('issueDesc').value.trim(),file=document.getElementById('issueUpload').files[0]; if(!type||!desc) return driverToast('Fill issue type and description.'); if(file&&file.size>10*1024*1024) return driverToast('Upload an image smaller than 10 MB.'); state.issues.unshift({id:Date.now(),orderId,type,description:desc,photo:file?file.name:'',createdAt:'Just now',status:'Open'}); try{const wf=JSON.parse(localStorage.getItem('dsWorkflowOrders')||'[]')||[]; const order=wf.find(o=>String(o.id).replace(/\D/g,'')===String(orderId)); if(order) order.status='INCIDENT_REPORTED'; localStorage.setItem('dsWorkflowOrders',JSON.stringify(wf)); const incidents=JSON.parse(localStorage.getItem('dsWorkflowIncidents')||'[]')||[]; incidents.unshift({id:Date.now(),orderId:`DS-${orderId}`,type,description:desc,photo:file?file.name:'',createdAt:new Date().toLocaleString(),status:'Reported'}); localStorage.setItem('dsWorkflowIncidents',JSON.stringify(incidents)); const notifs=JSON.parse(localStorage.getItem('dsWorkflowNotifications')||'[]')||[]; notifs.unshift({id:`N-${Date.now()}`,to:'business-client',title:'Incident Reported',message:`Driver reported an incident for order DS-${orderId}. Fleet Manager is reviewing it.`,createdAt:new Date().toISOString()}); notifs.unshift({id:`N-${Date.now()+1}`,to:'super-user',title:'Driver Incident Reported',message:`Driver reported a ${type} incident for order DS-${orderId}.`,createdAt:new Date().toISOString()}); localStorage.setItem('dsWorkflowNotifications',JSON.stringify(notifs)); }catch(e){} state.notifications.unshift({id:Date.now(),title:'Issue Report Submitted',message:`Issue created for Delivery #${orderId}.`,time:'Just now'}); save(state); driverToast('Issue report submitted.'); location.href='history.html';});}
    const proofForm=document.getElementById('proofForm'); if(proofForm){const upload=document.getElementById('proofUpload'), uploadName=document.getElementById('proofUploadName'); if(upload&&uploadName){upload.addEventListener('change',()=>{uploadName.textContent=upload.files&&upload.files[0]?upload.files[0].name:'No file chosen';});} proofForm.addEventListener('submit', function(e){e.preventDefault(); const o=detailsOrder(),recipient=document.getElementById('proofRecipient').value.trim(),file=document.getElementById('proofUpload').files[0]; if(!/^[A-Za-z ]{3,50}$/.test(recipient)) return driverToast('Recipient name must be 3 to 50 letters only.'); if(file && file.size>5*1024*1024) return driverToast('Upload an image smaller than 5 MB.'); if(!file) return driverToast('Photo or signature is required.'); o.proofRecipient=recipient; o.proofNote=document.getElementById('proofNote').value.trim().slice(0,200); o.proofTime=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); setOrderStatus(o.id,'completed'); location.href='history.html';});}
    const profileForm=document.getElementById('profileForm');
    if(profileForm){
      const editBtn=document.getElementById('profileEditBtn');
      const cancelBtn=document.getElementById('profileCancelBtn');

      if(editBtn){
        editBtn.onclick=function(){
          state.ui = state.ui || {};
          state.ui.profileEdit = true;
          save(state);
          render();
          setTimeout(()=>{const el=document.getElementById('profileName'); el && el.focus();}, 0);
        };
      }
      if(cancelBtn){
        cancelBtn.onclick=function(){
          // reset to last saved (and re-pull from core if available)
          state.ui = state.ui || {};
          state.ui.profileEdit = false;
      state = syncProfileFromCore(state);
          save(state);
          render();
        };
      }

      profileForm.addEventListener('submit', function(e){
        e.preventDefault();
        const fullName=document.getElementById('profileName').value.trim();
        const email=document.getElementById('profileEmail').value.trim();
        const phone=document.getElementById('profilePhone').value.trim();
        const license=document.getElementById('profileLicense').value.trim().toUpperCase();

        const emailRegex=/^(?=.{1,64}@)(?=.{6,320}$)(?!\.)(?!.*\.\.)([A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+(?:\.[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+)*)@([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)$/;
        if(!/^[A-Za-z ]+$/.test(fullName) || fullName.length < 2) return driverToast('Full name should contain only letters and spaces.');
        if(!emailRegex.test(email)) return driverToast('Enter a valid email address.');
        if(!/^[6-9]\d{9}$/.test(phone)) return driverToast('Phone number should be 10 digits and start with 9, 8, 7, or 6.');
        if(!/^[A-Z]{2}-\d{2}-\d{4}-\d{7}$/.test(license)) return driverToast('License number should be in AA-12-1234-1234567 format.');

        state.profile.fullName=fullName;
        state.profile.name=fullName.split(' ')[0];
        state.profile.email=email;
        state.profile.phone=phone;
        state.profile.licenseNumber=license;
        state.profile.status=document.getElementById('profileStatus').value;

        // Mirror into shared core state so Superuser edits reflect here and vice-versa.
        syncProfileToCore(state.profile);

        state.ui = state.ui || {};
        state.ui.profileEdit = false;
        save(state);
        driverToast('Profile updated.');
        render();
      });
    }
    const messageForm=document.getElementById('messageForm'); if(messageForm){messageForm.addEventListener('submit', function(e){e.preventDefault(); const to=document.getElementById('msgTo').value.trim()||'Dispatch',subject=document.getElementById('msgSubject').value.trim(),body=document.getElementById('msgBody').value.trim(); if(!subject||!body) return driverToast('Please fill subject and message.'); state.messages.unshift({id:Date.now(),from:`To: ${to}`,subject,body,time:'Just now'}); save(state); driverToast('Message sent in prototype.'); render();});}
    const searchBtn=document.getElementById('applySearch'); if(searchBtn){searchBtn.onclick=function(){const q=document.getElementById('taskSearch').value.trim(),params=new URLSearchParams(location.search); if(q) params.set('q',q); else params.delete('q'); const target='tasks.html?'+params.toString(); window.location.href=(page==='dashboard'?'dashboard.html':'tasks.html')+'?'+params.toString();};} const taskSearch=document.getElementById('taskSearch'); if(taskSearch){taskSearch.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault(); const q=taskSearch.value.trim(),params=new URLSearchParams(location.search); if(q) params.set('q',q); else params.delete('q'); window.location.href=(page==='dashboard'?'dashboard.html':'tasks.html')+'?'+params.toString();}});}
    document.querySelectorAll('[data-filter]').forEach(btn=>{btn.onclick=()=>{const params=new URLSearchParams(location.search); params.set('status',btn.dataset.filter); window.location.href=(page==='dashboard'?'dashboard.html':'tasks.html')+'?'+params.toString();};});
  }
  document.addEventListener('click', function(e){const btn=e.target.closest('[data-action]'); if(!btn) return; const action=btn.dataset.action,id=btn.dataset.id; if(action==='accept'){const order=orderById(id); if(!order) return; if(order.status!=='assigned'){driverToast('Only orders in Assigning status can be accepted.'); return;} if(hasOngoingOrder(id)){driverToast('Submit proof of delivery for your current order before accepting another order.'); return;} setOrderStatus(id,'accepted'); driverToast(`Delivery #${id} accepted.`); location.href=`task-details.html?id=${id}`;} if(action==='reject'){if(confirm(`Reject Delivery #${id}?`)){setOrderStatus(id,'rejected'); driverToast(`Delivery #${id} rejected.`); location.href='dashboard.html?status=rejected';}} if(action==='view'){location.href=`task-details.html?id=${id}`;} if(action==='map'){location.href=`map.html?id=${id}`;} if(action==='open-progress'){setOrderStatus(id,'accepted'); location.href=`delivery-accepted.html?id=${id}`;} if(action==='mark-picked'){setOrderStatus(id,'accepted'); location.href=`delivery-progress-1.html?id=${id}`;} if(action==='mark-transit'){setOrderStatus(id,'in_transit'); location.href=`delivery-progress-2.html?id=${id}`;} if(action==='proof'){setOrderStatus(id,'in_transit'); location.href=`proof-of-delivery.html?id=${id}`;} if(action==='delete-issue'){deleteIssue(Number(btn.dataset.issueId));} if(action==='edit-note'){const note=state.notes.find(n=>n.id===Number(btn.dataset.noteId)); if(note){document.getElementById('noteId').value=note.id; document.getElementById('noteText').value=note.text; window.scrollTo({top:0,behavior:'smooth'});}} if(action==='delete-note'){if(confirm('Delete this note?')) deleteNote(Number(btn.dataset.noteId));} if(action==='delete-notification'){deleteNotification(Number(btn.dataset.notificationId));}});
  if(notifBtn){notifBtn.onclick=function(){location.href='notifications.html';};} if(profileBtn){profileBtn.onclick=function(){location.href='profile.html';};}
  document.addEventListener('click', function(e){if(!e.target.closest('#notifWrap')) notifMenu&&notifMenu.classList.remove('open'); if(!e.target.closest('#profileWrap')) profileMenu&&profileMenu.classList.remove('open');});
  const logoutBtn=document.getElementById('driverLogout'); if(logoutBtn){logoutBtn.onclick=function(){localStorage.removeItem('driverLoggedIn'); sessionStorage.removeItem('driverLoggedIn'); localStorage.removeItem('deliverysync-session-v1'); location.href='../login.html';};}
  document.getElementById('quickProfileName').textContent=state.profile.fullName; document.getElementById('quickProfileEmail').textContent=state.profile.email;
  function renderDropdowns(){if(notifMenu){notifMenu.innerHTML=`<h3>Recent Notifications</h3>`+state.notifications.slice(0,4).map(n=>`<div class="dropdown-item"><strong>${n.title}</strong><small>${n.message}</small><small>${n.time}</small></div>`).join('');}}
  // React to cross-portal edits (Superuser/Fleet Manager) by re-syncing profile.
  window.addEventListener('storage', (e)=>{
    if(e.key === CORE_STORAGE_KEY){
      try{
        state = syncProfileFromCore(load());
        render();
      }catch(_){/* ignore */}
    }
  });

  render();
})();
