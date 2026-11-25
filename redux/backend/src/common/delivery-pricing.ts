import { paise, rupees } from './money';
import type { RateCard } from '../data-store/data-store.service';

export const VOLUMETRIC_DIVISOR_CM3_PER_KG = 5000;
export const EXPRESS_PRICE_MULTIPLIER = 1.5;

export type DeliveryPricing = {
  currency: 'INR';
  formulaVersion: 'dimensions-weight-v1';
  baseFare: number;
  distanceKm: number;
  perKm: number;
  distanceCharge: number;
  perKg: number;
  actualWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  weightCharge: number;
  serviceMultiplier: number;
  total: number;
  rateCardOwnerId: string;
};

type PricingInput = {
  distanceKm?: number;
  packageDimensions: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  weight: number;
  type?: string;
};


export function calculateDeliveryPricing(
  input: PricingInput,
  customerRateCard: RateCard,
): DeliveryPricing {
  const { length, width, height } = input.packageDimensions;
  const actualWeightKg = Number(input.weight);
  const volumetricWeightKg = Number(
    ((Number(length) * Number(width) * Number(height)) / VOLUMETRIC_DIVISOR_CM3_PER_KG).toFixed(2),
  );
  const chargeableWeightKg = Math.max(actualWeightKg, volumetricWeightKg);
  const baseFare = Number(customerRateCard.baseFare || 0);
  const perKg = Number(customerRateCard.perKg || 0);
  const weightCharge = rupees(paise(perKg, chargeableWeightKg));
  const serviceMultiplier = String(input.type || '').toLowerCase() === 'express'
    ? EXPRESS_PRICE_MULTIPLIER
    : 1;
  const distanceKm = input.distanceKm ?? 0;
  const perKm = Number(customerRateCard.perKm || 0);
  const distanceCharge = rupees(paise(perKm, distanceKm));
  const total = rupees(paise(rupees(paise(baseFare) + paise(distanceCharge) + paise(weightCharge)), serviceMultiplier));

  return {
    currency: 'INR',
    formulaVersion: 'dimensions-weight-v1',
    baseFare,
    perKg,
    actualWeightKg,
    volumetricWeightKg,
    chargeableWeightKg,
    weightCharge,
    distanceKm, perKm, distanceCharge,
    serviceMultiplier,
    total,
    rateCardOwnerId: customerRateCard.ownerId,
  };
}
