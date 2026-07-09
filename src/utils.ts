/**
 * Helper utilities for `@cobranza-apps/crypto`.
 *
 * Shared low-level helpers used across the library: base64 (de)serialization, random IV generation,
 * buffer concatenation, and constant-time comparison wrappers for hash verification.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';

/** AES-256-GCM initialization vector length (12 bytes, NIST SP 800-38D). */
export const IV_LENGTH_BYTES = 12;

/** AES-256-GCM authentication tag length (16 bytes). */
export const AUTH_TAG_LENGTH_BYTES = 16;

/**
 * Decode a base64 string into a `Buffer`.
 *
 * Note: `Buffer.from(value, 'base64')` silently ignores invalid base64 characters.
 * This helper only guards against empty input.
 *
 * @param value - Non-empty base64-encoded string.
 * @returns Decoded buffer.
 * @throws {Error} when `value` is an empty string.
 */
export function base64ToBuffer(value: string): Buffer {
  if (!value) {
    throw new Error('Invalid base64 input: expected a non-empty string.');
  }
  return Buffer.from(value, 'base64');
}

/**
 * Encode a `Buffer` as a base64 string.
 *
 * @param buffer - Buffer to encode.
 * @returns Base64-encoded string representation.
 */
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

/**
 * Generate a cryptographically strong random IV (default 12 bytes for AES-256-GCM).
 *
 * @param byteLength - Length of the IV in bytes (defaults to 12 for AES-256-GCM).
 * @returns Random buffer of the requested length.
 */
export function generateIv(byteLength: number = IV_LENGTH_BYTES): Buffer {
  return randomBytes(byteLength);
}

/**
 * Concatenate multiple buffers into a single buffer (used for `IV + ciphertext + authTag`).
 *
 * @param buffers - Buffers to concatenate.
 * @returns A single buffer containing all input bytes in order.
 */
export function concatBuffers(...buffers: Buffer[]): Buffer {
  return Buffer.concat(buffers);
}

/**
 * Constant-time comparison of two base64 strings.
 *
 * Returns `false` for differing lengths without invoking `crypto.timingSafeEqual` (which would
 * throw on length mismatch). Safe for hash verification (`verifyHash`) per brief §3.2.
 *
 * @param a - First base64 string.
 * @param b - Second base64 string.
 * @returns `true` if both strings are identical, `false` otherwise.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');
  return timingSafeEqual(aBuffer, bBuffer);
}
