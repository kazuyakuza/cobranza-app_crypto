/**
 * Runtime-type entry guards for the {@link SecureCrypto} public API.
 *
 * Extracted from {@link module:crypto.service} so that file stays under the
 * 200-line source file limit. Each guard enforces a `typeof` check at the
 * facade boundary — the trust boundary between untrusted callers and the
 * cipher/HMAC primitives.
 *
 * @remarks TypeScript guarantees are compile-time only; runtime checks prevent
 *   `any`-typed JSON payloads or `JSON.parse` results from reaching
 *   `Buffer.byteLength` / `createHmac` / `createCipheriv`.
 * @module crypto.service.facade-guards
 */

/**
 * Assert that a plaintext input is a string.
 *
 * @param plaintext - Value to check.
 * @throws {Error} when `plaintext` is not a string.
 */
export function assertPlaintextInput(plaintext: unknown): asserts plaintext is string {
  if (typeof plaintext !== 'string') {
    throw new Error('Invalid plaintext: expected a string.');
  }
}

/**
 * Assert that a keyName input is a string.
 *
 * @param keyName - Value to check.
 * @throws {Error} when `keyName` is not a string.
 */
export function assertKeyNameInput(keyName: unknown): asserts keyName is string {
  if (typeof keyName !== 'string') {
    throw new Error('Invalid keyName: expected a string.');
  }
}

/**
 * Assert that an optional keyName input is a string or undefined.
 *
 * @param keyName - Value to check.
 * @throws {Error} when `keyName` is present but not a string.
 */
export function assertOptionalKeyName(
  keyName: unknown,
): asserts keyName is string | undefined {
  if (keyName !== undefined && typeof keyName !== 'string') {
    throw new Error('Invalid keyName: expected a string or undefined.');
  }
}
