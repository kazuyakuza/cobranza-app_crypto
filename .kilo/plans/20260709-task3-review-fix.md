# Task 3 Code Review — Fix Plan

**Date:** 2026-07-09  
**Branch:** `feat/phase4-advanced-features`  
**Reviewed plan:** `.kilo/plans/20260709-task3-security-hardening.md`  
**Scope:** Step 4.3 (Code Review & Simplification) of the Critical Workflow.

---

## Executive Summary

Implementation is functionally correct and all tests pass with 100% coverage. Two issues require fixes before the task can be considered clean:

1. **`src/crypto.service.bulk.ts` exceeds the 200-line source-file limit** (210 lines).
2. **`assertValidHash` does not apply a runtime `typeof` guard** to `expectedHash`, so non-string inputs fail with inconsistent error messages.

The extraction of bulk helpers also requires a `.agent/project-structure.md` update per the project-structure rule.

---

## Issue 1 — `src/crypto.service.bulk.ts` exceeds 200 lines

### Finding

`src/crypto.service.bulk.ts` is **210 lines** total, violating the `max-lines-per-file` rule (`src/` files must not exceed 200 lines). The plan assumed the file would stay near 198 lines, but the added `assertFieldMap`/`assertSourceObject` helpers pushed it over the limit.

### Fix

Extract the type predicates and field assertions into a new helper module `src/crypto.service.bulk-guards.ts`. This keeps `crypto.service.bulk.ts` focused on orchestration and restores compliance.

### Exact changes

#### 1.1 Create `src/crypto.service.bulk-guards.ts`

Move lines 64–105 of `src/crypto.service.bulk.ts` into the new file:

```ts
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

import type { EncryptionKey } from './config.js';
import type { BulkFieldMap } from './crypto.service.bulk.js';

/** Whether a value is a non-null object. */
export function isNonNullObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

/** Whether a non-null object has a string `encryptedData` property (i.e. is an EncryptedValue). */
export function hasStringEncryptedData(value: object): value is EncryptedValue {
  return typeof (value as EncryptedValue).encryptedData === 'string';
}

/** Whether a value is shaped like an {@link EncryptedValue} (object with string `encryptedData`). */
export function isEncryptedValue(value: unknown): value is EncryptedValue {
  return isNonNullObject(value) && hasStringEncryptedData(value);
}

/** Assert that a value is a string. */
export function assertStringValue<T>(value: unknown, field: keyof T): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid field "${String(field)}": expected a string to encrypt.`);
  }
}

/** Assert that a value is an EncryptedValue. */
export function assertEncryptedValue<T>(value: unknown, field: keyof T): asserts value is EncryptedValue {
  if (!isEncryptedValue(value)) {
    throw new Error(`Invalid field "${String(field)}": expected an EncryptedValue to decrypt.`);
  }
}

/** Assert that a field map is a non-null object. */
export function assertFieldMap<T>(fieldMap: BulkFieldMap<T>): asserts fieldMap is BulkFieldMap<T> {
  if (typeof fieldMap !== 'object' || fieldMap === null) {
    throw new Error('Invalid fieldMap: expected a non-null object.');
  }
}

