/**
 * Bulk object encryption / decryption orchestration for {@link module:crypto.service}.
 *
 * Extracts {@link encryptObjectFields} and {@link decryptObjectFields} from the
 * SecureCrypto facade so it stays under the 200-line source file limit. Each
 * function receives the orchestrating {@link SecureCrypto} instance plus a
 * field map, transforms only the listed string / EncryptedValue fields, and
 * returns a shallow-cloned object (the input object is never mutated).
 *
 * @module crypto.service.bulk
 */

import type { EncryptedValue } from '@cobranza-apps/entities';

import type { EncryptionKey } from './config.js';
import type { SecureCrypto } from './crypto.service.js';

/**
 * Per-field key mapping for bulk object operations. Only the keys present in
 * this map are encrypted / decrypted; unmapped fields are passed through
 * unchanged.
 *
 * Values may be an {@link EncryptionKey} enum member or an arbitrary key-name
 * string (the same type accepted by {@link SecureCrypto.encrypt}).
 *
 * @typeParam T - Shape of the object being transformed.
 *
 * @example
 * ```ts
 * import { EncryptionKey } from '@cobranza-apps/crypto';
 * import type { BulkFieldMap } from '@cobranza-apps/crypto';
 *
 * interface Customer { email: string; name: string; id: number; }
 * const map: BulkFieldMap<Customer> = {
 *   email: EncryptionKey.PII,
 *   name:  EncryptionKey.PII,
 * };
 * ```
 *
 * @see {@link SecureCrypto.encryptObject}
 * @see {@link SecureCrypto.decryptObject}
 */
export type BulkFieldMap<T> = Partial<Record<keyof T, EncryptionKey | string>>;

/**
 * Inputs for {@link encryptObjectFields} and {@link decryptObjectFields}.
 *
 * @typeParam T - Shape of the object being transformed.
 *
 * @property crypto - The {@link SecureCrypto} instance used for encrypt / decrypt.
 * @property obj - Source object; never mutated — a shallow clone is returned.
 * @property fieldMap - {@link BulkFieldMap} listing which fields to transform
 *   and under which key name.
 *
 * @see {@link SecureCrypto.encryptObject}
 * @see {@link SecureCrypto.decryptObject}
 */
export interface BulkOperationParams<T> {
  readonly crypto: SecureCrypto;
  readonly obj: T;
  readonly fieldMap: BulkFieldMap<T>;
}

/** Whether a value is a non-null object. */
function isNonNullObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

/** Whether a non-null object has a string `encryptedData` property (i.e. is an EncryptedValue). */
function hasStringEncryptedData(value: object): value is EncryptedValue {
  return typeof (value as EncryptedValue).encryptedData === 'string';
}

/** Whether a value is shaped like an {@link EncryptedValue} (object with string `encryptedData`). */
function isEncryptedValue(value: unknown): value is EncryptedValue {
  return isNonNullObject(value) && hasStringEncryptedData(value);
}

/** Assert that a value is a string. */
function assertStringValue<T>(value: unknown, field: keyof T): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid field "${String(field)}": expected a string to encrypt.`);
  }
}

/** Assert that a value is an EncryptedValue. */
function assertEncryptedValue<T>(value: unknown, field: keyof T): asserts value is EncryptedValue {
  if (!isEncryptedValue(value)) {
    throw new Error(`Invalid field "${String(field)}": expected an EncryptedValue to decrypt.`);
  }
}

/**
 * Generator that yields each field from `fieldMap` that is present in `obj`,
 * together with its current value and mapped key name.
 *
 * @typeParam T - Shape of the source object.
 * @param obj - Source object to read field values from.
 * @param fieldMap - {@link BulkFieldMap} listing the fields to iterate.
 * @yields One entry per mapped field that exists on `obj`, containing the
 *   field key, its current value, and the mapped key name.
 */
function* iterateMappedFields<T>(
  obj: T,
  fieldMap: BulkFieldMap<T>,
): Generator<{ field: keyof T; value: unknown; keyName: EncryptionKey | string }> {
  const entries = Object.entries(fieldMap) as Array<[keyof T, EncryptionKey | string]>;
  for (const [field, keyName] of entries) {
    if (field in (obj as object)) {
      yield { field, value: (obj as Record<string, unknown>)[field as string], keyName };
    }
  }
}

/**
 * Encrypt every string field listed in `fieldMap` under its mapped key name,
 * returning a shallow-cloned object with those fields replaced by
 * {@link EncryptedValue}.
 *
 * Fields absent from `obj` are silently skipped; fields present but non-string
 * throw a descriptive error. The input object is never mutated.
 *
 * @typeParam T - Shape of the object being transformed.
 * @param params - {@link BulkOperationParams} carrying the crypto instance,
 *   source object, and per-field key map.
 * @returns A shallow clone of `params.obj` with mapped string fields replaced
 *   by their {@link EncryptedValue} payloads.
 * @throws {Error} when a mapped field is present but not a string.
 *
 * @example
 * ```ts
 * const customer = { email: 'a@b.com', name: 'Ana', id: 42 };
 * const encrypted = encryptObjectFields({
 *   crypto,
 *   obj: customer,
 *   fieldMap: { email: EncryptionKey.PII, name: EncryptionKey.PII },
 * });
 * // encrypted.email is an EncryptedValue; encrypted.id === 42
 * ```
 *
 * @see {@link decryptObjectFields} — inverse operation.
 * @see {@link SecureCrypto.encryptObject} — facade that delegates here.
 */
export function encryptObjectFields<T>(params: BulkOperationParams<T>): T {
  const { crypto, obj, fieldMap } = params;
  const clone = { ...(obj as Record<string, unknown>) } as T;
  for (const { field, value, keyName } of iterateMappedFields(obj, fieldMap)) {
    assertStringValue(value, field);
    clone[field] = crypto.encrypt(value, keyName) as T[keyof T];
  }
  return clone;
}

/**
 * Decrypt every {@link EncryptedValue} field listed in `fieldMap`, returning a
 * shallow-cloned object with those fields replaced by their plaintext strings.
 *
 * The map's key-name values are ignored during decryption — each
 * {@link EncryptedValue} carries its own `keyName` and `version`. Fields absent
 * from `obj` are silently skipped; fields present but not shaped like an
 * {@link EncryptedValue} throw a descriptive error. The input object is never
 * mutated.
 *
 * @typeParam T - Shape of the object being transformed.
 * @param params - {@link BulkOperationParams} carrying the crypto instance,
 *   source object, and per-field key map.
 * @returns A shallow clone of `params.obj` with mapped {@link EncryptedValue}
 *   fields replaced by their decrypted plaintext strings.
 * @throws {Error} when a mapped field is present but not an {@link EncryptedValue}.
 *
 * @example
 * ```ts
 * const plaintext = decryptObjectFields({
 *   crypto,
 *   obj: encrypted,
 *   fieldMap: { email: EncryptionKey.PII, name: EncryptionKey.PII },
 * });
 * // plaintext.email === 'a@b.com'; plaintext.id === 42
 * ```
 *
 * @see {@link encryptObjectFields} — inverse operation.
 * @see {@link SecureCrypto.decryptObject} — facade that delegates here.
 */
export function decryptObjectFields<T>(params: BulkOperationParams<T>): T {
  const { crypto, obj, fieldMap } = params;
  const clone = { ...(obj as Record<string, unknown>) } as T;
  for (const { field, value } of iterateMappedFields(obj, fieldMap)) {
    assertEncryptedValue(value, field);
    clone[field] = crypto.decrypt(value) as T[keyof T];
  }
  return clone;
}
