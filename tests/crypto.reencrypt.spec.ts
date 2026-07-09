/**
 * Unit tests for SecureCrypto.reEncrypt (manual key rotation helper).
 */
import { EncryptionKey } from '../src/index.js';
import { buildTestCrypto } from '../src/testing/index.js';
import type { EncryptedValue } from '@cobranza-apps/entities';

describe('SecureCrypto — reEncrypt', () => {
  let crypto: ReturnType<typeof buildTestCrypto>;

  beforeEach(() => {
    crypto = buildTestCrypto(1);
  });

  const encrypt = (plaintext: string, keyName = EncryptionKey.PII): EncryptedValue =>
    crypto.encrypt(plaintext, keyName);

  it('roundtrips: decrypt(reEncrypt(encrypted)) equals the original plaintext', () => {
    expect(crypto.decrypt(crypto.reEncrypt(encrypt('rotate-me')))).toBe('rotate-me');
  });

  it('preserves the keyName when newKeyName is omitted', () => {
    const encrypted = encrypt('keep-key', EncryptionKey.BANK_DATA);

    expect(crypto.reEncrypt(encrypted).keyName).toBe(EncryptionKey.BANK_DATA);
  });

  it('stamps the current version onto the re-encrypted value', () => {
    const v2 = buildTestCrypto(2);
    const encrypted = encrypt('version-rotation');

    expect(v2.reEncrypt(encrypted).version).toBe(2);
  });

  it('switches to a new keyName when provided', () => {
    const encrypted = encrypt('switch-key');

    const reEncrypted = crypto.reEncrypt(encrypted, EncryptionKey.NOTIFICATION);

    expect(reEncrypted.keyName).toBe(EncryptionKey.NOTIFICATION);
    expect(crypto.decrypt(reEncrypted)).toBe('switch-key');
  });

  it('produces a fresh ciphertext (new IV) distinct from the input', () => {
    const encrypted = encrypt('fresh-iv');

    expect(crypto.reEncrypt(encrypted).encryptedData).not.toBe(encrypted.encryptedData);
  });

  it('rotates a historical v1 value to v2 and a v2 instance can decrypt it', () => {
    const v2 = buildTestCrypto(2);
    const encrypted = encrypt('historical');

    const rotated = v2.reEncrypt(encrypted);

    expect(rotated.version).toBe(2);
    expect(v2.decrypt(rotated)).toBe('historical');
  });

  it('throws when the input encryptedValue is null (via decrypt guard)', () => {
    expect(() => crypto.reEncrypt(null as unknown as EncryptedValue)).toThrow(
      /expected an EncryptedValue object/,
    );
  });

  it('throws when newKeyName is empty (via encrypt guard)', () => {
    const encrypted = encrypt('x');

    expect(() => crypto.reEncrypt(encrypted, '')).toThrow(/Invalid keyName/);
  });
});
