import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DataStoreService,
  DriverPayout,
  RateCard,
  Trip,
  SettlementPeriod,
  SettlementSnapshot,
  SettlementAdjustment,
} from '../data-store/data-store.service';
import { SetRateCardDto } from './dto/rate-card.dto';

function parseDistanceKm(distance: string | undefined): number {
  const num = Number(String(distance || '').replace(/[^\d.]/g, ''));
  return !Number.isNaN(num) && num > 0 ? num : 0;
}

@Injectable()
export class PayoutsService {
  constructor(private readonly store: DataStoreService) {}

  getPlatformRateCard(): RateCard {
    const card = this.store.rateCards.find((r) => r.id === 'PLATFORM');

    if (!card) {
      throw new NotFoundException('Platform rate card is not configured');
    }

    return card;
  }

  setPlatformRateCard(dto: SetRateCardDto): RateCard {
    const card = this.getPlatformRateCard();

    card.baseFare = dto.baseFare;
    card.perKm = dto.perKm;
    card.perKg = dto.perKg;
    card.updatedAt = new Date().toISOString();

    this.store.persistRateCards();

    return card;
  }

  private findFleetManagerRateCard(fleetManagerId: string): RateCard | undefined {
    return this.store.rateCards.find((r) => r.id === fleetManagerId);
  }

  getEffectiveRateCard(fleetManagerId?: string): RateCard {
    if (fleetManagerId) {
      const custom = this.findFleetManagerRateCard(fleetManagerId);
      if (custom) return custom;
    }

    return this.getPlatformRateCard();
  }

  getMyRateCard(fleetManagerId: string): { effective: RateCard; platformFloor: RateCard; isCustom: boolean } {
    const custom = this.findFleetManagerRateCard(fleetManagerId);
    const platformFloor = this.getPlatformRateCard();

    return {
      effective: custom || platformFloor,
      platformFloor,
      isCustom: !!custom,
    };
  }

  setFleetManagerRateCard(fleetManagerId: string, dto: SetRateCardDto): RateCard {
    const floor = this.getPlatformRateCard();

    if (dto.baseFare < floor.baseFare || dto.perKm < floor.perKm || dto.perKg < floor.perKg) {
      throw new BadRequestException(
        `Rate card cannot go below the platform minimum (base ₹${floor.baseFare}, ₹${floor.perKm}/km, ₹${floor.perKg}/kg).`,
      );
    }

    let card = this.findFleetManagerRateCard(fleetManagerId);
    const now = new Date().toISOString();

    if (!card) {
      card = {
        id: fleetManagerId,
        ownerId: fleetManagerId,
        baseFare: dto.baseFare,
        perKm: dto.perKm,
        perKg: dto.perKg,
        updatedAt: now,
      };
      this.store.rateCards.push(card);
    } else {
      card.baseFare = dto.baseFare;
      card.perKm = dto.perKm;
      card.perKg = dto.perKg;
      card.updatedAt = now;
    }

    this.store.persistRateCards();

    return card;
  }

  private findFleetManagerIdForDriverName(driverName: string): string | undefined {
    const driver = this.store.drivers.find(
      (d) => String(d.name || '').toLowerCase().trim() === String(driverName || '').toLowerCase().trim(),
    );

    return driver?.fleetManagerId;
  }

