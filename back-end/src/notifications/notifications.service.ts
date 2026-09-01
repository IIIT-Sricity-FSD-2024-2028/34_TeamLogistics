import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataStoreService, Notification } from '../data-store/data-store.service';
import { CreateNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly store: DataStoreService) {}

  findAll(role?: string, userId?: string): Notification[] {
    if (role) {
      return this.store.notifications.filter((n) => {
        if (n.toUserId) return n.toUserId === userId;
        return n.to === role || n.to === 'all';
      });
    }
    return [...this.store.notifications];
  }

  create(dto: CreateNotificationDto): Notification {
    const notification: Notification = {
      id: `N-${Date.now()}`,
      title: dto.title,
      message: dto.message,
      time: 'Just now',
      to: dto.to,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.store.notifications.unshift(notification);
    this.store.persistNotifications();
    return notification;
  }

  markAllRead(role: string, userId?: string): { message: string } {
    this.store.notifications
      .filter((n) => (n.toUserId ? n.toUserId === userId : n.to === role || n.to === 'all'))
      .forEach((n) => (n.read = true));
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

    if (role && role !== 'superuser' && !belongsToRequester) {
      throw new ForbiddenException('You can only update your own notifications');
    }

    notification.read = read;
    this.store.persistNotifications();

    return notification;
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

    if (role && role !== 'superuser' && !belongsToRequester) {
      throw new ForbiddenException('You can only delete your own notifications');
    }

    this.store.notifications.splice(index, 1);
    this.store.persistNotifications();

    return { message: 'Notification deleted' };
  }
}
