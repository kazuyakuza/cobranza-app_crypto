/**
 * SecureCrypto HMAC-SHA256 hashing: determinism, verification (true/false),
 * exact assertions against TEST_VECTORS expectedHash literals, and the
 * constant-time-comparison length short-circuit.
 */

import { SecureCrypto } from '../src/index.js';
import { getTestCrypto, TEST_CRYPTO_CONFIG, TEST_VECTORS } from '../src/testing/index.js';

describe('SecureCrypto — hashing', () => {
  describe('hash', () => {
    it.each(TEST_VECTORS)(
      'produces the deterministic expectedHash for %j',
      (vector) => {
        const crypto = getTestCrypto();

        expect(crypto.hash(vector.plaintext)).toBe(vector.expectedHash);
      },
    );

    it('is deterministic: the same plaintext yields the same hash twice', () => {
      const crypto = getTestCrypto();

      expect(crypto.hash('repeatable')).toBe(crypto.hash('repeatable'));
    });

    it('differs across distinct plaintexts', () => {
      const crypto = getTestCrypto();

      expect(crypto.hash('alpha')).not.toBe(crypto.hash('beta'));
    });

    it('hashes an empty string', () => {
      const crypto = getTestCrypto();

      expect(typeof crypto.hash('')).toBe('string');
      expect(crypto.hash('')).toBe(crypto.hash(''));
    });

    it('hashes a long plaintext (10,000 characters)', () => {
      const crypto = getTestCrypto();
      const longText = 'A'.repeat(10000);

      const hash = crypto.hash(longText);

      expect(typeof hash).toBe('string');
      expect(hash).toBe(crypto.hash(longText));
    });
  });

  describe('verifyHash', () => {
    it.each(TEST_VECTORS)(
      'returns true for the matching expectedHash of %j',
      (vector) => {
        const crypto = getTestCrypto();

        expect(crypto.verifyHash(vector.plaintext, vector.expectedHash)).toBe(true);
      },
    );

    it('returns false for a wrong (valid base64) expected hash', () => {
      const crypto = getTestCrypto();
      const wrongHash = crypto.hash('a-completely-different-input');

      expect(crypto.verifyHash('john.doe@example.com', wrongHash)).toBe(false);
    });

    it('returns false for an expected hash of a different length (short-circuit)', () => {
      const crypto = getTestCrypto();
      const correct = crypto.hash('length-mismatch');
      const tooShort = correct.slice(0, 4);

      expect(crypto.verifyHash('length-mismatch', tooShort)).toBe(false);
    });

    it('throws for an empty expected hash', () => {
      const crypto = getTestCrypto();

      expect(() => crypto.verifyHash('any-text', '')).toThrow(/non-empty base64/);
    });

    it('returns false when expected hash differs by a single character', () => {
      const crypto = getTestCrypto();
      const hash = crypto.hash('single-char-diff');
      const mutated = hash.slice(0, -1) + (hash.at(-1) === 'A' ? 'B' : 'A');

      expect(crypto.verifyHash('single-char-diff', mutated)).toBe(false);
    });

    it('returns false when verifying with a wrong salt (different instance)', () => {
      const cryptoA = getTestCrypto();
      const differentSalt = Buffer.alloc(64, 1).toString('base64');
      const cryptoB = new SecureCrypto({ ...TEST_CRYPTO_CONFIG, hashSalt: differentSalt });
      const hash = cryptoA.hash('wrong-salt-test');

      expect(cryptoB.verifyHash('wrong-salt-test', hash)).toBe(false);
    });
  });
});