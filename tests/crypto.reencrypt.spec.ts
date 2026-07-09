/**
 * Unit tests for SecureCrypto.reEncrypt (manual key rotation helper).
 */
import { EncryptionKey } from '../src/index.js';
import { buildTestCrypto } from '../src/testing/index.js';
import type { EncryptedValue } from '@cobranza-apps/entities';

describe('SecureCrypto — reEncrypt', () => {
  it('roundtrips: decrypt(reEncrypt(encrypted)) equals the original plaintext', () => {
    const crypto = buildTestCrypto(1);
    const encrypted = crypto.encrypt('rotate-me', EncryptionKey.PII);

    expect(crypto.decrypt(crypto.reEncrypt(encrypted))).toBe('rotate-me');
  });

  it('preserves the keyName when newKeyName is omitted', () => {
    const crypto = buildTestCrypto(1);
    const encrypted = crypto.encrypt('keep-key', EncryptionKey.BANK_DATA);

    expect(crypto.reEncrypt(encrypted).keyName).toBe(EncryptionKey.BANK_DATA);
  });

  it('stamps the current version onto the re-encrypted value', () => {
    const v1 = buildTestCrypto(1);
    const v2 = buildTestCrypto(2);
    const encrypted = v1.encrypt('version-rotation', EncryptionKey.PII);

    expect(v2.reEncrypt(encrypted).version).toBe(2);
  });

  it('switches to a new keyName when provided', () => {
    const crypto = buildTestCrypto(1);
    const encrypted = crypto.encrypt('switch-key', EncryptionKey.PII);

    const reEncrypted = crypto.reEncrypt(encrypted, EncryptionKey.NOTIFICATION);

    expect(reEncrypted.keyName).toBe(EncryptionKey.NOTIFICATION);
    expect(crypto.decrypt(reEncrypted)).toBe('switch-key');
  });

  it('produces a fresh ciphertext (new IV) distinct from the input', () => {
    const crypto = buildTestCrypto(1);
    const encrypted = crypto.encrypt('fresh-iv', EncryptionKey.PII);

    expect(crypto.reEncrypt(encrypted).encryptedData).not.toBe(encrypted.encryptedData);
  });

  it('rotates a historical v1 value to v2 and a v2 instance can decrypt it', () => {
    const v1 = buildTestCrypto(1);
    const v2 = buildTestCrypto(2);
    const encrypted = v1.encrypt('historical', EncryptionKey.PII);

    const rotated = v2.reEncrypt(encrypted);

    expect(rotated.version).toBe(2);
    expect(v2.decrypt(rotated)).toBe('historical');
  });

  it('throws when the input encryptedValue is null (via decrypt guard)', () => {
    expect(() => buildTestCrypto(1).reEncrypt(null as unknown as EncryptedValue)).toThrow(
      /expected an EncryptedValue object/,
    );
  });

  it('throws when newKeyName is empty (via encrypt guard)', () => {
    const crypto = buildTestCrypto(1);
    const encrypted = crypto.encrypt('x', EncryptionKey.PII);

    expect(() => crypto.reEncrypt(encrypted, '')).toThrow(/Invalid keyName/);
  });
});
