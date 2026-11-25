export function requiresEmailVerification() {
  return process.env.NODE_ENV === 'production' || process.env.VERIFY_LOGIN_EMAIL === 'true';
}
