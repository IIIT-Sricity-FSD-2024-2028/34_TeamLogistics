
window.FleetManagerData = {
 vehicles:[
  {id:'VH-001',plate:'TN-09-AB-2345',type:'Truck',status:'Active',driver:'Rajesh Kumar',maintenance:'Jan 15, 2026',location:'Chennai',availability:'Available'},
  {id:'VH-002',plate:'KA-01-CD-7890',type:'Van',status:'On Trip',driver:'Arjun',maintenance:'Feb 02, 2026',location:'Bangalore',availability:'Unavailable'},
  {id:'VH-003',plate:'MH-12-EF-4321',type:'Truck',status:'Maintenance',driver:'Viram',maintenance:'Mar 01, 2026',location:'Mumbai',availability:'Unavailable'},
  {id:'VH-004',plate:'DL-08-GH-5678',type:'SUV',status:'Active',driver:'Suresh',maintenance:'Feb 20, 2026',location:'Delhi',availability:'Available'},
  {id:'VH-005',plate:'TN-05-IJ-9012',type:'Truck',status:'Blocked',driver:'Kiran Teja',maintenance:'Jan 28, 2026',location:'Coimbatore',availability:'Unavailable'}
 ],
 drivers:[
  {id:'DRV-1032',name:'Rajesh Kumar',license:'TN03201800034521',phone:'+91 98765 43210',status:'Active',vehicle:'TN-09-AB-2345',rating:'4.7',trip:'Mar 05, 2026'},
  {id:'DRV-1041',name:'Arjun',license:'KA61201900056712',phone:'+91 87654 32109',status:'On Trip',vehicle:'KA-01-CD-7890',rating:'4.4',trip:'Mar 08, 2026'},
  {id:'DRV-1055',name:'Viram',license:'MH12202000078934',phone:'+91 76543 21098',status:'Active',vehicle:'MH-12-EF-4321',rating:'4.8',trip:'Mar 04, 2026'},
  {id:'DRV-1062',name:'Suresh',license:'DL08201900091256',phone:'+91 65432 10987',status:'Suspended',vehicle:'--',rating:'3.9',trip:'Feb 28, 2026'},
  {id:'DRV-1078',name:'Kiran Teja',license:'AP07202100012478',phone:'+91 94321 09876',status:'Active',vehicle:'TN-05-IJ-9012',rating:'4.6',trip:'Mar 07, 2026'}
 ]
};
const FM_CORE_KEY = 'deliverysync-state-v1';
window.FleetManagerData.readCoreState = function(){
  try{ return JSON.parse(localStorage.getItem(FM_CORE_KEY) || 'null'); }catch(e){ return null; }
};
window.FleetManagerData.writeCoreState = function(state){
  try{ localStorage.setItem(FM_CORE_KEY, JSON.stringify(state)); }catch(e){}
};
window.FleetManagerData.getDrivers = function(){
  const state = window.FleetManagerData.readCoreState();
  const users = (state && Array.isArray(state.users)) ? state.users.filter(u => String(u.role||'').toLowerCase()==='driver') : [];
  const staticRows = Array.isArray(window.FleetManagerData.drivers) ? window.FleetManagerData.drivers : [];
  const mapped = users.map((u, idx) => {
    const pd = u.profileDetails || {};
    const match = staticRows.find(d => String(d.id)===String(pd.driverId) || String(d.license)===String(pd.licenseNumber) || String(d.name).toLowerCase()===String(u.name||'').toLowerCase());
    return {
      id: pd.driverId || u.id || `DRV-${1000+idx}`,
      name: u.name || (match && match.name) || 'Driver',
      license: pd.licenseNumber || (match && match.license) || '--',
      phone: u.phone || (match && match.phone) || '--',
      status: u.status || (match && match.status) || 'Active',
      vehicle: pd.vehicle || (match && match.vehicle) || '--',
      rating: (match && match.rating) || '4.5',
      trip: (match && match.trip) || '--',
      email: u.email || `${String(u.name||'driver').toLowerCase().replace(/[^a-z0-9]+/g,'.')}@gmail.com`,
      experienceYears: (pd.experienceYears ?? match?.experienceYears ?? ''),
      notes: pd.notes || match?.notes || ''
    };
  });
  const seen = new Set(mapped.map(d => String(d.id)));
  staticRows.forEach(d => { if(!seen.has(String(d.id))) mapped.push({...d, email:`${String(d.name||'driver').toLowerCase().replace(/[^a-z0-9]+/g,'.')}@gmail.com`}); });
  return mapped;
};
window.FleetManagerData.syncDriverToCore = function(driver){
  const state = window.FleetManagerData.readCoreState() || {users:[]};
  state.users = Array.isArray(state.users) ? state.users : [];
  let idx = state.users.findIndex(u => String(u.role||'').toLowerCase()==='driver' && ((u.profileDetails && String(u.profileDetails.driverId)===String(driver.id)) || String(u.id)===String(driver.id) || (u.email && driver.email && String(u.email).toLowerCase()===String(driver.email).toLowerCase()) || (u.profileDetails && String(u.profileDetails.licenseNumber)===String(driver.license))));
  if(idx < 0){
    const baseId = String(driver.id||'DRV-000');
    state.users.push({
      id: baseId.startsWith('DR-') ? baseId : `DR-${baseId.replace(/\D/g,'').slice(-3) || Date.now().toString().slice(-3)}`,
      username: String(driver.name||'driver').toLowerCase().replace(/[^a-z0-9]+/g,''),
      name: driver.name || 'Driver',
      email: driver.email || `${String(driver.name||'driver').toLowerCase().replace(/[^a-z0-9]+/g,'.')}@gmail.com`,
      password: 'Driver@123',
      role: 'driver',
      status: driver.status || 'Active',
      phone: driver.phone || '',
      profileDetails: {driverId: driver.id, licenseNumber: driver.license || '', vehicle: driver.vehicle || '--'}
    });
    idx = state.users.length - 1;
  }
  const u = state.users[idx];
  state.users[idx] = {
    ...u,
    name: driver.name || u.name,
    email: driver.email || u.email,
    phone: driver.phone || u.phone,
    status: driver.status || u.status,
    profileDetails: {
      ...(u.profileDetails || {}),
      driverId: driver.id || (u.profileDetails && u.profileDetails.driverId) || '',
      licenseNumber: driver.license || (u.profileDetails && u.profileDetails.licenseNumber) || '',
      vehicle: driver.vehicle || (u.profileDetails && u.profileDetails.vehicle) || '--'
    }
  };
  window.FleetManagerData.writeCoreState(state);
  return state.users[idx];
};
window.pillClass = function(v){
 v=(v||'').toLowerCase();
 if(v.includes('active')||v.includes('approved')||v.includes('available')||v.includes('completed')||v.includes('paid')||v.includes('compliant')) return 'pill-green';
 if(v.includes('trip')||v.includes('pending')||v.includes('submitted')||v.includes('manual')||v.includes('review')||v.includes('renew')) return 'pill-yellow';
 if(v.includes('maint')||v.includes('delay')||v.includes('minor')||v.includes('unavailable')||v.includes('overdue')) return 'pill-orange';
 if(v.includes('block')||v.includes('suspend')||v.includes('reject')||v.includes('expired')||v.includes('attention')) return 'pill-red';
 return 'pill-gray';
}


