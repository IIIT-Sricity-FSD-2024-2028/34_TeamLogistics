import { Controller, Get, Post, Patch, Body, Headers, UseGuards } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Get notifications for current role', description: 'Returns notifications filtered by the x-user-role header.' })
  findAll(@Headers('x-user-role') role: string) {
    return this.notificationsService.findAll(role);
  }

  @Post()
  @Roles(Role.SUPERUSER)
  @ApiOperation({ summary: 'Create a notification' })
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Patch('mark-read')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  @ApiOperation({ summary: 'Mark all notifications as read for current role' })
  markRead(@Headers('x-user-role') role: string) {
    return this.notificationsService.markAllRead(role);
  }
}
