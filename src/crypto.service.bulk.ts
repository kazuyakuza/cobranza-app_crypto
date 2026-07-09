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

/** Whether a value is shaped like an {@link EncryptedValue} (object with string `encryptedData`). */
function isEncryptedValue(value: unknown): value is EncryptedValue {
  return typeof value === 'object'
    && value !== null
    && typeof (value as EncryptedValue).encryptedData === 'string';
}

/** Throw when a field listed for encryption is present but not a string. */
function assertStringFieldValue<T>(obj: T, field: keyof T): void {
  const value = obj[field];
  if (typeof value !== 'string') {
    throw new Error(`Invalid field "${String(field)}": expected a string to encrypt.`);
  }
}

/** Throw when a field listed for decryption is present but not an EncryptedValue. */
function assertEncryptedFieldValue<T>(obj: T, field: keyof T): void {
  const value = obj[field];
  if (!isEncryptedValue(value)) {
    throw new Error(`Invalid field "${String(field)}": expected an EncryptedValue to decrypt.`);
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
  const entries = Object.entries(fieldMap) as Array<[keyof T, EncryptionKey | string]>;
  for (const [field, keyName] of entries) {
    if (!(field in (obj as object))) {
      continue;
    }
    assertStringFieldValue(obj, field);
    clone[field] = crypto.encrypt((obj as Record<string, unknown>)[field as string] as string, keyName) as T[keyof T];
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
  const entries = Object.entries(fieldMap) as Array<[keyof T, EncryptionKey | string]>;
  for (const [field] of entries) {
    if (!(field in (obj as object))) {
      continue;
    }
    assertEncryptedFieldValue(obj, field);
    clone[field] = crypto.decrypt((obj as Record<string, unknown>)[field as string] as unknown as EncryptedValue) as T[keyof T];
  }
  return clone;
}
