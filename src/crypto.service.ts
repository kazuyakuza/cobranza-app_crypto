/**
 * SecureCrypto core service module.
 *
 * Provides the {@link SecureCrypto} class — the single entrypoint for all
 * cryptographic operations in the Cobranza App platform:
 *
 * - **AES-256-GCM** authenticated encryption / decryption (brief §3.1)
 * - **HMAC-SHA256** deterministic hashing / verification (brief §3.2)
 * - **Combined encryptAndHash** for PII fields stored in dual columns (brief §4.1)
 *
 * @remarks
 * Uses Node.js built-in `crypto` module only. No external runtime dependencies.
 * Cipher primitives live in {@link module:crypto.service.encryption}, HMAC
 * primitives in {@link module:crypto.service.hashing}, and config validation in
 * {@link module:crypto.service.validation} — each extracted to keep this file
 * under the 200-line source file limit.
 *
 * @see {@link module:crypto.service.encryption} for AES-256-GCM primitives
 * @see {@link module:crypto.service.hashing} for HMAC-SHA256 primitives
 * @see {@link module:crypto.service.validation} for config resolution helpers
 * @module crypto.service
 */

import type { EncryptedValue } from '@cobranza-apps/entities';

import { EncryptionKey, type CryptoConfig } from './config.js';
import { decryptWithAesGcm, encryptWithAesGcm } from './crypto.service.encryption.js';
import { assertValidEncryptedValue } from './crypto.service.guards.js';
import { computeHmacSha256, verifyHmacSha256 } from './crypto.service.hashing.js';
import { deriveKeyForCategory } from './crypto.service.keys.js';
import type { ResolvedConfig } from './crypto.service.validation.js';
import { resolveConfig } from './crypto.service.validation.js';

/**
 * Core encryption + hashing service for the Cobranza App platform.
 *
 * Constructed once per service with a {@link CryptoConfig} (typically populated
 * by a NestJS `ConfigService`). All public methods are documented per brief §4.1.
 *
 * @example
 * ```ts
 * import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';
 *
 * const crypto = new SecureCrypto({
 *   masterKey: process.env.MASTER_KEY!,
 *   hashSalt: process.env.HASH_SALT!,
 *   currentVersion: 1,
 *   defaultKeyName: EncryptionKey.PII,
 * });
 *
 * const encrypted = crypto.encrypt('sensitive-data', EncryptionKey.PII);
 * const plaintext = crypto.decrypt(encrypted);
 * const emailHash = crypto.hash('user@example.com');
 * ```
 */
export class SecureCrypto {
  /** Validated runtime configuration (length/presence-checked at construction). */
  private readonly resolvedConfig: ResolvedConfig;

  /** Decoded hash salt (>= 32 bytes) reused across HMAC operations. */
  private readonly hashSaltBytes: Buffer;

  /** In-memory cache of derived per-category keys, keyed by `${keyName}:v${version}`. */
  private readonly derivedKeysCache: Map<string, Buffer>;

  /** Cached enum values for {@link EncryptionKey}. */
  private readonly availableKeys: string[] = Object.values(EncryptionKey);

  /**
   * @param config - Caller-provided configuration. Reads from `process.env` are
   *   the caller's responsibility (brief §7).
   * @throws {Error} when `config` is null/undefined.
   * @throws {Error} when `masterKey` is empty or does not decode to exactly 32 bytes.
   * @throws {Error} when `hashSalt` is empty or decodes to fewer than 32 bytes.
   */
  constructor(config: CryptoConfig) {
    this.resolvedConfig = resolveConfig(config);
    this.hashSaltBytes = Buffer.from(this.resolvedConfig.hashSalt, 'base64');
    this.derivedKeysCache = new Map<string, Buffer>();
  }

