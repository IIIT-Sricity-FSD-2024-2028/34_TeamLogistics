/**
 * Fleet Manager backend sync layer.
 * Converts Fleet Manager pages from static/localStorage rows to DeliverySyncAPI calls.
 * It intentionally preserves existing HTML/CSS layout classes.
 */
(function(){
  const D = window.DeliverySyncAPI;
  const page = (location.pathname.split('/').pop() || '').toLowerCase();
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const qs = () => new URLSearchParams(location.search);

  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function content(){ return $('.main .content') || $('.content'); }

  function esc(v){
    return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function pill(v){
    if(window.pillClass) return window.pillClass(v);
    v = String(v || '').toLowerCase();
    if(v.includes('active') || v.includes('available') || v.includes('completed') || v.includes('paid') || v.includes('on duty')) return 'pill-green';
    if(v.includes('trip') || v.includes('pending') || v.includes('scheduled') || v.includes('queue')) return 'pill-yellow';
    if(v.includes('maint') || v.includes('overdue') || v.includes('delayed')) return 'pill-orange';
    if(v.includes('block') || v.includes('suspend') || v.includes('reject') || v.includes('cancel')) return 'pill-red';
    return 'pill-gray';
  }

  function toast(message){
    let t = $('#fm-backend-toast');
    if(!t){
      t = document.createElement('div');
      t.id = 'fm-backend-toast';
      t.style.cssText = 'position:fixed;top:24px;right:24px;background:#1f2937;color:#fff;padding:13px 22px;border-left:4px solid #f7d10a;border-radius:12px;z-index:999999;box-shadow:0 12px 34px rgba(0,0,0,.35);font:600 14px Inter,Arial;opacity:0;transform:translateY(-8px);transition:.2s';
      document.body.appendChild(t);
    }
    t.textContent = message;
    t.style.opacity = '1';
    t.style.transform = 'translateY(0)';
    clearTimeout(toast._id);
    toast._id = setTimeout(()=>{ t.style.opacity = '0'; t.style.transform = 'translateY(-8px)'; }, 2600);
  }

  function money(v){
    if(v === undefined || v === null || v === '') return '--';
    const raw = String(v).replace(/[₹,]/g,'').trim();
    return isNaN(Number(raw)) ? esc(v) : `₹${Number(raw).toLocaleString('en-IN')}`;
  }

  function today(){ return new Date().toISOString().split('T')[0]; }

  function setTopbarFromUser(user){
    if(!user) return;
    const name = user.name || 'Fleet Manager';
    const initials = name.trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase() || 'FM';
    $$('.toptools .usertext strong').forEach(el => el.textContent = name);
    $$('.toptools .avatar').forEach(el => el.textContent = initials);
  }

  async function loadCurrentUser(){
    try{
      const id = D.getCurrentUserId && D.getCurrentUserId();
      if(!id) return null;
      const user = await D.Users.getOne(id);
      setTopbarFromUser(user);
      return user;
    }catch(e){ console.warn('Fleet profile preload failed:', e); return null; }
  }

  function errorBox(msg){
    const root = content();
    if(root) root.innerHTML = `<div class="panel"><div class="panel-body" style="text-align:center;color:#ff8d8d;padding:34px">${esc(msg)}</div></div>`;
  }
(function injectFleetActionMenuCSS(){
  if(document.getElementById('fleet-action-menu-css')) return;

  const style = document.createElement('style');
  style.id = 'fleet-action-menu-css';
  style.textContent = `
    .actions {
      position: relative;
      display: inline-block;
    }

    .actions .dots {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      border: 1px solid #2a2a2a;
      background: #111;
      color: #fff;
      font-size: 20px;
      cursor: pointer;
    }

    .actions .menu {
      position: absolute;
      right: 0;
      top: 46px;
      z-index: 99999;
      min-width: 150px;
      background: #111;
      border: 1px solid #2a2a2a;
      border-radius: 12px;
      padding: 8px;
      display: none;
      box-shadow: 0 16px 40px rgba(0,0,0,0.45);
    }

    .actions:hover .menu,
    .actions:focus-within .menu {
      display: block;
    }

    .actions .menu a,
    .actions .menu button {
      display: block;
      width: 100%;
      padding: 10px 12px;
      border: 0;
      background: transparent;
      color: #fff;
      text-align: left;
      font-size: 14px;
      text-decoration: none;
      border-radius: 8px;
      cursor: pointer;
    }

    .actions .menu a:hover,
    .actions .menu button:hover {
      background: #1f1f1f;
    }

    .actions .menu .danger,
    .actions .menu button.danger {
      color: #ff6b6b;
    }

    tr:nth-last-child(-n + 2) .actions .menu {
      top: auto;
      bottom: 46px;
    }

    .table-card,
    .card,
    .panel,
    .table-wrap,
    table,
    tbody,
    tr,
    td {
      overflow: visible !important;
    }
  `;

  document.head.appendChild(style);
})();

function actionMenu(items){
  return `
    <div class="actions">
      <button class="dots" type="button" aria-label="Actions">⋯</button>
      <div class="menu">
        ${items.join('')}
      </div>
    </div>
  `;
}

  async function renderDashboard(){
    const root = content(); if(!root || !D) return;
    root.innerHTML = `<div class="panel"><div class="panel-body" style="color:#b9b9b9;padding:28px;text-align:center">Loading dashboard from backend...</div></div>`;
    try{
      const [vehicles, drivers, trips, maintenance] = await Promise.all([
        D.Vehicles.getAll(), D.Drivers.getAll(), D.Trips.getAll(), D.Maintenance.getAll('')
      ]);
      const activeVehicles = vehicles.filter(v=>String(v.status).toLowerCase()==='active').length;
      const onTripVehicles = vehicles.filter(v=>String(v.status).toLowerCase().includes('trip')).length;
      const maintVehicles = vehicles.filter(v=>String(v.status).toLowerCase().includes('maint')).length;
      const activeDrivers = drivers.filter(d=>/active|available|on duty/i.test(d.status||'')).length;
      const inProgress = trips.filter(t=>/transit|queued|active|progress/i.test(t.status||'')).length;
      const completed = trips.filter(t=>/complete|delivered/i.test(t.status||'')).length;
      const pendingMaint = maintenance.filter(m=>!/complete/i.test(m.status||'')).length;
      root.innerHTML = `
        <section class="stats">
          <div class="stat"><h3>Total Vehicles</h3><div class="v yellow">${vehicles.length}</div><div class="s">Backend data</div></div>
          <div class="stat"><h3>Active Vehicles</h3><div class="v yellow">${activeVehicles}</div><div class="s">${onTripVehicles} on trip, ${maintVehicles} maintenance</div></div>
          <div class="stat"><h3>Total Drivers</h3><div class="v yellow">${drivers.length}</div><div class="s">${activeDrivers} active/available</div></div>
          <div class="stat"><h3>Trips</h3><div class="v yellow">${trips.length}</div><div class="s">${inProgress} active, ${completed} completed</div></div>
        </section>
        <section class="panel" style="margin-top:18px">
          <div class="panel-head"><div class="panel-title">Live Trip Overview</div></div>
          <table class="table"><thead><tr><th>Trip ID</th><th>Driver</th><th>Vehicle</th><th>Route</th><th>Status</th><th>Action</th></tr></thead><tbody>
          ${trips.slice(0,6).map(t=>`<tr><td class="em">${esc(t.id)}</td><td>${esc(t.driver)}</td><td>${esc(t.vehicle)}</td><td>${esc(t.pickup||'--')} → ${esc(t.destination||'--')}</td><td><span class="pill ${pill(t.status)}">${esc(t.status||'--')}</span></td><td><button class="btn btn-small btn-ghost fm-reassign" data-id="${esc(t.id)}">Reassign</button></td></tr>`).join('') || `<tr><td colspan="6" style="text-align:center;color:#888;padding:18px">No trips found</td></tr>`}
          </tbody></table>
        </section>
        <section class="stats" style="margin-top:18px;grid-template-columns:repeat(2,minmax(0,1fr))">
          <div class="stat"><h3>Pending Maintenance</h3><div class="v yellow">${pendingMaint}</div><div class="s">From backend maintenance records</div></div>
          <div class="stat"><h3>Fleet Health</h3><div class="v yellow">${vehicles.length ? Math.round((activeVehicles/vehicles.length)*100) : 0}%</div><div class="s">Active vehicle ratio</div></div>
        </section>`;
      bindTripReassign();
    }catch(e){ console.error(e); errorBox('Failed to load Fleet Manager dashboard from backend.'); }
  }

async function bindTripReassign(){
  $$('.fm-reassign-select').forEach(select => {
    select.onchange = async function(){
      const tripId = select.dataset.id;
      const driverName = select.value;

      if(!tripId || !driverName) return;

      try{
        await D.Trips.reassign(tripId, driverName);

        toast('Trip reassigned successfully');
        await renderTrips();

      }catch(e){
        console.error('Failed to reassign trip from backend:', e);
        alert('Failed to reassign trip from backend. Check Network response.');
      }
    };
  });
}

  async function renderVehicles(){
    const root = content(); if(!root) return;
    root.innerHTML = `
      <div class="toolbar"><label class="search-sm"><span>⌕</span><input id="vehicleSearch" placeholder="Search vehicles..."/></label><a class="btn btn-yellow" href="add-vehicle.html">＋ Add Vehicle</a></div>
      <section class="panel"><table class="table"><thead><tr><th>Vehicle ID</th><th>Plate Number</th><th>Type</th><th>Status</th><th>Last Maintenance</th><th>Availability</th><th>Actions</th></tr></thead><tbody id="vehicle-body"><tr><td colspan="7" style="text-align:center;padding:18px;color:#888">Loading vehicles...</td></tr></tbody></table></section>`;
    async function draw(){
      try{
        const q = $('#vehicleSearch').value.trim();
        const rows = await D.Vehicles.getAll(q);
        $('#vehicle-body').innerHTML = rows.map(v=>`<tr>
          <td class="em">${esc(v.id)}</td><td>${esc(v.plate || v.plateNumber || '--')}</td><td>${esc(v.type||'--')}</td><td><span class="pill ${pill(v.status)}">${esc(v.status||'--')}</span></td><td>${esc(v.maintenance || v.lastMaintenance || '--')}</td><td>${esc(v.availability || (v.status==='Active'?'Available':'Unavailable'))}</td>
          <td>${actionMenu([`<a href="edit-vehicle.html?id=${encodeURIComponent(v.id)}">Edit</a>`,`<button class="fm-del-vehicle danger" data-id="${esc(v.id)}">Delete</button>`])}</td></tr>`).join('') || `<tr><td colspan="7" style="text-align:center;padding:18px;color:#888">No vehicles found</td></tr>`;
        $$('.fm-del-vehicle').forEach(btn=>btn.onclick=async()=>{ if(!confirm(`Delete vehicle ${btn.dataset.id}?`)) return; await D.Vehicles.delete(btn.dataset.id); toast('Vehicle deleted'); draw(); });
      }catch(e){ console.error(e); $('#vehicle-body').innerHTML = `<tr><td colspan="7" style="text-align:center;color:#ff8d8d;padding:18px">Failed to load vehicles from backend.</td></tr>`; }
    }
    $('#vehicleSearch').oninput = draw;
    await draw();
  }

  function vehicleFormHTML(title, button, v={}){
    const maint = (v.maintenance || v.lastMaintenance || '').match(/^\d{4}-\d{2}-\d{2}$/) ? (v.maintenance || v.lastMaintenance) : '';
    return `<a class="muted" href="vehicles.html">← Back</a><section class="panel" style="margin-top:14px"><div class="panel-head"><div class="panel-title">${title}</div></div><div class="panel-body"><div class="form-grid">
      <div class="field"><label>Plate Number</label><input id="fmv-plate" value="${esc(v.plate||'')}"><div class="field-error" id="err-plate"></div></div>
      <div class="field"><label>Vehicle Type</label><select id="fmv-type">${['Mini Truck','Van','Truck','Bike','SUV','Cargo Van'].map(t=>`<option ${v.type===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label>Capacity</label><input id="fmv-capacity" value="${esc(v.capacity||'')}"></div>
      <div class="field"><label>Status</label><select id="fmv-status">${['Active','On Trip','Maintenance','Blocked'].map(s=>`<option ${v.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label>Assigned Driver</label><input id="fmv-driver" value="${esc(v.assignedDriver||v.driver||'')}"></div>
      <div class="field"><label>Last Maintenance Date</label><input id="fmv-maint" type="date" max="${today()}" value="${esc(maint)}"><div class="field-error" id="err-maint"></div></div>
      </div><div class="footer-actions"><a class="btn btn-ghost" href="vehicles.html">Cancel</a><button class="btn btn-yellow" id="saveVehicle">${button}</button></div></div></section>`;
  }

  async function renderAddVehicle(){
    const root = content(); if(!root) return;
    root.innerHTML = vehicleFormHTML('Add New Vehicle','Create Vehicle');
    $('#saveVehicle').onclick = async ()=>{
      $('#err-plate').textContent = ''; $('#err-maint').textContent = '';
      const plate = $('#fmv-plate').value.trim(); const maintenance = $('#fmv-maint').value.trim();
      if(!plate){ $('#err-plate').textContent='Plate number is required'; return; }
      if(maintenance && maintenance > today()){ $('#err-maint').textContent='Future date is not allowed'; return; }
      const payload = { plate, type: $('#fmv-type').value, capacity: $('#fmv-capacity').value.trim(), status: $('#fmv-status').value, assignedDriver: $('#fmv-driver').value.trim(), maintenance };
      try{ await D.Vehicles.create(payload); toast('Vehicle created'); location.href='vehicles.html'; }catch(e){ console.error(e); alert('Failed to create vehicle from backend'); }
    };
  }

  async function renderEditVehicle(){
  const root = content(); 
  if(!root) return;

  const id = qs().get('id');

  root.innerHTML = `
    <div class="panel">
      <div class="panel-body" style="text-align:center;color:#888;padding:24px">
        Loading vehicle...
      </div>
    </div>
  `;

  try{
    const v = await D.Vehicles.getOne(id);
    const drivers = await D.Drivers.getAll();

    root.innerHTML = vehicleFormHTML('Edit Vehicle','Update Vehicle',v);

    const driverSelect = $('#fmv-driver');

    if(driverSelect){
      const currentDriver = v.assignedDriver || v.driver || '';

      driverSelect.outerHTML = `
        <select id="fmv-driver">
          <option value="">Select Driver</option>
          ${(drivers || []).map(function(driver){
            const driverName = driver.name || driver.driver || driver.fullName || driver.username || '';
            const selected = driverName === currentDriver ? 'selected' : '';

            return `
              <option value="${esc(driverName)}" ${selected}>
                ${esc(driverName)}
              </option>
            `;
          }).join('')}
        </select>
        <div class="error" id="err-driver"></div>
      `;
    }

    $('#saveVehicle').onclick = async ()=>{
      $('#err-plate').textContent = '';
      $('#err-maint').textContent = '';

      const driverError = $('#err-driver');
      if(driverError) driverError.textContent = '';

      const plate = $('#fmv-plate').value.trim().toUpperCase();
      const maintenance = $('#fmv-maint').value.trim();
      const assignedDriver = $('#fmv-driver').value.trim();

      const indianPlateRegex = /^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{1,2}[ -]?[0-9]{4}$/;

      let ok = true;

      if(!plate){
        $('#err-plate').textContent = 'Plate number is required';
        ok = false;
      } 
      else if(!indianPlateRegex.test(plate)){
        $('#err-plate').textContent = 'Enter valid Indian plate number, e.g. KA 01 MG 2323 or DL 2C AA 1111';
        ok = false;
      }

      if(maintenance && maintenance > today()){
        $('#err-maint').textContent = 'Future date is not allowed';
        ok = false;
      }

      if(!assignedDriver && driverError){
        driverError.textContent = 'Please select assigned driver';
        ok = false;
      }

      if(!ok) return;

      const payload = { 
        plate, 
        type: $('#fmv-type').value, 
        capacity: $('#fmv-capacity').value.trim(), 
        status: $('#fmv-status').value, 
        assignedDriver, 
        maintenance 
      };

      await D.Vehicles.update(id, payload); 
      toast('Vehicle updated'); 
      location.href = 'vehicles.html';
    };

  } catch(e){ 
    console.error(e); 
    errorBox('Failed to load vehicle from backend.'); 
  }
}

 async function renderDrivers(){
  const root = content(); 
  if(!root) return;

  root.innerHTML = `
    <div class="toolbar">
      <label class="search-sm">
        <span>⌕</span>
        <input id="driverSearch" placeholder="Search drivers..."/>
      </label>
    </div>

    <section class="panel">
      <table class="table">
        <thead>
          <tr>
            <th>Driver</th>
            <th>License Number</th>
            <th>Phone</th>
            <th>Status</th>
            <th>Rating</th>
            <th>Last Trip</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody id="driver-body">
          <tr>
            <td colspan="7" style="text-align:center;color:#888;padding:18px">
              Loading drivers...
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  `;

  const addDriverBtn = document.getElementById('addDriverBtn');

  if(addDriverBtn){
    addDriverBtn.onclick = function(){
      window.location.href = 'add-driver-step1.html';
    };
  }

  async function draw(){
    try{
      const rows = await D.Drivers.getAll($('#driverSearch').value.trim());

      $('#driver-body').innerHTML = rows.map(d => `
        <tr>
          <td class="em">${esc(d.name)}</td>
          <td>${esc(d.license || '--')}</td>
          <td>${esc(d.phone || '--')}</td>
          <td>
            <span class="pill ${pill(d.status)}">
              ${esc(d.status || '--')}
            </span>
          </td>
          <td>${esc(d.rating || '--')}</td>
          <td>${esc(d.trip || '--')}</td>
          <td>
            ${actionMenu([
              `<a href="driver-profile.html?id=${encodeURIComponent(d.id)}">View</a>`,
              `<a href="edit-driver.html?id=${encodeURIComponent(d.id)}">Edit</a>`,
              `<button class="fm-driver-status" data-id="${esc(d.id)}" data-status="${esc(d.status || '')}">
                ${/suspend/i.test(d.status || '') ? 'Enable' : 'Suspend'}
              </button>`,
              `<button class="fm-del-driver danger" data-id="${esc(d.id)}">Delete</button>`
            ])}
          </td>
        </tr>
      `).join('') || `
        <tr>
          <td colspan="7" style="text-align:center;color:#888;padding:18px">
            No drivers found
          </td>
        </tr>
      `;

      $$('.fm-del-driver').forEach(btn => btn.onclick = async () => { 
        if(!confirm(`Delete driver ${btn.dataset.id}?`)) return; 

        await D.Drivers.delete(btn.dataset.id); 
        toast('Driver deleted'); 
        draw(); 
      });

      $$('.fm-driver-status').forEach(btn => btn.onclick = async () => { 
        const cur = btn.dataset.status || ''; 
        const next = /suspend/i.test(cur) ? 'Available' : 'Suspended'; 
        const d = await D.Drivers.getOne(btn.dataset.id); 

        await D.Drivers.update(btn.dataset.id, {
          name: d.name,
          phone: d.phone || '',
          zone: d.zone || '',
          vehicle: d.vehicle || '',
          status: next,
          license: d.license || '',
          email: d.email || ''
        }); 

        toast('Driver status updated'); 
        draw(); 
      });

    } catch(e){ 
      console.error(e); 

      $('#driver-body').innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;color:#ff8d8d;padding:18px">
            Failed to load drivers from backend.
          </td>
        </tr>
      `; 
    }
  }

  $('#driverSearch').oninput = draw; 
  await draw();
}

  function driverFormHTML(title, button, d={}){
    return `<a class="muted" href="drivers.html">← Back</a><section class="panel" style="margin-top:14px"><div class="panel-head"><div class="panel-title">${title}</div></div><div class="panel-body"><div class="form-grid">
      <div class="field"><label>Full Name</label><input id="fmd-name" value="${esc(d.name||'')}"><div class="field-error" id="err-d-name"></div></div>
      <div class="field"><label>Phone</label><input id="fmd-phone" value="${esc(d.phone||'')}"><div class="field-error" id="err-d-phone"></div></div>
      <div class="field"><label>Email</label><input id="fmd-email" value="${esc(d.email||'')}"><div class="field-error" id="err-d-email"></div></div>
      <div class="field"><label>License Number</label><input id="fmd-license" value="${esc(d.license||'')}"></div>
      <div class="field"><label>Zone</label><input id="fmd-zone" value="${esc(d.zone||'')}"></div>
      <div class="field"><label>Vehicle</label><input id="fmd-vehicle" value="${esc(d.vehicle||'')}"></div>
      <div class="field"><label>Status</label><select id="fmd-status">${['Available','On Duty','Suspended','Rejected'].map(s=>`<option ${d.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
      </div><div class="footer-actions"><a class="btn btn-ghost" href="drivers.html">Cancel</a><button class="btn btn-yellow" id="saveDriver">${button}</button></div></div></section>`;
  }

  function getDriverPayload(){ return { name: $('#fmd-name').value.trim(), phone: $('#fmd-phone').value.trim(), email: $('#fmd-email').value.trim(), license: $('#fmd-license').value.trim(), zone: $('#fmd-zone').value.trim(), vehicle: $('#fmd-vehicle').value.trim(), status: $('#fmd-status').value }; }
  function validDriver(payload){
    ['err-d-name','err-d-phone','err-d-email'].forEach(id=>{ const el=$('#'+id); if(el) el.textContent=''; });
    let ok=true; if(!/^[A-Za-z][A-Za-z\s]{2,79}$/.test(payload.name)){ $('#err-d-name').textContent='Enter a valid name'; ok=false; }
    if(!/^\+?\d[\d\s-]{8,16}$/.test(payload.phone)){ $('#err-d-phone').textContent='Enter a valid phone number'; ok=false; }
    if(payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)){ $('#err-d-email').textContent='Enter a valid email'; ok=false; }
    return ok;
  }

 async function renderAddDriver(){
  const root = content(); 
  if(!root) return;

  root.innerHTML = driverFormHTML('Add Driver','Create Driver');

  ['phone','email','license','zone','vehicle'].forEach(function(field){
    const input = document.getElementById('fmd-' + field);

    if(input && !document.getElementById('err-' + field)){
      input.insertAdjacentHTML('afterend', `<div class="error" id="err-${field}"></div>`);
    }
  });

  $('#saveDriver').onclick = async () => {
    ['phone','email','license','zone','vehicle'].forEach(function(field){
      const err = document.getElementById('err-' + field);
      if(err) err.textContent = '';
    });

    const payload = getDriverPayload();

    payload.phone = String(payload.phone || '').trim();
    payload.email = String(payload.email || '').trim();
    payload.license = String(payload.license || '').trim().toUpperCase();
    payload.zone = String(payload.zone || '').trim();
    payload.vehicle = String(payload.vehicle || '').trim().toUpperCase();

    let ok = true;

    const phoneRegex = /^[6-9]\d{9}$/;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
    const licenseRegex = /^[A-Z]{2}[ -]?[0-9]{2}[ -]?[0-9]{4}[ -]?[0-9]{7}$/;
    const vehiclePlateRegex = /^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{1,2}[ -]?[0-9]{4}$/;
    const zoneRegex = /^[A-Za-z0-9 ]{2,60}$/;

    if(!phoneRegex.test(payload.phone)){
      $('#err-phone').textContent = 'Phone must start with 6, 7, 8, or 9 and contain exactly 10 digits';
      ok = false;
    }

    if(!emailRegex.test(payload.email)){
      $('#err-email').textContent = 'Enter a valid email address';
      ok = false;
    }

    if(!licenseRegex.test(payload.license)){
      $('#err-license').textContent = 'License must be like TN03 2018 0003452';
      ok = false;
    }

    if(!zoneRegex.test(payload.zone)){
      $('#err-zone').textContent = 'Zone is required and can contain letters, numbers, and spaces only';
      ok = false;
    }

    if(!vehiclePlateRegex.test(payload.vehicle)){
      $('#err-vehicle').textContent = 'Vehicle must be like KA 01 MG 2323, DL 2C AA 1111, or TN09AB1234';
      ok = false;
    }

    if(!ok) return;

    if(typeof validDriver === 'function' && !validDriver(payload)) return;

    try{ 
      await D.Drivers.create(payload); 
      toast('Driver created'); 
      location.href = 'drivers.html'; 
    } catch(e){ 
      console.error(e); 
      alert('Failed to create driver from backend'); 
    } 
  };
}

 async function renderEditDriver(){
  const root = content(); 
  if(!root) return; 

  const id = qs().get('id');

  root.innerHTML = `
    <div class="panel">
      <div class="panel-body" style="text-align:center;color:#888;padding:24px">
        Loading driver...
      </div>
    </div>
  `;

  try{ 
    const d = await D.Drivers.getOne(id); 

    root.innerHTML = driverFormHTML('Edit Driver','Save Changes',d);

    ['phone','email','license','zone','vehicle'].forEach(function(field){
      const input = document.getElementById('fmd-' + field);

      if(input && !document.getElementById('err-' + field)){
        input.insertAdjacentHTML('afterend', `<div class="error" id="err-${field}"></div>`);
      }
    });

    $('#saveDriver').onclick = async () => {
      ['phone','email','license','zone','vehicle'].forEach(function(field){
        const err = document.getElementById('err-' + field);
        if(err) err.textContent = '';
      });

      const payload = getDriverPayload();

      payload.phone = String(payload.phone || '').trim();
      payload.email = String(payload.email || '').trim();
      payload.license = String(payload.license || '').trim().toUpperCase();
      payload.zone = String(payload.zone || '').trim();
      payload.vehicle = String(payload.vehicle || '').trim().toUpperCase();

      let ok = true;

      const phoneRegex = /^[6-9]\d{9}$/;
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
      const licenseRegex = /^[A-Z]{2}[ -]?[0-9]{2}[ -]?[0-9]{4}[ -]?[0-9]{7}$/;
      const vehiclePlateRegex = /^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{1,2}[ -]?[0-9]{4}$/;
      const zoneRegex = /^[A-Za-z0-9 ]{2,60}$/;

      if(!phoneRegex.test(payload.phone)){
        $('#err-phone').textContent = 'Phone must start with 6, 7, 8, or 9 and contain exactly 10 digits';
        ok = false;
      }

      if(!emailRegex.test(payload.email)){
        $('#err-email').textContent = 'Enter a valid email address';
        ok = false;
      }

      if(!licenseRegex.test(payload.license)){
        $('#err-license').textContent = 'License must be like TN03 2018 0003452';
        ok = false;
      }

      if(!zoneRegex.test(payload.zone)){
        $('#err-zone').textContent = 'Zone is required and can contain letters, numbers, and spaces only';
        ok = false;
      }

      if(!vehiclePlateRegex.test(payload.vehicle)){
        $('#err-vehicle').textContent = 'Vehicle must be like KA 01 MG 2323, DL 2C AA 1111, or TN09AB1234';
        ok = false;
      }

      if(!ok) return;

      if(typeof validDriver === 'function' && !validDriver(payload)) return;

      await D.Drivers.update(id, payload); 
      toast('Driver updated'); 
      location.href = 'drivers.html'; 
    }; 

  } catch(e){ 
    console.error(e); 
    errorBox('Failed to load driver from backend.'); 
  }
}
  async function renderDriverProfile(){
    const root = content(); if(!root) return; const id = qs().get('id');
    root.innerHTML = `<div class="panel"><div class="panel-body" style="text-align:center;color:#888;padding:24px">Loading driver profile...</div></div>`;
    try{
      const d = await D.Drivers.getOne(id);
      const initials = (d.name||'DR').split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();
      root.innerHTML = `<a class="muted" href="drivers.html">← Back to Drivers</a><section class="hero" style="margin-top:14px"><div style="display:flex;align-items:center;gap:16px"><div style="width:74px;height:74px;border-radius:24px;background:var(--yellow);display:grid;place-items:center;color:#111;font-size:34px;font-weight:800">${esc(initials)}</div><div><h2 style="margin:0 0 6px">${esc(d.name)} <span class="pill ${pill(d.status)}">${esc(d.status||'--')}</span></h2><p>${esc(d.id)} · ${esc(d.phone||'--')} · ${esc(d.email||'--')}</p><div class="rating">★★★★★ <span style="color:#ddd;font-size:16px">${esc(d.rating||'--')}</span></div></div></div><div style="display:flex;gap:12px"><a class="btn btn-yellow" href="edit-driver.html?id=${encodeURIComponent(d.id)}">Edit Driver</a></div></section><section class="panel" style="margin-top:16px"><div class="panel-head"><div class="panel-title">Driver Information</div></div><div class="panel-body"><div class="cards2"><div class="mini"><strong>Driver ID</strong><span>${esc(d.id)}</span></div><div class="mini"><strong>Full Name</strong><span>${esc(d.name)}</span></div><div class="mini"><strong>Phone</strong><span>${esc(d.phone||'--')}</span></div><div class="mini"><strong>Email</strong><span>${esc(d.email||'--')}</span></div><div class="mini"><strong>License</strong><span>${esc(d.license||'--')}</span></div><div class="mini"><strong>Assigned Vehicle</strong><span>${esc(d.vehicle||'--')}</span></div><div class="mini"><strong>Zone</strong><span>${esc(d.zone||'--')}</span></div><div class="mini"><strong>Last Trip</strong><span>${esc(d.trip||'--')}</span></div></div></div></section>`;
    }catch(e){ console.error(e); errorBox('Failed to load driver from backend.'); }
  }

  async function renderMaintenance(){
    const root = content(); if(!root) return;
    root.innerHTML = `<div class="toolbar"><label class="search-sm"><span>⌕</span><input id="maintSearch" placeholder="Search maintenance..."/></label><a class="btn btn-yellow" href="schedule-maintenance.html">＋ Schedule Maintenance</a></div><section class="panel"><table class="table"><thead><tr><th>ID</th><th>Vehicle</th><th>Issue</th><th>Priority</th><th>Status</th><th>Scheduled Date</th><th>Mechanic</th><th>Est. Cost</th><th>Actions</th></tr></thead><tbody id="maintBody"><tr><td colspan="9" style="text-align:center;color:#888;padding:18px">Loading maintenance...</td></tr></tbody></table></section>`;
    async function draw(){
      try{ const rows=await D.Maintenance.getAll($('#maintSearch').value.trim()); $('#maintBody').innerHTML=rows.map(m=>`<tr><td class="em">${esc(m.id)}</td><td>${esc(m.vehicle)}</td><td>${esc(m.issue)}</td><td><span class="pill ${pill(m.priority)}">${esc(m.priority)}</span></td><td><span class="pill ${pill(m.status)}">${esc(m.status||'Scheduled')}</span></td><td>${esc(m.date)}</td><td>${esc(m.mechanic)}</td><td class="em">${money(m.cost)}</td><td>${actionMenu([`<a class="btn btn-small btn-ghost" href="schedule-maintenance.html?id=${encodeURIComponent(m.id)}">Edit</a>`,`<button class="btn btn-small btn-ghost fm-del-maint" data-id="${esc(m.id)}">Delete</button>`])}</td></tr>`).join('') || `<tr><td colspan="9" style="text-align:center;color:#888;padding:18px">No maintenance records found</td></tr>`; $$('.fm-del-maint').forEach(btn=>btn.onclick=async()=>{ if(!confirm(`Delete maintenance record ${btn.dataset.id}?`)) return; await D.Maintenance.delete(btn.dataset.id); toast('Maintenance deleted'); draw(); }); }catch(e){ console.error(e); $('#maintBody').innerHTML=`<tr><td colspan="9" style="text-align:center;color:#ff8d8d;padding:18px">Failed to load maintenance from backend.</td></tr>`; }
    }
    $('#maintSearch').oninput = draw; await draw();
  }

  async function renderScheduleMaintenance(){
    const root=content(); if(!root) return; const id=qs().get('id');
    let existing=null, vehicles=[]; try{ [vehicles] = await Promise.all([D.Vehicles.getAll()]); if(id) existing=await D.Maintenance.getOne(id); }catch(e){ console.warn(e); }
    const issueTypes=['Engine Oil Change','Brake Pad Replacement','Tire Rotation & Balance','Air Filter Replacement','Transmission Service']; const mechanics=['Ravi Auto Service','SpeedFix Workshop','AutoCare Pro'];
    root.innerHTML = `<div style="margin-bottom:18px"><a class="btn btn-ghost" href="maintenance.html">← Back</a></div><div class="split"><div class="stack"><div class="info-card"><h3>Vehicle & Issue Details</h3><div class="field"><label>Vehicle *</label><select id="mVehicle"><option value="">Select vehicle</option>${vehicles.map(v=>{const plate=v.plate||v.id;return `<option value="${esc(plate)}" ${(existing&&(existing.vehicle===plate||existing.vehicleId===plate))?'selected':''}>${esc(plate)}${v.type?' - '+esc(v.type):''}</option>`}).join('')}</select><div class="field-error" id="err-mVehicle"></div></div><div class="field"><label>Issue Type *</label><select id="mIssue"><option value="">Select issue</option>${issueTypes.map(x=>`<option ${existing&&existing.issue===x?'selected':''}>${x}</option>`).join('')}</select><div class="field-error" id="err-mIssue"></div></div><div class="field"><label>Priority *</label><select id="mPriority">${['Low','Medium','High','Critical'].map(x=>`<option ${existing&&existing.priority===x?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="info-card"><h3>Additional Notes</h3><div class="field"><textarea id="mNotes" placeholder="Enter any special instructions or notes for the mechanic...">${esc(existing&&existing.notes||'')}</textarea></div></div></div><div class="stack"><div class="info-card"><h3>Scheduling & Assignment</h3><div class="field"><label>Scheduled Date *</label><input id="mDate" type="date" value="${esc(existing&&/^\d{4}-/.test(existing.date||'')?existing.date:'')}"><div class="field-error" id="err-mDate"></div></div><div class="field"><label>Assigned Mechanic *</label><select id="mMechanic"><option value="">Select mechanic</option>${mechanics.map(x=>`<option ${existing&&existing.mechanic===x?'selected':''}>${x}</option>`).join('')}</select><div class="field-error" id="err-mMechanic"></div></div><div class="field"><label>Estimated Cost (₹)</label><input id="mCost" placeholder="e.g. 1200" value="${esc(existing&&existing.cost?String(existing.cost).replace(/[₹,]/g,''):'')}"><div class="field-error" id="err-mCost"></div></div></div><div class="info-card"><h3>Summary Preview</h3><div class="summary-list" id="summaryBox"></div></div></div></div><div class="foot-actions"><div></div><div class="right-actions"><a class="btn btn-ghost" href="maintenance.html">✕ Cancel</a><button class="btn btn-yellow" id="saveMaint">${existing?'Update':'Schedule'} Maintenance</button></div></div>`;
    function updateSummary(){ const rows=[['Vehicle',$('#mVehicle').value||'—'],['Issue',$('#mIssue').value||'—'],['Priority',$('#mPriority').value||'—'],['Date',$('#mDate').value||'—'],['Mechanic',$('#mMechanic').value||'—'],['Est. Cost',$('#mCost').value?`₹${$('#mCost').value}`:'—']]; $('#summaryBox').innerHTML=rows.map(r=>`<div class="summary-row"><span>${r[0]}</span><span>${esc(r[1])}</span></div>`).join(''); }
    $$('#mVehicle,#mIssue,#mPriority,#mDate,#mMechanic,#mCost').forEach(el=>{el.oninput=updateSummary; el.onchange=updateSummary;}); updateSummary();
    $('#saveMaint').onclick=async()=>{ ['mVehicle','mIssue','mDate','mMechanic','mCost'].forEach(x=>{const e=$('#err-'+x); if(e)e.textContent='';}); const vehicle=$('#mVehicle').value.trim(), issue=$('#mIssue').value.trim(), priority=$('#mPriority').value, date=$('#mDate').value.trim(), mechanic=$('#mMechanic').value.trim(), cost=$('#mCost').value.trim(), notes=$('#mNotes').value.trim(); let ok=true; if(!vehicle){$('#err-mVehicle').textContent='Select a vehicle';ok=false;} if(!issue){$('#err-mIssue').textContent='Select issue type';ok=false;} if(!date){$('#err-mDate').textContent='Date is required';ok=false;} if(!mechanic){$('#err-mMechanic').textContent='Select mechanic';ok=false;} if(cost&&!/^\d{1,7}(\.\d{1,2})?$/.test(cost)){ $('#err-mCost').textContent='Enter valid cost in rupees'; ok=false; } if(!ok) return; const payload={vehicle,issue,priority,date,mechanic,cost:cost?`₹${cost}`:'--',notes}; try{ if(existing) await D.Maintenance.update(id,payload); else await D.Maintenance.create(payload); toast('Maintenance saved'); location.href='maintenance.html'; }catch(e){ console.error(e); alert('Failed to save maintenance from backend'); } };
  }
async function renderCompliance(){
  const root = content();
  if(!root) return;

  root.innerHTML = `
    <div class="panel">
      <div class="panel-body" style="text-align:center;color:#888;padding:24px">
        Loading compliance data from backend...
      </div>
    </div>
  `;

  function parseDate(value){
    if(!value) return null;

    const d = new Date(value);
    if(!isNaN(d.getTime())) return d;

    return null;
  }

  function formatDate(value){
    const d = parseDate(value);
    if(!d) return value || '--';

    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function getLicenseStatus(driver){
    const raw = String(driver.licenseStatus || '').trim();
    if(raw) return raw;

    const expiry = parseDate(driver.licenseExpiry || driver.expiry || driver.documentExpiry);

    if(!expiry) return 'Valid';

    const todayDate = new Date();
    todayDate.setHours(0,0,0,0);

    if(expiry < todayDate) return 'Expired';

    return 'Valid';
  }

  function getViolations(driver){
    const value = driver.violations ?? driver.violationCount ?? driver.totalViolations ?? 0;
    const num = Number(String(value).replace(/\D/g, ''));

    return isNaN(num) ? 0 : num;
  }

  function getOverallStatus(driver){
    const explicit = String(driver.complianceStatus || driver.overallStatus || '').trim();
    if(explicit) return explicit;

    const licenseStatus = getLicenseStatus(driver);
    const violations = getViolations(driver);
    const status = String(driver.status || '').toLowerCase();

    if(licenseStatus.toLowerCase() === 'expired') return 'Non-Compliant';
    if(status.includes('suspend')) return 'Non-Compliant';
    if(violations >= 3) return 'Non-Compliant';
    if(violations >= 1) return 'Needs Attention';

    return 'Compliant';
  }

  function licensePill(status){
    const s = String(status || '').toLowerCase();

    if(s.includes('expired')) return 'pill-red';
    if(s.includes('review')) return 'pill-yellow';
    return 'pill-green';
  }

  function overallPill(status){
    const s = String(status || '').toLowerCase();

    if(s.includes('non')) return 'pill-red';
    if(s.includes('attention')) return 'pill-yellow';
    return 'pill-green';
  }

  function violationPill(count){
    if(count >= 3) return 'pill-red';
    if(count >= 1) return 'pill-orange';
    return 'pill-green';
  }

  function metric(title, value){
    return `
      <div class="stat">
        <h3>${esc(title)}</h3>
        <div class="v yellow">${esc(value)}</div>
      </div>
    `;
  }

  try{
    const drivers = await D.Drivers.getAll();
    const rows = drivers || [];

    const totalDrivers = rows.length;

    const compliant = rows.filter(function(d){
      return getOverallStatus(d) === 'Compliant';
    }).length;

    const needsAttention = rows.filter(function(d){
      return getOverallStatus(d) === 'Needs Attention';
    }).length;

    const nonCompliant = rows.filter(function(d){
      return getOverallStatus(d) === 'Non-Compliant';
    }).length;

    const expiredDocs = rows.filter(function(d){
      return getLicenseStatus(d) === 'Expired';
    }).length;

    const totalViolations = rows.reduce(function(sum, d){
      return sum + getViolations(d);
    }, 0);

    root.innerHTML = `
      <section class="stats" style="grid-template-columns:repeat(6,minmax(0,1fr));margin-bottom:18px">
        ${metric('Total Drivers', totalDrivers)}
        ${metric('Fully Compliant', compliant)}
        ${metric('Needs Attention', needsAttention)}
        ${metric('Non-Compliant', nonCompliant)}
        ${metric('Expired Documents', expiredDocs)}
        ${metric('Total Violations', totalViolations)}
      </section>

      <div class="toolbar">
        <label class="search-sm">
          <span>⌕</span>
          <input id="complianceSearch" placeholder="Search drivers..."/>
        </label>

        <div class="btn btn-ghost" style="pointer-events:none">
          ▣ ${expiredDocs} Documents Expiring / Expired
        </div>
      </div>

      <section class="panel">
        <table class="table">
          <thead>
            <tr>
              <th>Driver</th>
              <th>License Status</th>
              <th>License Expiry</th>
              <th>Violations</th>
              <th>Overall Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody id="complianceBody">
            <tr>
              <td colspan="6" style="text-align:center;color:#888;padding:18px">
                Loading compliance records...
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    `;

    function draw(){
      const q = ($('#complianceSearch')?.value || '').trim().toLowerCase();

      const filtered = rows.filter(function(d){
        return [
          d.name,
          d.id,
          d.license,
          d.phone,
          d.status
        ].join(' ').toLowerCase().includes(q);
      });

      $('#complianceBody').innerHTML = filtered.map(function(d){
        const licenseStatus = getLicenseStatus(d);
        const expiry = d.licenseExpiry || d.expiry || d.documentExpiry || '--';
        const violations = getViolations(d);
        const overall = getOverallStatus(d);

        return `
          <tr>
            <td>
              <div class="em">${esc(d.name || '--')}</div>
              <div class="muted">${esc(d.id || '--')}</div>
            </td>

            <td>
              <span class="pill ${licensePill(licenseStatus)}">
                ${esc(licenseStatus)}
              </span>
            </td>

            <td>${esc(formatDate(expiry))}</td>

            <td>
              <span class="pill ${violationPill(violations)}">
                ${violations} ${violations === 1 ? 'violation' : 'violations'}
              </span>
            </td>

            <td>
              <span class="pill ${overallPill(overall)}">
                ${esc(overall)}
              </span>
            </td>

            <td>
              ${actionMenu([
                `<a href="driver-profile.html?id=${encodeURIComponent(d.id)}">View Driver</a>`,
                `<a href="edit-driver.html?id=${encodeURIComponent(d.id)}">Edit Driver</a>`,
                `<button class="fm-compliance-status" data-id="${esc(d.id)}" data-status="${esc(d.status || '')}">
                  ${/suspend/i.test(d.status || '') ? 'Enable Driver' : 'Suspend Driver'}
                </button>`
              ])}
            </td>
          </tr>
        `;
      }).join('') || `
        <tr>
          <td colspan="6" style="text-align:center;color:#888;padding:18px">
            No compliance records found.
          </td>
        </tr>
      `;

      $$('.fm-compliance-status').forEach(function(btn){
        btn.onclick = async function(){
          const current = btn.dataset.status || '';
          const next = /suspend/i.test(current) ? 'Available' : 'Suspended';

          if(!confirm(`Change driver status to ${next}?`)) return;

          try{
            const d = await D.Drivers.getOne(btn.dataset.id);

            await D.Drivers.update(btn.dataset.id, {
              name: d.name,
              phone: d.phone || '',
              email: d.email || '',
              license: d.license || '',
              zone: d.zone || '',
              vehicle: d.vehicle || '',
              status: next
            });

            toast('Driver status updated');
            await renderCompliance();

          }catch(error){
            console.error(error);
            alert('Failed to update driver status from backend');
          }
        };
      });
    }

    $('#complianceSearch').oninput = draw;
    draw();

  }catch(error){
    console.error(error);

    root.innerHTML = `
      <div class="panel">
        <div class="panel-body" style="text-align:center;color:#ff8d8d;padding:24px">
          Failed to load compliance data from backend.
        </div>
      </div>
    `;
  }
}
async function renderTrips(){
  const root = content(); 
  if(!root) return;

  root.innerHTML = `
    <div class="toolbar">
      <label class="search-sm">
        <span>⌕</span>
        <input id="tripSearch" placeholder="Search trips..."/>
      </label>
    </div>

    <section class="panel">
      <table class="table">
        <thead>
          <tr>
            <th>Trip ID</th>
            <th>Driver</th>
            <th>Vehicle</th>
            <th>Route</th>
            <th>Start Time</th>
            <th>Distance</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody id="tripBody">
          <tr>
            <td colspan="8" style="text-align:center;color:#888;padding:18px">
              Loading trips...
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  `;

  async function draw(){ 
    try{ 
      const [rows, drivers] = await Promise.all([
        D.Trips.getAll($('#tripSearch').value.trim()),
        D.Drivers.getAll()
      ]);

      const availableDrivers = (drivers || []).filter(function(d){
        return !/suspend|reject/i.test(d.status || '');
      });

      $('#tripBody').innerHTML = rows.map(t => `
        <tr>
          <td class="em">${esc(t.id)}</td>

          <td>${esc(t.driver || '--')}</td>

          <td class="em">${esc(t.vehicle || '--')}</td>

          <td>${esc(t.pickup || '--')} → ${esc(t.destination || '--')}</td>

          <td>${esc(t.startTime || '--')}</td>

          <td class="em">${esc(t.distance || '--')}</td>

          <td>
            <span class="pill ${pill(t.status)}">
              ${esc(t.status || '--')}
            </span>
          </td>

          <td>
            ${actionMenu([
              `
              <label style="display:block;padding:8px 10px;color:#aaa;font-size:13px">
                Reassign Driver
              </label>

              <select 
                class="fm-reassign-select" 
                data-id="${esc(t.id)}"
                style="
                  width:100%;
                  padding:10px;
                  border-radius:8px;
                  border:1px solid #2a2a2a;
                  background:#1b1b1b;
                  color:#fff;
                  outline:none;
                "
              >
                <option value="">Select driver</option>
                ${availableDrivers.map(function(d){
                  const name = d.name || d.driver || '';
                  const selected = name === t.driver ? 'selected' : '';

                  return `
                    <option value="${esc(name)}" ${selected}>
                      ${esc(name)}
                    </option>
                  `;
                }).join('')}
              </select>
              `
            ])}
          </td>
        </tr>
      `).join('') || `
        <tr>
          <td colspan="8" style="text-align:center;color:#888;padding:18px">
            No trips found
          </td>
        </tr>
      `; 

      bindTripReassign(); 

    }catch(e){ 
      console.error(e); 

      $('#tripBody').innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center;color:#ff8d8d;padding:18px">
            Failed to load trips from backend.
          </td>
        </tr>
      `; 
    }
  }

  $('#tripSearch').oninput = draw; 
  await draw();
}
async function renderNotifications(){
  const root = content();
  if(!root) return;

  root.innerHTML = `
    <div class="panel">
      <div class="panel-body" style="text-align:center;color:#888;padding:24px">
        Loading notifications from backend...
      </div>
    </div>
  `;

  function notificationStatus(n){
    const read = n.read === true || String(n.status || '').toLowerCase() === 'read';
    return read ? 'Read' : 'Unread';
  }

  function formatTime(n){
    return n.time || n.createdAt || n.date || '--';
  }

  function notificationCard(n){
    const status = notificationStatus(n);

    return `
      <div class="notification-card ${status === 'Unread' ? 'unread' : ''}">
        <div class="notification-main">
          <div class="notification-title-row">
            <h3>${esc(n.title || 'Notification')}</h3>
            <span class="pill ${status === 'Unread' ? 'pill-yellow' : 'pill-orange'}">
              ${esc(status)}
            </span>
          </div>

          <p class="notification-message">
            ${esc(n.message || n.description || '--')}
          </p>

          <div class="notification-meta">
            <span>${esc(n.targetRole || n.role || 'fleet-manager')}</span>
          </div>
        </div>

        <div class="notification-time">
          <div>${esc(formatTime(n))}</div>
          <div>${esc(n.date || '')}</div>
        </div>
      </div>
    `;
  }

  try{
    const notifications = await D.Notifications.getAll();
    const rows = notifications || [];

    const unreadCount = rows.filter(function(n){
      return notificationStatus(n) === 'Unread';
    }).length;

    root.innerHTML = `
      <style>
        .notifications-header{
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin-bottom:18px;
          gap:16px;
        }

        .notification-list{
          display:flex;
          flex-direction:column;
          gap:14px;
        }

        .notification-card{
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:24px;
          width:100%;
          padding:20px 22px;
          border:1px solid #242424;
          border-radius:18px;
          background:#151515;
          box-sizing:border-box;
        }

        .notification-card.unread{
          border-color:#facc15;
          background:linear-gradient(90deg, rgba(250,204,21,.13), rgba(21,21,21,.95));
        }

        .notification-main{
          flex:1;
          min-width:0;
        }

        .notification-title-row{
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
          margin-bottom:10px;
        }

        .notification-title-row h3{
          margin:0;
          font-size:17px;
          font-weight:800;
          color:#fff;
          line-height:1.25;
        }

        .notification-message{
          margin:0 0 12px 0;
          color:#cfcfcf;
          font-size:15px;
          line-height:1.6;
          max-width:900px;
          white-space:normal;
          word-break:normal;
        }

        .notification-meta{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
        }

        .notification-meta span{
          display:inline-flex;
          padding:5px 10px;
          border-radius:8px;
          background:#7c4a03;
          color:#ffd36a;
          font-size:12px;
          font-weight:700;
        }

        .notification-time{
          min-width:150px;
          text-align:right;
          color:#9ca3af;
          font-size:14px;
          line-height:1.6;
        }

        @media(max-width:800px){
          .notification-card{
            flex-direction:column;
          }

          .notification-time{
            text-align:left;
            min-width:0;
          }
        }
      </style>

      <div class="notifications-header">
        <span class="pill pill-yellow">
          ${unreadCount} Unread
        </span>

        <button class="btn btn-ghost" id="markAllReadBtn" type="button">
          Mark All as Read
        </button>
      </div>

      <div class="notification-list">
        ${rows.map(notificationCard).join('') || `
          <div class="panel">
            <div class="panel-body" style="padding:24px;color:#888;text-align:center">
              No notifications found.
            </div>
          </div>
        `}
      </div>
    `;

    const markAllReadBtn = document.getElementById('markAllReadBtn');

    if(markAllReadBtn){
      markAllReadBtn.onclick = async function(){
        try{
          await D.Notifications.markAllRead();
          toast('All notifications marked as read');
          await renderNotifications();
        }catch(error){
          console.error(error);
          alert('Failed to mark notifications as read');
        }
      };
    }

  }catch(error){
    console.error(error);

    root.innerHTML = `
      <div class="panel">
        <div class="panel-body" style="padding:24px;color:#ff8d8d;text-align:center">
          Failed to load notifications from backend.
        </div>
      </div>
    `;
  }
}
  
  async function renderProfile(){
    const root=content(); if(!root) return; const userId=D.getCurrentUserId();
    root.innerHTML = `<div class="info-card" style="padding:28px;text-align:center;color:#888">Loading profile from backend...</div>`;
    try{ const user=await D.Users.getOne(userId); const details=user.profileDetails||{}; const name=user.name||'Fleet Manager'; const initials=name.trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase()||'FM'; root.innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:16px"><button class="btn btn-yellow" id="editProfile">Edit</button></div><div class="info-card" style="max-width:1100px;margin:0 auto;padding:26px"><div style="display:flex;align-items:center;gap:18px;margin-bottom:22px"><div style="width:88px;height:88px;border-radius:24px;background:var(--yellow);color:#111;display:grid;place-items:center;font-weight:900;font-size:34px">${esc(initials)}</div><div><div style="font-size:34px;font-weight:800;color:#fff">${esc(name)}</div><div class="muted" style="font-size:20px">Fleet Manager Account</div></div></div><div class="profile-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:18px"><div class="field"><label>Full Name</label><input id="pName" value="${esc(name)}" readonly><div class="field-error" id="err-pName"></div></div><div class="field"><label>Email Address</label><input id="pEmail" value="${esc(user.email||'')}" readonly></div><div class="field"><label>Phone Number</label><input id="pPhone" value="${esc(user.phone||'')}" readonly><div class="field-error" id="err-pPhone"></div></div><div class="field"><label>Company Name</label><input id="pCompany" value="${esc(details.companyName||'')}" readonly></div><div class="field"><label>Company Address</label><input id="pAddress" value="${esc(details.companyAddress||'')}" readonly></div><div class="field"><label>Number of Vehicles</label><input id="pVehicles" value="${esc(details.numberOfVehicles||'')}" readonly></div></div><div class="footer-actions"><a class="btn btn-ghost" href="dashboard.html">Cancel</a><button class="btn btn-yellow" id="saveProfile" style="display:none">Save Profile</button></div></div>`; setTopbarFromUser(user);
      $('#editProfile').onclick=()=>{ ['pName','pPhone','pCompany','pAddress','pVehicles'].forEach(id=>$('#'+id).removeAttribute('readonly')); $('#saveProfile').style.display=''; $('#pName').focus(); };
      $('#saveProfile').onclick=async()=>{ $('#err-pName').textContent=''; $('#err-pPhone').textContent=''; const payload={ name:$('#pName').value.trim(), email:user.email, role:user.role, status:user.status||'Active', phone:$('#pPhone').value.trim(), profileDetails:{...(user.profileDetails||{}), companyName:$('#pCompany').value.trim(), companyAddress:$('#pAddress').value.trim(), numberOfVehicles:$('#pVehicles').value.trim()} }; if(!/^[A-Za-z][A-Za-z\s]{2,59}$/.test(payload.name)){ $('#err-pName').textContent='Name must be 3-60 letters'; return; } if(payload.phone && !/^\+?[0-9\s-]{10,17}$/.test(payload.phone)){ $('#err-pPhone').textContent='Enter a valid phone number'; return; } await D.Users.update(user.id,payload); toast('Profile updated'); renderProfile(); };
    }catch(e){ console.error(e); errorBox('Failed to load profile from backend.'); }
  }
async function renderDocuments(){
  const root = content();
  if(!root) return;

  root.innerHTML = `
    <div class="panel">
      <div class="panel-body" style="padding:24px;color:#888;text-align:center">
        Documents backend sync is loading...
      </div>
    </div>
  `;

  try {
    if(!D.Documents){
      root.innerHTML = `
        <div class="panel">
          <div class="panel-body" style="padding:24px;color:#ff8d8d;text-align:center">
            Documents API is not available in api-client.js
          </div>
        </div>
      `;
      return;
    }

    const docs = await D.Documents.getAll();

    root.innerHTML = `
      <div class="toolbar">
        <label class="search-sm">
          <span>⌕</span>
          <input id="documentSearch" placeholder="Search documents..."/>
        </label>

        <button class="btn btn-yellow" id="uploadDocumentBtn" type="button">
          ＋ Upload Document
        </button>
      </div>

      <section class="panel">
        <div class="panel-head">
          <div class="panel-title">Documents</div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Owner Type</th>
              <th>Owner</th>
              <th>Document Type</th>
              <th>Issue Date</th>
              <th>Expiry Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody id="documentsBody">
            <tr>
              <td colspan="8" style="text-align:center;color:#888;padding:18px">
                Loading documents...
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    `;

    const uploadDocumentBtn = document.getElementById('uploadDocumentBtn');

    if(uploadDocumentBtn){
      uploadDocumentBtn.onclick = function(){
        window.location.href = 'upload-document.html';
      };
    }

    function draw(){
      const q = ($('#documentSearch')?.value || '').trim().toLowerCase();

      const filtered = (docs || []).filter(function(d){
        return [
          d.id,
          d.ownerType,
          d.vehicle,
          d.driver,
          d.documentType,
          d.issueDate,
          d.expiryDate,
          d.status
        ].join(' ').toLowerCase().includes(q);
      });

      $('#documentsBody').innerHTML = filtered.map(function(d){
        return `
          <tr>
            <td class="em">${esc(d.id || '--')}</td>
            <td>${esc(d.ownerType || '--')}</td>
            <td>${esc(d.vehicle || d.driver || '--')}</td>
            <td>${esc(d.documentType || '--')}</td>
            <td>${esc(d.issueDate || '--')}</td>
            <td>${esc(d.expiryDate || '--')}</td>
            <td>
              <span class="pill ${pill(d.status)}">
                ${esc(d.status || '--')}
              </span>
            </td>
            <td>
              ${actionMenu([
                `<a href="upload-document.html?id=${encodeURIComponent(d.id || '')}">Edit Document</a>`,
                `<button class="fm-del-document danger" data-id="${esc(d.id || '')}">Delete</button>`
              ])}
            </td>
          </tr>
        `;
      }).join('') || `
        <tr>
          <td colspan="8" style="text-align:center;color:#888;padding:18px">
            No documents found.
          </td>
        </tr>
      `;

      $$('.fm-del-document').forEach(function(btn){
        btn.onclick = async function(){
          const id = btn.dataset.id;
          if(!id) return;

          if(!confirm(`Delete document ${id}?`)) return;

          try{
            await D.Documents.delete(id);
            toast('Document deleted');
            await renderDocuments();
          }catch(error){
            console.error(error);
            alert('Failed to delete document from backend');
          }
        };
      });
    }

    $('#documentSearch').oninput = draw;
    draw();

  } catch(error) {
    console.error(error);
    root.innerHTML = `
      <div class="panel">
        <div class="panel-body" style="padding:24px;color:#ff8d8d;text-align:center">
          Failed to load documents from backend.
        </div>
      </div>
    `;
  }
}
  async function renderAnalytics(){
    const root=content(); if(!root) return;
    root.innerHTML = `<div class="panel"><div class="panel-body" style="text-align:center;color:#888;padding:24px">Loading analytics...</div></div>`;
    try{ const [vehicles,drivers,trips,maintenance]=await Promise.all([D.Vehicles.getAll(),D.Drivers.getAll(),D.Trips.getAll(),D.Maintenance.getAll('')]); const active=vehicles.filter(v=>/active/i.test(v.status||'')).length; const completed=trips.filter(t=>/complete|deliver/i.test(t.status||'')).length; const cost=maintenance.reduce((sum,m)=>sum+(Number(String(m.cost||'').replace(/[₹,]/g,''))||0),0); root.innerHTML=`<section class="stats"><div class="stat"><h3>Fleet Score</h3><div class="v">${vehicles.length?Math.round(active/vehicles.length*100):0}%</div><div class="s">Active vehicle ratio</div></div><div class="stat"><h3>Completed Trips</h3><div class="v">${completed}</div><div class="s">From backend trips</div></div><div class="stat"><h3>Maintenance Cost</h3><div class="v">₹${cost.toLocaleString('en-IN')}</div><div class="s">Backend records</div></div><div class="stat"><h3>Drivers</h3><div class="v">${drivers.length}</div><div class="s">Backend drivers</div></div></section><section class="panel" style="margin-top:18px"><div class="panel-head"><div class="panel-title">Performance Breakdown</div></div><div class="panel-body"><div class="progress-list"><div class="progress-row"><div>Vehicle Active Ratio</div><div class="track"><span style="width:${vehicles.length?Math.round(active/vehicles.length*100):0}%"></span></div><strong>${vehicles.length?Math.round(active/vehicles.length*100):0}%</strong></div><div class="progress-row"><div>Trip Completion</div><div class="track"><span style="width:${trips.length?Math.round(completed/trips.length*100):0}%"></span></div><strong>${trips.length?Math.round(completed/trips.length*100):0}%</strong></div></div></div></section>`; }catch(e){ console.error(e); errorBox('Failed to load analytics from backend.'); }
  }

  async function init(){
    if(!D){ console.error('DeliverySyncAPI is not loaded'); return; }
    await loadCurrentUser();
    const routes = {
      'dashboard.html': renderDashboard,
      'vehicles.html': renderVehicles,
      'add-vehicle.html': renderAddVehicle,
      'edit-vehicle.html': renderEditVehicle,
      'drivers.html': renderDrivers,
      'compliance.html': renderCompliance,
      'edit-driver.html': renderEditDriver,
      'driver-profile.html': renderDriverProfile,
      'maintenance.html': renderMaintenance,
      'schedule-maintenance.html': renderScheduleMaintenance,
      'trips.html': renderTrips,
      'documents.html': renderDocuments,
      'notifications.html': renderNotifications,
      'profile.html': renderProfile
    };
    if(routes[page]) routes[page]();
  }

  ready(init);
})();
