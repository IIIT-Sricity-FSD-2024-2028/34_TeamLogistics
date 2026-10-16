import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DataStoreService,
  DriverPayout,
  RateCard,
  Trip,
} from '../data-store/data-store.service';
import { SetRateCardDto } from './dto/rate-card.dto';

function parseDistanceKm(distance: string | undefined): number {
  const num = Number(String(distance || '').replace(/[^\d.]/g, ''));
  return !Number.isNaN(num) && num > 0 ? num : 0;
}

type MonthlyFinancialSnapshot = {
  grossRevenue: number;
  platformCommission: number;
  driverEarnings: number;
  pendingDriverEarnings: number;
  fleetManagerGross: number;
  fleetExpenses: number;
  fleetManagerNet: number;
  completedTrips: number;
};

@Injectable()
export class PayoutsService {
  constructor(private readonly store: DataStoreService) {}

  private payoutForResponse(payout: DriverPayout): DriverPayout {
    if (String(payout.status || '').toLowerCase() !== 'earned') return payout;
    return { ...payout, status: 'Unpaid' };
  }

  private protectedShare(): number {
    const share = 1 - (this.store.commissionRate + this.store.minimumFleetMarginPercent) / 100;
    if (share <= 0) {
      throw new BadRequestException('Commission and minimum fleet margin leave no room for driver payout');
    }
    return share;
  }

  private minimumCustomerValue(driverValue: number): number {
    return Number((Number(driverValue || 0) / this.protectedShare()).toFixed(2));
  }

  private normalizedRateCard(card: RateCard): RateCard {
    return {
      ...card,
      customerBaseFare: Number(card.customerBaseFare || this.minimumCustomerValue(card.baseFare)),
      customerPerKm: Number(card.customerPerKm || this.minimumCustomerValue(card.perKm)),
      customerPerKg: Number(card.customerPerKg || this.minimumCustomerValue(card.perKg)),
    };
  }

  private assertProtectedMargin(card: RateCard): void {
    const normalized = this.normalizedRateCard(card);
    const checks = [
      ['base fare', normalized.baseFare, normalized.customerBaseFare],
      ['per-km rate', normalized.perKm, normalized.customerPerKm],
      ['per-kg rate', normalized.perKg, normalized.customerPerKg],
    ] as const;
    for (const [label, driverValue, customerValue] of checks) {
      const minimum = this.minimumCustomerValue(driverValue);
      if (Number(customerValue) + 0.001 < minimum) {
        throw new BadRequestException(
          `Customer ${label} must be at least ₹${minimum.toFixed(2)} to protect the ${this.store.minimumFleetMarginPercent}% fleet margin after ${this.store.commissionRate}% commission.`,
        );
      }
    }
  }

  getPlatformRateCard(): RateCard {
    const card = this.store.rateCards.find((r) => r.id === 'PLATFORM');

    if (!card) {
      throw new NotFoundException('Platform rate card is not configured');
    }

    return this.normalizedRateCard(card);
  }

  setPlatformRateCard(dto: SetRateCardDto): RateCard {
    const card = this.store.rateCards.find((r) => r.id === 'PLATFORM');
    if (!card) throw new NotFoundException('Platform rate card is not configured');

    const candidate: RateCard = {
      ...card,
      baseFare: dto.baseFare,
      perKm: dto.perKm,
      perKg: dto.perKg,
      customerBaseFare: dto.customerBaseFare ?? this.minimumCustomerValue(dto.baseFare),
      customerPerKm: dto.customerPerKm ?? this.minimumCustomerValue(dto.perKm),
      customerPerKg: dto.customerPerKg ?? this.minimumCustomerValue(dto.perKg),
    };
    this.assertProtectedMargin(candidate);

    const incompatibleCustom = this.store.rateCards.find(
      (item) => item.id !== 'PLATFORM' &&
        (
          item.baseFare < dto.baseFare ||
          item.perKm < dto.perKm ||
          item.perKg < dto.perKg ||
          Number(this.normalizedRateCard(item).customerBaseFare) < Number(candidate.customerBaseFare) ||
          Number(this.normalizedRateCard(item).customerPerKm) < Number(candidate.customerPerKm) ||
          Number(this.normalizedRateCard(item).customerPerKg) < Number(candidate.customerPerKg)
        ),
    );
    if (incompatibleCustom) {
      throw new BadRequestException(
        `Fleet rate card ${incompatibleCustom.id} is below the proposed driver minimum. Update that fleet card first.`,
      );
    }

    Object.assign(card, candidate);
    card.updatedAt = new Date().toISOString();

    this.store.persistRateCards();

    return this.normalizedRateCard(card);
  }

