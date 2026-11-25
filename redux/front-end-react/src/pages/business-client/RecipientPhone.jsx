import { useState } from 'react';
import { useStartPhoneVerificationMutation, useConfirmPhoneVerificationMutation } from '../../redux/businessClientApi';

export default function RecipientPhone({ phone, onPhone, onVerified, verified }) {
  const [start, sending] = useStartPhoneVerificationMutation();
  const [confirm, checking] = useConfirmPhoneVerificationMutation();
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const busy = sending.isLoading || checking.isLoading;
  async function send() {
    try {
      const result = await start(phone).unwrap();
      setChallenge(result.challenge);
      setCode('');
      setMessage('Ask the recipient for the booking verification code.');
    } catch (error) { setMessage(error.message); }
  }
  async function check() {
    try {
      const result = await confirm({ challenge, code }).unwrap();
      onVerified(result.verification);
      setMessage('Recipient phone verified.');
    } catch (error) { setMessage(error.message); }
  }
  return <div>
    <label htmlFor="recipient-phone">Recipient mobile (with country code)</label>
    <input className="input" type="tel" id="recipient-phone" placeholder="+91…" value={phone} disabled={busy} onChange={(event) => {
      onPhone(event.target.value.trim()); onVerified(''); setChallenge(''); setMessage('');
    }} required />
    <button type="button" className="btn" disabled={busy || !/^\+[1-9]\d{7,14}$/.test(phone)} onClick={send}>
      {verified ? 'Verify again' : 'Send verification SMS'}
    </button>
    {challenge && !verified && <><label>Booking verification code<input className="input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} /></label>
      <button type="button" className="btn" disabled={busy || !code} onClick={check}>Verify phone</button></>}
    {message && <p role="status">{message}</p>}
  </div>;
}
