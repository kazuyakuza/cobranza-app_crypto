/**
 * TTL-based in-memory cache utility for optionally caching decrypted values.
 *
 * Generic lazy-eviction cache: entries are removed on first access after their
 * TTL expires, or proactively via {@link TtlCache.purgeExpired}. No timers,
 * no runtime dependencies (uses `Date.now()` + `Map` only).
 *
 * The {@link DecryptionCache} alias + {@link createDecryptionCache} factory
 * provide a purpose-built entry point for caching `decrypt` results. The cache
 * is intentionally NOT wired into {@link SecureCrypto.decrypt} (brief §7):
 * caching plaintext in memory is an explicit, opt-in consumer decision.
 *
 * @module utils/cache
 */

/** Options for constructing a {@link TtlCache}. */
export interface TtlCacheOptions {
  /** Default time-to-live in milliseconds applied by {@link TtlCache.set}. */
  readonly defaultTtlMs: number;
}

/** Inputs for {@link TtlCache.setWithTtl} (per-entry TTL override). */
export interface TtlCacheSetParams<K, V> {
  readonly key: K;
  readonly value: V;
  readonly ttlMs: number;
}

/** A single cache entry with its absolute expiry timestamp. */
interface TtlCacheEntry<V> {
  readonly value: V;
  readonly expiresAt: number;
}

/**
 * In-memory TTL cache with lazy eviction.
 *
 * @example
 * ```ts
 * const cache = new TtlCache<string, string>({ defaultTtlMs: 60_000 });
 * cache.set('payload', 'plaintext');
 * cache.get('payload'); // -> 'plaintext' (within TTL)
 * ```
 */
function assertPositive(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${fieldName}: must be a positive finite number.`);
  }
}

export class TtlCache<K, V> {
  private readonly entries: Map<K, TtlCacheEntry<V>> = new Map();

  private readonly defaultTtlMs: number;

  constructor(options: TtlCacheOptions) {
    assertPositive(options.defaultTtlMs, 'defaultTtlMs');
    this.defaultTtlMs = options.defaultTtlMs;
  }

  /** Store `value` under `key` using the cache default TTL. */
  set(key: K, value: V): void {
    this.storeEntry(key, value, this.defaultTtlMs);
  }

  /** Store `value` under `key` with an explicit per-entry TTL. */
  setWithTtl(params: TtlCacheSetParams<K, V>): void {
    assertPositive(params.ttlMs, 'ttlMs');
    this.storeEntry(params.key, params.value, params.ttlMs);
  }

  /** Return the value for `key`, or `undefined` when missing or expired (lazy eviction). */
  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (this.isExpired(entry)) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /** Whether `key` holds a fresh value (expired entries are lazily evicted). */
  has(key: K): boolean {
    const entry = this.entries.get(key);
    if (!entry) {
      return false;
    }
    if (this.isExpired(entry)) {
      this.entries.delete(key);
      return false;
    }
    return true;
  }

  /** Remove `key`; returns `true` if it was present. */
  delete(key: K): boolean {
    return this.entries.delete(key);
  }

  /** Remove every entry. */
  clear(): void {
    this.entries.clear();
  }

  /** Raw entry count (may include stale entries not yet accessed). */
  size(): number {
    return this.entries.size;
  }

  /** Proactively remove all expired entries; returns the count removed. */
  purgeExpired(): number {
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (this.isExpired(entry)) {
        this.entries.delete(key);
        removed++;
      }
    }
    return removed;
  }

  private storeEntry(key: K, value: V, ttlMs: number): void {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  private isExpired(entry: TtlCacheEntry<V>): boolean {
    return Date.now() > entry.expiresAt;
  }
}

/** A TTL cache keyed by the encrypted-payload string and holding decrypted plaintext. */
export type DecryptionCache = TtlCache<string, string>;

/** Build a {@link DecryptionCache} with a default TTL in milliseconds. */
export function createDecryptionCache(defaultTtlMs: number): DecryptionCache {
  return new TtlCache<string, string>({ defaultTtlMs });
}
