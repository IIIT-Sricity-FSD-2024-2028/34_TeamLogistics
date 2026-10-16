import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { Subject } from 'rxjs';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';


export interface ProfileDetails {
  companyName?: string;
  companyAddress?: string;
  numberOfVehicles?: string;
  companyContactNumber?: string;
  businessAddress?: string;
  fullName?: string;
  licenseNumber?: string;
  licenseDocument?: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  bankBook?: string;
  driverId?: string;
  vehicle?: string;
  [key: string]: any;
}

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  password: string;
  role: string;
  status: string;
  phone?: string;
  lastLogin?: string;
  notifications?: string[];
  profileDetails?: ProfileDetails;
  createdAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  termsAcceptedAt?: string;
  termsVersion?: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  type: string;
  capacity: string;
  assignedDriver: string;
  status: string;
  maintenance?: string;
  location?: string;
  fleetManagerId?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  zone: string;
  vehicle: string;
  status: string;
  license?: string;
  licenseExpiry?: string;
  rating?: string;
  trip?: string;
  email?: string;
  userEmail?: string;
  fleetManagerId?: string;
}

export interface Mechanic {
  id: string;
  name: string;
  active: boolean;
  fleetManagerId?: string;
}

export interface DeliveryRequest {
  id: string;
  clientUserId?: string;
  customer: string;
  contact: string;
  pickup: string;
  dropoff: string;
  package: string;
  packageType?: string;
  packageDimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  type: string;
  requestTime: string;
  status: string;
  priority: string;
  items: number;
  driver: string;
  preferredDeliveryAt?: string;
  blockReason?: string;
  unblockReason?: string;
  cancelReason?: string;
}

export interface Trip {
  id: string;
  assignment: string;
  driver: string;
  phone: string;
  vehicle: string;
  vehicleType: string;
  pickup: string;
  destination: string;
  startTime: string;
  distance: string;
  status: string;
  request?: string;
  driverNotes?: { text: string; time: string }[];
  statusBeforeIssue?: string;
  disputeResolution?: {
    resolvedAmount: number;
    resolvedBy: string;
    resolvedAt: string;
    reason: string;
  };
}

export interface MaintenanceSchedule {
  id: string;
  vehicle: string;
  issue: string;
  priority: string;
  status: string;
  date: string;
  mechanic: string;
  mechanicId?: string;
  cost: string;
  notes?: string;
  fleetManagerId?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  to: string;
  toUserId?: string;
  read: boolean;
  createdAt: string;
  readByUserIds?: string[];
  unreadByUserIds?: string[];
  dismissedForUserIds?: string[];
}

export interface Transaction {
  id: string;
  type: string;
  client: string;
  amount: number;
  status: string;
  date: string;
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string;

  invoiceId?: string;
  deliveryId?: string;
  paymentMode?: string;
  reference?: string;
  receiptName?: string;
  receiptUrl?: string;
  userId?: string;

  transactionType?: string;
  grossAmount?: number;
  platformCommission?: number;
  fleetManagerAmount?: number;
  resolvedAmount?: number;
  commissionRatePercent?: number;

  refunded?: boolean;
  refundedAt?: string;
  refundReason?: string;
  relatedTransactionId?: string;

  refundedAmount?: number;
  refundAmount?: number;
}

export interface RateCard {
  id: string;
  ownerId: string;
  baseFare: number;
  perKm: number;
  perKg: number;
  customerBaseFare?: number;
  customerPerKm?: number;
  customerPerKg?: number;
  updatedAt: string;
}

export interface DriverPayout {
  id: string;
  tripId: string;
  deliveryId?: string;
  driverName: string;
  fleetManagerId?: string;
  baseFare: number;
  distanceFare: number;
  weightSurcharge: number;
  totalAmount: number;
  createdAt: string;
  status?: 'Unpaid' | 'Earned' | 'Approved' | 'Paid';
  earnedAt?: string;
  approvedAt?: string;
  paidAt?: string;
  rateCardSnapshot?: { baseFare: number; perKm: number; perKg: number; ownerId: string };
  reversed?: boolean;
  reversalReason?: string;
}

export interface Invoice {
  id: string;
  client: string;
  amount: number;
  status: string;
  dueDate: string;
  createdAt: string;
}

