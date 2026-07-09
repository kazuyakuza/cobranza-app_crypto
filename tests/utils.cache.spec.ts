/**
 * Unit tests for the TTL cache utility (src/utils/cache.ts) — 100% coverage target.
 */
import { TtlCache, createDecryptionCache } from '../src/utils/cache.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('TtlCache', () => {
  describe('constructor', () => {
    it('constructs with a positive defaultTtlMs', () => {
      expect(new TtlCache<string, string>({ defaultTtlMs: 100 })).toBeInstanceOf(TtlCache);
    });

    it('throws when defaultTtlMs is non-positive', () => {
      expect(() => new TtlCache<string, string>({ defaultTtlMs: 0 })).toThrow(/positive number/);
    });
  });

  describe('set / get', () => {
    it('returns the value within the TTL', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 1000 });
      cache.set('a', 1);

      expect(cache.get('a')).toBe(1);
    });

    it('returns undefined for a missing key', () => {
      expect(new TtlCache<string, number>({ defaultTtlMs: 1000 }).get('missing')).toBeUndefined();
    });

    it('returns undefined and evicts after the TTL expires', async () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 1 });
      cache.set('a', 1);
      await sleep(15);

      expect(cache.get('a')).toBeUndefined();
      expect(cache.size()).toBe(0);
    });
  });

  describe('setWithTtl', () => {
    it('stores with a per-entry TTL that expires independently of the default', async () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100000 });
      cache.setWithTtl({ key: 'a', value: 1, ttlMs: 1 });

      expect(cache.get('a')).toBe(1);
      await sleep(15);

      expect(cache.get('a')).toBeUndefined();
    });

    it('throws when ttlMs is non-positive', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 1000 });

      expect(() => cache.setWithTtl({ key: 'a', value: 1, ttlMs: 0 })).toThrow(/positive number/);
    });
  });

  describe('has', () => {
    it('returns true for a fresh entry and false for an expired or missing one', async () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 1 });
      cache.set('a', 1);

      expect(cache.has('a')).toBe(true);
      await sleep(15);

      expect(cache.has('a')).toBe(false);
      expect(cache.has('missing')).toBe(false);
    });
  });

  describe('delete', () => {
    it('returns true when deleting a present entry and false otherwise', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 1000 });
      cache.set('a', 1);

      expect(cache.delete('a')).toBe(true);
      expect(cache.delete('a')).toBe(false);
    });
  });

  describe('clear and size', () => {
    it('clears all entries', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 1000 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();

      expect(cache.size()).toBe(0);
    });

    it('size reports the raw entry count', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 1000 });
      cache.set('a', 1);
      cache.set('b', 2);

      expect(cache.size()).toBe(2);
    });
  });

  describe('purgeExpired', () => {
    it('removes only expired entries and returns the count removed', async () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 1 });
      cache.set('expired', 1);
      await sleep(15);
      cache.set('fresh', 2);

      expect(cache.purgeExpired()).toBe(1);
      expect(cache.size()).toBe(1);
      expect(cache.get('fresh')).toBe(2);
    });
  });
});

describe('createDecryptionCache', () => {
  it('returns a TtlCache<string, string> that stores and returns plaintext', () => {
    const cache = createDecryptionCache(1000);
    cache.set('encrypted-payload-base64', 'decrypted-plaintext');

    expect(cache.get('encrypted-payload-base64')).toBe('decrypted-plaintext');
  });
});
