import crypto from 'crypto';

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';

export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }
  return email.trim().toLowerCase();
}

/**
 * Hashes a plaintext password using PBKDF2 with a unique 16-byte random salt.
 * Output format: pbkdf2$iterations$saltHex$derivedKeyHex
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEYLEN,
    PBKDF2_DIGEST
  ).toString('hex');

  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${derivedKey}`;
}

/**
 * Verifies a password against the stored PBKDF2 hash using constant-time comparison.
 */
export function verifyPassword(password: string, combinedHash: string): boolean {
  try {
    const parts = combinedHash.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
      return false;
    }

    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const storedHash = parts[3];

    const derivedKey = crypto.pbkdf2Sync(
      password,
      salt,
      iterations,
      PBKDF2_KEYLEN,
      PBKDF2_DIGEST
    ).toString('hex');

    const storedBuffer = Buffer.from(storedHash, 'hex');
    const derivedBuffer = Buffer.from(derivedKey, 'hex');

    if (storedBuffer.length !== derivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(storedBuffer, derivedBuffer);
  } catch {
    return false;
  }
}

/**
 * Generates a cryptographically random token string.
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Computes a SHA-256 hash of a token for server-side persistence.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