export interface PlatformSettings {
  name: string;
  timezone: string;
  language: string;
  logo: string;
}

export interface SecuritySettings {
  passwordLength: number;
  failedAttempts: number;
  sessionTimeout: number;
}

export type PermissionEntry = [string, string, boolean];

export interface Permissions {
  [role: string]: PermissionEntry[];
}

export interface Document {
  id: string;
  type: string;
  owner: string;
  review: string;
  updated: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  scope: string;
  status: string;
}


@Injectable()
export class DataStoreService {
  readonly changes = new Subject<void>();
  private readonly logger = new Logger(DataStoreService.name);
  private readonly dataDir: string;

  users: User[] = [];
  vehicles: Vehicle[] = [];
  drivers: Driver[] = [];
  mechanics: Mechanic[] = [];
  deliveryRequests: DeliveryRequest[] = [];
  trips: Trip[] = [];
  maintenanceSchedules: MaintenanceSchedule[] = [];
  notifications: Notification[] = [];
  transactions: Transaction[] = [];
  invoices: Invoice[] = [];
  documents: Document[] = [];
  settings: Setting[] = [];
  rateCards: RateCard[] = [];
  driverPayouts: DriverPayout[] = [];

  platformSettings: PlatformSettings = { name: '', timezone: '', language: '', logo: '' };
  securitySettings: SecuritySettings = { passwordLength: 8, failedAttempts: 5, sessionTimeout: 30 };
  permissions: Permissions = {};
  commissionRate = 10;
  minimumFleetMarginPercent = 15;

  constructor() {
    this.dataDir = process.env.DATA_DIR
      ? path.resolve(process.env.DATA_DIR)
      : path.resolve(__dirname, '..', '..', 'data');
    this.logger.log(`📂 JSON data directory: ${this.dataDir}`);
    this.loadAllFromFiles();
    if (new Set(this.notifications.map((n) => n.id)).size !== this.notifications.length) {
      this.persistNotifications();
    }
  }


