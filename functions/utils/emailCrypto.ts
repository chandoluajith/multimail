/**
 * AES-256-GCM email encryption for D1 storage.
 *
 * Why encryption instead of hashing?
 *   - A one-way hash (SHA-256) would make email addresses unreadable in the UI.
 *   - AES-256-GCM encrypts data so it can be decrypted for display,
 *     but the database contains only opaque ciphertext — no plaintext email
 *     is ever written to D1.
 *
 * Key derivation:
 *   - The raw secret (JWT_SECRET env var) is fed through HKDF-SHA-256 to
 *     produce a proper 256-bit AES key. This keeps the JWT secret and the
 *     encryption key cryptographically separate even though they share the
 *     same source material.
 *
 * Storage format: base64url( 12-byte IV ‖ 16-byte GCM tag ‖ ciphertext )
 */

const HKDF_INFO = new TextEncoder().encode('mailstracker-email-encryption-v1');
const HKDF_SALT = new TextEncoder().encode('mailstracker-salt-2025');

async function deriveKey(secret: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(secret);
  const baseKey = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: HKDF_INFO },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Converts an ArrayBuffer to a URL-safe base64 string. */
function bufToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Converts a URL-safe base64 string back to a Uint8Array. */
function b64ToBuf(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

/**
 * Encrypts a plaintext email address.
 * Returns a base64url string safe for storage in a TEXT column.
 */
export async function encryptEmail(email: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const plaintext = new TextEncoder().encode(email.toLowerCase().trim());

  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  // Pack: iv (12) + ciphertext+tag (n+16)
  const packed = new Uint8Array(12 + ciphertext.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ciphertext), 12);
  return bufToB64(packed.buffer);
}

/**
 * Decrypts a stored email cipher blob back to the original address.
 * Returns null if the blob is invalid or the key doesn't match.
 */
export async function decryptEmail(blob: string, secret: string): Promise<string | null> {
  try {
    const key = await deriveKey(secret);
    const packed = b64ToBuf(blob);
    const iv = packed.slice(0, 12);
    const data = packed.slice(12);

    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(plain);
  } catch {
    // Wrong key, corrupted data, or plaintext row from before encryption was added
    // → fall through and return the raw value so old rows still display
    return null;
  }
}

/**
 * Safe decrypt: if decryption fails (e.g. legacy plain-text row),
 * returns the original value as-is so existing data isn't lost.
 */
export async function safeDecryptEmail(value: string, secret: string): Promise<string> {
  if (!value) return value;
  const result = await decryptEmail(value, secret);
  return result ?? value; // fallback to raw value for legacy/plain rows
}
