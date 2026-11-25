import {
  checkDeliveryOtp,
  deliveryOtpForResponse,
  DELIVERY_OTP_MAX_ATTEMPTS,
  issueDeliveryOtp,
  markDeliveryOtpUsed,
} from './delivery-otp';

describe('delivery OTP', () => {
  const issuedAt = new Date('2026-11-23T10:00:00.000Z');

  it('issues a six-digit code but stores only its hash', () => {
    const delivery: any = { id: 'DR-1' };
    const result = issueDeliveryOtp(delivery, issuedAt);

    expect(result.code).toMatch(/^\d{6}$/);
    expect(delivery.deliveryOtpHash).toMatch(/^[a-f0-9]{64}$/);
    expect(delivery.deliveryOtpAttemptsRemaining).toBe(DELIVERY_OTP_MAX_ATTEMPTS);
    expect(deliveryOtpForResponse(delivery)).toEqual({
      issued: true,
      issuedAt: issuedAt.toISOString(),
      expiresAt: result.expiresAt,
      verifiedAt: undefined,
    });
    expect(checkDeliveryOtp(delivery, result.code, issuedAt)).toEqual({
      valid: true,
      message: 'Delivery OTP verified.',
    });
  });

  it('decrements failed attempts and locks the OTP', () => {
    const delivery: any = { id: 'DR-2' };
    const { code } = issueDeliveryOtp(delivery, issuedAt);
    const wrongCode = code === '000000' ? '111111' : '000000';

    for (let attempt = 1; attempt <= DELIVERY_OTP_MAX_ATTEMPTS; attempt += 1) {
      expect(checkDeliveryOtp(delivery, wrongCode, issuedAt).valid).toBe(false);
    }

    expect(delivery.deliveryOtpAttemptsRemaining).toBe(0);
    expect(checkDeliveryOtp(delivery, code, issuedAt)).toEqual({
      valid: false,
      message: 'The delivery OTP is locked after too many attempts. Ask the business client to generate a new one.',
    });
  });

  it('rejects expired codes and removes the secret after completion', () => {
    const delivery: any = { id: 'DR-3' };
    const { code, expiresAt } = issueDeliveryOtp(delivery, issuedAt);
    const expiredAt = new Date(new Date(expiresAt).getTime() + 1);

    expect(checkDeliveryOtp(delivery, code, expiredAt).message).toContain('expired');

    const completedAt = new Date('2026-11-23T11:00:00.000Z');
    markDeliveryOtpUsed(delivery, completedAt);
    expect(delivery.deliveryOtpHash).toBeUndefined();
    expect(delivery.deliveryOtpAttemptsRemaining).toBeUndefined();
    expect(deliveryOtpForResponse(delivery).verifiedAt).toBe(completedAt.toISOString());
  });
});
