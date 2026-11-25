import { Roles, Role } from './index';
import { requestMetrics } from '../middleware/logging.middleware';
import { Controller, Get } from '@nestjs/common';
import { DataStoreService } from '../data-store/data-store.service';

@Controller('health')
export class HealthController {
  constructor(private readonly store: DataStoreService) {}

  @Get()
  health() { return { status: 'ok' }; }

  @Get('metrics')
  @Roles(Role.SUPERUSER)
  metrics() { return {...requestMetrics, uptimeSeconds: Math.floor(process.uptime())}; }

  @Get('ready')
  ready() {
    this.store.assertReady();
    return { status: 'ready' };
  }
}
