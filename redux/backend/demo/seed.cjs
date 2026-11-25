const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const sharedDemoVans = ['01', '02'].map(suffix => ({
  id: 'VH-DEMO-' + suffix, plate: 'DEMO-VAN-' + suffix, type: 'Cargo Van',
  capacity: '1000 kg', cargoCm: [240, 140, 150], handling: ['Fragile Items', 'Food', 'Refrigerated', 'Medical Supplies'],
  status: 'Active', assignedDriver: '--', fleetManagerId: 'FM-101',
}));

// Generated only when starting a fresh local demo or isolated test.
module.exports = function seed(directory) {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo accounts are disabled in production');
  fs.mkdirSync(directory, { recursive: true });
  const accounts = [
    ['SU-001', 'Demo Admin', 'superuser', 'superuser', 'Super@123'],
    ['FM-101', 'Demo Fleet', 'fleet', 'fleet-manager', 'Fleet@123'],
    ['BC-202', 'UrbanKart Retail', 'urbancart', 'business-client', 'Client@123'],
    ['DR-301', 'Demo Driver', 'driver', 'driver', 'Driver@123'],
    ['DR-302', 'Kiran Teja', 'kiran', 'driver', 'Driver@123'],
  ];
  const users = accounts.map(([id, name, email, role, password]) => ({
    id, name, email: email + '@deliverysync.com', role, status: 'Active', password: bcrypt.hashSync(password, 10),
  }));
  const rows = {
    users,
    drivers: users.filter((u) => u.role === 'driver').map((u) => ({
      id: u.id, name: u.name, email: u.email, status: 'Available', zone: 'Chennai', phone: '', vehicle: '--', fleetManagerId: 'FM-101',
    })),
    vehicles: [{ id: 'VH-001', plate: 'TN09AB1000', type: 'Truck', capacity: '1000 kg', cargoCm: [240, 140, 150], status: 'Active', assignedDriver: '--', fleetManagerId: 'FM-101' }, ...sharedDemoVans],
    mechanics: [{ id: 'MC-002', name: 'SpeedFix Workshop', active: true, fleetManagerId: 'FM-101' }],
    maintenance: [{id: 'MT-2026-002', vehicle: 'DEMO-02', issue: 'Inspection', mechanic: 'SpeedFix Workshop', mechanicId: 'MC-002', status: 'Completed', fleetManagerId: 'FM-101'}],
    settings: { permissions: { 'fleet-manager': [['Role & Permissions Access', 'Edit role policies', false]], driver: [['Trip Monitoring', 'View assigned trips', true]], 'business-client': [['Track Requests', 'View and track deliveries', true]] } },
  };
  for (const [name, data] of Object.entries(rows)) {
    fs.writeFileSync(path.join(directory, name + '.json'), JSON.stringify(data, null, 2), {flag: 'wx'});
  }
};

module.exports.sharedDemoVans = sharedDemoVans;
