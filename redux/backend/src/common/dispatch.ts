import { BadRequestException } from '@nestjs/common';
import type { Point, ServiceRoute } from './service-routes';
import type { Trip, Driver, Vehicle } from '../data-store/data-store.service';

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const timeFormat = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export type Shift = {start: string; end: string};
const shifts: Record<string, Shift> = JSON.parse(process.env.DRIVER_SHIFTS_JSON || '{}');
if (!shifts || typeof shifts !== 'object' || Array.isArray(shifts) || Object.values(shifts).some(s =>
  !s || !timeFormat.test(s.start) || !timeFormat.test(s.end) || s.start === s.end)) throw new Error('Invalid DRIVER_SHIFTS_JSON');

export function onShift(driverId: string, now = new Date(), schedule = shifts) {
  const shift = schedule[driverId];
  if (!shift) return true;
  const local = (now.getUTCHours() * 60 + now.getUTCMinutes() + 330) % 1440;
  const start = minutes(shift.start), end = minutes(shift.end);
  return start < end ? local >= start && local < end : local >= start || local < end;
}

export function distanceM(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const h = Math.sin((a.latitude - b.latitude) * rad / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((a.longitude - b.longitude) * rad / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(Math.min(h, 1)));
}

export interface Position extends Point { accuracy?: number; measuredAt?: string; recordedAt: string; nearDrop?: boolean }
export function trackPosition(input: Point & {accuracy?: number; measuredAt?: string}, previous?: Position,
  route?: ServiceRoute, now = Date.now()): Position {
  const measured = input.measuredAt === undefined ? now : Date.parse(input.measuredAt);
  if (!Number.isFinite(measured) || measured > now + 5000 || now - measured > 600000)
    throw new BadRequestException('A fresh GPS measurement is required');
  const prior = Date.parse(previous?.measuredAt || previous?.recordedAt || '');
  if (previous && measured <= prior) return previous;
  if (input.accuracy !== undefined && input.accuracy > 500) throw new BadRequestException('GPS accuracy is too low');
  if (previous && measured > prior && distanceM(previous, input) >
      55 * (measured - prior) / 1000 + (input.accuracy ?? 100) + (previous.accuracy ?? 100))
    throw new BadRequestException('GPS movement could not be confirmed');
  const point: Position = {...input, measuredAt: new Date(measured).toISOString(), recordedAt: new Date(now).toISOString()};
  if (route?.dropPoint && route.arrivalRadiusM && input.accuracy !== undefined) {
    point.nearDrop = distanceM(input, route.dropPoint) + input.accuracy <= route.arrivalRadiusM;
  }
  return point;
}

export const WORK_TRIP_STATUSES = ['accepted', 'picked up', 'in transit', 'issue reported', 'attempt failed', 'returning'];
export function reservesDriver(trip: Trip) {
  const status = trip.status.trim().toLowerCase();
  return status === 'assigned' || (Boolean(trip.driverId) && ['queued', 'pending'].includes(status)) ||
    WORK_TRIP_STATUSES.includes(status);
}

// The stored status is the driver's idle preference. Open assignments own the In Work state.
export function driverStatus(status: string, reserved: boolean): string {
  switch (String(status).toLowerCase()) {
    case 'active': case 'available': case 'on duty': case 'in work':
      return reserved ? 'In Work' : 'Available';
    case 'offline': case 'busy': case 'unavailable':
      return reserved ? 'In Work' : 'Unavailable';
    default:
      return status;
  }
}

export function dispatchVehicle(driver: Driver, vehicles: Vehicle[], drivers: Driver[]) {
  const fleet = vehicles.filter(v => v.fleetManagerId === driver.fleetManagerId);
  const free = (v: Vehicle) => !v.assignedDriver || v.assignedDriver === '--';
  return fleet.find(v => v.plate === driver.vehicle && (free(v) || v.assignedDriver === driver.name)) ||
    fleet.find(v => v.assignedDriver === driver.name) ||
    fleet.find(v => free(v) && !drivers.some(d =>
      d.id !== driver.id && d.fleetManagerId === driver.fleetManagerId && d.vehicle === v.plate));
}

export function rankDrivers(drivers: Driver[], trips: Trip[], pickup?: Point, now = Date.now()) {
  const history = new Map<string, {jobs: number; position?: Position}>();
  for (const trip of trips) {
    if (!trip.driverId) continue;
    const entry = history.get(trip.driverId) || {jobs: 0};
    entry.jobs++;
    const pos: Position | undefined = (trip as Trip & {lastPosition?: Position}).lastPosition;
    const recorded = (p?: Position) => Date.parse(p?.measuredAt || p?.recordedAt || '');
    if (pos && (pos.accuracy ?? Infinity) <= 100 && recorded(pos) <= now && now - recorded(pos) <= 60000 &&
      (!entry.position || recorded(pos) > recorded(entry.position))) entry.position = pos;
    history.set(trip.driverId, entry);
  }
  const distance = (id: string) => {
    const position = history.get(id)?.position;
    return pickup && position ? distanceM(position, pickup) : Infinity;
  };
  return [...drivers].sort((a,b) => (a.lastAssignedAt || '').localeCompare(b.lastAssignedAt || '') ||
    distance(a.id) - distance(b.id) ||
    (history.get(a.id)?.jobs || 0) - (history.get(b.id)?.jobs || 0) || a.id.localeCompare(b.id));
}
