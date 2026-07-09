/**
 * SecureCrypto AES-256-GCM encrypt/decrypt: roundtrip, key-category coverage,
 * version handling, and error cases (corrupted data, wrong auth tag, missing key,
 * malformed payload). Ciphertext is non-deterministic (random 12-byte IV), so
 * vectors are asserted structurally + via roundtrip (no exact-ciphertext literal).
 */

import { EncryptionKey } from '../src/index.js';
import { buildTestCrypto, TEST_VECTORS } from '../src/testing/index.js';
import { mutateBase64Byte } from './payload-mutators.js';
import type { EncryptedValue } from '@cobranza-apps/entities';

const MIN_PAYLOAD_BYTES = 28; // 12 IV + 16 authTag (zero ciphertext)

function decodePayloadLength(encrypted: EncryptedValue): number {
  return Buffer.from(encrypted.encryptedData, 'base64').length;
}

describe('SecureCrypto — encrypt / decrypt', () => {
  describe('roundtrip', () => {
    it.each(TEST_VECTORS)(
      'roundtrips plaintext %j under key %s v%d',
      (vector) => {
        const cryptoInstance = buildTestCrypto(vector.version);

        const encrypted = cryptoInstance.encrypt(vector.plaintext, vector.keyName);

        expect(cryptoInstance.decrypt(encrypted)).toBe(vector.plaintext);
      },
    );

    it.each(Object.values(EncryptionKey))(
      'roundtrips under every EncryptionKey enum value %s',
      (keyName) => {
        const cryptoInstance = buildTestCrypto(1);

        const encrypted = cryptoInstance.encrypt('payload', keyName);

        expect(cryptoInstance.decrypt(encrypted)).toBe('payload');
        expect(encrypted.keyName).toBe(keyName);
      },
    );

    it('roundtrips empty plaintext', () => {
      const cryptoInstance = buildTestCrypto(1);

      const encrypted = cryptoInstance.encrypt('', EncryptionKey.PII);

      expect(cryptoInstance.decrypt(encrypted)).toBe('');
      expect(decodePayloadLength(encrypted)).toBe(MIN_PAYLOAD_BYTES);
    });
  });

  describe('encrypted value structure', () => {
    it.each(TEST_VECTORS)(
      'produces a well-formed EncryptedValue for %j',
      (vector) => {
        const cryptoInstance = buildTestCrypto(vector.version);

        const encrypted = cryptoInstance.encrypt(vector.plaintext, vector.keyName);

        expect(encrypted.algorithm).toBe('aes-256-gcm');
        expect(encrypted.keyName).toBe(vector.keyName);
        expect(encrypted.version).toBe(vector.version);
        expect(decodePayloadLength(encrypted)).toBeGreaterThanOrEqual(MIN_PAYLOAD_BYTES);
      },
    );
  });

  describe('version handling', () => {
    it('stamps the current config version onto the EncryptedValue', () => {
      const encrypted = buildTestCrypto(2).encrypt('v2-payload', EncryptionKey.BANK_DATA);

      expect(encrypted.version).toBe(2);
    });

    it('decrypts a v1 payload using a v2-configured instance (uses payload version)', () => {
      const v1Crypto = buildTestCrypto(1);
      const v2Crypto = buildTestCrypto(2);
      const plaintext = 'historical-value';
      const encrypted = v1Crypto.encrypt(plaintext, EncryptionKey.PII);

      expect(encrypted.version).toBe(1);
      expect(v2Crypto.decrypt(encrypted)).toBe(plaintext);
    });

    it('falls back to currentVersion when EncryptedValue.version is undefined', () => {
      const v2Crypto = buildTestCrypto(2);
      const encrypted = v2Crypto.encrypt('no-version', EncryptionKey.PII);
      const withoutVersion: EncryptedValue = {
        encryptedData: encrypted.encryptedData,
        keyName: encrypted.keyName,
      };

      expect(encrypted.version).toBe(2);
      expect(v2Crypto.decrypt(withoutVersion)).toBe('no-version');
    });
  });

  describe('error cases', () => {
    it('throws when keyName is empty on encrypt (missing key)', () => {
      expect(() => buildTestCrypto(1).encrypt('x', '')).toThrow(/Invalid keyName/);
    });

    it('throws when keyName is empty on decrypt (missing key)', () => {
      const cryptoInstance = buildTestCrypto(1);
      const encrypted = cryptoInstance.encrypt('x', EncryptionKey.PII);

      expect(() => cryptoInstance.decrypt({ ...encrypted, keyName: '' })).toThrow(/keyName is required/);
    });

    it('throws on a malformed (truncated) payload', () => {
      const malformed = Buffer.alloc(10).toString('base64');

      expect(() =>
        buildTestCrypto(1).decrypt({
          encryptedData: malformed,
          keyName: EncryptionKey.PII,
          version: 1,
        }),
      ).toThrow(/expected at least 28 bytes/);
    });

    it('throws on a corrupted auth tag', () => {
      const cryptoInstance = buildTestCrypto(1);
      const encrypted = cryptoInstance.encrypt('tamper-me', EncryptionKey.PII);

      expect(() => cryptoInstance.decrypt(mutateBase64Byte(encrypted, -1))).toThrow(/Decryption failed/);
    });

    it('throws on corrupted ciphertext', () => {
      const cryptoInstance = buildTestCrypto(1);
      const encrypted = cryptoInstance.encrypt('flip-me', EncryptionKey.PII);

      expect(() => cryptoInstance.decrypt(mutateBase64Byte(encrypted, 12))).toThrow(/Decryption failed/);
    });

    it('throws on invalid base64 encryptedData', () => {
      const cryptoInstance = buildTestCrypto(1);

      expect(() =>
        cryptoInstance.decrypt({
          encryptedData: '!!!invalid-base64!!!',
          keyName: EncryptionKey.PII,
          version: 1,
        }),
      ).toThrow();
    });

    it('throws when decrypting with a wrong keyName', () => {
      const cryptoInstance = buildTestCrypto(1);
      const encrypted = cryptoInstance.encrypt('secret-value', EncryptionKey.PII);

      expect(() =>
        cryptoInstance.decrypt({
          ...encrypted,
          keyName: EncryptionKey.BANK_DATA,
        }),
      ).toThrow(/Decryption failed/);
    });

    it('throws when encryptedValue is null', () => {
      expect(() =>
        buildTestCrypto(1).decrypt(null as unknown as EncryptedValue),
      ).toThrow(/expected an EncryptedValue object/);
    });

    it('throws when encryptedData is missing', () => {
      const cryptoInstance = buildTestCrypto(1);
      const encrypted = cryptoInstance.encrypt('x', EncryptionKey.PII);

      expect(() =>
        cryptoInstance.decrypt({
          keyName: encrypted.keyName,
          algorithm: encrypted.algorithm,
          version: encrypted.version,
        } as EncryptedValue),
      ).toThrow(/encryptedData is required/);
    });

    it('throws when keyName is missing on the EncryptedValue', () => {
      const cryptoInstance = buildTestCrypto(1);
      const encrypted = cryptoInstance.encrypt('x', EncryptionKey.PII);

      expect(() =>
        cryptoInstance.decrypt({
          encryptedData: encrypted.encryptedData,
          algorithm: encrypted.algorithm,
          version: encrypted.version,
        } as EncryptedValue),
      ).toThrow(/keyName is required/);
    });

    it('throws when decrypting an empty plaintext payload with corrupted data', () => {
      const cryptoInstance = buildTestCrypto(1);
      const encrypted = cryptoInstance.encrypt('', EncryptionKey.PII);

      expect(() => cryptoInstance.decrypt(mutateBase64Byte(encrypted, -1))).toThrow(/Decryption failed/);
    });
  });
});