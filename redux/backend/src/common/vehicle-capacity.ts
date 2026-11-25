import type { Vehicle } from '../data-store/data-store.service';

export function capacityKg(capacity: string): number {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(kg|kgs|kilograms?|t|tonnes?|tons?)\s*$/i.exec(capacity);
  return match ? Number(match[1]) * (/^t/i.test(match[2]) ? 1000 : 1) : 0;
}

export type Cargo = {weight: number; packageDimensions?: {length: number; width: number; height: number}; packageType?: string; routeId?: string; refrigerated?: boolean};

export function fitsVehicle(vehicle: Vehicle, load: Cargo): boolean {
  if (load.weight > capacityKg(vehicle.capacity)) return false;
  if (vehicle.routeIds?.length && (!load.routeId || !vehicle.routeIds.includes(load.routeId))) return false;
  if (load.refrigerated && !vehicle.handling?.includes('Refrigerated')) return false;
  if (['Food', 'Medical Supplies', 'Fragile Items', 'Hazardous Goods'].includes(load.packageType || '') &&
      !vehicle.handling?.includes(load.packageType!)) return false;
  const dims = load.packageDimensions;
  if (!dims) return true;
  if (vehicle.cargoCm?.length !== 3) return false;
  // Keep parcels upright. Horizontal rotation is allowed.
  const [l, w, h] = vehicle.cargoCm;
  return dims.height <= h && Math.min(dims.length, dims.width) <= Math.min(l, w) &&
    Math.max(dims.length, dims.width) <= Math.max(l, w);
}
