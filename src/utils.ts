/**
 * Helper utilities for `@cobranza-apps/crypto`.
 *
 * Shared low-level helpers used across the library: base64 (de)serialization, random IV generation,
 * buffer concatenation, and constant-time comparison wrappers for hash verification.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';

const IV_LENGTH_BYTES = 12;

/**
 * Decode a base64 string into a `Buffer`.
 *
 * @throws {Error} when `value` is empty or not valid base64.
 */
export function base64ToBuffer(value: string): Buffer {
  if (!value) {
    throw new Error('Invalid base64 input: expected a non-empty string.');
  }
  return Buffer.from(value, 'base64');
}

/**
 * Encode a `Buffer` as a base64 string.
 */
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

/**
 * Generate a cryptographically strong random IV (default 12 bytes for AES-256-GCM).
 */
export function generateIv(byteLength: number = IV_LENGTH_BYTES): Buffer {
  return randomBytes(byteLength);
}

/**
 * Concatenate multiple buffers into a single buffer (used for `IV + ciphertext + authTag`).
 */
export function concatBuffers(...buffers: Buffer[]): Buffer {
  return Buffer.concat(buffers);
}

/**
 * Constant-time comparison of two base64 strings.
 *
 * Returns `false` for differing lengths without invoking `crypto.timingSafeEqual` (which would
 * throw on length mismatch). Safe for hash verification (`verifyHash`) per brief §3.2.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');
  return timingSafeEqual(aBuffer, bBuffer);
}
