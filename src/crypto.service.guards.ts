/**
 * Input-validation guards for {@link module:crypto.service}.
 *
 * Extracts validation helpers from `crypto.service.ts` to keep that file under
 * the 200-line source file limit. Contains {@link assertValidEncryptedValue}
 * and its internal {@link assertPresent} helper.
 *
 * @module crypto.service.guards
 */

import type { EncryptedValue } from '@cobranza-apps/entities';

/**
 * Assert that a value is truthy, throwing a descriptive error for the field.
 *
 * @param value - Value to check.
 * @param fieldName - Human-readable field name used in the error message.
 * @throws {Error} when `value` is falsy.
 */
function assertPresent(value: unknown, fieldName: string): void {
  if (!value) {
    throw new Error(`Invalid encryptedValue: ${fieldName} is required.`);
  }
}

/**
 * Validate that an {@link EncryptedValue} carries the fields required to decrypt.
 *
 * @param encryptedValue - Payload to check.
 * @throws {Error} when `encryptedValue`, `encryptedData`, or `keyName` is missing.
 */
export function assertValidEncryptedValue(encryptedValue: EncryptedValue): void {
  if (!encryptedValue) {
    throw new Error('Invalid encryptedValue: expected an EncryptedValue object.');
  }
  assertPresent(encryptedValue.encryptedData, 'encryptedData');
  assertPresent(encryptedValue.keyName, 'keyName');
}