window.FleetManagerData.getSessionFleetManagerUser = function(){
  const state = window.FleetManagerData.readCoreState() || {};
  const sessionRaw = localStorage.getItem('deliverysync-session-v1');
  let session = null;
  try { session = sessionRaw ? JSON.parse(sessionRaw) : null; } catch(e) { session = null; }
  const users = Array.isArray(state.users) ? state.users : [];
  if(session && session.role === 'fleet-manager'){
    const match = users.find(u => String(u.id||'') === String(session.userId||''))
      || users.find(u => (u.email||'').toLowerCase() === String(session.email||'').toLowerCase());
    if(match) return match;
  }
  return users.find(u => String(u.role||'').toLowerCase() === 'fleet-manager') || null;
};
window.FleetManagerData.getFleetManagerProfile = function(){
  const user = window.FleetManagerData.getSessionFleetManagerUser();
  if(!user) return null;
  const details = user.profileDetails || {};
  const fullName = user.name || 'Fleet Manager';
  const companyName = details.companyName || user.companyName || 'DeliverSync Logistics Pvt Ltd';
  const companyAddress = details.companyAddress || details.address || user.address || 'OMR, Chennai';
  const numberOfVehicles = details.numberOfVehicles || user.numberOfVehicles || '';
  const phone = user.phone || details.phone || '';
  const email = user.email || '';
  const initials = (fullName || 'FM').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0] || '').join('').toUpperCase() || 'FM';
  return { user, fullName, companyName, companyAddress, numberOfVehicles, phone, email, initials };
};
window.FleetManagerData.applyFleetManagerProfile = function(){
  const profile = window.FleetManagerData.getFleetManagerProfile();
  if(!profile) return;
  const { fullName, companyName, companyAddress, numberOfVehicles, phone, email, initials } = profile;

  document.querySelectorAll('.toptools .usertext strong').forEach(el => { el.textContent = fullName; });
  document.querySelectorAll('.toptools .avatar').forEach(el => { el.textContent = initials; });
  document.querySelectorAll('#fm-profile-heading').forEach(el => { el.textContent = fullName; });
  document.querySelectorAll('#fm-profile-avatar').forEach(el => { el.textContent = initials; });
  document.querySelectorAll('#fm-full-name').forEach(el => { if(document.activeElement !== el) el.value = fullName; });
  document.querySelectorAll('#fm-email').forEach(el => { if(document.activeElement !== el) el.value = email; });
  document.querySelectorAll('#fm-phone').forEach(el => { if(document.activeElement !== el) el.value = phone; });
  document.querySelectorAll('#fm-company-name').forEach(el => { if(document.activeElement !== el) el.value = companyName; });
  document.querySelectorAll('#fm-company-address').forEach(el => { if(document.activeElement !== el) el.value = companyAddress; });
  document.querySelectorAll('#fm-number-of-vehicles').forEach(el => { if(document.activeElement !== el) el.value = numberOfVehicles; });

  const heroHeading = document.querySelector('.hero h2');
  if(heroHeading && /welcome back/i.test(heroHeading.textContent || '')){
    heroHeading.textContent = `Welcome Back, ${fullName}`;
  }

  document.querySelectorAll('[data-fm-full-name]').forEach(el => { el.textContent = fullName; });
  document.querySelectorAll('[data-fm-company-name]').forEach(el => { el.textContent = companyName; });
  document.querySelectorAll('[data-fm-company-address]').forEach(el => { el.textContent = companyAddress; });
  document.querySelectorAll('[data-fm-email]').forEach(el => { el.textContent = email; });
  document.querySelectorAll('[data-fm-phone]').forEach(el => { el.textContent = phone; });
  document.querySelectorAll('[data-fm-vehicle-count]').forEach(el => { el.textContent = numberOfVehicles; });
};

document.addEventListener('DOMContentLoaded', function(){
  window.FleetManagerData.applyFleetManagerProfile();
});
window.addEventListener('storage', function(e){
  if(e.key === FM_CORE_KEY){
    window.FleetManagerData.applyFleetManagerProfile();
  }
});
window.addEventListener('deliverysync:state-updated', function(){
  window.FleetManagerData.applyFleetManagerProfile();
});
