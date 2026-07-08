/**
 * AES-256-GCM encryption / decryption primitives for {@link module:crypto.service}.
 *
 * Encapsulates the cipher operations and the `IV(12) + ciphertext + authTag(16)`
 * payload packing/unpacking (brief §3.1) so the orchestrator stays under the
 * 200-line source file limit.
 *
 * @remarks Uses Node.js built-in `crypto` only. All errors fail closed with
 * non-sensitive messages.
 * @module crypto.service.encryption
 */

import { createCipheriv, createDecipheriv } from 'node:crypto';
import type { EncryptedValue } from '@cobranza-apps/entities';

import { base64ToBuffer, bufferToBase64, concatBuffers, generateIv } from './utils.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const MIN_PAYLOAD_BYTES = IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES;

/** Inputs required to encrypt a plaintext under a derived AES-256 key. */
export interface EncryptParams {
  readonly plaintext: string;
  readonly key: Buffer;
  readonly keyName: string;
  readonly version: number;
}

/** Inputs required to decrypt a base64 payload with a derived AES-256 key. */
export interface DecryptParams {
  readonly encryptedData: string;
  readonly key: Buffer;
}

/** Sliced components of an `IV + ciphertext + authTag` payload buffer. */
interface EncryptedPayloadParts {
  readonly initializationVector: Buffer;
  readonly ciphertext: Buffer;
  readonly authTag: Buffer;
}

/**
 * Encrypt `plaintext` with AES-256-GCM under the provided derived key.
 *
 * @param params - Plaintext, 32-byte key, key name, and version to embed.
 * @returns {@link EncryptedValue} whose `encryptedData` is base64
 *   `IV(12) + ciphertext + authTag(16)`.
 */
export function encryptWithAesGcm(params: EncryptParams): EncryptedValue {
  const { plaintext, key, keyName, version } = params;
  const initializationVector = generateIv(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, initializationVector);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const encryptedData = bufferToBase64(
    concatBuffers(initializationVector, ciphertext, authTag),
  );
  return { encryptedData, keyName, algorithm: ALGORITHM, version };
}

/**
 * Split a decoded payload buffer into its IV, ciphertext, and authTag slices.
 *
 * @param payload - Decoded `IV(12) + ciphertext + authTag(16)` buffer.
 * @returns The three payload components (buffer views, zero-copy).
 * @throws {Error} when the payload is shorter than `IV + authTag` (28 bytes).
 */
function splitEncryptedPayload(payload: Buffer): EncryptedPayloadParts {
  if (payload.length < MIN_PAYLOAD_BYTES) {
    throw new Error(
      `Invalid encryptedData: expected at least ${MIN_PAYLOAD_BYTES} bytes, ` +
        `got ${payload.length}.`,
    );
  }
  const initializationVector = payload.subarray(0, IV_LENGTH_BYTES);
  const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH_BYTES);
  const ciphertext = payload.subarray(IV_LENGTH_BYTES, payload.length - AUTH_TAG_LENGTH_BYTES);
  return { initializationVector, ciphertext, authTag };
}

/**
 * Decrypt a base64 `IV(12) + ciphertext + authTag(16)` payload with AES-256-GCM.
 *
 * @param params - Base64 `encryptedData` and the 32-byte derived key.
 * @returns Recovered plaintext (UTF-8).
 * @throws {Error} when the authentication tag is invalid or data is corrupted.
 */
export function decryptWithAesGcm(params: DecryptParams): string {
  const { encryptedData, key } = params;
  const payload = base64ToBuffer(encryptedData);
  const { initializationVector, ciphertext, authTag } = splitEncryptedPayload(payload);
  const decipher = createDecipheriv(ALGORITHM, key, initializationVector);
  decipher.setAuthTag(authTag);
  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  } catch {
    throw new Error('Decryption failed: invalid authentication tag or corrupted ciphertext.');
  }
}
