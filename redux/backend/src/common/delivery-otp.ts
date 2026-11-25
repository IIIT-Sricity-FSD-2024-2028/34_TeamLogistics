import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { JWT_SECRET } from './jwt.constants';

export const DELIVERY_OTP_LIFETIME_MS = 10 * 60 * 1000;
export const DELIVERY_OTP_MAX_ATTEMPTS = 5;

export interface DeliveryOtpRecord {
  id: string;
  deliveryOtpHash?: string;
  deliveryOtpIssuedAt?: string;
  deliveryOtpExpiresAt?: string;
  deliveryOtpAttemptsRemaining?: number;
  deliveryOtpVerifiedAt?: string;
}

function hashOtp(deliveryId: string, code: string): Buffer {
  const secret = process.env.DELIVERY_OTP_SECRET || JWT_SECRET;
  return createHmac('sha256', secret).update(`${deliveryId}:${code}`).digest();
}

export function issueDeliveryOtp(delivery: DeliveryOtpRecord, now = new Date()): { code: string; expiresAt: string } {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(now.getTime() + DELIVERY_OTP_LIFETIME_MS).toISOString();
  delivery.deliveryOtpHash = hashOtp(delivery.id, code).toString('hex');
  delivery.deliveryOtpIssuedAt = now.toISOString();
  delivery.deliveryOtpExpiresAt = expiresAt;
  delivery.deliveryOtpAttemptsRemaining = DELIVERY_OTP_MAX_ATTEMPTS;
  delete delivery.deliveryOtpVerifiedAt;
  return { code, expiresAt };
}

export function checkDeliveryOtp(delivery: DeliveryOtpRecord, code: string, now = new Date()) {
  if (!/^\d{6}$/.test(String(code || ''))) {
    return { valid: false, message: 'Enter the six-digit delivery OTP.' };
  }
  if (!delivery.deliveryOtpHash) {
    return { valid: false, message: 'A delivery OTP has not been issued. Ask the business client to generate one.' };
  }
  if (!delivery.deliveryOtpExpiresAt || new Date(delivery.deliveryOtpExpiresAt).getTime() <= now.getTime()) {
    return { valid: false, message: 'The delivery OTP has expired. Ask the business client to generate a new one.' };
  }
  const attempts = Number(delivery.deliveryOtpAttemptsRemaining || 0);
  if (attempts <= 0) {
    return { valid: false, message: 'The delivery OTP is locked after too many attempts. Ask the business client to generate a new one.' };
  }

  const expected = Buffer.from(delivery.deliveryOtpHash, 'hex');
  const supplied = hashOtp(delivery.id, code);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    delivery.deliveryOtpAttemptsRemaining = attempts - 1;
    return {
      valid: false,
      message: delivery.deliveryOtpAttemptsRemaining > 0
        ? `Incorrect delivery OTP. ${delivery.deliveryOtpAttemptsRemaining} attempt(s) remaining.`
        : 'The delivery OTP is locked after too many attempts. Ask the business client to generate a new one.',
    };
  }
  return { valid: true, message: 'Delivery OTP verified.' };
}

export function markDeliveryOtpUsed(delivery: DeliveryOtpRecord, now = new Date()) {
  delivery.deliveryOtpVerifiedAt = now.toISOString();
  delete delivery.deliveryOtpHash;
  delete delivery.deliveryOtpAttemptsRemaining;
}

export function deliveryOtpForResponse(delivery: DeliveryOtpRecord) {
  return {
    issued: Boolean(delivery.deliveryOtpHash),
    issuedAt: delivery.deliveryOtpIssuedAt,
    expiresAt: delivery.deliveryOtpExpiresAt,
    verifiedAt: delivery.deliveryOtpVerifiedAt,
  };
}
