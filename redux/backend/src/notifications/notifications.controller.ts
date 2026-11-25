import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { paginate } from '../common/page';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/notification.dto';
import { RolesGuard, Roles, Role } from '../common';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  @ApiOperation({ summary: 'Get notifications for the current user', description: 'Returns notifications scoped to the verified requester.' })
  findAll(@Req() req: Request) {
    const requester = (req as any).user as { userId: string; role: string };
    const items = this.notificationsService.findAll(requester.role, requester.userId);
    if (!req.query.page && !req.query.limit) return items;
    const attention = (n: typeof items[number]) => /issue|blocked|reject|failed|delay|overdue|expir|suspend/i.test(n.title + ' ' + n.message);
    const search = String(req.query.search || '').trim().toLowerCase();
    const filter = req.query.filter;
    const filtered = items.filter((n) =>
      (filter !== 'unread' || !n.read) && (filter !== 'read' || n.read) && (filter !== 'attention' || attention(n)) &&
      (n.title + ' ' + n.message).toLowerCase().includes(search));
    return { ...paginate(filtered, req.query.page, req.query.limit),
      counts: { total: items.length, unread: items.filter((n) => !n.read).length, attention: items.filter(attention).length } };
  }

  @Post()
  @Roles(Role.SUPERUSER)
  @ApiOperation({ summary: 'Create a notification' })
  create(@Body() dto: CreateNotificationDto, @Req() req: Request) {
    return this.notificationsService.create(dto, req.get('Idempotency-Key'), (req as any).user.userId);
  }

  @Patch('mark-read')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  @ApiOperation({ summary: 'Mark all notifications as read for the current user' })
  markRead(@Req() req: Request) {
    const requester = (req as any).user as { userId: string; role: string };
    return this.notificationsService.markAllRead(requester.role, requester.userId);
  }

  @Patch(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  @ApiOperation({ summary: 'Mark a single notification as read or unread' })
  markOne(@Param('id') id: string, @Body('read') read: boolean, @Req() req: Request) {
    const requester = (req as any).user as { userId: string; role: string };
    return this.notificationsService.markOne(id, read !== false, requester.role, requester.userId);
  }

  @Delete(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  @ApiOperation({ summary: 'Delete a notification', description: 'Deletes a notification belonging to the verified requester.' })
  remove(@Param('id') id: string, @Req() req: Request) {
    const requester = (req as any).user as { userId: string; role: string };
    return this.notificationsService.remove(id, requester.role, requester.userId);
  }
}
