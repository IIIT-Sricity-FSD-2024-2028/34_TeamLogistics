import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataStoreService, Notification } from '../data-store/data-store.service';
import { CreateNotificationDto } from './dto/notification.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class NotificationsService {
  constructor(private readonly store: DataStoreService) {}

  findAll(role?: string, userId?: string): Notification[] {
    if (role) {
      return this.store.notifications.filter((n) => {
        if (userId && n.dismissedForUserIds?.includes(userId)) return false;
        if (n.toUserId) return n.toUserId === userId;
        return n.to === role || n.to === 'all';
      }).map((n) => ({
        ...n,
        read: userId && n.unreadByUserIds?.includes(userId) ? false
          : Boolean(n.read || (userId && n.readByUserIds?.includes(userId))),
        readByUserIds: undefined,
        unreadByUserIds: undefined,
        dismissedForUserIds: undefined,
      })).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    }
    return [...this.store.notifications];
  }

  create(dto: CreateNotificationDto): Notification {
    const notification: Notification = {
      id: `N-${randomUUID()}`,
      title: dto.title,
      message: dto.message,
      time: 'Just now',
      to: dto.to,
      toUserId: dto.toUserId,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.store.notifications.unshift(notification);
    this.store.persistNotifications();
    return notification;
  }

  markAllRead(role: string, userId?: string): { message: string } {
    const visible = new Set(this.findAll(role, userId).map((n) => n.id));
    this.store.notifications.filter((n) => visible.has(n.id))
      .forEach((n) => this.setRead(n, true, userId));
    this.store.persistNotifications();
    return { message: 'All notifications marked as read' };
  }

  markOne(id: string, read: boolean, role?: string, userId?: string): Notification {
    const notification = this.store.notifications.find((n) => n.id === id);

    if (!notification) {
      throw new NotFoundException(`Notification "${id}" not found`);
    }

    const belongsToRequester = notification.toUserId
      ? notification.toUserId === userId
      : notification.to === role || notification.to === 'all';

    if (role && !belongsToRequester) {
      throw new ForbiddenException('You can only update your own notifications');
    }

    this.setRead(notification, read, userId);
    this.store.persistNotifications();

    return { ...notification, read, readByUserIds: undefined, unreadByUserIds: undefined, dismissedForUserIds: undefined };
  }

  private setRead(notification: Notification, read: boolean, userId?: string): void {
    if (!userId || notification.toUserId) {
      notification.read = read;
      return;
    }
    notification.readByUserIds = (notification.readByUserIds || []).filter((id) => id !== userId);
    notification.unreadByUserIds = (notification.unreadByUserIds || []).filter((id) => id !== userId);
    if (read) notification.readByUserIds.push(userId);
    else notification.unreadByUserIds.push(userId);
  }

  remove(id: string, role?: string, userId?: string): { message: string } {
    const index = this.store.notifications.findIndex((n) => n.id === id);

    if (index < 0) {
      throw new NotFoundException(`Notification "${id}" not found`);
    }

    const notification = this.store.notifications[index];
    const belongsToRequester = notification.toUserId
      ? notification.toUserId === userId
      : notification.to === role || notification.to === 'all';

    if (role && !belongsToRequester) {
      throw new ForbiddenException('You can only delete your own notifications');
    }

    if (userId && !notification.toUserId) {
      notification.dismissedForUserIds = [...new Set([...(notification.dismissedForUserIds || []), userId])];
    } else {
      this.store.notifications.splice(index, 1);
    }
    this.store.persistNotifications();

    return { message: 'Notification deleted' };
  }
}