/** Assert that a source object is a non-null object. */
export function assertSourceObject<T>(obj: T): asserts obj is T {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Invalid obj: expected a non-null object.');
  }
}
```

#### 1.2 Update `src/crypto.service.bulk.ts`

- Add import near the top (after the `SecureCrypto` import):

  ```ts
  import {
    assertEncryptedValue,
    assertFieldMap,
    assertSourceObject,
    assertStringValue,
  } from './crypto.service.bulk-guards.js';
  ```

- Delete the local definitions of `isNonNullObject`, `hasStringEncryptedData`, `isEncryptedValue`, `assertStringValue`, `assertEncryptedValue`, `assertFieldMap`, and `assertSourceObject` (current lines 64–105).

Expected result: `src/crypto.service.bulk.ts` shrinks to approximately **169 lines**, restoring the ≤200-line compliance.

#### 1.3 Update `.agent/project-structure.md`

Update the `src/` bullet to mention the new bulk-guards module:

```text
- src/ - library root: main exports, config interfaces, SecureCrypto facade, HKDF derivation, helpers, mixins (encryption/hashing/keys/validation/guards, facade entry guards crypto.service.facade-guards.ts, bulk object-operations mixin crypto.service.bulk.ts, bulk field guards crypto.service.bulk-guards.ts, audit notifier crypto.service.audit.ts), and AuditLogger interface (audit.ts)
```

---

## Issue 2 — `assertValidHash` lacks a runtime type guard

### Finding

`SecureCrypto.verifyHash(plaintext, expectedHash)` delegates to `verifyHmacSha256`, which calls `assertValidHash(expectedHash)`. `assertValidHash` currently runs `assertNonEmpty` then `assertValidBase64`; it never checks `typeof expectedHash === 'string'`.

Consequences:
- `null` / `undefined` / `''` / `0` fail with `expected a non-empty string`.
- Numbers like `123` fail with `expected a valid base64 string`.
- Objects fail with `expected a valid base64 string`.

This is inconsistent with the runtime `typeof` guards added everywhere else and makes the trust boundary less uniform.

### Fix

Add `assertString` at the start of `assertValidHash` so non-string `expectedHash` always produces `Invalid expectedHash: expected a string.`

### Exact changes

#### 2.1 Update `src/crypto.service.guards.ts`

Change `assertValidHash` from:

```ts
export function assertValidHash(expectedHash: string): void {
  assertNonEmpty(expectedHash, 'expectedHash');
  assertValidBase64(expectedHash, 'expectedHash');
}
```

to:

```ts
export function assertValidHash(expectedHash: string): void {
  assertString(expectedHash, 'expectedHash');
  assertNonEmpty(expectedHash, 'expectedHash');
  assertValidBase64(expectedHash, 'expectedHash');
}
```

> `assertString` is already defined as a private helper in the same file (lines 33–37).

#### 2.2 Add regression test in `tests/crypto.input-validation.spec.ts`

Append a new `describe` block after the existing `assertValidEncryptedValue` tests:

```ts
describe('assertValidHash — runtime type guard', () => {
  it('throws when expectedHash is not a string', () => {
    expect(() => assertValidHash(123 as unknown as string)).toThrow(/expected a string/);
    expect(() => assertValidHash(null as unknown as string)).toThrow(/expected a string/);
    expect(() => assertValidHash(undefined as unknown as string)).toThrow(/expected a string/);
    expect(() => assertValidHash({} as unknown as string)).toThrow(/expected a string/);
  });
});
```

---

## Verification Steps

After applying the fixes, run:

```bash
npm run build
npm run lint
npm test -- --coverage
```

Expected outcomes:
- `npm run build` passes with no TypeScript errors.
- `npm run lint` passes.
- All 240+ tests pass.
- Coverage remains 100% on `src/crypto.service.bulk.ts`, `src/crypto.service.bulk-guards.ts`, `src/crypto.service.guards.ts`, `src/crypto.service.encryption.ts`, `src/crypto.service.facade-guards.ts`, and `src/crypto.service.ts`.
- `src/crypto.service.bulk.ts` total line count is ≤200.

---

## Top 3 Issues Found

1. **`src/crypto.service.bulk.ts` is 210 lines**, exceeding the `max-lines-per-file` rule. Fix by extracting bulk guards to `src/crypto.service.bulk-guards.ts`.
2. **`assertValidHash` does not guard `typeof expectedHash === 'string'`**, producing inconsistent error messages for non-string hash inputs.
3. **`.agent/project-structure.md` must be updated** to document the new `crypto.service.bulk-guards.ts` module (project-structure rule).