  /**
   * Encrypt a plaintext string under a per-category derived key (brief §3.1).
   *
   * @param plaintext - Plaintext to encrypt.
   * @param keyName - Logical key category (enum) or arbitrary key name string.
   * @returns {@link EncryptedValue} carrying base64 `IV(12)+ciphertext+authTag(16)`,
   *   `keyName`, `algorithm`, and the current key `version`.
   */
  encrypt(plaintext: string, keyName: EncryptionKey | string): EncryptedValue {
    const key = deriveKeyForCategory({
      keyName,
      version: this.resolvedConfig.currentVersion,
      resolvedConfig: this.resolvedConfig,
      derivedKeysCache: this.derivedKeysCache,
    });
    return encryptWithAesGcm({
      plaintext,
      key,
      keyName,
      version: this.resolvedConfig.currentVersion,
    });
  }

  /**
   * Decrypt an {@link EncryptedValue} back to its plaintext string (brief §3.1).
   *
   * Honors the `version` field so historical values can be decrypted during
   * key rotation; falls back to the current version when `version` is absent.
   *
   * @param encryptedValue - Payload previously produced by {@link encrypt}.
   * @returns Decrypted plaintext.
   * @throws {Error} when the payload is malformed, the key is missing, or
   *   authentication fails (non-sensitive message).
   */
  decrypt(encryptedValue: EncryptedValue): string {
    assertValidEncryptedValue(encryptedValue);
    const version = encryptedValue.version ?? this.resolvedConfig.currentVersion;
    const key = deriveKeyForCategory({
      keyName: encryptedValue.keyName,
      version,
      resolvedConfig: this.resolvedConfig,
      derivedKeysCache: this.derivedKeysCache,
    });
    return decryptWithAesGcm({ encryptedData: encryptedValue.encryptedData, key });
  }

  /**
   * Compute a deterministic HMAC-SHA256 hash for indexed PII lookups (brief §3.2).
   *
   * @param plaintext - Plaintext to hash.
   * @returns Base64-encoded HMAC-SHA256 digest keyed by the configured `hashSalt`.
   */
  hash(plaintext: string): string {
    return computeHmacSha256({ plaintext, salt: this.hashSaltBytes });
  }

  /**
   * Verify a plaintext against an expected deterministic hash using constant-time
   * comparison (brief §3.2).
   *
   * @param plaintext - Plaintext to re-hash and compare.
   * @param expectedHash - Previously computed base64 hash.
   * @returns `true` when the recomputed hash matches `expectedHash`.
   */
  verifyHash(plaintext: string, expectedHash: string): boolean {
    return verifyHmacSha256({
      plaintext,
      salt: this.hashSaltBytes,
      expectedHash,
    });
  }

  /**
   * Combined encrypt + hash operation, recommended for PII fields persisted as
   * both `EncryptedValue` and `*Hash` columns (brief §4.1).
   *
   * @param plaintext - Plaintext to encrypt and hash.
   * @param keyName - Logical key category (enum) or arbitrary key name string.
   * @returns Object containing the encrypted payload and the deterministic hash.
   */
  encryptAndHash(
    plaintext: string,
    keyName: EncryptionKey | string,
  ): { encrypted: EncryptedValue; hash: string } {
    return { encrypted: this.encrypt(plaintext, keyName), hash: this.hash(plaintext) };
  }

  /**
   * Report whether a key name is recognized by this library.
   *
   * @param keyName - Key name to test (case-sensitive enum string value).
   * @returns `true` when `keyName` matches a known {@link EncryptionKey} value.
   */
  hasKey(keyName: string): boolean {
    return this.availableKeys.includes(keyName);
  }

  /**
   * List all recognized key names (the string values of {@link EncryptionKey}).
   *
   * @returns New array of available key names.
   */
  getAvailableKeys(): string[] {
    return [...this.availableKeys];
  }

  /**
   * Zero cached derived keys and clear the derivation cache.
   *
   * @remarks Best-effort cleanup; the instance must not be used after calling.
   */
  destroy(): void {
    for (const key of this.derivedKeysCache.values()) {
      key.fill(0);
    }
    this.derivedKeysCache.clear();
  }
}
