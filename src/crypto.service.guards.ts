/**
 * Input-validation guards for {@link module:crypto.service}.
 *
 * Extracts validation helpers from `crypto.service.ts` to keep that file under
 * the 200-line source file limit. Contains {@link assertValidEncryptedValue},
 * {@link assertValidPlaintext}, {@link assertValidHash}, and internal helpers
 * for base64/length validation (length + encoding checks per TODO Task 3).
 *
 * @module crypto.service.guards
 */

import type { EncryptedValue } from '@cobranza-apps/entities';

/** Maximum allowed plaintext UTF-8 byte length (mitigates oversized-input DoS). */
const MAX_PLAINTEXT_BYTES = 1_000_000;

/** Maximum allowed encryptedData base64 string length (rejected before decoding). */
const MAX_ENCRYPTED_DATA_LENGTH_CHARS = 2_000_000;

/** Strict standard-alphabet base64 (with optional padding) validation pattern. */
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** The only supported encryption algorithm. */
const SUPPORTED_ALGORITHM = 'aes-256-gcm';

/**
 * Assert that a value is a string.
 *
 * @param value - Value to check.
 * @param fieldName - Human-readable field name used in the error message.
 * @throws {Error} when `value` is not a string.
 */
function assertString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}: expected a string.`);
  }
}

/**
 * Check whether a value is a positive integer.
 *
 * @param value - Value to check.
 * @returns `true` when `value` is a positive integer.
 */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Assert that a version value is a positive integer or undefined.
 *
 * @param version - Version value to validate.
 * @throws {Error} when `version` is present but not a positive integer.
 */
function assertValidVersion(version: unknown): void {
  if (version === undefined) return;
  if (!isPositiveInteger(version)) {
    throw new Error('Invalid version: expected a positive integer or undefined.');
  }
}

/**
 * Assert that an algorithm value is `'aes-256-gcm'` or undefined.
 *
 * @param algorithm - Algorithm value to validate.
 * @throws {Error} when `algorithm` is present but not `'aes-256-gcm'`.
 */
function assertValidAlgorithm(algorithm: unknown): void {
  if (algorithm === undefined) return;
  if (algorithm !== SUPPORTED_ALGORITHM) {
    throw new Error(
      `Invalid algorithm: expected '${SUPPORTED_ALGORITHM}' or undefined.`,
    );
  }
}

/**
 * Assert that a value is non-empty, throwing a descriptive error for the field.
 *
 * @param value - Value to check.
 * @param fieldName - Human-readable field name used in the error message.
 * @throws {Error} when `value` is falsy.
 */
function assertNonEmpty(value: unknown, fieldName: string): void {
  if (!value) {
    throw new Error(`Invalid ${fieldName}: expected a non-empty string.`);
  }
}

/**
 * Assert that a string is valid standard base64.
 *
 * @param value - String to validate.
 * @param fieldName - Human-readable field name used in the error message.
 * @throws {Error} when `value` is not valid base64.
 */
function assertValidBase64(value: string, fieldName: string): void {
  if (!BASE64_PATTERN.test(value)) {
    throw new Error(`Invalid ${fieldName}: expected a valid base64 string.`);
  }
}

/**
 * Assert that a plaintext is within the allowed UTF-8 byte length.
 *
 * Empty plaintext is permitted (it is a valid encrypt/hash input).
 *
 * @param plaintext - Plaintext to validate.
 * @throws {Error} when the UTF-8 byte length exceeds {@link MAX_PLAINTEXT_BYTES}.
 */
export function assertValidPlaintext(plaintext: string): void {
  assertString(plaintext, 'plaintext');
  const byteLength = Buffer.byteLength(plaintext, 'utf8');
  if (byteLength > MAX_PLAINTEXT_BYTES) {
    throw new Error(
      `Invalid plaintext: length ${byteLength} bytes exceeds maximum ${MAX_PLAINTEXT_BYTES} bytes.`,
    );
  }
}

/**
 * Assert that an expected hash is a non-empty, valid base64 string.
 *
 * @param expectedHash - Hash to validate.
 * @throws {Error} when `expectedHash` is empty or not valid base64.
 */
export function assertValidHash(expectedHash: string): void {
  assertNonEmpty(expectedHash, 'expectedHash');
  assertValidBase64(expectedHash, 'expectedHash');
}

/**
 * Assert that encryptedData is within the length limit and valid base64.
 *
 * @param encryptedData - Base64 `IV + ciphertext + authTag` string to validate.
 * @throws {Error} when too long or not valid base64.
 */
function assertEncryptedDataFormat(encryptedData: string): void {
  if (encryptedData.length > MAX_ENCRYPTED_DATA_LENGTH_CHARS) {
    throw new Error(
      `Invalid encryptedData: length ${encryptedData.length} chars exceeds maximum ${MAX_ENCRYPTED_DATA_LENGTH_CHARS} chars.`,
    );
  }
  assertValidBase64(encryptedData, 'encryptedData');
}

/**
 * Validate that an {@link EncryptedValue} carries the fields required to decrypt.
 *
 * @param encryptedValue - Payload to check.
 * @throws {Error} when `encryptedValue`, `encryptedData`, or `keyName` is missing,
 *   or when `encryptedData` is too long or not valid base64.
 */
export function assertValidEncryptedValue(encryptedValue: EncryptedValue): void {
  if (!encryptedValue) {
    throw new Error('Invalid encryptedValue: expected an EncryptedValue object.');
  }
  assertString(encryptedValue.encryptedData, 'encryptedData');
  assertString(encryptedValue.keyName, 'keyName');
  assertValidVersion(encryptedValue.version);
  assertValidAlgorithm(encryptedValue.algorithm);
  assertNonEmpty(encryptedValue.encryptedData, 'encryptedData');
  assertNonEmpty(encryptedValue.keyName, 'keyName');
  assertEncryptedDataFormat(encryptedValue.encryptedData);
}
