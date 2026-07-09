/**
 * Public entrypoint for `@cobranza-apps/crypto` (`.` export).
 *
 * ## Exported API
 *
 * | Export | Kind | Description |
 * | --- | --- | --- |
 * | {@link SecureCrypto} | class | Core encryption/hashing service |
 * | {@link EncryptionKey} | enum | Logical key category constants |
 * | {@link CryptoConfig} | interface | Constructor configuration shape |
 * | {@link TtlCache} | class | Generic in-memory TTL cache |
 * | {@link createDecryptionCache} | function | Factory for a string-to-string decryption cache |
 * | {@link DecryptionCache} | type | Alias for `TtlCache<string, string>` |
 * | {@link createDecryptionCacheWrapper} | function | SecureCrypto-aware cache-through decrypt wrapper |
 * | {@link CachedDecryptor} | interface | Cache-through decryptor returned by withCache |
 * | {@link BulkFieldMap} | type | Per-field key mapping for encryptObject/decryptObject |
 *
 * ## Quick start
 *
 * ```ts
 * import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';
 * import type { CryptoConfig } from '@cobranza-apps/crypto';
 *
 * const config: CryptoConfig = {
 *   masterKey: process.env.MASTER_KEY!,   // base64, 32 bytes decoded
 *   hashSalt: process.env.HASH_SALT!,     // base64, non-empty
 *   currentVersion: 1,
 *   defaultKeyName: EncryptionKey.PII,
 * };
 *
 * const crypto = new SecureCrypto(config);
 * crypto.hasKey(EncryptionKey.PII); // => true
 * ```
 *
 * @remarks
 * All crypto methods (`encrypt`, `decrypt`, `hash`, `verifyHash`, `encryptAndHash`, `reEncrypt`,
 * encryptObject/decryptObject (bulk), and withCache (cached decrypt)) are fully implemented using
 * AES-256-GCM encryption and HMAC-SHA256 hashing.
 *
 * The dedicated testing subpath is available as `@cobranza-apps/crypto/testing`
 * (see `src/testing/index.ts`).
 *
 * @packageDocumentation
 * @see {@link module:crypto.service} for the SecureCrypto implementation
 * @see {@link module:crypto.service.validation} for config resolution internals
 */

export { EncryptionKey } from './config.js';
export type { CryptoConfig } from './config.js';
export { SecureCrypto } from './crypto.service.js';
export { TtlCache, createDecryptionCache } from './utils/cache.js';
export type { TtlCacheOptions, TtlCacheSetParams, DecryptionCache } from './utils/cache.js';
export { createDecryptionCacheWrapper } from './utils/decryption-cache.js';
export type {
  DecryptionCacheOptions,
  SecureCryptoDecryptor,
  CachedDecryptor,
} from './utils/decryption-cache.js';
export type { BulkFieldMap } from './crypto.service.bulk.js';
