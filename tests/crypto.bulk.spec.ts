/**
 * Unit tests for SecureCrypto.encryptObject / decryptObject (bulk operations).
 */
import { EncryptionKey } from '../src/index.js';
import type { SecureCrypto } from '../src/index.js';
import { buildTestCrypto, BULK_OBJECT_FIXTURE } from '../src/testing/index.js';
import type { EncryptedValue } from '@cobranza-apps/entities';

interface Person {
  name: string;
  email: string;
  note: string;
  counter: number;
}

const asEncryptedRecord = (obj: unknown): Record<string, EncryptedValue> =>
  obj as unknown as Record<string, EncryptedValue>;

describe('SecureCrypto — encryptObject / decryptObject', () => {
  let crypto: SecureCrypto;

  beforeEach(() => {
    crypto = buildTestCrypto(1);
  });

  it('roundtrips multiple fields through encryptObject then decryptObject', () => {
    const person: Person = { name: 'John', email: 'john@x.com', note: 'secret', counter: 5 };
    const fieldMap = { name: EncryptionKey.PII, email: EncryptionKey.PII, note: EncryptionKey.BANK_DATA };

    const encrypted = crypto.encryptObject(person, fieldMap);
    const decrypted = crypto.decryptObject(encrypted, fieldMap);

    expect(decrypted).toEqual(person);
  });

  it('encrypts only the listed fields and leaves others untouched', () => {
    const person: Person = { name: 'John', email: 'john@x.com', note: 'n', counter: 5 };

    const encrypted = crypto.encryptObject(person, { name: EncryptionKey.PII });

    expect(typeof asEncryptedRecord(encrypted).name!.encryptedData).toBe('string');
    expect((encrypted as unknown as Person).email).toBe('john@x.com');
    expect((encrypted as unknown as Person).counter).toBe(5);
  });

  it('does not mutate the original object', () => {
    const person: Person = { name: 'John', email: 'e', note: 'n', counter: 1 };
    const fieldMap = { name: EncryptionKey.PII, email: EncryptionKey.PII };

    crypto.encryptObject(person, fieldMap);

    expect(person.name).toBe('John');
    expect(person.email).toBe('e');
  });

  it('returns a shallow-cloned equal object when fieldMap is empty', () => {
    const person: Person = { name: 'John', email: 'e', note: 'n', counter: 1 };

    const result = crypto.encryptObject(person, {});

    expect(result).toEqual(person);
    expect(result).not.toBe(person);
  });

  it('skips fields listed in the map but absent from the object', () => {
    const partial = { name: 'John', counter: 1 } as Person;
    const fieldMap = { name: EncryptionKey.PII, email: EncryptionKey.PII };

    const result = crypto.encryptObject(partial, fieldMap);

    expect(typeof asEncryptedRecord(result).name!.encryptedData).toBe('string');
    expect((result as unknown as Person).email).toBeUndefined();
  });

  it('throws when an encrypt field is present but not a string', () => {
    const person: Person = { name: 'John', email: 'e', note: 'n', counter: 5 };

    expect(() => crypto.encryptObject(person, { counter: EncryptionKey.GENERAL })).toThrow(
      /expected a string to encrypt/,
    );
  });

  it('throws when a decrypt field is present but not an EncryptedValue', () => {
    const person: Person = { name: 'John', email: 'e', note: 'n', counter: 5 };

    expect(() => crypto.decryptObject(person, { name: EncryptionKey.PII })).toThrow(
      /expected an EncryptedValue to decrypt/,
    );
  });

  it('decryptObject ignores the fieldMap key-name values and uses each EncryptedValue keyName', () => {
    const person = { name: 'John' };
    const encrypted = crypto.encryptObject(person, { name: EncryptionKey.PII });

    const decrypted = crypto.decryptObject(encrypted, { name: EncryptionKey.BANK_DATA });

    expect(decrypted.name).toBe('John');
  });

  it('encryptObject stamps the current version on each encrypted field', () => {
    const v2 = buildTestCrypto(2);

    const encrypted = v2.encryptObject(
      { a: 'x', b: 'y' },
      { a: EncryptionKey.PII, b: EncryptionKey.GENERAL },
    );
    const record = asEncryptedRecord(encrypted);

    expect(record.a!.version).toBe(2);
    expect(record.b!.version).toBe(2);
  });

  it('roundtrips the shared BULK_OBJECT_FIXTURE', () => {
    const { object, fieldMap } = BULK_OBJECT_FIXTURE;

    const encrypted = crypto.encryptObject(object, fieldMap);
    const decrypted = crypto.decryptObject(encrypted, fieldMap);

    expect(decrypted).toEqual(object);
  });
});
