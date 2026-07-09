/**
 * Direct unit tests for SecureCrypto internal modules to reach branch coverage
 * that is awkward or impossible through the public API alone (config guards,
 * decryption guards, key-derivation cache, HKDF derivation, low-level utils).
 */

import { resolveConfig } from '../src/crypto.service.validation.js';
import { assertValidEncryptedValue } from '../src/crypto.service.guards.js';
import { deriveKeyForCategory } from '../src/crypto.service.keys.js';
import { deriveKey } from '../src/hkdf.js';
import {
  base64ToBuffer,
  bufferToBase64,
  concatBuffers,
  constantTimeCompare,
  generateIv,
} from '../src/utils.js';
import { TEST_CRYPTO_CONFIG, TEST_MASTER_KEY } from '../src/testing/index.js';
import type { EncryptedValue } from '@cobranza-apps/entities';

describe('resolveConfig', () => {
  it('throws when config is null', () => {
    expect(() => resolveConfig(null as never)).toThrow(/expected a CryptoConfig object/);
  });

  it('throws when masterKey is empty', () => {
    expect(() => resolveConfig({ ...TEST_CRYPTO_CONFIG, masterKey: '' })).toThrow(/non-empty base64 string/);
  });

  it('throws when masterKey decodes to the wrong length', () => {
    const shortKey = Buffer.alloc(16).toString('base64');

    expect(() => resolveConfig({ ...TEST_CRYPTO_CONFIG, masterKey: shortKey })).toThrow(/expected 32 bytes/);
  });

  it('throws when hashSalt is empty', () => {
    expect(() => resolveConfig({ ...TEST_CRYPTO_CONFIG, hashSalt: '' })).toThrow(/non-empty base64 string/);
  });

  it('throws when hashSalt decodes to fewer than 32 bytes', () => {
    const shortSalt = Buffer.alloc(16).toString('base64');

    expect(() => resolveConfig({ ...TEST_CRYPTO_CONFIG, hashSalt: shortSalt })).toThrow(/at least 32 bytes/);
  });

  it('defaults currentVersion to 1 when omitted', () => {
    const trimmed = { masterKey: TEST_CRYPTO_CONFIG.masterKey, hashSalt: TEST_CRYPTO_CONFIG.hashSalt };

    expect(resolveConfig(trimmed).currentVersion).toBe(1);
  });
});

describe('assertValidEncryptedValue', () => {
  it('throws when the value is null', () => {
    expect(() => assertValidEncryptedValue(null as unknown as EncryptedValue)).toThrow(/expected an EncryptedValue object/);
  });

  it('throws when encryptedData is missing', () => {
    const value = { keyName: 'pii' } as EncryptedValue;

    expect(() => assertValidEncryptedValue(value)).toThrow(/encryptedData is required/);
  });

  it('throws when keyName is missing', () => {
    const value = { encryptedData: 'AAA' } as EncryptedValue;

    expect(() => assertValidEncryptedValue(value)).toThrow(/keyName is required/);
  });

  it('accepts a fully-populated EncryptedValue', () => {
    const value: EncryptedValue = { encryptedData: 'AAA', keyName: 'pii', algorithm: 'aes-256-gcm', version: 1 };

    expect(() => assertValidEncryptedValue(value)).not.toThrow();
  });
});

describe('deriveKeyForCategory', () => {
  it('throws on an empty keyName', () => {
    const resolved = resolveConfig(TEST_CRYPTO_CONFIG);

    expect(() =>
      deriveKeyForCategory({
        keyName: '',
        version: 1,
        resolvedConfig: resolved,
        derivedKeysCache: new Map(),
      }),
    ).toThrow(/Invalid keyName/);
  });

  it('returns the same Buffer reference on a cache hit', () => {
    const resolved = resolveConfig(TEST_CRYPTO_CONFIG);
    const cache = new Map<string, Buffer>();

    const first = deriveKeyForCategory({ keyName: 'pii', version: 1, resolvedConfig: resolved, derivedKeysCache: cache });
    const second = deriveKeyForCategory({ keyName: 'pii', version: 1, resolvedConfig: resolved, derivedKeysCache: cache });

    expect(second).toBe(first);
    expect(cache.size).toBe(1);
  });
});

describe('deriveKey (HKDF)', () => {
  it('throws when the masterKey decodes to the wrong length', () => {
    expect(() => deriveKey({ masterKey: Buffer.alloc(16).toString('base64'), keyName: 'pii', version: 1 })).toThrow(/expected 32 bytes/);
  });

  it('throws on an empty keyName', () => {
    expect(() => deriveKey({ masterKey: TEST_MASTER_KEY, keyName: '', version: 1 })).toThrow(/Invalid keyName/);
  });

  it('derives a 32-byte key', () => {
    expect(deriveKey({ masterKey: TEST_MASTER_KEY, keyName: 'pii', version: 1 }).length).toBe(32);
  });

  it('derives a different key when the version suffix differs', () => {
    const v1 = deriveKey({ masterKey: TEST_MASTER_KEY, keyName: 'pii', version: 1 });
    const v2 = deriveKey({ masterKey: TEST_MASTER_KEY, keyName: 'pii', version: 2 });

    expect(v2.equals(v1)).toBe(false);
  });

  it('derives a key without the :vN suffix when version is omitted', () => {
    const withVersion = deriveKey({ masterKey: TEST_MASTER_KEY, keyName: 'pii', version: 1 });
    const noVersion = deriveKey({ masterKey: TEST_MASTER_KEY, keyName: 'pii' });

    expect(noVersion.equals(withVersion)).toBe(false);
    expect(noVersion.length).toBe(32);
  });
});

describe('utils', () => {
  it('base64ToBuffer throws on an empty string', () => {
    expect(() => base64ToBuffer('')).toThrow(/non-empty string/);
  });

  it('bufferToBase64 roundtrips a buffer', () => {
    const buffer = Buffer.from([1, 2, 3, 4]);

    expect(base64ToBuffer(bufferToBase64(buffer)).equals(buffer)).toBe(true);
  });

  it('generateIv produces the requested number of bytes', () => {
    expect(generateIv(12).length).toBe(12);
    expect(generateIv().length).toBe(12);
  });

  it('concatBuffers concatenates inputs in order', () => {
    expect(concatBuffers(Buffer.from([1]), Buffer.from([2, 3])).equals(Buffer.from([1, 2, 3]))).toBe(true);
  });

  it('constantTimeCompare returns true for equal strings', () => {
    expect(constantTimeCompare('abc', 'abc')).toBe(true);
  });

  it('constantTimeCompare returns false for differing lengths', () => {
    expect(constantTimeCompare('abc', 'abcd')).toBe(false);
  });

  it('constantTimeCompare returns false for equal lengths with different content', () => {
    expect(constantTimeCompare('abc', 'abd')).toBe(false);
  });
});