  private readJsonFile<T>(filename: string, fallback: T): T {
    const filePath = path.join(this.dataDir, filename);
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        this.logger.log(`  ✅ Loaded ${filename}`);
        return JSON.parse(raw) as T;
      } else {
        this.logger.warn(`  ⚠️  ${filename} not found, using defaults`);
        return fallback;
      }
    } catch (err) {
      this.logger.error(`  ❌ Error reading ${filename}: ${err}`);
      return fallback;
    }
  }

  private writeJsonFile(filename: string, data: any): void {
    const filePath = path.join(this.dataDir, filename);
    const temporaryPath = `${filePath}.tmp`;
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(temporaryPath, filePath);
      this.changes.next();
    } catch (err) {
      this.logger.error(`  ❌ Error writing ${filename}: ${err}`);
      // Reload the last committed records before any subsequent reads.
      this.loadAllFromFiles();
      throw new InternalServerErrorException('Unable to save changes. Please retry.');
    }
  }


  private loadAllFromFiles(): void {
    this.logger.log('🔄 Loading data from JSON files...');

    this.users = this.readJsonFile<User[]>('users.json', []);
    this.vehicles = this.readJsonFile<Vehicle[]>('vehicles.json', []).map((vehicle) => {
      return String(vehicle.status || '').toLowerCase() === 'blocked'
        ? { ...vehicle, status: 'Maintenance' }
        : vehicle;
    });
    this.drivers = this.readJsonFile<Driver[]>('drivers.json', []);
    this.mechanics = this.readJsonFile<Mechanic[]>('mechanics.json', []);
    this.deliveryRequests = this.readJsonFile<DeliveryRequest[]>('deliveries.json', []);
    this.trips = this.readJsonFile<Trip[]>('trips.json', []);
    this.maintenanceSchedules = this.readJsonFile<MaintenanceSchedule[]>('maintenance.json', []);
    this.notifications = this.readJsonFile<Notification[]>('notifications.json', []);
    this.transactions = this.readJsonFile<Transaction[]>('transactions.json', []);
    this.invoices = this.readJsonFile<Invoice[]>('invoices.json', []);
    this.documents = this.readJsonFile<Document[]>('documents.json', []);
    this.rateCards = this.readJsonFile<RateCard[]>('rate-cards.json', [
      {
        id: 'PLATFORM',
        ownerId: 'PLATFORM',
        baseFare: 50,
        perKm: 8,
        perKg: 5,
        customerBaseFare: 80,
        customerPerKm: 13,
        customerPerKg: 8,
        updatedAt: new Date().toISOString(),
      },
    ]);
    this.driverPayouts = this.readJsonFile<DriverPayout[]>('driver-payouts.json', []);

    const settingsData = this.readJsonFile<any>('settings.json', {});
    this.platformSettings = settingsData.platform || { name: 'DeliverSync', timezone: 'Asia/Kolkata', language: 'English', logo: '' };
    this.securitySettings = {
      passwordLength: Number(settingsData.security?.passwordLength || 8),
      failedAttempts: Number(settingsData.security?.failedAttempts || 5),
      sessionTimeout: Number(settingsData.security?.sessionTimeout || 30),
    };
    this.permissions = settingsData.permissions || {};
    this.settings = settingsData.configEntries || [];
    this.commissionRate = typeof settingsData.commissionRate === 'number' ? settingsData.commissionRate : 10;
    this.minimumFleetMarginPercent =
      typeof settingsData.minimumFleetMarginPercent === 'number' ? settingsData.minimumFleetMarginPercent : 15;

    this.driverPayouts = this.driverPayouts.map((payout) => ({
      ...payout,
      status: payout.status || 'Paid',
      earnedAt: payout.earnedAt || payout.createdAt,
      paidAt: payout.status ? payout.paidAt : payout.createdAt,
    }));

    this.logger.log(
      `✅ Data loaded — ${this.users.length} users, ${this.vehicles.length} vehicles, ` +
      `${this.drivers.length} drivers, ${this.mechanics.length} mechanics, ${this.deliveryRequests.length} deliveries, ` +
      `${this.trips.length} trips, ${this.maintenanceSchedules.length} maintenance records`,
    );
  }


  persistUsers(): void {
    this.writeJsonFile('users.json', this.users);
  }

  persistVehicles(): void {
    this.writeJsonFile('vehicles.json', this.vehicles);
  }

  persistDrivers(): void {
    this.writeJsonFile('drivers.json', this.drivers);
  }

  persistMechanics(): void {
    this.writeJsonFile('mechanics.json', this.mechanics);
  }

  persistDeliveries(): void {
    this.writeJsonFile('deliveries.json', this.deliveryRequests);
  }

  persistTrips(): void {
    this.writeJsonFile('trips.json', this.trips);
  }

  persistMaintenance(): void {
    this.writeJsonFile('maintenance.json', this.maintenanceSchedules);
  }

  persistNotifications(): void {
    // Legacy event producers used millisecond IDs, which can collide during
    // completion/invoice/payout actions. Preserve existing unique IDs and
    // assign stable IDs to collisions before exposing them to the inbox.
    const seen = new Set<string>();
    for (const notification of this.notifications) {
      if (!notification.id || seen.has(notification.id)) notification.id = `N-${randomUUID()}`;
      seen.add(notification.id);
    }
    this.writeJsonFile('notifications.json', this.notifications);
  }

  persistTransactions(): void {
    this.writeJsonFile('transactions.json', this.transactions);
  }

  persistInvoices(): void {
    this.writeJsonFile('invoices.json', this.invoices);
  }

  persistDocuments(): void {
    this.writeJsonFile('documents.json', this.documents);
  }

  persistRateCards(): void {
    this.writeJsonFile('rate-cards.json', this.rateCards);
  }

  persistDriverPayouts(): void {
    this.writeJsonFile('driver-payouts.json', this.driverPayouts);
  }

  persistSettings(): void {
    this.writeJsonFile('settings.json', {
      platform: this.platformSettings,
      security: this.securitySettings,
      permissions: this.permissions,
      configEntries: this.settings,
      commissionRate: this.commissionRate,
      minimumFleetMarginPercent: this.minimumFleetMarginPercent,
    });
  }

  generateId(prefix: string, collection: { id: string }[]): string {
    const nums = collection
      .map((item) => {
        const match = String(item.id || '').match(/(\d+)/);
        return match ? Number(match[1]) : 0;
      })
      .filter(Boolean);
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${prefix}-${String(next).padStart(3, '0')}`;
  }
}
