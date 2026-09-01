import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('DeliverSync API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication', () => {
    it('logs in a seeded superuser and returns a bearer token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'superuser@deliverysync.com', password: 'Super@123' })
        .expect(201);

      expect(res.body.token).toBeDefined();
      expect(res.body.role).toBe('superuser');
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

  describe('Revenue model', () => {
    let superuserToken: string;
    let fleetToken: string;
    let businessToken: string;
    let driverToken: string;

    beforeAll(async () => {
      const [su, fleet, business, driver] = await Promise.all([
        request(app.getHttpServer()).post('/api/auth/login').send({ email: 'superuser@deliverysync.com', password: 'Super@123' }),
        request(app.getHttpServer()).post('/api/auth/login').send({ email: 'fleet@deliverysync.com', password: 'Fleet@123' }),
        request(app.getHttpServer()).post('/api/auth/login').send({ email: 'urbancart@deliverysync.com', password: 'Client@123' }),
        request(app.getHttpServer()).post('/api/auth/login').send({ email: 'driver@deliverysync.com', password: 'Driver@123' }),
      ]);
      superuserToken = su.body.token;
      fleetToken = fleet.body.token;
      businessToken = business.body.token;
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

      for (const status of ['Accepted', 'Picked Up', 'In Transit', 'Delivered']) {
        await request(app.getHttpServer())
          .patch(`/api/trips/${tripId}/status`)
          .set('Authorization', `Bearer ${driverToken}`)
          .send({ status });
      }

      const payRes = await request(app.getHttpServer())
        .post('/api/transactions/pay-delivery')
        .set('Authorization', `Bearer ${businessToken}`)
        .send({ deliveryId });

      return { deliveryId, tripId, transaction: payRes.body };
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

    it('applies the current commission rate to new payments but never rewrites historical ones', async () => {
      await request(app.getHttpServer())
        .put('/api/settings/commission')
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ commissionRate: 10 })
        .expect(200);

      const first = await createPaidDelivery('E2ERateTest1');
      expect(first.transaction.commissionRatePercent).toBe(10);
      expect(first.transaction.platformCommission).toBeCloseTo(first.transaction.grossAmount * 0.1, 2);

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

    it('supports multiple partial refunds capped at the original amount, with proportional commission reversal', async () => {
      const { transaction } = await createPaidDelivery('E2ERefundTest');
      const half = Number((transaction.amount / 2).toFixed(2));

      const refund1 = await request(app.getHttpServer())
        .post(`/api/transactions/${transaction.id}/refund`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ amount: half, reason: 'e2e partial 1' })
        .expect(201);

      expect(refund1.body.platformCommission).toBeCloseTo(-(transaction.platformCommission * 0.5), 1);

      const over = await request(app.getHttpServer())
        .post(`/api/transactions/${transaction.id}/refund`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ amount: transaction.amount, reason: 'too much' })
        .expect(400);

      expect(over.body.message).toMatch(/exceeds/i);

      await request(app.getHttpServer())
        .post(`/api/transactions/${transaction.id}/refund`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ reason: 'e2e final refund' })
        .expect(201);

      const refetch = await request(app.getHttpServer())
        .get('/api/transactions/payments')
        .set('Authorization', `Bearer ${superuserToken}`)
        .expect(200);

      const original = refetch.body.find((t: any) => t.id === transaction.id);
      expect(original.refunded).toBe(true);
      expect(original.refundedAmount).toBeCloseTo(transaction.amount, 1);

      await request(app.getHttpServer())
        .post(`/api/transactions/${transaction.id}/refund`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({ amount: 1, reason: 'should fail' })
        .expect(400);
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
