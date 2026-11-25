import type { DeliveryRequest } from '../data-store/data-store.service';
import { deliveryOtpForResponse } from './delivery-otp';

export function deliveryForResponse(delivery: DeliveryRequest): DeliveryRequest {
  if (!('parcelBarcode' in delivery || 'deliveryOtpHash' in delivery || 'deliveryOtpAttemptsRemaining' in delivery || 'otpSendTimes' in delivery ||
      'bookingFingerprint' in delivery || 'bookingKey' in delivery || delivery.deliveryOtpVerifiedAt || delivery.deliveryOtpIssuedAt)) return delivery;
  const { deliveryOtpHash, deliveryOtpAttemptsRemaining, otpSendTimes, bookingFingerprint, bookingKey, parcelBarcode, ...safe } = delivery;
  if (parcelBarcode) safe.requiresParcelScan = true;
  if (deliveryOtpHash || delivery.deliveryOtpIssuedAt || delivery.deliveryOtpVerifiedAt) {
    return { ...safe, deliveryOtp: deliveryOtpForResponse(delivery) };
  }
  return safe;
}
