/**
 * Validation and config resolution helpers for {@link module:crypto.service}.
 *
 * ## Exports
 *
 * - {@link ResolvedConfig} — resolved configuration shape (exported type)
 * - {@link resolveConfig} — full config resolution + validation (exported function)
 *
 * ## Internal helpers (not exported)
 *
 * - {@link validateMasterKey} — master-key presence and length validation
 * - {@link validateHashSalt} — hash-salt presence validation
 *
 * @remarks
 * Extracted from `crypto.service.ts` to stay under the 200-line source file limit.
 * This module is consumed exclusively by the {@link SecureCrypto} constructor.
 *
 * @see {@link module:crypto.service} for the SecureCrypto class
 * @module crypto.service.validation
 */

import type { CryptoConfig } from './config.js';
import type { EncryptionKey } from './config.js';

/** Expected decoded length of the base64 master key (AES-256 = 32 bytes). */
const MASTER_KEY_LENGTH_BYTES = 32;

/** Fallback key version when `config.currentVersion` is not provided. */
const DEFAULT_VERSION = 1;

/** Result of resolving a {@link CryptoConfig} into validated internal state. */
export interface ResolvedConfig {
  /** Base64-encoded 32-byte master key (length-validated). */
  readonly masterKey: string;
  /** Base64-encoded hashing salt (presence-validated). */
  readonly hashSalt: string;
  /** Effective key version (config value or {@link DEFAULT_VERSION}). */
  readonly currentVersion: number;
  /** Default key category for encrypt/hash operations that omit an explicit key name. */
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
 * Called by the {@link SecureCrypto} constructor to ensure all config values are
 * present and correctly shaped before any crypto operation is attempted.
 *
 * @param config - Raw caller-provided configuration (typically from `process.env`).
 * @returns Validated resolved configuration with defaults applied.
 * @throws {Error} when `config` is null/undefined.
 * @throws {Error} when `masterKey` is empty or does not decode to exactly 32 bytes.
 * @throws {Error} when `hashSalt` is empty.
 *
 * @example
 * ```ts
 * const resolved = resolveConfig({
 *   masterKey: process.env.MASTER_KEY!,
 *   hashSalt: process.env.HASH_SALT!,
 *   currentVersion: 2,
 * });
 * // resolved.currentVersion === 2
 * // resolved.defaultKeyName === undefined (not provided)
 * ```
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
