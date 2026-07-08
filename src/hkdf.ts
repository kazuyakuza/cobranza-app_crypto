/**
 * Internal HKDF-SHA256 key derivation.
 *
 * Derives per-category 32-byte AES-256 keys from a single base64-encoded 32-byte master key
 * using Node.js `crypto.hkdfSync` (brief §3.1).
 *
 * HKDF parameters:
 * - `digest`: "sha256"
 * - `salt`: empty buffer (no fixed salt by default)
 * - `info`: "cobranza-encryption-v1:${keyName}" (+ ":vN" when `version` is provided)
 * - `keyLength`: 32 bytes
 */

import { hkdfSync } from 'node:crypto';

import type { DeriveKeyParams } from './hkdf.types.js';

const HKDF_DIGEST = 'sha256';
const HKDF_INFO_PREFIX = 'cobranza-encryption-v1';
const DERIVED_KEY_LENGTH_BYTES = 32;
const MASTER_KEY_LENGTH_BYTES = 32;
const EMPTY_SALT = Buffer.alloc(0);

/**
 * Build the HKDF `info` buffer for a given key name and optional version.
 */
function buildHkdfInfo(keyName: string, version?: number): Buffer {
  const versionSuffix = version === undefined ? '' : `:v${version}`;
  const info = `${HKDF_INFO_PREFIX}:${keyName}${versionSuffix}`;
  return Buffer.from(info, 'utf8');
}

/**
 * Decode a base64 master key and assert it is exactly 32 bytes.
 */
function decodeMasterKey(masterKeyBase64: string): Buffer {
  const masterKeyBuffer = Buffer.from(masterKeyBase64, 'base64');
  if (masterKeyBuffer.length !== MASTER_KEY_LENGTH_BYTES) {
    throw new Error(
      `Invalid masterKey: expected ${MASTER_KEY_LENGTH_BYTES} bytes after base64 decode, ` +
        `got ${masterKeyBuffer.length} bytes.`,
    );
  }
  return masterKeyBuffer;
}

/**
 * Derive a 32-byte per-category AES-256 key from the master key via HKDF-SHA256.
 *
 * @example
 * const key = deriveKey({
 *   masterKey: 'base64...',
 *   keyName: EncryptionKey.PII,
 *   version: 1,
 * });
 * // key.length === 32
 *
 * @throws {Error} when `masterKey` does not decode to exactly 32 bytes.
 * @throws {Error} when `keyName` is empty.
 */
export function deriveKey(params: DeriveKeyParams): Buffer {
  const { masterKey, keyName, version } = params;
  if (!keyName) {
    throw new Error('Invalid keyName: must be a non-empty string.');
  }
  const inputKeyMaterial = decodeMasterKey(masterKey);
  const info = buildHkdfInfo(keyName, version);
  const derived = hkdfSync(
    HKDF_DIGEST,
    inputKeyMaterial,
    EMPTY_SALT,
    info,
    DERIVED_KEY_LENGTH_BYTES,
  );
  return Buffer.from(derived);
}
