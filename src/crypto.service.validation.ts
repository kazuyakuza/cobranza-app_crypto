/**
 * Validation and config resolution helpers for SecureCrypto.
 *
 * Contains:
 * - {@link ResolvedConfig} resolved configuration shape (exported)
 * - {@link validateMasterKey} master-key validation
 * - {@link validateHashSalt} hash-salt validation
 * - {@link resolveConfig} full config resolution + validation (exported)
 *
 * Extracted from `crypto.service.ts` to stay under the 200-line source file limit.
 */

import type { CryptoConfig } from './config.js';
import type { EncryptionKey } from './config.js';

const MASTER_KEY_LENGTH_BYTES = 32;
const DEFAULT_VERSION = 1;

/** Result of resolving a {@link CryptoConfig} into validated internal state. */
export interface ResolvedConfig {
  /** Base64-encoded 32-byte master key (length-validated). */
  readonly masterKey: string;
  /** Base64-encoded hashing salt (presence-validated). */
  readonly hashSalt: string;
  /** Effective key version (config value or {@link DEFAULT_VERSION}). */
  readonly currentVersion: number;
  /** Default key category (may be undefined). */
  readonly defaultKeyName: EncryptionKey | undefined;
}

/**
 * Validate the master key: non-empty base64 that decodes to exactly 32 bytes.
 *
 * @param masterKey - Raw base64 master key from {@link CryptoConfig}.
 * @throws {Error} when empty or when decoded length is not 32 bytes.
 */
function validateMasterKey(masterKey: string): void {
  if (!masterKey) {
    throw new Error('Invalid masterKey: expected a non-empty base64 string.');
  }
  const decoded = Buffer.from(masterKey, 'base64');
  if (decoded.length !== MASTER_KEY_LENGTH_BYTES) {
    throw new Error(
      `Invalid masterKey: expected ${MASTER_KEY_LENGTH_BYTES} bytes after base64 decode, ` +
        `got ${decoded.length} bytes.`,
    );
  }
}

/**
 * Validate the hash salt: non-empty base64 string. Length enforcement is deferred
 * to Phase 2 (when HMAC consumes it).
 *
 * @param hashSalt - Raw base64 hash salt from {@link CryptoConfig}.
 * @throws {Error} when empty.
 */
function validateHashSalt(hashSalt: string): void {
  if (!hashSalt) {
    throw new Error('Invalid hashSalt: expected a non-empty base64 string.');
  }
}

/**
 * Resolve and validate a {@link CryptoConfig} into internal {@link ResolvedConfig}.
 *
 * @param config - Raw caller-provided configuration.
 * @returns Validated resolved configuration.
 * @throws {Error} when config is null/undefined or validation fails.
 */
export function resolveConfig(config: CryptoConfig): ResolvedConfig {
  if (!config) {
    throw new Error('Invalid config: expected a CryptoConfig object.');
  }
  validateMasterKey(config.masterKey);
  validateHashSalt(config.hashSalt);
  return {
    masterKey: config.masterKey,
    hashSalt: config.hashSalt,
    currentVersion: config.currentVersion ?? DEFAULT_VERSION,
    defaultKeyName: config.defaultKeyName,
  };
}
