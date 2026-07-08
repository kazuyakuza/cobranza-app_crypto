/**
 * SecureCrypto implementation (Phase 1 skeleton).
 *
 * Core class providing (logic deferred to Phase 2):
 * - AES-256-GCM authenticated encryption / decryption
 * - HMAC-SHA256 deterministic hashing / verification
 * - Combined encryptAndHash operation for PII fields
 *
 * Phase 1 scope: constructor config validation, derived-key cache storage,
 * and method stubs with full signatures + JSDoc. All crypto methods throw
 * `Error('Not implemented in Phase 1')`. `hasKey` and `getAvailableKeys`
 * are minimally implemented (no crypto).
 *
 * Uses Node.js built-in `crypto` module only. No external runtime dependencies.
 */

import type { EncryptedValue } from '@cobranza-apps/entities';

import type { CryptoConfig } from './config.js';
import { EncryptionKey } from './config.js';

const DEFAULT_VERSION = 1;
const MASTER_KEY_LENGTH_BYTES = 32;
const PHASE_1_NOT_IMPLEMENTED = 'Not implemented in Phase 1';

/** Result of resolving a {@link CryptoConfig} into validated internal state. */
interface ResolvedConfig {
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
 * @throws {Error} when validation fails.
 */
function resolveConfig(config: CryptoConfig): ResolvedConfig {
  validateMasterKey(config.masterKey);
  validateHashSalt(config.hashSalt);
  return {
    masterKey: config.masterKey,
    hashSalt: config.hashSalt,
    currentVersion: config.currentVersion ?? DEFAULT_VERSION,
    defaultKeyName: config.defaultKeyName,
  };
}

/**
 * Core encryption + hashing service for the Cobranza App platform.
 *
 * Constructed once per service with a {@link CryptoConfig} (typically populated by a
 * NestJS `ConfigService`). All public methods are documented per brief §4.1.
 *
 * @example
 * const crypto = new SecureCrypto({
 *   masterKey: process.env.MASTER_KEY!,
 *   hashSalt: process.env.HASH_SALT!,
 *   currentVersion: 1,
 *   defaultKeyName: EncryptionKey.PII,
 * });
 */
export class SecureCrypto {
  /** Validated runtime configuration (length/presence-checked at construction). */
  private readonly resolvedConfig: ResolvedConfig;

  /** In-memory cache of derived per-category keys, keyed by `${keyName}:v${version}`. */
  private readonly derivedKeysCache: Map<string, Buffer>;

  /**
   * @param config - Caller-provided configuration. Reads from `process.env` are the
   *   caller's responsibility (brief §7).
   * @throws {Error} when `config` is null/undefined.
   * @throws {Error} when `masterKey` is empty or does not decode to exactly 32 bytes.
   * @throws {Error} when `hashSalt` is empty.
   */
  constructor(config: CryptoConfig) {
    this.resolvedConfig = resolveConfig(config);
    this.derivedKeysCache = new Map<string, Buffer>();
    // Suppress noUnusedLocals in skeleton (Phase 2 reads these properties).
    void this.resolvedConfig;
    void this.derivedKeysCache;
  }

  /**
   * Encrypt a plaintext string under a per-category derived key (brief §3.1).
   *
   * Output is an {@link EncryptedValue} whose `encryptedData` is base64
   * `IV(12) + ciphertext + authTag(16)` for AES-256-GCM.
   *
   * @param _plaintext - Plaintext to encrypt.
   * @param _keyName - Logical key category (enum) or arbitrary key name string.
   * @returns Encrypted payload carrying `encryptedData`, `keyName`, `algorithm`, `version`.
   * @throws {Error} Phase 1: always throws `'Not implemented in Phase 1'`.
   */
  encrypt(_plaintext: string, _keyName: EncryptionKey | string): EncryptedValue {
    throw new Error(PHASE_1_NOT_IMPLEMENTED);
  }

  /**
   * Decrypt an {@link EncryptedValue} back to its plaintext string (brief §3.1).
   *
   * Honors the `version` field so historical values can be decrypted during key rotation.
   *
   * @param _encryptedValue - Payload previously produced by {@link encrypt}.
   * @returns Decrypted plaintext.
   * @throws {Error} Phase 1: always throws `'Not implemented in Phase 1'`.
   */
  decrypt(_encryptedValue: EncryptedValue): string {
    throw new Error(PHASE_1_NOT_IMPLEMENTED);
  }

  /**
   * Compute a deterministic HMAC-SHA256 hash for indexed PII lookups (brief §3.2).
   *
   * @param _plaintext - Plaintext to hash.
   * @returns Deterministic hash (encoding/format defined in Phase 2).
   * @throws {Error} Phase 1: always throws `'Not implemented in Phase 1'`.
   */
  hash(_plaintext: string): string {
    throw new Error(PHASE_1_NOT_IMPLEMENTED);
  }

  /**
   * Verify a plaintext against an expected deterministic hash using
   * constant-time comparison (`crypto.timingSafeEqual`, brief §3.2).
   *
   * @param _plaintext - Plaintext to re-hash and compare.
   * @param _expectedHash - Previously computed hash.
   * @returns `true` when the recomputed hash matches `expectedHash`.
   * @throws {Error} Phase 1: always throws `'Not implemented in Phase 1'`.
   */
  verifyHash(_plaintext: string, _expectedHash: string): boolean {
    throw new Error(PHASE_1_NOT_IMPLEMENTED);
  }

  /**
   * Combined encrypt + hash operation, recommended for PII fields persisted as
   * both `EncryptedValue` and `*Hash` columns (brief §4.1).
   *
   * @param _plaintext - Plaintext to encrypt and hash atomically.
   * @param _keyName - Logical key category (enum) or arbitrary key name string.
   * @returns Object containing the encrypted payload and the deterministic hash.
   * @throws {Error} Phase 1: always throws `'Not implemented in Phase 1'`.
   */
  encryptAndHash(
    _plaintext: string,
    _keyName: EncryptionKey | string,
  ): { encrypted: EncryptedValue; hash: string } {
    throw new Error(PHASE_1_NOT_IMPLEMENTED);
  }

  /**
   * Report whether a key name is recognized by this library.
   *
   * Phase 1 implementation checks membership in the {@link EncryptionKey} enum
   * (no crypto derivation). Phase 2 may extend this to include arbitrary
   * configured key names.
   *
   * @param keyName - Key name to test (case-sensitive enum string value).
   * @returns `true` when `keyName` matches a known {@link EncryptionKey} value.
   */
  hasKey(keyName: string): boolean {
    return this.getAvailableKeys().includes(keyName);
  }

  /**
   * List all recognized key names (the string values of {@link EncryptionKey}).
   *
   * @returns New array of available key names.
   */
  getAvailableKeys(): string[] {
    return Object.values(EncryptionKey);
  }
}
