import { paise, rupees } from '../common/money';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DataStoreService,
  DriverPayout,
  FleetManagerSettlement,
  RateCard,
  SettlementSnapshot,
  Trip,
} from '../data-store/data-store.service';
import { SetRateCardDto } from './dto/rate-card.dto';
import { SettlementPeriodDto } from './dto/settlement.dto';

function parseDistanceKm(distance: string | undefined): number {
  const num = Number(String(distance || '').replace(/[^\d.]/g, ''));
  return !Number.isNaN(num) && num > 0 ? num : 0;
}

type MonthlyFinancialSnapshot = SettlementSnapshot;

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

    const fleetManagerId = trip.fleetManagerId;
    const driverId = trip.driverId;
    const rateCard = (trip as Trip & {driverRateCard?: RateCard}).driverRateCard || this.getEffectiveRateCard(fleetManagerId);

    const distanceKm = parseDistanceKm(trip.distance);
    const weightKg = Number(delivery?.weight ?? delivery?.estimatedWeight ?? 0) || 0;

    const baseFare = rateCard.baseFare;
    const distanceFare = rupees(paise(rateCard.perKm, distanceKm));
    const weightSurcharge = rupees(paise(rateCard.perKg, weightKg));
    const totalAmount = rupees(paise(baseFare) + paise(distanceFare) + paise(weightSurcharge));

    const earnedAt = new Date().toISOString();
    const payout: DriverPayout = {
      id: this.store.generateId('PAYOUT', this.store.driverPayouts as any),
      tripId: trip.id,
      deliveryId: trip.request,
      driverName, driverId,
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

    const recipient = this.driverIdForPayout(payout);
    if (recipient) this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Trip payout earned',
      message: `You earned ₹${totalAmount.toLocaleString('en-IN')} for completing trip ${trip.id}. It will be approved after customer payment is verified.`,
      time: 'Just now',
      to: 'driver',
      toUserId: recipient,
      read: false,
      createdAt: new Date().toISOString(),
    } as any);
    this.store.persistNotifications();

    return payout;
  }

  private driverIdForPayout(payout: DriverPayout) {
    if (payout.driverId) return payout.driverId;
    const trip = this.store.trips?.find((item) => item.id === payout.tripId);
    return trip?.driverId;
  }

  getDriverPayouts(userId: string): DriverPayout[] {
    return this.store.driverPayouts.filter((p) => this.driverIdForPayout(p) === userId)
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

    const recipient = this.driverIdForPayout(payout);
    if (recipient) this.store.notifications.push({
      id: `N-${Date.now()}`,
      title: 'Payout approved',
      message: `Your ₹${Number(payout.totalAmount).toLocaleString('en-IN')} payout for trip ${payout.tripId} is approved for payment.`,
      time: 'Just now',
      to: 'driver',
      toUserId: recipient,
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
    if (payout.status === 'Paid') return payout;
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
        ['delivery-payment', 'payment-reversal'].includes(t.transactionType || '') &&
        ['completed', 'approved', 'paid'].includes(String(t.status || '').toLowerCase()) &&
        t.deliveryId &&
        myDeliveryIds.has(t.deliveryId) &&
        inMonth(t.approvedAt || t.updatedAt || t.createdAt),
    );

    let grossRevenue = 0;
    let platformCommission = 0;
    let fleetManagerGross = 0;

    for (const original of originals) {
      grossRevenue += paise(original.grossAmount || 0);
      platformCommission += paise(original.platformCommission || 0);

      fleetManagerGross += paise(original.fleetManagerAmount || 0);
    }

    const monthPayouts = fleetPayouts.filter((p) => !p.reversed && inMonth(p.earnedAt || p.createdAt));
    const driverEarnings = monthPayouts
      .reduce((sum, p) => sum + paise(p.totalAmount || 0), 0);
    const pendingDriverEarnings = monthPayouts
      .filter((p) => (p.status || 'Paid') !== 'Paid')
      .reduce((sum, p) => sum + paise(p.totalAmount || 0), 0);

    const fleetExpenses = (this.store.maintenanceSchedules as any[])
      .filter((m) => m.fleetManagerId === fleetManagerId && inMonth(m.date || m.createdAt))
      .reduce((sum, m) => sum + paise(Number(String(m.cost || '').replace(/[^\d.]/g, '') || 0)), 0);

    const completedTrips = this.store.trips.filter(
      (t) =>
        myTripIds.has(t.id) &&
        ['delivered', 'completed'].includes(String(t.status || '').toLowerCase()) &&
        inMonth((t as any).updatedAt || (t as any).createdAt || t.startTime),
    ).length;

    const fleetManagerNet = fleetManagerGross - driverEarnings - fleetExpenses;

    return {
      grossRevenue: rupees(grossRevenue),
      platformCommission: rupees(platformCommission),
      driverEarnings: rupees(driverEarnings),
      pendingDriverEarnings: rupees(pendingDriverEarnings),
      fleetManagerGross: rupees(fleetManagerGross),
      fleetExpenses: rupees(fleetExpenses),
      fleetManagerNet: rupees(fleetManagerNet),
      completedTrips,
    };
  }

  private normalizeMonth(month?: string): string {
    const targetMonth = String(month || new Date().toISOString().slice(0, 7)).trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) {
      throw new BadRequestException('month must use YYYY-MM format');
    }
    return targetMonth;
  }

  private assertFleetManagerExists(fleetManagerId: string): void {
    const fleetManager = this.store.users.find(
      (user) => user.id === fleetManagerId && user.role === 'fleet-manager',
    );
    if (!fleetManager) {
      throw new NotFoundException(`Fleet manager "${fleetManagerId}" not found`);
    }
  }

  private buildOpenSettlement(fleetManagerId: string, month: string): FleetManagerSettlement {
    const [year, monthNumber] = month.split('-').map(Number);
    const finalDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return {
      id: this.store.generateId('STL', this.store.settlements),
      fleetManagerId,
      month,
      startDate: `${month}-01`,
      endDate: `${month}-${String(finalDay).padStart(2, '0')}`,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
  }

  createSettlement(dto: SettlementPeriodDto, requester: { userId: string; role: string }): FleetManagerSettlement {
    if (requester.role !== 'superuser') {
      throw new ForbiddenException('Only a superuser can create settlement periods');
    }

    const month = this.normalizeMonth(dto.month);
    this.assertFleetManagerExists(dto.fleetManagerId);
    const existing = this.store.settlements.find(
      (settlement) => settlement.fleetManagerId === dto.fleetManagerId && settlement.month === month,
    );
    if (existing) return existing;

    const settlement = this.buildOpenSettlement(dto.fleetManagerId, month);
    this.store.settlements.push(settlement);
    this.store.persistSettlements();
    return settlement;
  }

  listSettlements(
    requester: { userId: string; role: string },
    fleetManagerId?: string,
  ): Array<FleetManagerSettlement & { fleetManagerName?: string }> {
    let targetId = fleetManagerId;
    if (requester.role === 'fleet-manager') targetId = requester.userId;
    else if (requester.role !== 'superuser') {
      throw new ForbiddenException('You are not authorized to view fleet settlements');
    }

    return this.store.settlements
      .filter((settlement) => !targetId || settlement.fleetManagerId === targetId)
      .map((settlement) => ({
        ...settlement,
        fleetManagerName: this.store.users.find((user) => user.id === settlement.fleetManagerId)?.name,
      }))
      .sort((left, right) => right.month.localeCompare(left.month));
  }

  lockSettlement(
    dto: SettlementPeriodDto,
    requester: { userId: string; role: string },
  ): FleetManagerSettlement {
    if (requester.role !== 'superuser') {
      throw new ForbiddenException('Only a superuser can lock settlement periods');
    }

    const month = this.normalizeMonth(dto.month);
    this.assertFleetManagerExists(dto.fleetManagerId);
    const existing = this.store.settlements.find(
      (settlement) => settlement.fleetManagerId === dto.fleetManagerId && settlement.month === month,
    );
    if (existing?.status === 'locked') return existing;

    const unpaidPayouts = this.store.driverPayouts.filter(
      (payout) =>
        payout.fleetManagerId === dto.fleetManagerId &&
        !payout.reversed &&
        String(payout.earnedAt || payout.createdAt).slice(0, 7) === month &&
        String(payout.status || '').toLowerCase() !== 'paid',
    );
    if (unpaidPayouts.length > 0) {
      const unpaidTotal = unpaidPayouts.reduce((total, payout) => total + Number(payout.totalAmount || 0), 0);
      throw new BadRequestException(
        `Driver payouts remain unpaid for ${month}: ${unpaidPayouts.length} payout(s), ₹${unpaidTotal.toFixed(2)}. Pay them before locking the settlement.`,
      );
    }

    if (month >= new Date().toISOString().slice(0,7)) throw new BadRequestException('A settlement can be locked after its calendar month ends');
    const settlement = existing || this.buildOpenSettlement(dto.fleetManagerId, month);
    if (!existing) this.store.settlements.push(settlement);
    settlement.status = 'locked';
    settlement.lockedAt = new Date().toISOString();
    settlement.lockedBy = requester.userId;
    settlement.snapshot = this.computeMonthlyStatement(dto.fleetManagerId, month);
    this.store.persistSettlements();
    return settlement;
  }

  getFleetManagerStatement(fleetManagerId: string, month?: string) {
    const targetMonth = this.normalizeMonth(month);
    this.assertFleetManagerExists(fleetManagerId);
    const settlement = this.store.settlements.find(
      (item) => item.fleetManagerId === fleetManagerId && item.month === targetMonth,
    );
    const snapshot = settlement?.status === 'locked' && settlement.snapshot
      ? {
          ...settlement.snapshot,
          pendingDriverEarnings: Number(settlement.snapshot.pendingDriverEarnings || 0),
        }
      : this.computeMonthlyStatement(fleetManagerId, targetMonth);

    return {
      settlementId: settlement?.id,
      month: targetMonth,
      status: settlement?.status || 'open',
      lockedAt: settlement?.lockedAt,
      lockedBy: settlement?.lockedBy,
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
