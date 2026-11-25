import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JWT_SECRET } from '../common/jwt.constants';

const jwt = new JwtService({secret: JWT_SECRET});
const phoneFormat = /^\+[1-9]\d{7,14}$/;

@Injectable()
export class RecipientSmsService {
  private async post(url: string, fields: Record<string, string>) {
    const { TWILIO_ACCOUNT_SID: account, TWILIO_AUTH_TOKEN: token } = process.env;
    if (!account || !token) throw new ServiceUnavailableException('Dispatch has not configured SMS');
    try {
      const response = await fetch(url, {method: 'POST', signal: AbortSignal.timeout(10000),
        headers: {Authorization: 'Basic ' + Buffer.from(account + ':' + token).toString('base64')},
        body: new URLSearchParams(fields)});
      if (response.ok) return await response.json();
      if ([400, 404, 429].includes(response.status)) throw new BadRequestException('SMS request expired, invalid or rate limited');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
    }
    throw new ServiceUnavailableException('SMS provider unavailable');
  }

  private verifyUrl(resource: string) {
    const service = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!service) throw new ServiceUnavailableException('Dispatch has not configured phone verification');
    return 'https://verify.twilio.com/v2/Services/' + encodeURIComponent(service) + '/' + resource;
  }

  async start(phone: string, actor: string) {
    if (typeof phone !== 'string' || !phoneFormat.test(phone)) throw new BadRequestException('Use an international phone number including + and country code');
    const result = await this.post(this.verifyUrl('Verifications'), {To: phone, Channel: 'sms'});
    if (typeof result.sid !== 'string' || !result.sid) throw new ServiceUnavailableException('SMS provider did not confirm a verification request');
    const challenge = jwt.sign({phone, actor, sid: result.sid}, {audience: 'phone-challenge', expiresIn: '10m'});
    return {challenge};
  }

  async confirm(challenge: string, code: string, actor: string) {
    let claim;
    try { claim = jwt.verify(challenge, {audience: 'phone-challenge'}); }
    catch { throw new BadRequestException('Request a new phone verification code'); }
    if (claim.actor !== actor || !/^\d{4,10}$/.test(code)) throw new BadRequestException('Invalid phone verification');
    const result = await this.post(this.verifyUrl('VerificationCheck'), {VerificationSid: claim.sid, Code: code});
    if (result.status !== 'approved' || result.to !== claim.phone) throw new BadRequestException('Incorrect verification code');
    return {verification: jwt.sign({phone: claim.phone, actor}, {audience: 'booking-recipient', expiresIn: '30m'})};
  }

  assertVerified(verification: string, phone: string, actor: string) {
    try {
      const claim = jwt.verify(verification, {audience: 'booking-recipient'});
      if (claim.actor === actor && claim.phone === phone && phoneFormat.test(phone)) return;
    } catch {}
    throw new BadRequestException('Verify the recipient phone before booking');
  }

  async sendDeliveryCode(phone: string, id: string, code: string) {
    const sender = process.env.TWILIO_FROM;
    if (!sender) throw new ServiceUnavailableException('Dispatch has not configured the SMS sender');
    const account = encodeURIComponent(process.env.TWILIO_ACCOUNT_SID || '');
    await this.post('https://api.twilio.com/2010-04-01/Accounts/' + account + '/Messages.json', {
      From: sender, To: phone, Body: 'Delivery ' + id + ': share ' + code + ' with the driver after receiving your parcel. Expires in 10 minutes.',
    });
  }
}
