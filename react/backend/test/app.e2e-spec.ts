import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { DataStoreService } from './../src/data-store/data-store.service';

describe('DeliverSync API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Live portal updates', () => {
    it('persists read, unread and dismissal without changing another portal’s inbox', async () => {
      const su = await request(app.getHttpServer()).post('/api/auth/login')
        .send({ email: 'superuser@deliverysync.com', password: 'Super@123' }).expect(201);
      const fm = await request(app.getHttpServer()).post('/api/auth/login')
        .send({ email: 'fleet@deliverysync.com', password: 'Fleet@123' }).expect(201);
      const admin = `Bearer ${su.body.token}`;
      const manager = `Bearer ${fm.body.token}`;
      const created = await request(app.getHttpServer()).post('/api/notifications')
        .set('Authorization', admin)
        .send({ title: 'Inbox integration check', message: 'Shared alert with independent recipient states', to: 'all' }).expect(201);
      const id = created.body.id;
      await request(app.getHttpServer()).patch(`/api/notifications/${id}`)
        .set('Authorization', admin).send({ read: true }).expect(200);
      const adminInbox = await request(app.getHttpServer()).get('/api/notifications').set('Authorization', admin).expect(200);
      const managerInbox = await request(app.getHttpServer()).get('/api/notifications').set('Authorization', manager).expect(200);
      expect(adminInbox.body.find((n: any) => n.id === id).read).toBe(true);
      expect(managerInbox.body.find((n: any) => n.id === id).read).toBe(false);
      await request(app.getHttpServer()).patch(`/api/notifications/${id}`)
        .set('Authorization', admin).send({ read: false }).expect(200);
      const unreadInbox = await request(app.getHttpServer()).get('/api/notifications').set('Authorization', admin).expect(200);
      expect(unreadInbox.body.find((n: any) => n.id === id).read).toBe(false);
      await request(app.getHttpServer()).delete(`/api/notifications/${id}`).set('Authorization', manager).expect(200);
      const dismissedInbox = await request(app.getHttpServer()).get('/api/notifications').set('Authorization', manager).expect(200);
      const retainedInbox = await request(app.getHttpServer()).get('/api/notifications').set('Authorization', admin).expect(200);
      expect(dismissedInbox.body.some((n: any) => n.id === id)).toBe(false);
      expect(retainedInbox.body.some((n: any) => n.id === id)).toBe(true);
    });

    it('rejects an unauthenticated change stream', async () => {
      await request(app.getHttpServer()).get('/api/changes').expect(401);
    });

    it('streams invalidations to authenticated clients without broadcasting records', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'superuser@deliverysync.com', password: 'Super@123' })
        .expect(201);
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 4000);
      try {
        const address = app.getHttpServer().address() as { port: number };
        const response = await fetch(`http://127.0.0.1:${address.port}/api/changes`, {
          headers: { Authorization: `Bearer ${login.body.token}` },
          signal: abort.signal,
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/event-stream');
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let received = '';
        while (!received.includes('connected')) {
          const chunk = await reader.read();
          received += decoder.decode(chunk.value);
        }
        const store = app.get(DataStoreService);
        store.persistNotifications();
        while (!received.includes('changed')) {
          const chunk = await reader.read();
          received += decoder.decode(chunk.value);
        }
        expect(received).not.toContain('password');
        expect(received).not.toContain('superuser@deliverysync.com');
        await reader.cancel();
      } finally {
        clearTimeout(timeout);
        abort.abort();
      }
    });
  });

  describe('Authentication', () => {
    it('logs in a seeded superuser and returns a bearer token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'superuser@deliverysync.com', password: 'Super@123' })
        .expect(201);

      expect(res.body.token).toBeDefined();
      expect(res.body.role).toBe('superuser');
      expect(res.body.expiresInMinutes).toBe(30);
      expect(res.body.password).toBeUndefined();
    });

    it('rejects an incorrect password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'superuser@deliverysync.com', password: 'wrong-password' })
        .expect(401);
    });

    it('rejects a login for an email that does not exist', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@deliverysync.com', password: 'whatever' })
        .expect(404);
    });
  });

  describe('Configured portal permissions', () => {
    it('enforces permission switches at the API boundary', async () => {
      const [superuserLogin, fleetLogin, businessLogin] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: 'superuser@deliverysync.com', password: 'Super@123' }),
        request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: 'fleet@deliverysync.com', password: 'Fleet@123' }),
        request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: 'urbancart@deliverysync.com', password: 'Client@123' }),
      ]);

      const superuserToken = superuserLogin.body.token;
      const fleetToken = fleetLogin.body.token;
      const businessToken = businessLogin.body.token;

      await request(app.getHttpServer())
        .get('/api/dashboard/fleet-manager')
        .set('Authorization', `Bearer ${fleetToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/settings/permissions/driver')
        .set('Authorization', `Bearer ${fleetToken}`)
        .expect(403);

      const permissionsResponse = await request(app.getHttpServer())
        .get('/api/settings/permissions/business-client')
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(200);

      const originalPermissions = permissionsResponse.body;
      const disabledTracking = originalPermissions.map((entry: [string, string, boolean]) =>
        entry[0] === 'Track Requests' ? [entry[0], entry[1], false] : entry,
      );

      await request(app.getHttpServer())
        .put('/api/settings/permissions/business-client')
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ permissions: disabledTracking })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/deliveries')
        .set('Authorization', `Bearer ${businessToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .put('/api/settings/permissions/business-client')
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ permissions: originalPermissions })
        .expect(200);
    });
  });

  describe('Authorization boundary', () => {
    it('rejects a guarded route with no Authorization header', async () => {
      await request(app.getHttpServer()).get('/api/users').expect(401);
    });

    it('rejects a guarded route with a garbage bearer token', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });

    it('rejects the legacy x-user-role header with no bearer token', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .set('x-user-role', 'superuser')
        .expect(401);
    });

    it('rejects a valid non-superuser token on a superuser-only route', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'driver@deliverysync.com', password: 'Driver@123' })
        .expect(201);

      await request(app.getHttpServer())
        .get('/api/transactions/revenue-summary')
        .set('Authorization', `Bearer ${login.body.token}`)
        .expect(403);
    });

    it('allows a valid superuser token on a superuser-only route', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'superuser@deliverysync.com', password: 'Super@123' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/transactions/revenue-summary')
        .set('Authorization', `Bearer ${login.body.token}`)
        .expect(200);

      expect(typeof res.body.totalRevenue).toBe('number');
    });
  });

  describe('Data isolation', () => {
    it('scopes a business client to only their own deliveries', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'urbancart@deliverysync.com', password: 'Client@123' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/deliveries')
        .set('Authorization', `Bearer ${login.body.token}`)
        .expect(200);

      const customers = new Set(res.body.map((d: any) => d.customer));
      expect(customers.size).toBeLessThanOrEqual(1);
      if (customers.size === 1) {
        expect([...customers][0]).toBe('UrbanKart Retail');
      }
    });

    it('scopes a driver to only their own trips', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'kiran@deliverysync.com', password: 'Driver@123' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/trips')
        .set('Authorization', `Bearer ${login.body.token}`)
        .expect(200);

      const drivers = new Set(res.body.map((t: any) => t.driver));
      expect(drivers.size).toBeLessThanOrEqual(1);
      if (drivers.size === 1) {
        expect([...drivers][0]).toBe('Kiran Teja');
      }
    });
  });

  describe('Mechanics and maintenance assignments', () => {
    let fleetToken: string;

    beforeAll(async () => {
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'fleet@deliverysync.com', password: 'Fleet@123' })
        .expect(201);
      fleetToken = login.body.token;
    });

    it('creates, retrieves, assigns, edits, deactivates, and validates mechanics', async () => {
      const first = await request(app.getHttpServer())
        .post('/api/mechanics')
        .set('Authorization', `Bearer ${fleetToken}`)
        .send({ name: 'E2E Primary Workshop' })
        .expect(201);

      const second = await request(app.getHttpServer())
        .post('/api/mechanics')
        .set('Authorization', `Bearer ${fleetToken}`)
        .send({ name: 'E2E Secondary Workshop' })
        .expect(201);

      expect(first.body.id).toMatch(/^MC-/);
      expect(first.body.active).toBe(true);

      const renamed = await request(app.getHttpServer())
        .put(`/api/mechanics/${first.body.id}`)
        .set('Authorization', `Bearer ${fleetToken}`)
        .send({ name: 'E2E Primary Auto Workshop' })
        .expect(200);
      expect(renamed.body.name).toBe('E2E Primary Auto Workshop');

      const retrieved = await request(app.getHttpServer())
        .get(`/api/mechanics/${first.body.id}`)
        .set('Authorization', `Bearer ${fleetToken}`)
        .expect(200);
      expect(retrieved.body).toMatchObject({ id: first.body.id, name: renamed.body.name, active: true });

      await request(app.getHttpServer())
        .post('/api/mechanics')
        .set('Authorization', `Bearer ${fleetToken}`)
        .send({ name: '   ' })
        .expect(400);

      const active = await request(app.getHttpServer())
        .get('/api/mechanics?active=true')
        .set('Authorization', `Bearer ${fleetToken}`)
        .expect(200);
      expect(active.body.some((item: any) => item.id === first.body.id)).toBe(true);

      const vehicle = await request(app.getHttpServer())
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${fleetToken}`)
        .send({ plate: 'E2E-MECHANIC-VEHICLE', type: 'Van', status: 'Active' })
        .expect(201);

      const future = new Date();
      future.setDate(future.getDate() + 30);
      const maintenance = await request(app.getHttpServer())
        .post('/api/maintenance')
        .set('Authorization', `Bearer ${fleetToken}`)
        .send({
          vehicle: vehicle.body.plate,
          issue: 'Engine Oil Change',
          priority: 'Low',
          date: future.toISOString().slice(0, 10),
          mechanicId: first.body.id,
          cost: '₹1200.50',
        })
        .expect(201);

      expect(maintenance.body).toMatchObject({
        mechanicId: first.body.id,
        mechanic: renamed.body.name,
      });

      const updated = await request(app.getHttpServer())
        .put(`/api/maintenance/${maintenance.body.id}`)
        .set('Authorization', `Bearer ${fleetToken}`)
        .send({ mechanicId: second.body.id })
        .expect(200);
      expect(updated.body).toMatchObject({
        mechanicId: second.body.id,
        mechanic: second.body.name,
      });

      await request(app.getHttpServer())
        .patch(`/api/mechanics/${second.body.id}/deactivate`)
        .set('Authorization', `Bearer ${fleetToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/maintenance')
        .set('Authorization', `Bearer ${fleetToken}`)
        .send({
          vehicle: 'E2E-INACTIVE-MECHANIC',
          issue: 'Engine Oil Change',
          priority: 'Low',
          date: future.toISOString().slice(0, 10),
          mechanicId: second.body.id,
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/maintenance')
        .set('Authorization', `Bearer ${fleetToken}`)
        .send({
          vehicle: 'E2E-INVALID-MECHANIC',
          issue: 'Engine Oil Change',
          priority: 'Low',
          date: future.toISOString().slice(0, 10),
          mechanicId: 'MC-DOES-NOT-EXIST',
        })
        .expect(400);

      const legacy = await request(app.getHttpServer())
        .get('/api/maintenance/MT-2026-002')
        .set('Authorization', `Bearer ${fleetToken}`)
        .expect(200);
      expect(legacy.body).toMatchObject({
        mechanicId: 'MC-002',
        mechanic: 'SpeedFix Workshop',
      });
    });
  });

  describe('Revenue model', () => {
    let superuserToken: string;
    let fleetToken: string;
    let businessToken: string;
    let driverToken: string;

    beforeAll(async () => {
      const [su, fleet, business] = await Promise.all([
        request(app.getHttpServer()).post('/api/auth/login').send({ email: 'superuser@deliverysync.com', password: 'Super@123' }),
        request(app.getHttpServer()).post('/api/auth/login').send({ email: 'fleet@deliverysync.com', password: 'Fleet@123' }),
        request(app.getHttpServer()).post('/api/auth/login').send({ email: 'urbancart@deliverysync.com', password: 'Client@123' }),
      ]);
      superuserToken = su.body.token;
      fleetToken = fleet.body.token;
      businessToken = business.body.token;

      const registration = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'E2E Workflow Driver',
          email: 'e2e.workflow.driver@deliverysync.com',
          password: 'Workflow@123',
          role: 'driver',
          phone: '9000000001',
          termsAccepted: true,
          termsVersion: '2026-10-12',
          profileDetails: {
            licenseNumber: 'E2E-LICENSE-001',
            licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          },
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/users/${registration.body.userId}/approval`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ decision: 'approve' })
        .expect(200);

      await request(app.getHttpServer())
        .put(`/api/drivers/${registration.body.userId}`)
        .set('Authorization', `Bearer ${fleetToken}`)
        .send({ vehicle: 'TN09AB1000', status: 'Available' })
        .expect(200);

      const driver = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'e2e.workflow.driver@deliverysync.com', password: 'Workflow@123' })
        .expect(201);
      driverToken = driver.body.token;
    });

    async function createPaidDelivery(label: string) {
      const createRes = await request(app.getHttpServer())
        .post('/api/deliveries')
        .set('Authorization', `Bearer ${businessToken}`)
        .send({
          customer: 'UrbanKart Retail',
          contact: 'UrbanKart Retail',
          pickup: `${label} Pickup`,
          dropoff: `${label} Drop`,
          package: 'Test',
          packageType: 'Electronics',
          packageDimensions: { length: 10, width: 10, height: 10, unit: 'cm' },
          weight: 2,
          type: 'Standard',
          priority: 'Medium',
          items: 1,
        })
        .expect(201);

      const deliveryId = createRes.body.id;
      const tripId = createRes.body.tripId;
      expect(createRes.body.driver).toBe('Raghav Reddy');
      expect(createRes.body.assignedDriver).toBe('Raghav Reddy');
      expect(createRes.body.status).toBe('Assigned');
      const defaultTrip = await request(app.getHttpServer())
        .get(`/api/trips/${tripId}`)
        .set('Authorization', `Bearer ${fleetToken}`)
        .expect(200);
      expect(defaultTrip.body.driver).toBe('Raghav Reddy');
      expect(defaultTrip.body.status).toBe('Assigned');

      await request(app.getHttpServer())
        .patch(`/api/trips/${tripId}/location`)
        .set('Authorization', `Bearer ${businessToken}`)
        .send({ latitude: 17.4, longitude: 78.4 })
        .expect(403);

      const reassigned = await request(app.getHttpServer())
        .patch(`/api/trips/${tripId}/reassign`)
        .set('Authorization', `Bearer ${fleetToken}`)
        .send({ driver: 'E2E Workflow Driver' })
        .expect(200);
      expect(reassigned.body.driver).toBe('E2E Workflow Driver');
      expect(reassigned.body.status).toBe('Assigned');
      const pendingSummary = await request(app.getHttpServer())
        .get('/api/dashboard/driver').set('Authorization', `Bearer ${driverToken}`).expect(200);
      const pendingBeforeAcceptance = pendingSummary.body.pendingTrips;

      for (const status of ['Accepted', 'Picked Up', 'In Transit']) {
        await request(app.getHttpServer())
          .patch(`/api/trips/${tripId}/status`)
          .set('Authorization', `Bearer ${driverToken}`)
          .send({ status })
          .expect(200);
        const driverSummary = await request(app.getHttpServer())
          .get('/api/dashboard/driver').set('Authorization', `Bearer ${driverToken}`).expect(200);
        expect(driverSummary.body.pendingTrips).toBe(pendingBeforeAcceptance - 1);
        expect(driverSummary.body.activeTrips).toBeGreaterThanOrEqual(1);

        // Every role reads the same status after the driver's explicit action.
        for (const token of [superuserToken, fleetToken, businessToken, driverToken]) {
          const trip = await request(app.getHttpServer())
            .get(`/api/trips/${tripId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
          const delivery = await request(app.getHttpServer())
            .get(`/api/deliveries/${deliveryId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
          expect(trip.body.status).toBe(status);
          expect(delivery.body.status).toBe(status);
          const notifications = await request(app.getHttpServer())
            .get('/api/notifications')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
          expect(notifications.body.some((n: any) => n.title.includes(status) && n.message.includes(tripId))).toBe(true);
        }
        if (status === 'Accepted') {
          await request(app.getHttpServer())
            .patch(`/api/trips/${tripId}/location`)
            .set('Authorization', `Bearer ${driverToken}`)
            .send({ latitude: 91, longitude: 78.4 })
            .expect(400);
          await request(app.getHttpServer())
            .patch(`/api/trips/${tripId}/location`)
            .set('Authorization', `Bearer ${driverToken}`)
            .send({ latitude: 17.4, longitude: 78.4, accuracy: 12 })
            .expect(200);
          for (const token of [superuserToken, fleetToken, businessToken, driverToken]) {
            const tracked = await request(app.getHttpServer())
              .get(`/api/deliveries/${deliveryId}`)
              .set('Authorization', `Bearer ${token}`)
              .expect(200);
            expect(tracked.body.lastPosition.latitude).toBe(17.4);
            expect(tracked.body.status).toBe('Accepted');
          }
          await request(app.getHttpServer())
            .patch(`/api/trips/${tripId}/report-issue`)
            .set('Authorization', `Bearer ${driverToken}`)
            .send({ issueType: 'Traffic delay', description: 'Road temporarily blocked during integration test' })
            .expect(200);
          const issueSummary = await request(app.getHttpServer())
            .get('/api/dashboard/driver').set('Authorization', `Bearer ${driverToken}`).expect(200);
          expect(issueSummary.body.activeTrips).toBe(0);
          expect(issueSummary.body.pendingTrips).toBe(pendingBeforeAcceptance - 1);
          expect(issueSummary.body.reportedIssues).toBe(1);
          for (const token of [superuserToken, fleetToken, businessToken, driverToken]) {
            const report = await request(app.getHttpServer()).get(`/api/trips/${tripId}`)
              .set('Authorization', `Bearer ${token}`).expect(200);
            expect(report.body.status).toBe('Issue Reported');
            expect(report.body.statusBeforeIssue).toBe('Accepted');
            expect(report.body.issueType).toBe('Traffic delay');
          }
          await request(app.getHttpServer()).patch(`/api/trips/${tripId}/report-issue`)
            .set('Authorization', `Bearer ${driverToken}`)
            .send({ issueType: 'Other', description: 'Duplicate report must be rejected' }).expect(400);
          await request(app.getHttpServer()).patch(`/api/trips/${tripId}/status`)
            .set('Authorization', `Bearer ${driverToken}`).send({ status: 'Accepted' }).expect(200);
        }
      }

      const proof = await request(app.getHttpServer())
        .post('/api/documents')
        .set('Authorization', `Bearer ${driverToken}`)
        .field('ownerType', 'delivery')
        .field('delivery', deliveryId)
        .field('documentType', 'Proof of Delivery')
        .attach('file', Buffer.from('e2e-proof-image'), {
          filename: `${label}-proof.jpg`,
          contentType: 'image/jpeg',
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/trips/${tripId}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          status: 'Completed',
          recipient: 'E2E Recipient',
          notes: 'Delivered during integration test',
          proofDocumentId: proof.body.id,
        })
        .expect(200);

      const invoices = await request(app.getHttpServer())
        .get('/api/transactions/invoices')
        .set('Authorization', `Bearer ${businessToken}`)
        .expect(200);

      const invoice = invoices.body.find((item: any) => item.deliveryId === deliveryId);
      expect(invoice).toBeDefined();

      const paymentSubmission = await request(app.getHttpServer())
        .post('/api/transactions')
        .set('Authorization', `Bearer ${businessToken}`)
        .send({
          client: 'Spoofed client name must be ignored',
          amount: invoice.totalAmount,
          status: 'Completed',
          invoiceId: invoice.id,
          deliveryId,
          paymentMode: 'Bank Transfer',
          reference: `E2E-${label}-${Date.now()}`,
        })
        .expect(201);

      expect(paymentSubmission.body.status).toBe('Pending');
      expect(paymentSubmission.body.client).toBe(invoice.client);

      const approval = await request(app.getHttpServer())
        .patch(`/api/transactions/payments/${paymentSubmission.body.id}/status`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ status: 'Approved' })
        .expect(200);

      return { deliveryId, tripId, invoice, transaction: approval.body };
    }

    it('exposes the platform commission rate and rejects non-superuser writes', async () => {
      await request(app.getHttpServer())
        .get('/api/settings/commission')
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .put('/api/settings/commission')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ commissionRate: 0 })
        .expect(403);

      await request(app.getHttpServer())
        .put('/api/settings/commission')
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ commissionRate: 150 })
        .expect(400);
    });

    it('rejects customer pricing that cannot fund payout, commission, and fleet margin', async () => {
      const current = await request(app.getHttpServer())
        .get('/api/payouts/rate-card/platform')
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .put('/api/payouts/rate-card/platform')
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({
          baseFare: current.body.baseFare,
          perKm: current.body.perKm,
          perKg: current.body.perKg,
          customerBaseFare: current.body.baseFare,
          customerPerKm: current.body.perKm,
          customerPerKg: current.body.perKg,
        })
        .expect(400);
    });

    it('applies the current commission rate to new payments but never rewrites historical ones', async () => {
      await request(app.getHttpServer())
        .put('/api/settings/commission')
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ commissionRate: 10 })
        .expect(200);

      const first = await createPaidDelivery('E2ERateTest1');
      expect(first.transaction.commissionRatePercent).toBe(10);
      expect(first.transaction.platformCommission).toBeCloseTo(first.transaction.grossAmount * 0.1, 2);

      const payouts = await request(app.getHttpServer())
        .get('/api/payouts/driver')
        .set('Authorization', `Bearer ${fleetToken}`)
        .expect(200);
      const payout = payouts.body.find((item: any) => item.deliveryId === first.deliveryId);
      expect(payout).toBeDefined();
      expect(payout.status).toBe('Approved');
      expect(first.transaction.fleetManagerAmount - payout.totalAmount)
        .toBeGreaterThanOrEqual(first.invoice.totalAmount * 0.15 - 0.02);

      const paidPayout = await request(app.getHttpServer())
        .patch(`/api/payouts/driver/${payout.id}/paid`)
        .set('Authorization', `Bearer ${fleetToken}`)
        .expect(200);
      expect(paidPayout.body.status).toBe('Paid');

      await request(app.getHttpServer())
        .patch(`/api/transactions/payments/${first.transaction.id}/status`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ status: 'Rejected' })
        .expect(400);

      await request(app.getHttpServer())
        .put('/api/settings/commission')
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ commissionRate: 12 })
        .expect(200);

      const second = await createPaidDelivery('E2ERateTest2');
      expect(second.transaction.commissionRatePercent).toBe(12);

      const refetch = await request(app.getHttpServer())
        .get('/api/transactions/payments')
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(200);

      const firstAgain = refetch.body.find((t: any) => t.id === first.transaction.id);
      expect(firstAgain.commissionRatePercent).toBe(10);

      await request(app.getHttpServer())
        .put('/api/settings/commission')
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ commissionRate: 10 })
        .expect(200);
    });

    it('creates and locks a fleet-manager settlement period, blocking non-superusers from locking', async () => {
      const month = new Date().toISOString().slice(0, 7);

      const statement = await request(app.getHttpServer())
        .get(`/api/payouts/fleet-manager/statement?month=${month}&fleetManagerId=FM-101`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(200);

      expect(statement.body.status).toBe('open');

      await request(app.getHttpServer())
        .post('/api/payouts/fleet-manager/settlement/lock')
        .set('Authorization', `Bearer ${fleetToken}`)
        .send({ fleetManagerId: 'FM-101', month })
        .expect(403);

      const unpaidLock = await request(app.getHttpServer())
        .post('/api/payouts/fleet-manager/settlement/lock')
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ fleetManagerId: 'FM-101', month })
        .expect(400);
      expect(unpaidLock.body.message).toMatch(/payouts remain unpaid/i);

      const settlements = await request(app.getHttpServer())
        .get('/api/payouts/fleet-manager/settlements')
        .set('Authorization', `Bearer ${fleetToken}`)
        .expect(200);

      expect(Array.isArray(settlements.body)).toBe(true);
      for (const s of settlements.body) {
        expect(s.fleetManagerId).toBe('FM-101');
      }
    });
  });

  describe('Notifications', () => {
    it('lets a user mark a single notification read/unread and delete it, scoped to their own', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'driver@deliverysync.com', password: 'Driver@123' })
        .expect(201);

      const token = login.body.token;

      const create = await request(app.getHttpServer())
        .post('/api/notifications')
        .set('Authorization', `Bearer ${(await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'superuser@deliverysync.com', password: 'Super@123' })).body.token}`)
        .send({ title: 'E2E test notification', message: 'test', to: 'driver' })
        .expect(201);

      const notifId = create.body.id;

      const marked = await request(app.getHttpServer())
        .patch(`/api/notifications/${notifId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ read: true })
        .expect(200);

      expect(marked.body.read).toBe(true);

      await request(app.getHttpServer())
        .delete(`/api/notifications/${notifId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});
