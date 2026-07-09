/**
 * Type predicates and runtime guards for {@link module:crypto.service.bulk}.
 *
 * Extracted so `crypto.service.bulk.ts` remains under the 200-line source file
 * limit. These helpers validate `fieldMap`, source objects, and per-field
 * values before bulk encryption / decryption proceeds.
 *
 * @module crypto.service.bulk-guards
 */

import type { EncryptedValue } from '@cobranza-apps/entities';

import type { BulkFieldMap } from './crypto.service.bulk.js';

/** Whether a value has `typeof 'object'`. */
function hasObjectType(value: unknown): boolean {
  return typeof value === 'object';
}

/** Whether a value is not null. */
function isNotNull(value: unknown): boolean {
  return value !== null;
}

/** Whether a value is a non-null object. */
function isNonNullObject(value: unknown): value is object {
  return hasObjectType(value) && isNotNull(value);
}

/** Whether a non-null object has a string `encryptedData` property. */
function hasStringEncryptedData(value: object): value is EncryptedValue {
  return typeof (value as EncryptedValue).encryptedData === 'string';
}

/** Whether a value is shaped like an {@link EncryptedValue} (object with string `encryptedData`). */
function isEncryptedValue(value: unknown): value is EncryptedValue {
  return isNonNullObject(value) && hasStringEncryptedData(value);
}

/**
 * Assert that a field value is a string suitable for encryption.
 *
 * Used by {@link module:crypto.service.bulk | bulk encryption} to validate
 * each mapped field before it reaches `encryptWithAesGcm`.
 *
 * @typeParam T - Entity type whose fields are being encrypted.
 * @param value - Runtime value of the field (from the source object).
 * @param field - Property key being validated (used in the error message).
 * @throws {Error} when `value` is not a string.
 */
export function assertStringValue<T>(value: unknown, field: keyof T): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid field "${String(field)}": expected a string to encrypt.`);
  }
}

/**
 * Assert that a field value is a valid {@link EncryptedValue} suitable for decryption.
 *
 * Checks that the value is a non-null object with a string `encryptedData`
 * property — the minimum shape required by `decryptWithAesGcm`.
 *
 * @typeParam T - Entity type whose fields are being decrypted.
 * @param value - Runtime value of the field (from the source object).
 * @param field - Property key being validated (used in the error message).
 * @throws {Error} when `value` is not an {@link EncryptedValue}.
 */
export function assertEncryptedValue<T>(
  value: unknown,
  field: keyof T,
): asserts value is EncryptedValue {
  if (!isEncryptedValue(value)) {
    throw new Error(`Invalid field "${String(field)}": expected an EncryptedValue to decrypt.`);
  }
}

/**
 * Assert that a {@link BulkFieldMap} is a non-null object.
 *
 * The `fieldMap` maps entity property keys to encryption key names.
 * This guard prevents `null` / `undefined` / primitive values from reaching
 * the per-field iteration logic.
 *
 * @typeParam T - Entity type whose fields are mapped.
 * @param fieldMap - The field-to-key mapping to validate.
 * @throws {Error} when `fieldMap` is not a non-null object.
 */
export function assertFieldMap<T>(fieldMap: BulkFieldMap<T>): asserts fieldMap is BulkFieldMap<T> {
  if (!isNonNullObject(fieldMap)) {
    throw new Error('Invalid fieldMap: expected a non-null object.');
  }
}

/**
 * Assert that a source object is a non-null object.
 *
 * Used by bulk encrypt / decrypt to reject `null`, `undefined`, and primitive
 * arguments before field iteration begins.
 *
 * @typeParam T - Entity type of the source object.
 * @param obj - The source object to validate.
 * @throws {Error} when `obj` is not a non-null object.
 */
export function assertSourceObject<T>(obj: T): asserts obj is T {
  if (!isNonNullObject(obj)) {
    throw new Error('Invalid obj: expected a non-null object.');
  }
}
