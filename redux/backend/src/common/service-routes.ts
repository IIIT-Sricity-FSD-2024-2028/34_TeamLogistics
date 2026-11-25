import { BadRequestException } from '@nestjs/common';

export interface Point { latitude: number; longitude: number }
export interface ServiceRoute {
  id: string;
  label: string;
  km: number;
  pickupPoint?: Point;
  dropPoint?: Point;
  transitMinutes?: number;
  arrivalRadiusM?: number;
}

function validPoint(point: Point | undefined) {
  return point === undefined || (point != null && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180);
}

// Local demo tariffs. Operators can supply their contracted routes as JSON.
const demoRoutes: ServiceRoute[] = [
  { id: 'chennai-local', label: 'Chennai local zone', km: 12 },
  { id: 'chennai-bengaluru', label: 'Chennai – Bengaluru', km: 350 },
];
export const serviceRoutes: ServiceRoute[] = process.env.DELIVERY_ROUTES_JSON
  ? JSON.parse(process.env.DELIVERY_ROUTES_JSON) : demoRoutes;
if (!Array.isArray(serviceRoutes) || !serviceRoutes.length || serviceRoutes.some((r) =>
  !r || !validPoint(r.pickupPoint) || !validPoint(r.dropPoint) ||
  (r.transitMinutes !== undefined && (!Number.isInteger(r.transitMinutes) || r.transitMinutes < 1 || r.transitMinutes > 10080)) ||
  (r.arrivalRadiusM !== undefined && (!r.dropPoint || !Number.isFinite(r.arrivalRadiusM) || r.arrivalRadiusM < 1 || r.arrivalRadiusM > 1000)) ||
  !r.id || !r.label || !Number.isFinite(r.km) || r.km <= 0) ||
  new Set(serviceRoutes.map((r) => r.id)).size !== serviceRoutes.length) {
  throw new Error('Invalid DELIVERY_ROUTES_JSON configuration');
}
export function serviceRoute(id: string) {
  const route = serviceRoutes.find((item) => item.id === id);
  if (!route) throw new BadRequestException('Select a supported delivery route');
  return route;
}
