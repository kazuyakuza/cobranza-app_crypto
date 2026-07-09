/**
 * Unit tests for security hardening: facade entry guards, bulk fieldMap/obj
 * guards, and decrypt buffer-zeroing behavior.
 */
import { EncryptionKey } from '../src/index.js';
import { getTestCrypto } from '../src/testing/index.js';
import { mutateBase64Byte } from './payload-mutators.js';
import { expectStringRejection } from './test-helpers.js';

describe('SecureCrypto — runtime type guards (facade)', () => {
  let crypto: ReturnType<typeof getTestCrypto>;

  beforeEach(() => { crypto = getTestCrypto(); });

  it('encrypt rejects non-string plaintext', () => {
    expectStringRejection((v) => crypto.encrypt(v as string, EncryptionKey.PII));
  });

  it('encrypt rejects non-string keyName', () => {
    expect(() => crypto.encrypt('x', 42 as unknown as string)).toThrow(/expected a string/);
  });

  it('hash rejects non-string plaintext', () => {
    expectStringRejection((v) => crypto.hash(v as string));
  });

  it('verifyHash rejects non-string plaintext', () => {
    const h = crypto.hash('x');
    expectStringRejection((v) => crypto.verifyHash(v as string, h));
  });

  it('encryptAndHash rejects non-string plaintext', () => {
    expectStringRejection((v) => crypto.encryptAndHash(v as string, EncryptionKey.PII));
  });

  it('encryptAndHash rejects non-string keyName', () => {
    expect(() => crypto.encryptAndHash('x', 9 as unknown as string)).toThrow(/expected a string/);
  });

  it('reEncrypt rejects non-string optional keyName', () => {
    const enc = crypto.encrypt('x', EncryptionKey.PII);
    expect(() => crypto.reEncrypt(enc, 9 as unknown as string)).toThrow(/expected a string or undefined/);
  });

  it('decrypt rejects invalid payload (version zero)', () => {
    const enc = crypto.encrypt('x', EncryptionKey.PII);
    expect(() => crypto.decrypt({ ...enc, version: 0 })).toThrow(/positive integer/);
  });
});

describe('encryptObject / decryptObject — fieldMap & obj guards', () => {
  let crypto: ReturnType<typeof getTestCrypto>;

  beforeEach(() => { crypto = getTestCrypto(); });

  it('encryptObject rejects non-object fieldMap', () => {
    expect(() => crypto.encryptObject({}, null as never)).toThrow(/fieldMap.*non-null object/);
    expect(() => crypto.encryptObject({}, 'x' as never)).toThrow(/fieldMap.*non-null object/);
  });

  it('decryptObject rejects non-object fieldMap', () => {
    expect(() => crypto.decryptObject({}, null as never)).toThrow(/fieldMap.*non-null object/);
  });

  it('encryptObject rejects non-object obj', () => {
    expect(() => crypto.encryptObject(null as never, {})).toThrow(/obj.*non-null object/);
  });
});

describe('decryptWithAesGcm — buffer zeroing (best-effort)', () => {
  let crypto: ReturnType<typeof getTestCrypto>;

  beforeEach(() => { crypto = getTestCrypto(); });

  it('recovers plaintext on success (roundtrip)', () => {
    const enc = crypto.encrypt('s3cret', EncryptionKey.PII);
    expect(crypto.decrypt(enc)).toBe('s3cret');
  });

  it('throws a closed error on a corrupted auth tag', () => {
    const enc = crypto.encrypt('s3cret', EncryptionKey.PII);
    const corrupted = mutateBase64Byte(enc, -1);
    expect(() => crypto.decrypt(corrupted)).toThrow(/Decryption failed/);
  });
});
