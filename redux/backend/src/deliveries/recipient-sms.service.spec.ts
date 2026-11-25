import {RecipientSmsService} from './recipient-sms.service';

describe('recipient SMS', () => {
  const service = new RecipientSmsService();
  const phone = '+12025550123';
  const env = process.env;
  const original = global.fetch;
  const net = jest.fn();
  beforeEach(() => {
    process.env = {...env, TWILIO_ACCOUNT_SID:'AC-test', TWILIO_AUTH_TOKEN:'test', TWILIO_VERIFY_SERVICE_SID:'VA-test', TWILIO_FROM:'+12025550111'};
    global.fetch = net.mockReset();
  });
  afterEach(() => {process.env = env; global.fetch = original;});
  it('binds an approved number to its booking client and sends the handoff to that number', async () => {
    const response = (body: object) => ({ok:true,json:async () => body});
    net.mockResolvedValueOnce(response({sid:'VE-test'})).mockResolvedValueOnce(response({to:phone,status:'approved'})).mockResolvedValueOnce(response({sid:'SM-test'}));
    const {challenge} = await service.start(phone, 'client');
    await expect(service.confirm(challenge,'123456','other')).rejects.toThrow('verification');
    const {verification} = await service.confirm(challenge,'123456','client');
    expect(() => service.assertVerified(verification,phone,'client')).not.toThrow();
    expect(() => service.assertVerified(verification,phone,'other')).toThrow('Verify');
    await service.sendDeliveryCode(phone,'parcel','123456');
    expect(net.mock.calls[1][0]).toContain('/VerificationCheck');
    expect(net.mock.calls[2][0]).toContain('/Messages.json');
    expect(net.mock.calls[2][1].body.get('To')).toBe(phone);
  });
  it('rejects malformed phones and withholds verification during an outage', async () => {
    await expect(service.start('123','client')).rejects.toThrow('international');
    expect(net).not.toHaveBeenCalled();
    net.mockRejectedValue(new Error('provider detail'));
    await expect(service.start(phone,'client')).rejects.toThrow('SMS provider unavailable');
  });
});
