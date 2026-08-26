import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DataStoreService,
  Subscription,
  Transaction,
} from '../data-store/data-store.service';
import { PaySubscriptionDto } from './dto/subscription.dto';

export const SUBSCRIPTION_PLANS: Record<
  string,
  { amount: number; vehicleLimit: number; billingCycle: 'monthly' }
> = {
  Starter: { amount: 999, vehicleLimit: 5, billingCycle: 'monthly' },
  Business: { amount: 2499, vehicleLimit: 25, billingCycle: 'monthly' },
  Enterprise: { amount: 5999, vehicleLimit: 100, billingCycle: 'monthly' },
};

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class SubscriptionsService {
  constructor(private readonly store: DataStoreService) {}

  private expireIfNeeded(subscription: Subscription): Subscription {
    if (
      subscription.status === 'active' &&
      subscription.endDate &&
      new Date(subscription.endDate).getTime() < Date.now()
    ) {
      subscription.status = 'expired';
      subscription.updatedAt = new Date().toISOString();
      this.store.persistSubscriptions();
    }
    return subscription;
  }

  getCurrent(userId?: string): { subscription: Subscription | null; plans: typeof SUBSCRIPTION_PLANS } {
    if (!userId) {
      throw new BadRequestException('Missing x-user-id header');
    }

    const subscription = this.store.subscriptions.find((s) => s.userId === userId) || null;

    if (subscription) {
      this.expireIfNeeded(subscription);
    }

    return { subscription, plans: SUBSCRIPTION_PLANS };
  }

  payAndActivate(
    userId: string | undefined,
    dto: PaySubscriptionDto,
  ): { subscription: Subscription | null; transaction: Transaction } {
    if (!userId) {
      throw new BadRequestException('Missing x-user-id header');
    }

    const user = this.store.users.find((u) => u.id === userId);
    if (!user) {
      throw new NotFoundException(`User "${userId}" not found`);
    }

    const planConfig = SUBSCRIPTION_PLANS[dto.plan];
    if (!planConfig) {
      throw new BadRequestException(`Invalid plan "${dto.plan}"`);
    }

    const now = new Date();
    const amount = planConfig.amount;
    const simulateFailure = dto.simulate === 'fail';

    const transaction: Transaction = {
      id: `TXN-${Date.now()}`,
      type: 'Subscription',
      client: user.name || user.username || userId,
      amount,
      status: simulateFailure ? 'Failed' : 'Completed',
      date: now.toISOString().split('T')[0],
      createdAt: now.toISOString(),
      userId,
      paymentMode: dto.paymentMode || 'Demo Payment',
      reference: `SUB-${Date.now()}`,
      transactionType: 'subscription',
    };

    this.store.transactions.push(transaction);
    this.store.persistTransactions();

    if (simulateFailure) {
      return { subscription: this.store.subscriptions.find((s) => s.userId === userId) || null, transaction };
    }

    const startDate = now.toISOString().split('T')[0];
    const endDate = new Date(now.getTime() + MONTH_MS).toISOString().split('T')[0];

    let subscription = this.store.subscriptions.find((s) => s.userId === userId);

    if (!subscription) {
      subscription = {
        id: this.store.generateId('SUB', this.store.subscriptions),
        userId,
        role: 'fleet-manager',
        plan: dto.plan,
        amount,
        vehicleLimit: planConfig.vehicleLimit,
        billingCycle: planConfig.billingCycle,
        status: 'active',
        startDate,
        endDate,
        paymentStatus: 'paid',
        transactionId: transaction.id,
        createdAt: now.toISOString(),
      };
      this.store.subscriptions.push(subscription);
    } else {
      subscription.plan = dto.plan;
      subscription.amount = amount;
      subscription.vehicleLimit = planConfig.vehicleLimit;
      subscription.billingCycle = planConfig.billingCycle;
      subscription.status = 'active';
      subscription.startDate = startDate;
      subscription.endDate = endDate;
      subscription.paymentStatus = 'paid';
      subscription.transactionId = transaction.id;
      subscription.updatedAt = now.toISOString();
    }

    this.store.persistSubscriptions();

    this.store.notifications.unshift({
      id: `N-${Date.now()}`,
      title: 'Subscription activated successfully',
      message: `Your ${dto.plan} plan subscription is now active until ${endDate}.`,
      time: 'Just now',
      to: 'fleet-manager',
      read: false,
      createdAt: now.toISOString(),
    } as any);
    this.store.persistNotifications();

    return { subscription, transaction };
  }
}