  private findFleetManagerRateCard(fleetManagerId: string): RateCard | undefined {
    return this.store.rateCards.find((r) => r.id === fleetManagerId);
  }

  getEffectiveRateCard(fleetManagerId?: string): RateCard {
    if (fleetManagerId) {
      const custom = this.findFleetManagerRateCard(fleetManagerId);
      if (custom) return this.normalizedRateCard(custom);
    }

    return this.getPlatformRateCard();
  }

  getMyRateCard(fleetManagerId: string): {
    effective: RateCard;
    platformFloor: RateCard;
    isCustom: boolean;
    economics: { commissionRate: number; minimumFleetMarginPercent: number };
  } {
    const custom = this.findFleetManagerRateCard(fleetManagerId);
    const platformFloor = this.getPlatformRateCard();

    return {
      effective: this.normalizedRateCard(custom || platformFloor),
      platformFloor,
      isCustom: !!custom,
      economics: {
        commissionRate: this.store.commissionRate,
        minimumFleetMarginPercent: this.store.minimumFleetMarginPercent,
      },
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

    const candidate: RateCard = {
      id: fleetManagerId,
      ownerId: fleetManagerId,
      baseFare: dto.baseFare,
      perKm: dto.perKm,
      perKg: dto.perKg,
      customerBaseFare: dto.customerBaseFare ?? card?.customerBaseFare ?? this.minimumCustomerValue(dto.baseFare),
      customerPerKm: dto.customerPerKm ?? card?.customerPerKm ?? this.minimumCustomerValue(dto.perKm),
      customerPerKg: dto.customerPerKg ?? card?.customerPerKg ?? this.minimumCustomerValue(dto.perKg),
      updatedAt: now,
    };
    this.assertProtectedMargin(candidate);
    if (
      Number(candidate.customerBaseFare) < Number(floor.customerBaseFare) ||
      Number(candidate.customerPerKm) < Number(floor.customerPerKm) ||
      Number(candidate.customerPerKg) < Number(floor.customerPerKg)
    ) {
      throw new BadRequestException(
        `Customer pricing cannot go below the platform defaults (base ₹${floor.customerBaseFare}, ₹${floor.customerPerKm}/km, ₹${floor.customerPerKg}/kg).`,
      );
    }

    if (!card) {
      card = candidate;
      this.store.rateCards.push(card);
    } else {
      Object.assign(card, candidate);
    }

    this.store.persistRateCards();

    return this.normalizedRateCard(card);
  }

  getEffectiveCustomerRateCard(fleetManagerId?: string): RateCard {
    const card = this.getEffectiveRateCard(fleetManagerId);
    return {
      ...card,
      baseFare: Number(card.customerBaseFare),
      perKm: Number(card.customerPerKm),
      perKg: Number(card.customerPerKg),
    };
  }

  findFleetManagerIdForDriverName(driverName: string): string | undefined {
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

    const earnedAt = new Date().toISOString();
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
      createdAt: earnedAt,
      earnedAt,
      status: 'Unpaid',
      rateCardSnapshot: {
        baseFare: rateCard.baseFare,
        perKm: rateCard.perKm,
        perKg: rateCard.perKg,
        ownerId: rateCard.ownerId,
      },
    };

    this.store.driverPayouts.push(payout);
    this.store.persistDriverPayouts();

    const driverUser: any = this.store.users.find(
      (u: any) => u.role === 'driver' && String(u.name || '').toLowerCase().trim() === String(driverName).toLowerCase().trim(),
    );

    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Trip payout earned',
      message: `You earned ₹${totalAmount.toLocaleString('en-IN')} for completing trip ${trip.id}. It will be approved after customer payment is verified.`,
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

    return this.store.driverPayouts
      .filter((p) => String(p.driverName || '').toLowerCase().trim() === normalized)
      .map((payout) => this.payoutForResponse(payout));
  }

  listDriverPayouts(requester?: { userId: string; role: string }): DriverPayout[] {
    if (requester?.role === 'fleet-manager') {
      return this.store.driverPayouts
        .filter((payout) => payout.fleetManagerId === requester.userId)
        .map((payout) => this.payoutForResponse(payout));
    }
    return this.store.driverPayouts.map((payout) => this.payoutForResponse(payout));
  }