  createForTrip(trip: Trip): DriverPayout | null {
    if (this.store.driverPayouts.some((p) => p.tripId === trip.id)) {
      return null;
    }

    const driverName = trip.driver;

    if (!driverName) {
      return null;
    }

    const delivery: any = trip.request
      ? this.store.deliveryRequests.find((d) => d.id === trip.request)
      : undefined;

    const fleetManagerId = this.findFleetManagerIdForDriverName(driverName);
    const rateCard = this.getEffectiveRateCard(fleetManagerId);

    const distanceKm = parseDistanceKm(trip.distance);
    const weightKg = Number(delivery?.weight ?? delivery?.estimatedWeight ?? 0) || 0;

    const baseFare = rateCard.baseFare;
    const distanceFare = Number((distanceKm * rateCard.perKm).toFixed(2));
    const weightSurcharge = Number((weightKg * rateCard.perKg).toFixed(2));
    const totalAmount = Number((baseFare + distanceFare + weightSurcharge).toFixed(2));

    const payout: DriverPayout = {
      id: this.store.generateId('PAYOUT', this.store.driverPayouts as any),
      tripId: trip.id,
      deliveryId: trip.request,
      driverName,
      fleetManagerId,
      baseFare,
      distanceFare,
      weightSurcharge,
      totalAmount,
      createdAt: new Date().toISOString(),
    };

    this.store.driverPayouts.push(payout);
    this.store.persistDriverPayouts();

    const driverUser: any = this.store.users.find(
      (u: any) => u.role === 'driver' && String(u.name || '').toLowerCase().trim() === String(driverName).toLowerCase().trim(),
    );

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Trip payout credited',
      message: `You earned ₹${totalAmount.toLocaleString('en-IN')} for completing trip ${trip.id}.`,
      time: 'Just now',
      to: 'driver',
      toUserId: driverUser?.id,
      read: false,
      createdAt: new Date().toISOString(),
    } as any);
    this.store.persistNotifications();

    return payout;
  }

  getDriverNameForUser(userId: string): string {
    const user: any = this.store.users.find((u) => u.id === userId);
    return user?.name || '';
  }

  getDriverPayouts(driverName: string): DriverPayout[] {
    const normalized = String(driverName || '').toLowerCase().trim();

    return this.store.driverPayouts.filter(
      (p) => String(p.driverName || '').toLowerCase().trim() === normalized,
    );
  }

  private computeOpenPeriodSnapshot(fleetManagerId: string, month: string): SettlementSnapshot {
    const inMonth = (isoDate: string | undefined) => String(isoDate || '').slice(0, 7) === month;

    const myDriverNames = new Set(
      this.store.drivers
        .filter((d) => d.fleetManagerId === fleetManagerId)
        .map((d) => String(d.name || '').toLowerCase().trim()),
    );

    const myTripIds = new Set(
      this.store.trips
        .filter((t) => myDriverNames.has(String(t.driver || '').toLowerCase().trim()))
        .map((t) => t.id),
    );

    const myDeliveryIds = new Set(
      this.store.trips
        .filter((t) => myTripIds.has(t.id) && t.request)
        .map((t) => t.request as string),
    );

    const originals = this.store.transactions.filter(
      (t) =>
        t.transactionType === 'delivery-payment' &&
        t.deliveryId &&
        myDeliveryIds.has(t.deliveryId) &&
        inMonth(t.createdAt),
    );

    let grossRevenue = 0;
    let platformCommission = 0;
    let fleetManagerGross = 0;

    for (const original of originals) {
      grossRevenue += Number(original.grossAmount || 0);
      platformCommission += Number(original.platformCommission || 0);

      const refundReversals = this.store.transactions
        .filter((t) => t.transactionType === 'refund' && t.relatedTransactionId === original.id)
        .reduce((sum, t) => sum + Number(t.fleetManagerAmount || 0), 0);

      fleetManagerGross += Number(original.fleetManagerAmount || 0) + refundReversals;
    }

    const driverEarnings = this.store.driverPayouts
      .filter((p) => myTripIds.has(p.tripId) && !p.reversed && inMonth(p.createdAt))
      .reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);

    const fleetExpenses = (this.store.maintenanceSchedules as any[])
      .filter((m) => m.fleetManagerId === fleetManagerId && inMonth(m.date || m.createdAt))
      .reduce((sum, m) => sum + Number(String(m.cost || '').replace(/[^\d.]/g, '') || 0), 0);

    const completedTrips = this.store.trips.filter(
      (t) =>
        myTripIds.has(t.id) &&
        ['delivered', 'completed'].includes(String(t.status || '').toLowerCase()) &&
        inMonth((t as any).updatedAt || (t as any).createdAt || t.startTime),
    ).length;

    const fleetManagerNet = fleetManagerGross - driverEarnings - fleetExpenses;

    return {
      grossRevenue: Number(grossRevenue.toFixed(2)),
      platformCommission: Number(platformCommission.toFixed(2)),
      driverEarnings: Number(driverEarnings.toFixed(2)),
      fleetManagerGross: Number(fleetManagerGross.toFixed(2)),
      fleetExpenses: Number(fleetExpenses.toFixed(2)),
      fleetManagerNet: Number(fleetManagerNet.toFixed(2)),
      completedTrips,
    };
  }

  private monthBounds(month: string): { startDate: string; endDate: string } {
    const [y, m] = month.split('-').map(Number);
    const startDate = new Date(Date.UTC(y, (m || 1) - 1, 1)).toISOString().split('T')[0];
    const endDate = new Date(Date.UTC(y, m || 1, 0)).toISOString().split('T')[0];
    return { startDate, endDate };
  }

  private ensureSettlementPeriod(fleetManagerId: string, month: string): SettlementPeriod {
    let period = this.store.settlementPeriods.find(
      (p) => p.fleetManagerId === fleetManagerId && p.month === month,
    );

    if (!period) {
      const { startDate, endDate } = this.monthBounds(month);

      period = {
        id: this.store.generateId('STL', this.store.settlementPeriods as any),
        fleetManagerId,
        month,
        startDate,
        endDate,
        status: 'open',
      };

      this.store.settlementPeriods.push(period);
      this.store.persistSettlementPeriods();
    }

    return period;
  }

  getFleetManagerStatement(fleetManagerId: string, month?: string) {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const period = this.ensureSettlementPeriod(fleetManagerId, targetMonth);

    if (period.status === 'locked' && period.snapshot) {
      const s = period.snapshot;

      return {
        month: targetMonth,
        status: 'locked' as const,
        lockedAt: period.lockedAt,
        lockedBy: period.lockedBy,
        grossRevenue: s.grossRevenue,
        platformCommission: s.platformCommission,
        driverEarnings: s.driverEarnings,
        fleetManagerGross: s.fleetManagerGross,
        fleetExpenses: s.fleetExpenses,
        fleetManagerNet: s.fleetManagerNet,
        completedTrips: s.completedTrips,
        adjustmentsTotal: 0,
        tripRevenue: s.fleetManagerGross,
        driverPayoutsTotal: s.driverEarnings,
        maintenanceCosts: s.fleetExpenses,
        netIncome: s.fleetManagerNet,
      };
    }

    const snapshot = this.computeOpenPeriodSnapshot(fleetManagerId, targetMonth);

    const adjustmentsTotal = this.store.settlementAdjustments
      .filter((a) => a.settlementPeriodId === period.id)
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);

    const netIncome = Number((snapshot.fleetManagerNet + adjustmentsTotal).toFixed(2));

    return {
      month: targetMonth,
      status: 'open' as const,
      grossRevenue: snapshot.grossRevenue,
      platformCommission: snapshot.platformCommission,
      driverEarnings: snapshot.driverEarnings,
      fleetManagerGross: snapshot.fleetManagerGross,
      fleetExpenses: snapshot.fleetExpenses,
      fleetManagerNet: snapshot.fleetManagerNet,
      completedTrips: snapshot.completedTrips,
      adjustmentsTotal: Number(adjustmentsTotal.toFixed(2)),
      tripRevenue: snapshot.fleetManagerGross,
      driverPayoutsTotal: snapshot.driverEarnings,
      maintenanceCosts: snapshot.fleetExpenses,
      netIncome,
    };
  }

  lockSettlement(fleetManagerId: string, month: string, requester?: { userId: string; role: string }): SettlementPeriod {
    const period = this.ensureSettlementPeriod(fleetManagerId, month);

    if (period.status === 'locked') {
      throw new BadRequestException(`Settlement for ${month} is already locked`);
    }

    const snapshot = this.computeOpenPeriodSnapshot(fleetManagerId, month);

    period.status = 'locked';
    period.lockedAt = new Date().toISOString();
    period.lockedBy = requester?.userId || 'system';
    period.snapshot = snapshot;

    this.store.persistSettlementPeriods();

    return period;
  }

  listSettlements(fleetManagerId?: string) {
    let periods = [...this.store.settlementPeriods];

    if (fleetManagerId) {
      periods = periods.filter((p) => p.fleetManagerId === fleetManagerId);
    }

    return periods
      .sort((a, b) => b.month.localeCompare(a.month))
      .map((p) => {
        const statement = this.getFleetManagerStatement(p.fleetManagerId, p.month);
        const fmUser: any = this.store.users.find((u) => u.id === p.fleetManagerId);

        return {
          fleetManagerId: p.fleetManagerId,
          fleetManagerName: fmUser?.name || p.fleetManagerId,
          month: p.month,
          status: p.status,
          lockedAt: p.lockedAt,
          netIncome: statement.netIncome,
        };
      });
  }

  applyRefundAdjustment(
    fleetManagerId: string,
    originalMonth: string,
    fleetReversal: number,
    refundTransactionId: string,
    reason: string,
  ): SettlementAdjustment | null {
    if (!fleetManagerId || !originalMonth) return null;

    const originalPeriod = this.store.settlementPeriods.find(
      (p) => p.fleetManagerId === fleetManagerId && p.month === originalMonth,
    );

    if (!originalPeriod || originalPeriod.status !== 'locked') {
      return null;
    }

    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentPeriod = this.ensureSettlementPeriod(fleetManagerId, currentMonth);

    const adjustment: SettlementAdjustment = {
      id: this.store.generateId('ADJ', this.store.settlementAdjustments as any),
      settlementPeriodId: currentPeriod.id,
      fleetManagerId,
      sourceTransactionId: refundTransactionId,
      type: 'refund',
      amount: -Math.abs(Number(fleetReversal.toFixed(2))),
      createdAt: new Date().toISOString(),
      reason,
    };

    this.store.settlementAdjustments.push(adjustment);
    this.store.persistSettlementAdjustments();

    return adjustment;
  }

  assertFleetManagerSelfOrSuperuser(fleetManagerId: string, requester?: { userId: string; role: string }): void {
    if (!requester) return;
    if (requester.role === 'superuser') return;
    if (requester.role === 'fleet-manager' && requester.userId === fleetManagerId) return;

    throw new ForbiddenException('You are not authorized to view this fleet manager statement');
  }
}
