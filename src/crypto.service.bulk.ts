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

/** Per-field key mapping for bulk operations; only listed keys are transformed. */
export type BulkFieldMap<T> = Partial<Record<keyof T, EncryptionKey | string>>;

/** Inputs for {@link encryptObjectFields} and {@link decryptObjectFields}. */
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
 * returning a shallow-cloned object with those fields replaced by EncryptedValue.
 * Fields absent from `obj` are skipped; fields present but non-string throw.
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
 * Decrypt every EncryptedValue field listed in `fieldMap`, returning a shallow-
 * cloned object with those fields replaced by their plaintext strings. The map's
 * key-name values are ignored; each EncryptedValue carries its own keyName.
 * Fields absent from `obj` are skipped; fields present but non-EncryptedValue throw.
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
