import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { debounceTime, interval, map, merge, Observable, of } from 'rxjs';
import { Roles, Role } from '../common';
import { DataStoreService } from './data-store.service';

@Controller('changes')
export class ChangesController {
  constructor(private readonly store: DataStoreService) {}

  @Sse()
  @SkipThrottle()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  stream(): Observable<MessageEvent> {
    // Send invalidations only. Each client refetches through the existing
    // role-scoped APIs; no private record is broadcast to other accounts.
    return merge(
      of({ data: { type: 'connected' } }),
      this.store.changes.pipe(debounceTime(200), map(() => ({ data: { type: 'changed' } }))),
      interval(15000).pipe(map(() => ({ data: { type: 'heartbeat' } }))),
    );
  }
}
