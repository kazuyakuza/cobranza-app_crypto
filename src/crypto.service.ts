/**
 * SecureCrypto core service module — the single entrypoint for all cryptographic
 * operations in the Cobranza App platform (AES-256-GCM encryption, HMAC-SHA256
 * hashing, combined encryptAndHash). Uses Node.js built-in `crypto` only.
 *
 * Cipher primitives: {@link module:crypto.service.encryption}; HMAC:
 * {@link module:crypto.service.hashing}; bulk object ops:
 * {@link module:crypto.service.bulk}; config validation:
 * {@link module:crypto.service.validation}.
 *
 * @module crypto.service
 */

import type { EncryptedValue } from '@cobranza-apps/entities';

import { EncryptionKey, type CryptoConfig } from './config.js';
import { decryptWithAesGcm, encryptWithAesGcm } from './crypto.service.encryption.js';
import { assertValidEncryptedValue } from './crypto.service.guards.js';
import { computeHmacSha256, verifyHmacSha256 } from './crypto.service.hashing.js';
import { deriveKeyForCategory } from './crypto.service.keys.js';
import { resolveConfig, type ResolvedConfig } from './crypto.service.validation.js';
import { decryptObjectFields, encryptObjectFields, type BulkFieldMap } from './crypto.service.bulk.js';
import { createDecryptionCacheWrapper, type CachedDecryptor } from './utils/decryption-cache.js';
const AVAILABLE_KEYS: string[] = Object.values(EncryptionKey);

/**
 * Core encryption + hashing service for the Cobranza App platform.
 *
 * Constructed once per service with a {@link CryptoConfig} (typically populated
 * by a NestJS `ConfigService`). All public methods are documented per brief §4.1.
 *
 * @example
 * ```ts
 * const crypto = new SecureCrypto(config);
 * const encrypted = crypto.encrypt('data', EncryptionKey.PII);
 * const plaintext = crypto.decrypt(encrypted);
 * ```
 */
export class SecureCrypto {
  /** Validated runtime configuration (length/presence-checked at construction). */
  private readonly resolvedConfig: ResolvedConfig;

  /** Decoded hash salt (>= 32 bytes) reused across HMAC operations. */
  private readonly hashSaltBytes: Buffer;

  /** In-memory cache of derived per-category keys, keyed by `${keyName}:v${version}`. */
  private readonly derivedKeysCache: Map<string, Buffer>;

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

  private deriveKey(keyName: string, version: number): Buffer {
    return deriveKeyForCategory({ keyName, version, resolvedConfig: this.resolvedConfig, derivedKeysCache: this.derivedKeysCache });
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
    const key = this.deriveKey(keyName, this.resolvedConfig.currentVersion);
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
    const key = this.deriveKey(encryptedValue.keyName, version);
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
  ): { encrypted: EncryptedValue; hash: string; } {
    return { encrypted: this.encrypt(plaintext, keyName), hash: this.hash(plaintext) };
  }

  /** Decrypt and re-encrypt at the current version, optionally under a new key. */
  reEncrypt(encrypted: EncryptedValue, targetKeyName?: EncryptionKey | string): EncryptedValue {
    const plaintext = this.decrypt(encrypted);
    const resolvedTargetKeyName = targetKeyName ?? encrypted.keyName;
    return this.encrypt(plaintext, resolvedTargetKeyName);
  }
  /** Encrypt string fields per `fieldMap`. See {@link module:crypto.service.bulk}. */
  encryptObject<T>(obj: T, fieldMap: BulkFieldMap<T>): T {
    return encryptObjectFields({ crypto: this, obj, fieldMap });
  }

  /** Decrypt EncryptedValue fields per `fieldMap`. See {@link module:crypto.service.bulk}. */
  decryptObject<T>(obj: T, fieldMap: BulkFieldMap<T>): T {
    return decryptObjectFields({ crypto: this, obj, fieldMap });
  }

  /** TTL-cached decryptor. See {@link module:utils/decryption-cache}. */
  withCache(options?: { ttlMs?: number; }): CachedDecryptor {
    return createDecryptionCacheWrapper(this, options);
  }
  /**
   * Report whether a key name is recognized by this library.
   *
   * @param keyName - Key name to test (case-sensitive enum string value).
   * @returns `true` when `keyName` matches a known {@link EncryptionKey} value.
   */
  hasKey(keyName: string): boolean {
    return AVAILABLE_KEYS.includes(keyName);
  }

  /**
   * List all recognized key names (the string values of {@link EncryptionKey}).
   *
   * @returns New array of available key names.
   */
  getAvailableKeys(): string[] {
    return [...AVAILABLE_KEYS];
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
    this.hashSaltBytes.fill(0);
  }
}
