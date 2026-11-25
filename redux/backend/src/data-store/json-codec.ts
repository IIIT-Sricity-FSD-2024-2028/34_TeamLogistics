import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export function storageKey() {
  const hex = process.env.DATA_ENCRYPTION_KEY;
  if (!hex && process.env.NODE_ENV !== 'production') return null;
  if (!hex || !/^[a-f0-9]{64}$/i.test(hex)) throw new Error('DATA_ENCRYPTION_KEY must be a 32-byte hex key');
  return Buffer.from(hex, 'hex');
}

export function encodeJson(value: unknown, filename: string): string {
  const key = storageKey();
  const json = JSON.stringify(value, null, 2);
  if (!key) return json;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(filename));
  const bytes = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  return JSON.stringify({ format: 'aes-256-gcm-v1', iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'), data: bytes.toString('base64') });
}

export function decodeJson<T>(json: string, filename: string): T {
  const data = JSON.parse(json);
  if (data?.format !== 'aes-256-gcm-v1') return data;
  const key = storageKey();
  if (!key) throw new Error('A storage key is required to open encrypted JSON');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(data.iv, 'hex'));
  decipher.setAAD(Buffer.from(filename));
  decipher.setAuthTag(Buffer.from(data.tag, 'hex'));
  const plain = Buffer.concat([decipher.update(Buffer.from(data.data, 'base64')), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}
