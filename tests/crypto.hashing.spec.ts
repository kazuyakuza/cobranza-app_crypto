/**
 * SecureCrypto HMAC-SHA256 hashing: determinism, verification (true/false),
 * exact assertions against TEST_VECTORS expectedHash literals, and the
 * constant-time-comparison length short-circuit.
 */

import { getTestCrypto, TEST_VECTORS } from '../src/testing/index.js';

describe('SecureCrypto — hashing', () => {
  describe('hash', () => {
    it.each(TEST_VECTORS)(
      'produces the deterministic expectedHash for %j',
      (vector) => {
        expect(getTestCrypto().hash(vector.plaintext)).toBe(vector.expectedHash);
      },
    );

    it('is deterministic: the same plaintext yields the same hash twice', () => {
      const cryptoInstance = getTestCrypto();

      expect(cryptoInstance.hash('repeatable')).toBe(cryptoInstance.hash('repeatable'));
    });

    it('differs across distinct plaintexts', () => {
      const cryptoInstance = getTestCrypto();

      expect(cryptoInstance.hash('alpha')).not.toBe(cryptoInstance.hash('beta'));
    });
  });

  describe('verifyHash', () => {
    it.each(TEST_VECTORS)(
      'returns true for the matching expectedHash of %j',
      (vector) => {
        expect(getTestCrypto().verifyHash(vector.plaintext, vector.expectedHash)).toBe(true);
      },
    );

    it('returns false for a wrong expected hash', () => {
      expect(getTestCrypto().verifyHash('john.doe@example.com', 'wrong-hash')).toBe(false);
    });

    it('returns false for an expected hash of a different length (short-circuit)', () => {
      const cryptoInstance = getTestCrypto();
      const correct = cryptoInstance.hash('length-mismatch');
      const tooShort = correct.slice(0, 4);

      expect(cryptoInstance.verifyHash('length-mismatch', tooShort)).toBe(false);
    });
  });
});
