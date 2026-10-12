import crypto from 'crypto';
import { config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AccessTokenPayload } from '../types/index.js';

const ACCESS_TOKEN_TTL_SECONDS = 900; // 15 minutes

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString('utf-8');
}

export function createAccessToken(
  payload: Omit<AccessTokenPayload, 'iat' | 'exp'>,
  ttlSeconds = ACCESS_TOKEN_TTL_SECONDS
): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload: AccessTokenPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  if (!token || typeof token !== 'string') {
    throw new AppError(401, 'INVALID_TOKEN', 'No authentication token provided');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AppError(401, 'INVALID_TOKEN', 'Malformed authentication token');
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedSigBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
  ) {
    throw new AppError(401, 'INVALID_TOKEN_SIGNATURE', 'Token signature verification failed');
  }

  let payload: AccessTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Failed to decode token payload');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new AppError(401, 'TOKEN_EXPIRED', 'Authentication token has expired');
  }

  return payload;
}
