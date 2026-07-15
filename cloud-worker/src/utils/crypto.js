/**
 * crypto.js
 * Utility for signing and verifying time-limited login tokens.
 * Uses HMAC-SHA256 — no external deps beyond Node built-ins.
 */

import { createHmac, timingSafeEqual } from 'crypto';

const SECRET = process.env.LOGIN_URL_SECRET;
const TTL    = parseInt(process.env.LOGIN_URL_TTL_SECONDS || '600', 10);

if (!SECRET || SECRET.length < 16) {
  throw new Error('[crypto] LOGIN_URL_SECRET must be set and at least 16 characters');
}

/**
 * Creates a signed, time-limited token for a userId + platform.
 * @returns {string} base64url-encoded payload.signature
 */
export function createLoginToken(userId, platform) {
  const expiresAt = Date.now() + TTL * 1000;
  const payload   = Buffer.from(JSON.stringify({ userId, platform, expiresAt })).toString('base64url');
  const sig       = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Verifies a login token.
 * @returns {{ userId: string, platform: string }} or throws on invalid/expired
 */
export function verifyLoginToken(token) {
  const parts = (token || '').split('.');
  if (parts.length !== 2) throw new Error('Malformed token');

  const [payload, sig] = parts;
  const expectedSig = createHmac('sha256', SECRET).update(payload).digest('base64url');

  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    throw new Error('Invalid token signature');
  }

  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

  if (Date.now() > data.expiresAt) {
    throw new Error('Login token expired');
  }

  return { userId: data.userId, platform: data.platform };
}
