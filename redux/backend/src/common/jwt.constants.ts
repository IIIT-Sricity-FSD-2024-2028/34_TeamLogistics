import { randomBytes } from 'crypto';

const configuredSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' &&
    (!configuredSecret || Buffer.byteLength(configuredSecret.trim()) < 32 ||
     configuredSecret === 'deliversync-dev-secret-change-in-production')) {
  throw new Error('Configure a unique JWT_SECRET of at least 32 bytes for production');
}
export const JWT_SECRET = configuredSecret || randomBytes(32).toString('hex');
export const JWT_EXPIRES_IN = '12h';
