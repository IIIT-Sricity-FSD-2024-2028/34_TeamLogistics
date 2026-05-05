import { Injectable } from '@nestjs/common';
import { DataStoreService, Notification } from '../data-store/data-store.service';
import { CreateNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly store: DataStoreService) {}

  findAll(role?: string): Notification[] {
    if (role) {
      return this.store.notifications.filter((n) => n.to === role || n.to === 'all');
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

  markAllRead(role: string): { message: string } {
    this.store.notifications
      .filter((n) => n.to === role || n.to === 'all')
      .forEach((n) => (n.read = true));
    this.store.persistNotifications();
    return { message: 'All notifications marked as read' };
  }
}
