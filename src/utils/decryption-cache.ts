/**
 * SecureCrypto-aware decryption cache wrapper with TTL support.
 *
 * Wraps the generic {@link TtlCache} to cache {@link SecureCrypto.decrypt}
 * results keyed by `encryptedData`. Caching plaintext is an explicit, opt-in
 * consumer decision (brief §7).
 *
 * @module utils/decryption-cache
 */

import type { EncryptedValue } from '@cobranza-apps/entities';

import { TtlCache } from './cache.js';

/** Default cache time-to-live (60s) when `ttlMs` is not provided. */
const DEFAULT_DECRYPTION_TTL_MS = 60_000;

/**
 * Options for {@link createDecryptionCacheWrapper}.
 *
 * @property ttlMs - Cache time-to-live in milliseconds. Defaults to
 *   {@link DEFAULT_DECRYPTION_TTL_MS} (60 000 ms). Shorter TTLs trade cache
 *   hit-rate for lower memory footprint; longer TTLs increase the window in
 *   which plaintext is held in memory.
 *
 * @see {@link SecureCrypto.withCache} — facade that delegates here.
 */
export interface DecryptionCacheOptions {
  /** Cache time-to-live in milliseconds; defaults to {@link DEFAULT_DECRYPTION_TTL_MS}. */
  readonly ttlMs?: number;
}

/**
 * Minimal decryptor accepted by {@link createDecryptionCacheWrapper}.
 *
 * Any object exposing a `decrypt(encryptedValue): string` method satisfies this
 * contract — {@link SecureCrypto} is the canonical implementation.
 *
 * @see {@link SecureCrypto}
 */
export interface SecureCryptoDecryptor {
  decrypt(encryptedValue: EncryptedValue): string;
}

/**
 * Cache-through decryptor returned by {@link createDecryptionCacheWrapper}.
 *
 * Wraps an underlying {@link SecureCryptoDecryptor} with a TTL-bounded
 * in-memory cache keyed by `encrypted.encryptedData`. Plaintext is cached only
 * on cache miss; subsequent calls for the same ciphertext return the cached
 * value until the TTL elapses.
 *
 * @property decrypt - Decrypt an {@link EncryptedValue}, returning cached
 *   plaintext when available.
 * @property clear - Drop all cached entries (e.g. after key rotation).
 * @property size - Current number of cached plaintext entries.
 *
 * @example
 * ```ts
 * const cached = crypto.withCache({ ttlMs: 30_000 });
 * const a = cached.decrypt(encrypted); // cache miss — delegates to SecureCrypto
 * const b = cached.decrypt(encrypted); // cache hit  — returns cached plaintext
 * cached.clear();                      // invalidate after key rotation
 * ```
 *
 * @see {@link SecureCrypto.withCache}
 */
export interface CachedDecryptor {
  decrypt(encrypted: EncryptedValue): string;
  clear(): void;
  size(): number;
}

/**
 * Build a TTL-cached decryptor bound to `decryptor`.
 *
 * Cache hits avoid the cost of AES-256-GCM decryption for hot records. The
 * cache is keyed by `encrypted.encryptedData` so identical ciphertexts share
 * a single plaintext entry. Call {@link CachedDecryptor.clear} after key
 * rotation to invalidate stale entries.
 *
 * @param decryptor - Object exposing a `decrypt` method (e.g. a
 *   {@link SecureCrypto} instance).
 * @param options - Optional TTL override via {@link DecryptionCacheOptions}.
 * @returns A {@link CachedDecryptor} whose `decrypt` caches plaintext keyed by
 *   `encrypted.encryptedData`; cache misses delegate to `decryptor.decrypt`.
 *
 * @example
 * ```ts
 * import { createDecryptionCacheWrapper } from '@cobranza-apps/crypto';
 *
 * const cached = createDecryptionCacheWrapper(crypto, { ttlMs: 30_000 });
 * const plaintext = cached.decrypt(encryptedValue);
 * ```
 *
 * @see {@link SecureCrypto.withCache} — facade that delegates here.
 */
export function createDecryptionCacheWrapper(
  decryptor: SecureCryptoDecryptor,
  options?: DecryptionCacheOptions,
): CachedDecryptor {
  const ttlMs = options?.ttlMs ?? DEFAULT_DECRYPTION_TTL_MS;
  const cache = new TtlCache<string, string>({ defaultTtlMs: ttlMs });
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
