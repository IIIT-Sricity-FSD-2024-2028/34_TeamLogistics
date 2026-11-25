const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deliversync-browser-'));
Object.assign(process.env, { NODE_ENV: 'test', PORT: '3184', VERIFY_LOGIN_EMAIL: 'false',
  DATA_DIR: dir, UPLOAD_DIR: path.join(dir,'uploads'), LOG_DIR: path.join(dir,'logs') });
require('../../backend/demo/seed.cjs')(dir);
// Only this browser test process uses the loopback SMS receiver.
Object.assign(process.env, {TWILIO_ACCOUNT_SID:'AC-browser', TWILIO_AUTH_TOKEN:'demo', TWILIO_FROM:'+12025550110'});
const realFetch = global.fetch;
global.fetch = (url, options) => {
  if (String(url) === 'https://api.twilio.com/2010-04-01/Accounts/AC-browser/Messages.json')
    return realFetch('http://127.0.0.1:3185/sms', {method:'POST',body:options.body,signal:options.signal});
  throw new Error('Unexpected outgoing request in browser fixture');
};
const delivery = {id:'PARCEL-BROWSER', clientUserId:'BC-202', customer:'UrbanKart Retail', driver:'Demo Driver',
  driverId:'DR-301', fleetManagerId:'FM-101', status:'Attempt Failed', pickup:'Demo origin', dropoff:'Demo destination', amount:100};
const trip = {...delivery, id:'TRIP-BROWSER', request:delivery.id, issueDescription:'Recipient unavailable', vehicle:'TN09AB1000',
  statusHistory:[{status:'Attempt Failed',reason:'Recipient unavailable',source:'driver',at:new Date().toISOString()}]};
const handoff = {...delivery,id:'PARCEL-HANDOFF',status:'In Transit',contact:'Demo Recipient',recipientPhone:'+12025550123',
  parcelBarcode:'1234567890123456',pricing:{total:100},distance:'5 km'};
const handoffTrip = {...trip,id:'TRIP-HANDOFF',request:handoff.id,status:'In Transit',distance:'5 km',statusHistory:[]};
const offered = {...delivery, id:'PARCEL-OFFER', driver:'Kiran Teja', driverId:'DR-302', status:'Assigned'};
const offeredTrip = {...offered, id:'TRIP-OFFER', request:offered.id, vehicle:'DEMO-VAN-01'};
for (const [name,rows] of [['deliveries',[delivery,handoff,offered]],['trips',[trip,handoffTrip,offeredTrip]]]) fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(rows));
require('../../backend/dist/main.js');
