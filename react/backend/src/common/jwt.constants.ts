export const JWT_SECRET = process.env.JWT_SECRET || 'deliversync-dev-secret-change-in-production';
export const JWT_EXPIRES_IN = '12h';

export function decodeBearerToken(authHeader: string | undefined): { userId?: string; role?: string } {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {};
  }

  try {
    const token = authHeader.slice(7);
    const payloadSegment = token.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf-8'));
    return { userId: payload.sub, role: payload.role };
  } catch {
    return {};
  }
}
