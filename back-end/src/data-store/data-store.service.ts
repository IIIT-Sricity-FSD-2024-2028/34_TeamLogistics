import { Injectable, Logger } from '@nestjs/common';
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
  availability?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  zone: string;
  vehicle: string;
  status: string;
  license?: string;
  rating?: string;
  trip?: string;
  email?: string;
  userEmail?: string;
}

export interface DeliveryRequest {
  id: string;
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
}

export interface MaintenanceSchedule {
  id: string;
  vehicle: string;
  issue: string;
  priority: string;
  status: string;
  date: string;
  mechanic: string;
  cost: string;
  notes?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  to: string;
  read: boolean;
  createdAt: string;
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
}

export interface Invoice {
  id: string;
  client: string;
  amount: number;
  status: string;
  dueDate: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  role: string;
  plan: string;
  amount: number;
  vehicleLimit: number;
  billingCycle: string;
  status: string;
  startDate: string;
  endDate: string;
  paymentStatus: string;
  transactionId?: string;
  createdAt: string;
  updatedAt?: string;
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
  twoFactor: boolean;
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
  private readonly logger = new Logger(DataStoreService.name);
  private readonly dataDir: string;

  users: User[] = [];
  vehicles: Vehicle[] = [];
  drivers: Driver[] = [];
  deliveryRequests: DeliveryRequest[] = [];
  trips: Trip[] = [];
  maintenanceSchedules: MaintenanceSchedule[] = [];
  notifications: Notification[] = [];
  transactions: Transaction[] = [];
  invoices: Invoice[] = [];
  documents: Document[] = [];
  settings: Setting[] = [];
  subscriptions: Subscription[] = [];

  platformSettings: PlatformSettings = { name: '', timezone: '', language: '', logo: '' };
  securitySettings: SecuritySettings = { passwordLength: 8, failedAttempts: 5, sessionTimeout: 30, twoFactor: true };
  permissions: Permissions = {};

  constructor() {
    this.dataDir = path.resolve(__dirname, '..', '..', 'data');
    this.logger.log(`📂 JSON data directory: ${this.dataDir}`);
    this.loadAllFromFiles();
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
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      this.logger.error(`  ❌ Error writing ${filename}: ${err}`);
    }
  }


  private loadAllFromFiles(): void {
    this.logger.log('🔄 Loading data from JSON files...');

    this.users = this.readJsonFile<User[]>('users.json', []);
    this.vehicles = this.readJsonFile<Vehicle[]>('vehicles.json', []);
    this.drivers = this.readJsonFile<Driver[]>('drivers.json', []);
    this.deliveryRequests = this.readJsonFile<DeliveryRequest[]>('deliveries.json', []);
    this.trips = this.readJsonFile<Trip[]>('trips.json', []);
    this.maintenanceSchedules = this.readJsonFile<MaintenanceSchedule[]>('maintenance.json', []);
    this.notifications = this.readJsonFile<Notification[]>('notifications.json', []);
    this.transactions = this.readJsonFile<Transaction[]>('transactions.json', []);
    this.invoices = this.readJsonFile<Invoice[]>('invoices.json', []);
    this.documents = this.readJsonFile<Document[]>('documents.json', []);
    this.subscriptions = this.readJsonFile<Subscription[]>('subscriptions.json', []);

    const settingsData = this.readJsonFile<any>('settings.json', {});
    this.platformSettings = settingsData.platform || { name: 'DeliverSync', timezone: 'Asia/Kolkata', language: 'English', logo: '' };
    this.securitySettings = settingsData.security || { passwordLength: 8, failedAttempts: 5, sessionTimeout: 30, twoFactor: true };
    this.permissions = settingsData.permissions || {};
    this.settings = settingsData.configEntries || [];

    this.logger.log(
      `✅ Data loaded — ${this.users.length} users, ${this.vehicles.length} vehicles, ` +
      `${this.drivers.length} drivers, ${this.deliveryRequests.length} deliveries, ` +
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

  persistSubscriptions(): void {
    this.writeJsonFile('subscriptions.json', this.subscriptions);
  }

  persistSettings(): void {
    this.writeJsonFile('settings.json', {
      platform: this.platformSettings,
      security: this.securitySettings,
      permissions: this.permissions,
      configEntries: this.settings,
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
