# Code Review Fix Plan — Task 1 Advanced Cryptographic Features

- **Date:** 2026-07-09
- **Reviewed plan:** `.kilo/plans/20260709-task1-advanced-crypto.md`
- **Branch:** `feat/phase4-advanced-features`
- **Reviewer finding:** Build, lint, and all tests pass. `src/utils/decryption-cache.ts` is already at 100% coverage.

---

## Findings Summary

| File | Plan Target | Current State | Gap |
|---|---|---|---|
| `src/crypto.service.bulk.ts` | 100% statement/branch coverage | 96.29% statements, 85.71% branches (uncovered line 82, branch `BRDA:81,4,0`) | Missing test for `decryptObjectFields` absent-field skip. |
| `src/crypto.service.ts` | ≤198 lines | 199 lines | One line over the planned budget. |
| `src/crypto.service.bulk.ts` | Match approved plan's clean casts | Uses extra `Record<string, unknown>` / `field as string` casts | Deviates from approved plan, reduces readability. |

---

## Top 3 Issues

1. **Uncovered `decryptObjectFields` absent-field skip branch.** `tests/crypto.bulk.spec.ts` covers the skip path for `encryptObjectFields` but not for `decryptObjectFields`. As a result, line 82 (`continue`) and branch `BRDA:81,4,0` in `src/crypto.service.bulk.ts` are never executed, failing the plan's 100% coverage gate.

2. **`src/crypto.service.ts` exceeds its line-budget target.** The file is 199 lines, one over the plan's ≤198 target. The module-level JSDoc comment for `AVAILABLE_KEYS` on line 24 is redundant (the variable name is self-documenting) and can be removed safely.

3. **`src/crypto.service.bulk.ts` uses unnecessarily verbose type casts.** The implementation deviates from the approved plan by casting `obj` to `Record<string, unknown>` and `field` to `string` on every access. The casts can be simplified to `{ ...obj }`, `obj[field] as string`, and `obj[field] as unknown as EncryptedValue`, keeping only the required `(obj as object)` cast for the `in` operator (generic `T` is not constrained to `object`).

---

## Fix Steps

### Step 1 — Add missing `decryptObject` absent-field coverage

**File:** `tests/crypto.bulk.spec.ts`

Insert the following test immediately after the existing test at lines 83-89 (`'throws when a decrypt field is present but not an EncryptedValue'`):

```ts
  it('skips fields listed for decrypt but absent from the object', () => {
    const partial = { name: 'John' } as Person;
    const encryptedPartial = crypto.encryptObject(partial, { name: EncryptionKey.PII });
    const fieldMap = { name: EncryptionKey.PII, email: EncryptionKey.PII };

    const decrypted = crypto.decryptObject(encryptedPartial, fieldMap);

    expect(decrypted.name).toBe('John');
    expect(decrypted.email).toBeUndefined();
  });
```

**Verification:** `npm run test` must report `src/crypto.service.bulk.ts` at 100% statements, branches, functions, and lines.

---

### Step 2 — Trim `src/crypto.service.ts` to ≤198 lines

**File:** `src/crypto.service.ts`

Remove the redundant module-level JSDoc comment at line 24:

```ts
/** Module-level constant derived from the static enum, avoiding per-instance allocation. */
```

The `const AVAILABLE_KEYS: string[] = Object.values(EncryptionKey);` line remains directly after the import block. This reduces the file from 199 to 198 lines.

---

### Step 3 — Simplify casts in `src/crypto.service.bulk.ts`

**File:** `src/crypto.service.bulk.ts`

Replace the body of `encryptObjectFields` (current lines 56-68) with:

```ts
export function encryptObjectFields<T>(params: BulkOperationParams<T>): T {
  const { crypto, obj, fieldMap } = params;
  const clone = { ...obj } as T;
  const entries = Object.entries(fieldMap) as Array<[keyof T, EncryptionKey | string]>;
  for (const [field, keyName] of entries) {
    if (!(field in (obj as object))) {
      continue;
    }
    assertStringFieldValue(obj, field);
    clone[field] = crypto.encrypt(obj[field] as string, keyName) as T[keyof T];
  }
  return clone;
}
```

Replace the body of `decryptObjectFields` (current lines 76-88) with:

```ts
export function decryptObjectFields<T>(params: BulkOperationParams<T>): T {
  const { crypto, obj, fieldMap } = params;
  const clone = { ...obj } as T;
  const entries = Object.entries(fieldMap) as Array<[keyof T, EncryptionKey | string]>;
  for (const [field] of entries) {
    if (!(field in (obj as object))) {
      continue;
    }
    assertEncryptedFieldValue(obj, field);
    clone[field] = crypto.decrypt(obj[field] as unknown as EncryptedValue) as T[keyof T];
  }
  return clone;
}
```

**Rationale:** The simplified form was verified to compile with `npm run build` under the project's strict TypeScript settings (`strict`, `noUncheckedIndexedAccess`). The `(obj as object)` cast is still required because `T` is not constrained to `object`, and the `in` operator requires an object right-hand side.

---

## Verification Gates

After applying the fixes, the following must pass before the task is considered resolved:

- `npm run build` — zero TypeScript errors.
- `npm run lint` — zero ESLint errors/warnings on touched files.
- `npm run test` — all tests pass; `src/crypto.service.bulk.ts` and `src/utils/decryption-cache.ts` both report 100% statement/branch/function/line coverage; global thresholds are maintained.
- `src/crypto.service.ts` line count is ≤198.

No `.gitignore`-matching files should be staged; all changes remain on `feat/phase4-advanced-features`.
