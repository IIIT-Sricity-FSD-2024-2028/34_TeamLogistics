import { BadRequestException } from '@nestjs/common';

// Convert decimal inputs before multiplying so that half-paise ties round consistently.
function decimal(value: number) {
  if (!Number.isFinite(value)) throw new BadRequestException('Invalid monetary value');
  const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e');
  const scale = (mantissa.split('.')[1]?.length || 0) - Number(exponent);
  const digits = BigInt(mantissa.replace('.', ''));
  return { n: digits * 10n ** BigInt(Math.max(0, -scale)), d: 10n ** BigInt(Math.max(0, scale)) };
}

export function paise(amount: number, multiplier = 1, divisor = 1): number {
  const a = decimal(amount), m = decimal(multiplier);
  const numerator = a.n * m.n * 100n;
  const denominator = a.d * m.d * BigInt(divisor);
  const magnitude = numerator < 0n ? -numerator : numerator;
  const result = Number((magnitude + denominator / 2n) / denominator) * (numerator < 0n ? -1 : 1);
  if (!Number.isSafeInteger(result)) throw new BadRequestException('Amount exceeds supported range');
  return result;
}

export function rupees(minor: number) {
  if (!Number.isSafeInteger(minor)) throw new BadRequestException('Invalid paise amount');
  return minor / 100;
}
