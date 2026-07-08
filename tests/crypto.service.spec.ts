/**
 * Unit tests for SecureCrypto — Phase 1 skeleton.
 *
 * Covers constructor / config validation, key-presence checks (hasKey), and
 * key enumeration (getAvailableKeys). Uses the deterministic test fixtures
 * exported from `src/testing` so no real cryptographic keys are involved.
 *
 * Phase 2 will extend this suite with encrypt / decrypt / hash / verifyHash
 * assertions driven by the TEST_VECTORS table.
 */

import { SecureCrypto, EncryptionKey } from '../src/index.js';
import { getTestCrypto, TEST_CRYPTO_CONFIG } from '../src/testing/index.js';

describe('SecureCrypto — Phase 1 skeleton', () => {
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
});
