/**
 * Shared test helpers for crypto module unit tests.
 *
 * Reduces assertion duplication across spec files by providing reusable
 * assertion functions for common validation patterns.
 */

/**
 * Assert that a function throws `expected a string` for common non-string value
 * types: number, null, undefined, and plain object.
 *
 * @param act - Function that accepts a value of any type and performs an
 *   operation expected to throw when the value is not a string.
 */
export function expectStringRejection(
  act: (value: unknown) => unknown,
): void {
  expect(() => act(123)).toThrow(/expected a string/);
  expect(() => act(null)).toThrow(/expected a string/);
  expect(() => act(undefined)).toThrow(/expected a string/);
  expect(() => act({})).toThrow(/expected a string/);
}
