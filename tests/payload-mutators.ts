/**
 * Test-only helper for tampering with base64-encoded encrypted payloads.
 *
 * Corrupts a single byte of the decoded payload at the given offset and
 * re-encodes it to base64. This lets tests verify that AES-256-GCM auth-tag
 * verification catches both ciphertext and auth-tag corruption.
 */

import type { EncryptedValue } from '@cobranza-apps/entities';

/**
 * Flip (XOR with 0x01) a single byte at `byteOffset` within the decoded
 * `encrypted.encryptedData` payload, then re-encode it to base64.
 *
 * @param encrypted - Original encrypted value to tamper with.
 * @param byteOffset - Byte offset within the decoded payload (0-based).
 * @returns A new {@link EncryptedValue} with corrupted `encryptedData`.
 */
export function mutateBase64Byte(
  encrypted: EncryptedValue,
  byteOffset: number,
): EncryptedValue {
  const payload = Buffer.from(encrypted.encryptedData, 'base64');
  const offset = byteOffset < 0
    ? payload.length + byteOffset
    : Math.min(byteOffset, payload.length - 1);

  payload[offset] = (payload[offset] ?? 0) ^ 0x01;
  return { ...encrypted, encryptedData: payload.toString('base64') };
}
