/**
 * Unit tests for SecureCrypto — service surface.
 *
 * Covers constructor / config validation, key-presence checks (hasKey),
 * key enumeration (getAvailableKeys), encryptAndHash (driven by TEST_VECTORS),
 * and destroy. Encryption/decryption/hashing/internals live in focused sibling
 * spec files.
 */

import { SecureCrypto, EncryptionKey } from '../src/index.js';
import {
  buildTestCrypto,
  getTestCrypto,
  TEST_CRYPTO_CONFIG,
  TEST_VECTORS,
  encryptedMatchesShape,
} from '../src/testing/index.js';

describe('SecureCrypto — service surface', () => {
  describe('constructor / config validation', () => {
    it('constructs without throwing given a valid config', () => {
      const crypto = new SecureCrypto(TEST_CRYPTO_CONFIG);

      expect(crypto).toBeInstanceOf(SecureCrypto);
    });

    it('getTestCrypto() returns a configured SecureCrypto instance', () => {
      expect(getTestCrypto()).toBeInstanceOf(SecureCrypto);
    });

    it.each([
      { field: 'masterKey', value: Buffer.alloc(16).toString('base64'), expected: /expected 32 bytes/ },
      { field: 'masterKey', value: '', expected: /non-empty base64 string/ },
      { field: 'hashSalt', value: '', expected: /non-empty base64 string/ },
    ])('throws when $field is invalid', ({ field, value, expected }) => {
      const invalidConfig = { ...TEST_CRYPTO_CONFIG, [field]: value };

      expect(() => new SecureCrypto(invalidConfig)).toThrow(expected);
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
      const crypto = getTestCrypto();
      const available = crypto.getAvailableKeys();

      expect(available).toEqual(Object.values(EncryptionKey));
    });

    it('mutating the returned array does not affect the instance', () => {
      const crypto = getTestCrypto();
      const available = crypto.getAvailableKeys();
      const originalLength = available.length;

      available.pop();
      const afterMutation = crypto.getAvailableKeys();

      expect(afterMutation).toHaveLength(originalLength);
    });
  });

  describe('encryptAndHash', () => {
    it.each(TEST_VECTORS)(
      'combines encrypt + hash for plaintext %j',
      (vector) => {
        const cryptoInstance = buildTestCrypto(vector.version);

        const result = cryptoInstance.encryptAndHash(vector.plaintext, vector.keyName);

        expect(cryptoInstance.decrypt(result.encrypted)).toBe(vector.plaintext);
        expect(result.hash).toBe(vector.expectedHash);
        expect(cryptoInstance.verifyHash(vector.plaintext, result.hash)).toBe(true);
        expect(result.encrypted.algorithm).toBe(vector.expectedEncryptedShape.algorithm);
        expect(result.encrypted.keyName).toBe(vector.keyName);
        expect(result.encrypted.version).toBe(vector.version);
        expect(
          Buffer.from(result.encrypted.encryptedData, 'base64').length,
        ).toBe(vector.expectedEncryptedShape.encryptedDataByteLength);
      },
    );

    it('encryptedMatchesShape returns true for a vector-aligned encryption', () => {
      const cryptoInstance = buildTestCrypto(1);
      const vector = TEST_VECTORS[0]!;
      const encrypted = cryptoInstance.encrypt(vector.plaintext, vector.keyName);

      expect(encryptedMatchesShape({ encrypted, vector })).toBe(true);
    });
  });

  describe('destroy', () => {
    it('clears the derived-key cache without throwing', () => {
      const cryptoInstance = getTestCrypto();

      cryptoInstance.encrypt('warm-up', EncryptionKey.PII);
      expect(() => cryptoInstance.destroy()).not.toThrow();
    });

    it('a separate fresh instance still works after another instance is destroyed', () => {
      const instanceA = getTestCrypto();

      instanceA.encrypt('warm-up', EncryptionKey.PII);
      instanceA.destroy();

      const instanceB = getTestCrypto();
      const encrypted = instanceB.encrypt('after-destroy', EncryptionKey.PII);

      expect(instanceB.decrypt(encrypted)).toBe('after-destroy');
    });
  });
});
