# Task 3 Code Simplification Plan

## Scope

Review the files created/modified during Task 3 (security hardening) implementation and reduce complexity without changing behavior.

Files reviewed:

- `src/crypto.service.facade-guards.ts`
- `src/crypto.service.guards.ts`
- `src/crypto.service.encryption.ts`
- `src/crypto.service.ts`
- `src/crypto.service.bulk.ts`
- `tests/crypto.security.spec.ts`
- `tests/crypto.input-validation.spec.ts`

## Simplification 1 — Extract a common `assertString` helper in facade guards

**File:** `src/crypto.service.facade-guards.ts`

`assertPlaintextInput` and `assertKeyNameInput` are identical except for the field name and error message. Introduce a private `assertString(value, fieldName)` helper and reuse it. Keep the existing public function signatures and exported assertions unchanged.

Current:

```ts
export function assertPlaintextInput(plaintext: unknown): asserts plaintext is string {
  if (typeof plaintext !== 'string') {
    throw new Error('Invalid plaintext: expected a string.');
  }
}

export function assertKeyNameInput(keyName: unknown): asserts keyName is string {
  if (typeof keyName !== 'string') {
    throw new Error('Invalid keyName: expected a string.');
  }
}
```

Proposed:

```ts
function assertString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}: expected a string.`);
  }
}

export function assertPlaintextInput(plaintext: unknown): asserts plaintext is string {
  assertString(plaintext, 'plaintext');
}

export function assertKeyNameInput(keyName: unknown): asserts keyName is string {
  assertString(keyName, 'keyName');
}
```

For `assertOptionalKeyName`, preserve the current `string | undefined` error message. Refactor the compound condition to comply with the single-section boolean rule (see Simplification 2).

## Simplification 2 — Fix single-section boolean condition violations

**Files:** `src/crypto.service.facade-guards.ts`, `src/crypto.service.guards.ts`, `src/crypto.service.bulk.ts`

Per `.kilo/rules/single-section-boolean-conditions.md`, compound conditions must be extracted into descriptively named helpers.

### `src/crypto.service.facade-guards.ts`

Refactor `assertOptionalKeyName`:

```ts
function isValidOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

export function assertOptionalKeyName(
  keyName: unknown,
): asserts keyName is string | undefined {
  if (!isValidOptionalString(keyName)) {
    throw new Error('Invalid keyName: expected a string or undefined.');
  }
}
```

### `src/crypto.service.guards.ts`

Refactor `isPositiveInteger`:

```ts
function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

function isInteger(value: number): boolean {
  return Number.isInteger(value);
}

function isGreaterThanZero(value: number): boolean {
  return value > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNumber(value) && isInteger(value) && isGreaterThanZero(value);
}
```

### `src/crypto.service.bulk.ts`

Refactor `isNonNullObject`, `assertFieldMap`, and `assertSourceObject`.

Introduce:

```ts
function hasObjectType(value: unknown): boolean {
  return typeof value === 'object';
}

function isNotNull(value: unknown): boolean {
  return value !== null;
}
```

Then:

```ts
function isNonNullObject(value: unknown): value is object {
  return hasObjectType(value) && isNotNull(value);
}

function assertFieldMap<T>(fieldMap: BulkFieldMap<T>): asserts fieldMap is BulkFieldMap<T> {
  if (!isNonNullObject(fieldMap)) {
    throw new Error('Invalid fieldMap: expected a non-null object.');
  }
}

function assertSourceObject<T>(obj: T): asserts obj is T {
  if (!isNonNullObject(obj)) {
    throw new Error('Invalid obj: expected a non-null object.');
  }
}
```

## Simplification 3 — Inline `zeroBuffer`

**File:** `src/crypto.service.encryption.ts`

`zeroBuffer` is only called inside `decryptWithAesGcm`. Inlining removes a single-use helper while preserving the best-effort cleanup behavior. `Buffer.fill(0)` is a no-op on empty buffers, so the `length > 0` guard is unnecessary.

Replace the two `zeroBuffer(...)` calls and the helper with direct `fill(0)` calls:

```ts
try {
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const result = plaintext.toString('utf8');
  plaintext.fill(0);
  payload.fill(0);
  return result;
} catch {
  payload.fill(0);
  throw new Error('Decryption failed: invalid authentication tag or corrupted ciphertext.');
}
```

## Simplification 4 — Consolidate duplicated test assertions

**Files:** `tests/crypto.security.spec.ts`, `tests/crypto.input-validation.spec.ts`

Both files assert non-string rejection for plaintext/keyName inputs. Extract a shared test helper in a new file or in an existing test utility to avoid repeating the same four `expect(...).toThrow(/expected a string/)` blocks.

**Option A (preferred):** Add a helper in `tests/test-helpers.ts` (or similar existing test utility):

```ts
export function expectStringRejection(
  act: (value: unknown) => unknown,
): void {
  expect(() => act(123)).toThrow(/expected a string/);
  expect(() => act(null)).toThrow(/expected a string/);
  expect(() => act(undefined)).toThrow(/expected a string/);
  expect(() => act({})).toThrow(/expected a string/);
}
```

Then replace inline assertions in both spec files, e.g.:

```ts
it('encrypt rejects non-string plaintext', () => {
  expectStringRejection((v) => crypto.encrypt(v as string, EncryptionKey.PII));
});
```

**Option B:** If creating a new helper file is undesirable, parametrize the existing tests with an array of invalid inputs and a single assertion per spec.

Also, `crypto.security.spec.ts` tests version `0` and unsupported algorithm through the public `decrypt` method. These cases are already exhaustively covered in `crypto.input-validation.spec.ts` under `assertValidEncryptedValue`. Reduce the security spec test to a single integration sanity check (one invalid version case) or remove it to avoid duplication.

## Simplification 5 — Use a `Set` for known-key lookup

**File:** `src/crypto.service.ts`

`AVAILABLE_KEYS` is used only for `hasKey` and `getAvailableKeys`. Converting it to a `Set` makes `hasKey` O(1) and slightly clarifies intent.

```ts
const AVAILABLE_KEYS = new Set<string>(Object.values(EncryptionKey));

hasKey(keyName: string): boolean {
  return AVAILABLE_KEYS.has(keyName);
}

getAvailableKeys(): string[] {
  return [...AVAILABLE_KEYS];
}
```

Ensure `src/crypto.service.ts` remains at or below 200 source lines after the change.

## Verification

1. Run the unit test suite: `npm test` or equivalent project command.
2. Confirm `src/crypto.service.ts` line count is ≤ 200.
3. Confirm no behavior change: error messages remain identical, and all existing tests pass without modification except for the intended test refactorings.