  approveForDelivery(deliveryId?: string): DriverPayout | null {
    if (!deliveryId) return null;
    const payout = this.store.driverPayouts.find((item) => item.deliveryId === deliveryId);
    if (!payout) return null;
    if (!['Earned', 'Unpaid'].includes(payout.status || 'Paid')) return payout;

    payout.status = 'Approved';
    payout.approvedAt = new Date().toISOString();
    this.store.persistDriverPayouts();

    const driverUser: any = this.store.users.find(
      (user: any) =>
        user.role === 'driver' &&
        String(user.name || '').toLowerCase().trim() === String(payout.driverName || '').toLowerCase().trim(),
    );
    this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Payout approved',
      message: `Your ₹${Number(payout.totalAmount).toLocaleString('en-IN')} payout for trip ${payout.tripId} is approved for payment.`,
      time: 'Just now',
      to: 'driver',
      toUserId: driverUser?.id,
      read: false,
      createdAt: payout.approvedAt,
    } as any);
    this.store.persistNotifications();
    return payout;
  }

  markPayoutPaid(id: string, requester?: { userId: string; role: string }): DriverPayout {
    const payout = this.store.driverPayouts.find((item) => item.id === id);
    if (!payout) throw new NotFoundException(`Payout "${id}" not found`);
    if (requester?.role === 'fleet-manager' && payout.fleetManagerId !== requester.userId) {
      throw new ForbiddenException('You can only pay payouts belonging to your fleet');
    }
    if ((payout.status || 'Paid') !== 'Approved') {
      throw new BadRequestException('Only an approved payout can be marked paid');
    }

    payout.status = 'Paid';
    payout.paidAt = new Date().toISOString();
    this.store.persistDriverPayouts();
    return payout;
  }

  private computeMonthlyStatement(fleetManagerId: string, month: string): MonthlyFinancialSnapshot {
    const inMonth = (isoDate: string | undefined) => String(isoDate || '').slice(0, 7) === month;

    const fleetPayouts = this.store.driverPayouts.filter((payout) => payout.fleetManagerId === fleetManagerId);
    const myTripIds = new Set(fleetPayouts.map((payout) => payout.tripId));
    const myDeliveryIds = new Set(
      fleetPayouts
        .map((payout) => payout.deliveryId)
        .filter((deliveryId): deliveryId is string => Boolean(deliveryId)),
    );

    const originals = this.store.transactions.filter(
      (t) =>
        t.transactionType === 'delivery-payment' &&
        ['completed', 'approved', 'paid'].includes(String(t.status || '').toLowerCase()) &&
        t.deliveryId &&
        myDeliveryIds.has(t.deliveryId) &&
        inMonth(t.approvedAt || t.updatedAt || t.createdAt),
    );

    let grossRevenue = 0;
    let platformCommission = 0;
    let fleetManagerGross = 0;

    for (const original of originals) {
      grossRevenue += Number(original.grossAmount || 0);
      platformCommission += Number(original.platformCommission || 0);

      fleetManagerGross += Number(original.fleetManagerAmount || 0);
    }

    const monthPayouts = fleetPayouts.filter((p) => !p.reversed && inMonth(p.earnedAt || p.createdAt));
    const driverEarnings = monthPayouts
      .reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);
    const pendingDriverEarnings = monthPayouts
      .filter((p) => (p.status || 'Paid') !== 'Paid')
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
      pendingDriverEarnings: Number(pendingDriverEarnings.toFixed(2)),
      fleetManagerGross: Number(fleetManagerGross.toFixed(2)),
      fleetExpenses: Number(fleetExpenses.toFixed(2)),
      fleetManagerNet: Number(fleetManagerNet.toFixed(2)),
      completedTrips,
    };
  }

  getFleetManagerStatement(fleetManagerId: string, month?: string) {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const snapshot = this.computeMonthlyStatement(fleetManagerId, targetMonth);

    return {
      month: targetMonth,
      grossRevenue: snapshot.grossRevenue,
      platformCommission: snapshot.platformCommission,
      driverEarnings: snapshot.driverEarnings,
      pendingDriverEarnings: snapshot.pendingDriverEarnings || 0,
      fleetManagerGross: snapshot.fleetManagerGross,
      fleetExpenses: snapshot.fleetExpenses,
      fleetManagerNet: snapshot.fleetManagerNet,
      completedTrips: snapshot.completedTrips,
      tripRevenue: snapshot.fleetManagerGross,
      driverPayoutsTotal: snapshot.driverEarnings,
      maintenanceCosts: snapshot.fleetExpenses,
      netIncome: snapshot.fleetManagerNet,
    };
  }

  assertFleetManagerSelfOrSuperuser(fleetManagerId: string, requester?: { userId: string; role: string }): void {
    if (!requester) return;
    if (requester.role === 'superuser') return;
    if (requester.role === 'fleet-manager' && requester.userId === fleetManagerId) return;

    throw new ForbiddenException('You are not authorized to view this fleet manager statement');
  }
}
