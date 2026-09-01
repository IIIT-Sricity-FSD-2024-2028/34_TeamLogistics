import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataStoreService, PlatformSettings, SecuritySettings, PermissionEntry } from '../data-store/data-store.service';
import { UpdatePlatformSettingsDto, UpdateSecuritySettingsDto } from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly store: DataStoreService) {}

  getPlatformSettings(): PlatformSettings {
    return { ...this.store.platformSettings };
  }

  updatePlatformSettings(dto: UpdatePlatformSettingsDto): PlatformSettings {
    this.store.platformSettings = { ...this.store.platformSettings, ...dto };
    this.store.persistSettings();
    return this.store.platformSettings;
  }

  getSecuritySettings(): SecuritySettings {
    return { ...this.store.securitySettings };
  }

  updateSecuritySettings(dto: UpdateSecuritySettingsDto): SecuritySettings {
    this.store.securitySettings = { ...this.store.securitySettings, ...dto };
    this.store.persistSettings();
    return this.store.securitySettings;
  }

  getPermissions(role: string): PermissionEntry[] {
    const perms = this.store.permissions[role];
    if (!perms) throw new NotFoundException(`Permissions for role "${role}" not found`);
    return perms;
  }

  updatePermissions(role: string, permissions: PermissionEntry[]): PermissionEntry[] {
    if (!this.store.permissions[role]) {
      throw new NotFoundException(`Permissions for role "${role}" not found`);
    }
    this.store.permissions[role] = permissions;
    this.store.persistSettings();
    return this.store.permissions[role];
  }

  getAllPermissions(): Record<string, PermissionEntry[]> {
    return { ...this.store.permissions };
  }

  isPermissionEnabled(role: string, label: string): boolean {
    const perms = this.store.permissions[role];
    if (!perms) return true;
    const entry = perms.find((p) => p[0] === label);
    return entry ? entry[2] !== false : true;
  }

  getCommissionRate(): number {
    return this.store.commissionRate;
  }

  setCommissionRate(rate: number): number {
    if (typeof rate !== 'number' || Number.isNaN(rate) || rate < 0 || rate > 100) {
      throw new BadRequestException('commissionRate must be a number between 0 and 100');
    }

    this.store.commissionRate = rate;
    this.store.persistSettings();

    return this.store.commissionRate;
  }
}
