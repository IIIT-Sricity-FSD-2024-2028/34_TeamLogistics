import {
  calculateDeliveryPricing,
  EXPRESS_PRICE_MULTIPLIER,
  VOLUMETRIC_DIVISOR_CM3_PER_KG,
} from './delivery-pricing';

const rateCard: any = {
  ownerId: 'FM-101',
  baseFare: 95,
  perKg: 9,
};

describe('calculateDeliveryPricing', () => {
  it('uses actual weight when it is greater than volumetric weight', () => {
    const result = calculateDeliveryPricing({
      packageDimensions: { length: 30, width: 20, height: 10, unit: 'cm' },
      weight: 5,
      type: 'Standard',
    }, rateCard);

    expect(result.volumetricWeightKg).toBe(1.2);
    expect(result.chargeableWeightKg).toBe(5);
    expect(result.total).toBe(140);
  });

  it('uses package dimensions when volumetric weight is greater', () => {
    const result = calculateDeliveryPricing({
      packageDimensions: { length: 100, width: 50, height: 40, unit: 'cm' },
      weight: 5,
      type: 'Standard',
    }, rateCard);

    expect(result.volumetricWeightKg).toBe(200000 / VOLUMETRIC_DIVISOR_CM3_PER_KG);
    expect(result.chargeableWeightKg).toBe(40);
    expect(result.total).toBe(455);
  });

  it('applies the express multiplier to the complete package-based price', () => {
    const result = calculateDeliveryPricing({
      packageDimensions: { length: 30, width: 20, height: 10, unit: 'cm' },
      weight: 5,
      type: 'Express',
    }, rateCard);

    expect(result.serviceMultiplier).toBe(EXPRESS_PRICE_MULTIPLIER);
    expect(result.total).toBe(210);
  });
});
