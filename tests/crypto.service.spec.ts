/**
 * Unit tests for SecureCrypto — service surface.
 *
 * Covers constructor / config validation, key-presence checks (hasKey),
 * key enumeration (getAvailableKeys), encryptAndHash (driven by TEST_VECTORS),
 * and destroy. Encryption/decryption/hashing/internals live in focused sibling
 * spec files.
 */

import { SecureCrypto, EncryptionKey } from '../src/index.js';
import { getTestCrypto, TEST_CRYPTO_CONFIG, TEST_VECTORS } from '../src/testing/index.js';

describe('SecureCrypto — service surface', () => {
  describe('constructor / config validation', () => {
    it('constructs without throwing given a valid config', () => {
      const crypto = new SecureCrypto(TEST_CRYPTO_CONFIG);

      expect(crypto).toBeInstanceOf(SecureCrypto);
    });

    it('getTestCrypto() returns a configured SecureCrypto instance', () => {
      expect(getTestCrypto()).toBeInstanceOf(SecureCrypto);
    });

    it('throws when masterKey decodes to fewer than 32 bytes', () => {
      const shortKey = Buffer.alloc(16).toString('base64');
      const invalidConfig = { ...TEST_CRYPTO_CONFIG, masterKey: shortKey };

      expect(() => new SecureCrypto(invalidConfig)).toThrow(/expected 32 bytes/);
    });

    it('throws when masterKey is empty', () => {
      const invalidConfig = { ...TEST_CRYPTO_CONFIG, masterKey: '' };

      expect(() => new SecureCrypto(invalidConfig)).toThrow(/non-empty base64 string/);
    });

    it('throws when hashSalt is empty (simulates a missing salt)', () => {
      const invalidConfig = { ...TEST_CRYPTO_CONFIG, hashSalt: '' };

      expect(() => new SecureCrypto(invalidConfig)).toThrow(/non-empty base64 string/);
    });
  });

  describe('hasKey', () => {
    it.each(Object.values(EncryptionKey))(
      'returns true for known key "%s"',
      (keyName) => {
        expect(getTestCrypto().hasKey(keyName)).toBe(true);
      },
    );

    it('returns false for an unknown key name', () => {
      expect(getTestCrypto().hasKey('unknown_key')).toBe(false);
    });
  });

  describe('getAvailableKeys', () => {
    it('returns every EncryptionKey value', () => {
      const available = getTestCrypto().getAvailableKeys();

      expect(available).toEqual(Object.values(EncryptionKey));
    });
  });

  describe('encryptAndHash', () => {
    it.each(TEST_VECTORS)(
      'combines encrypt + hash for plaintext %j',
      (vector) => {
        const cryptoInstance = new SecureCrypto({
          ...TEST_CRYPTO_CONFIG,
          currentVersion: vector.version,
        });

        const result = cryptoInstance.encryptAndHash(vector.plaintext, vector.keyName);

        expect(cryptoInstance.decrypt(result.encrypted)).toBe(vector.plaintext);
        expect(result.hash).toBe(cryptoInstance.hash(vector.plaintext));
        expect(result.hash).toBe(vector.expectedHash);
        expect(cryptoInstance.verifyHash(vector.plaintext, result.hash)).toBe(true);
        expect(result.encrypted.keyName).toBe(vector.keyName);
        expect(result.encrypted.version).toBe(vector.version);
      },
    );
  });

  describe('destroy', () => {
    it('clears the derived-key cache without throwing and a fresh encrypt still works', () => {
      const cryptoInstance = getTestCrypto();

      cryptoInstance.encrypt('warm-up', EncryptionKey.PII);
      expect(() => cryptoInstance.destroy()).not.toThrow();
      const encrypted = cryptoInstance.encrypt('after-destroy', EncryptionKey.PII);
      expect(cryptoInstance.decrypt(encrypted)).toBe('after-destroy');
    });
  });
});
