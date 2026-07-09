# Simplification Plan: Task 3 — Advanced Features

- **Date:** 2026-07-09
- **TODO:** `.agent/todos/20260707/20260707-todo-3.md` → Task 3, step 4.3
- **Plan path:** `.kilo/plans/20260709-task3-advanced-simplify.md`
- **Reviewed files:**
  - `src/utils/cache.ts`
  - `src/crypto.service.ts`
  - `src/crypto.service.guards.ts`
  - `src/crypto.service.encryption.ts`
  - `src/crypto.service.hashing.ts`
  - `tests/utils.cache.spec.ts`
  - `tests/crypto.input-validation.spec.ts`
  - `tests/crypto.reencrypt.spec.ts`

---

## Verdict: Simplifications Proposed

The implementation from step 4.2 is well-structured and respects all project constraints (file length, method length, nesting depth, parameter limits). Four focused simplifications are proposed to reduce duplication and boilerplate without changing behavior.

---

## Simplification 1 — DRY key derivation in `src/crypto.service.ts`

**Issue:** `encrypt()` and `decrypt()` both call `deriveKeyForCategory()` with the same two instance fields (`resolvedConfig`, `derivedKeysCache`).

**Change:** Add a private helper that encapsulates the repeated parameters.

```ts
private deriveKey(keyName: string, version: number): Buffer {
  return deriveKeyForCategory({
    keyName,
    version,
    resolvedConfig: this.resolvedConfig,
    derivedKeysCache: this.derivedKeysCache,
  });
}
```

**Then update:**

- `encrypt()`:
  ```ts
  const key = this.deriveKey(keyName, this.resolvedConfig.currentVersion);
  ```
- `decrypt()`:
  ```ts
  const version = encryptedValue.version ?? this.resolvedConfig.currentVersion;
  const key = this.deriveKey(encryptedValue.keyName, version);
  ```

**Impact:** Both public methods become shorter; the facade stays under 200 lines. No behavior change.

---

## Simplification 2 — Generic non-empty guard in `src/crypto.service.guards.ts`

**Issue:** `assertPresent()` is hardcoded to the `encryptedValue` context and used only inside `assertValidEncryptedValue()`. `assertValidHash()` duplicates the same falsy-check pattern with its own error message.

**Change:** Replace `assertPresent()` with a generic `assertNonEmpty(value, fieldName)` helper, and use it for both `encryptedValue` fields and `expectedHash`.

```ts
function assertNonEmpty(value: unknown, fieldName: string): void {
  if (!value) {
    throw new Error(`Invalid ${fieldName}: expected a non-empty string.`);
  }
}
```

**Then update:**

- `assertValidHash()`:
  ```ts
  assertNonEmpty(expectedHash, 'expectedHash');
  assertValidBase64(expectedHash, 'expectedHash');
  ```
- `assertValidEncryptedValue()`:
  ```ts
  assertNonEmpty(encryptedValue.encryptedData, 'encryptedData');
  assertNonEmpty(encryptedValue.keyName, 'keyName');
  assertEncryptedDataFormat(encryptedValue.encryptedData);
  ```

**Impact:** Removes a single-purpose helper and unifies empty-string validation. The error text for missing `encryptedData`/`keyName` changes slightly; verify/update tests if they assert the exact old `"is required"` text (current tests only assert the null-object message, so no update is required).

---

## Simplification 3 — Generic positive-number guard in `src/utils/cache.ts`

**Issue:** The constructor and `setWithTtl()` contain nearly identical `if (x <= 0)` validation blocks.

**Change:** Extract a private `assertPositive()` helper.

```ts
function assertPositive(value: number, fieldName: string): void {
  if (value <= 0) {
    throw new Error(`Invalid ${fieldName}: must be a positive number.`);
  }
}
```

**Then update:**

- Constructor: `assertPositive(options.defaultTtlMs, 'defaultTtlMs');`
- `setWithTtl()`: `assertPositive(params.ttlMs, 'ttlMs');`

**Impact:** Single source of truth for positive-number validation. File remains under 200 lines.

---

## Simplification 4 — Reduce repetitive test setup

### 4a. `tests/crypto.reencrypt.spec.ts`

**Issue:** Most tests repeat `const crypto = buildTestCrypto(1);` and many repeat `crypto.encrypt(..., EncryptionKey.PII)`.

**Change:** Introduce a describe-level `crypto` variable created in `beforeEach`, and a small helper for the common encryption pattern.

```ts
describe('SecureCrypto — reEncrypt', () => {
  let crypto: SecureCrypto;

  beforeEach(() => {
    crypto = buildTestCrypto(1);
  });

  const encrypt = (plaintext: string, keyName = EncryptionKey.PII): EncryptedValue =>
    crypto.encrypt(plaintext, keyName);

  it('roundtrips: decrypt(reEncrypt(encrypted)) equals the original plaintext', () => {
    expect(crypto.decrypt(crypto.reEncrypt(encrypt('rotate-me')))).toBe('rotate-me');
  });

  // ... remaining tests use crypto / encrypt helper where appropriate
});
```

**Impact:** Removes ~10 lines of repetitive setup. Tests that need `buildTestCrypto(2)` keep explicit calls.

### 4b. `tests/crypto.input-validation.spec.ts`

**Issue:** `getTestCrypto()` is called in every test inside the `SecureCrypto — public-method input validation` describe block.

**Change:** Use a describe-level variable created in `beforeEach`.

```ts
describe('SecureCrypto — public-method input validation', () => {
  let crypto: SecureCrypto;

  beforeEach(() => {
    crypto = getTestCrypto();
  });

  it('encrypt throws when plaintext exceeds the maximum length', () => {
    expect(() => crypto.encrypt(OVER_LIMIT_PLAINTEXT, EncryptionKey.PII)).toThrow(/exceeds maximum/);
  });

  // ... remaining tests
});
```

**Impact:** Removes repeated factory calls; no behavior change.

---

## Constraints Compliance After Changes

| Rule | Status |
|---|---|
| Max 200 lines/source file | All affected files remain ≤200 lines. |
| Max 50 lines/method | New helpers are <10 lines; no public method grows. |
| Max 2 params/method | `deriveKey(2)`, `assertNonEmpty(2)`, `assertPositive(2)` — all ≤2. |
| Max 2 nesting levels | No new nesting introduced. |
| Private members by default | New helpers are private/internal. |
| No behavior change | Refactoring only; test semantics preserved. |

---

## Verification Steps

1. Run `npm run build` — confirm no TypeScript errors.
2. Run `npm test` — confirm all tests pass, including updated test files.
3. Run `npm run lint` — confirm no lint errors.
4. Confirm coverage:
   - `src/utils/cache.ts` remains 100%.
   - `src/crypto.service.ts`, `src/crypto.service.guards.ts`, and modified files maintain 100%.
   - Global coverage remains ≥85%.

---

## Files to Modify

- `src/crypto.service.ts`
- `src/crypto.service.guards.ts`
- `src/utils/cache.ts`
- `tests/crypto.reencrypt.spec.ts`
- `tests/crypto.input-validation.spec.ts`

## Out of Scope

- No changes to public API signatures.
- No changes to validation limits, algorithms, or security semantics.
- No documentation updates (handled by step 4.4).
