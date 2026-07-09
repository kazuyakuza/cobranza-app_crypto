/**
 * Unit tests for SecureCrypto.withCache and createDecryptionCacheWrapper.
 */
import {
  EncryptionKey,
  createDecryptionCacheWrapper,
} from '../src/index.js';
import type { SecureCrypto } from '../src/index.js';
import { buildTestCrypto } from '../src/testing/index.js';
import type { EncryptedValue } from '@cobranza-apps/entities';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('SecureCrypto — withCache', () => {
  let crypto: SecureCrypto;

  beforeEach(() => {
    crypto = buildTestCrypto(1);
  });

  it('returns the plaintext on first call and populates the cache', () => {
    const cached = crypto.withCache();
    const encrypted = crypto.encrypt('secret', EncryptionKey.PII);

    expect(cached.decrypt(encrypted)).toBe('secret');
    expect(cached.size()).toBe(1);
  });

  it('does not call the underlying decrypt on a cache hit', () => {
    const calls: string[] = [];
    const decryptor = {
      decrypt(encrypted: EncryptedValue) {
        calls.push(encrypted.encryptedData);
        return `plain-${encrypted.encryptedData}`;
      },
    };
    const cached = createDecryptionCacheWrapper(decryptor, { ttlMs: 1000 });
    const encrypted: EncryptedValue = { encryptedData: 'AAAA', keyName: 'pii' };

    cached.decrypt(encrypted);
    cached.decrypt(encrypted);

    expect(calls).toHaveLength(1);
  });

  it('re-invokes the underlying decrypt after the TTL expires', async () => {
    const calls: string[] = [];
    const decryptor = {
      decrypt(encrypted: EncryptedValue) {
        calls.push(encrypted.encryptedData);
        return 'plain';
      },
    };
    const cached = createDecryptionCacheWrapper(decryptor, { ttlMs: 1 });
    const encrypted: EncryptedValue = { encryptedData: 'AAAA', keyName: 'pii' };

    cached.decrypt(encrypted);
    await sleep(15);
    cached.decrypt(encrypted);

    expect(calls).toHaveLength(2);
  });

  it('uses the default TTL when options are omitted', () => {
    const cached = crypto.withCache();
    const encrypted = crypto.encrypt('secret', EncryptionKey.PII);

    cached.decrypt(encrypted);

    expect(cached.size()).toBe(1);
  });

  it('clear() empties the cache', () => {
    const cached = crypto.withCache();
    const encrypted = crypto.encrypt('secret', EncryptionKey.PII);

    cached.decrypt(encrypted);
    cached.clear();

    expect(cached.size()).toBe(0);
  });

  it('does not cache a result when the underlying decrypt throws', () => {
    const cached = crypto.withCache();

    expect(() => cached.decrypt(null as unknown as EncryptedValue)).toThrow();
    expect(cached.size()).toBe(0);
  });
});

describe('createDecryptionCacheWrapper', () => {
  it('throws when ttlMs is non-positive (delegated to TtlCache)', () => {
    const decryptor = { decrypt: () => 'x' };

    expect(() => createDecryptionCacheWrapper(decryptor, { ttlMs: 0 })).toThrow(
      /positive finite number/,
    );
  });

  it('throws when ttlMs is NaN (delegated to TtlCache)', () => {
    const decryptor = { decrypt: () => 'x' };

    expect(() => createDecryptionCacheWrapper(decryptor, { ttlMs: NaN })).toThrow(
      /positive finite number/,
    );
  });
});
