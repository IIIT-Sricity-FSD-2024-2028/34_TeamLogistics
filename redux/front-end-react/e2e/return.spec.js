import {createServer} from 'node:http';
import { test, expect } from '@playwright/test';

async function signIn(browser, baseURL, email, password) {
    const context = await browser.newContext({baseURL});
    const page = await context.newPage();
    await page.goto('/login');
    await page.getByLabel('Email', {exact:true}).fill(email+'@deliverysync.com');
    await page.locator('#password').fill(password);
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/dashboard');
    return page;
  }

test('a driver can release an offer and change availability across reloads', async ({browser, baseURL}) => {
  const page = await signIn(browser, baseURL, 'kiran', 'Driver@123');
  await expect(page.getByRole('heading', {name: 'In Work', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Reject', exact:true}).click();
  await page.getByRole('button', {name: 'Go unavailable'}).click();
  await expect(page.getByRole('heading', {name: 'Unavailable', exact: true})).toBeVisible();
  await page.reload();
  await page.getByRole('button', {name: 'Go available'}).click();
  await expect(page.getByRole('heading', {name: 'Available', exact: true})).toBeVisible();
});

test('the fleet manager authorises a return, the driver confirms it and the client sees it', async ({browser, baseURL}) => {
  const fleet = await signIn(browser, baseURL, 'fleet', 'Fleet@123');
  await fleet.goto('/fleet-manager/trips');
  const row = fleet.getByRole('row').filter({hasText:'TRIP-BROWSER'});
  await row.getByRole('button',{name:'Actions'}).click();
  await fleet.getByRole('button',{name:'Return to sender'}).click();
  await expect(row).toContainText('Returning');
  const driver = await signIn(browser, baseURL, 'driver','Driver@123');
  await driver.goto('/driver/task-details?id=TRIP-BROWSER');
  await driver.getByRole('button',{name:'Confirm parcel returned to sender'}).click();
  await expect(driver.getByRole('button',{name:'Confirm parcel returned to sender'})).toHaveCount(0);
  const client = await signIn(browser, baseURL, 'urbancart','Client@123');
  await client.goto('/business-client/live-tracking?id=PARCEL-BROWSER');
  await expect(client.getByText('Returned',{exact:true}).first()).toBeVisible();
  await expect(client.getByText('Recipient unavailable',{exact:true})).toBeVisible();
});

test('the recipient code and parcel label complete a delivery and create a client invoice', async ({browser,baseURL}) => {
  let sms;
  const receiver = createServer(async (req,res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    sms = new URLSearchParams(body);
    res.writeHead(201, {'Content-Type':'application/json'});
    res.end(JSON.stringify({sid:'SM-browser'}));
  });
  await new Promise((resolve,reject) => receiver.once('error',reject).listen(3185,'127.0.0.1',resolve));
  try {
    const driver = await signIn(browser,baseURL,'driver','Driver@123');
    await expect(driver.getByRole('heading', {name: 'In Work', exact: true})).toBeVisible();
    await expect(driver.getByRole('button', {name: 'Go unavailable'})).toHaveCount(0);
    await driver.goto('/driver/proof-of-delivery?id=TRIP-HANDOFF');
    await driver.getByRole('button',{name:'Send code to recipient'}).click();
    await expect(driver.getByText('Code submitted for SMS delivery.')).toBeVisible();
    expect(sms.get('To')).toBe('+12025550123');
    const code = sms.get('Body').match(/share (\d{6}) /)[1];
    await driver.getByPlaceholder('Scan or enter label digits').fill('1234567890123456');
    await driver.getByPlaceholder('Enter 6-digit OTP').fill(code);
    await driver.locator('input[type=file]').setInputFiles({name:'proof.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic demo proof')});
    await driver.getByRole('button',{name:'Complete Delivery'}).click();
    await driver.waitForURL('**/driver/dashboard');
    const client = await signIn(browser,baseURL,'urbancart','Client@123');
    await client.goto('/business-client/transactions');
    await expect(client.getByRole('row').filter({hasText:'INV-PARCEL-HANDOFF'})).toContainText('Unpaid');
  } finally {
    await new Promise(resolve => receiver.close(resolve));
  }
});
