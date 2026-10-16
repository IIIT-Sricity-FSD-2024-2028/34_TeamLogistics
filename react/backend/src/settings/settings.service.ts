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
    const definedUpdates = Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined));
    this.store.platformSettings = { ...this.store.platformSettings, ...definedUpdates };
    this.store.persistSettings();
    return this.store.platformSettings;
  }

  getSecuritySettings(): SecuritySettings {
    return { ...this.store.securitySettings };
  }

  updateSecuritySettings(dto: UpdateSecuritySettingsDto): SecuritySettings {
    const definedUpdates = Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined));
    this.store.securitySettings = { ...this.store.securitySettings, ...definedUpdates };
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
    return this.updateEconomicsSettings(rate, this.store.minimumFleetMarginPercent).commissionRate;
  }

  getEconomicsSettings() {
    return {
      commissionRate: this.store.commissionRate,
      minimumFleetMarginPercent: this.store.minimumFleetMarginPercent,
    };
  }

  updateEconomicsSettings(commissionRate: number, minimumFleetMarginPercent: number) {
    if (commissionRate + minimumFleetMarginPercent >= 100) {
      throw new BadRequestException('Commission plus minimum fleet margin must be below 100%');
    }
    const availableShare = 1 - (commissionRate + minimumFleetMarginPercent) / 100;
    const incompatible = this.store.rateCards.find((card) =>
      (card.customerBaseFare && card.baseFare > card.customerBaseFare * availableShare + 0.001) ||
      (card.customerPerKm && card.perKm > card.customerPerKm * availableShare + 0.001) ||
      (card.customerPerKg && card.perKg > card.customerPerKg * availableShare + 0.001),
    );
    if (incompatible) {
      throw new BadRequestException(
        `Rate card ${incompatible.id} cannot support these percentages. Increase its customer prices first.`,
      );
    }
    this.store.commissionRate = commissionRate;
    this.store.minimumFleetMarginPercent = minimumFleetMarginPercent;
    this.store.persistSettings();
    return this.getEconomicsSettings();
  }
}
