/**
 * SecureCrypto-aware decryption cache wrapper.
 *
 * Wraps the generic {@link TtlCache} to cache {@link SecureCrypto.decrypt}
 * results keyed by the encrypted payload's base64 `encryptedData`. Distinct
 * from {@link module:utils/cache.createDecryptionCache} (a bare
 * `TtlCache<string,string>` factory): this module binds a decryptor and exposes
 * a cache-through `decrypt` plus lifecycle helpers. Caching plaintext is an
 * explicit, opt-in consumer decision (brief §7).
 *
 * @module utils/decryption-cache
 */

import type { EncryptedValue } from '@cobranza-apps/entities';

import { TtlCache } from './cache.js';

/** Default cache time-to-live (60s) when `ttlMs` is not provided. */
const DEFAULT_DECRYPTION_TTL_MS = 60_000;

/** Options for {@link createDecryptionCacheWrapper}. */
export interface DecryptionCacheOptions {
  /** Cache time-to-live in milliseconds; defaults to {@link DEFAULT_DECRYPTION_TTL_MS}. */
  readonly ttlMs?: number;
}

/** Minimal decryptor accepted by {@link createDecryptionCacheWrapper} (SecureCrypto satisfies this). */
export interface SecureCryptoDecryptor {
  decrypt(encryptedValue: EncryptedValue): string;
}

/** Cache-through decryptor returned by {@link createDecryptionCacheWrapper}. */
export interface CachedDecryptor {
  decrypt(encrypted: EncryptedValue): string;
  clear(): void;
  size(): number;
}

/** Resolve the TTL, falling back to the default when unset. */
function resolveTtlMs(options?: DecryptionCacheOptions): number {
  return options?.ttlMs ?? DEFAULT_DECRYPTION_TTL_MS;
}

/**
 * Build a TTL-cached decryptor bound to `decryptor`.
 *
 * @param decryptor - Object exposing a `decrypt` method (e.g. a SecureCrypto instance).
 * @param options - Optional TTL override.
 * @returns A {@link CachedDecryptor} whose `decrypt` caches plaintext keyed by
 *   `encrypted.encryptedData`; cache misses delegate to `decryptor.decrypt`.
 */
export function createDecryptionCacheWrapper(
  decryptor: SecureCryptoDecryptor,
  options?: DecryptionCacheOptions,
): CachedDecryptor {
  const cache = new TtlCache<string, string>({ defaultTtlMs: resolveTtlMs(options) });
  return {
    decrypt(encrypted) {
      const cacheKey = encrypted.encryptedData;
      const cachedPlaintext = cache.get(cacheKey);
      if (cachedPlaintext !== undefined) {
        return cachedPlaintext;
      }
      const plaintext = decryptor.decrypt(encrypted);
      cache.set(cacheKey, plaintext);
      return plaintext;
    },
    clear() {
      cache.clear();
    },
    size() {
      return cache.size();
    },
  };
}
