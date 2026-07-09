# Code Review: Advanced Features (Task 3) — Step 4.3

**Date:** 2026-07-09
**Plan reviewed:** `.kilo/plans/20260709-task3-advanced-features.md`
**TODO:** `.agent/todos/20260707/20260707-todo-3.md` → Task 3
**Implementation commit:** `0cefb0f feat(crypto): add TTL decryption cache utility, reEncrypt helper, and input validation hardening`

---

## Verdict

**PASS with minor fix recommendations.**

The implementation matches the approved plan, fulfills the TODO requirements, and passes the full build/test/lint pipeline with 100 % coverage. The issues found are low-severity robustness or documentation items; none block acceptance.

---

## Verification Results

| Check | Result |
|---|---|
| `npm run build` | ✅ Clean (`dist/utils/cache.*` emitted) |
| `npm run test` | ✅ 171 passed, 9 suites, 100 % statements/branches/functions/lines |
| `npm run lint` | ✅ Clean |
| `src/utils/cache.ts` coverage | ✅ 100 % |
| `src/crypto.service.ts` ≤ 200 lines | ✅ 197 lines |
| `src/crypto.service.guards.ts` ≤ 200 lines | ✅ 108 lines |
| `src/crypto.service.encryption.ts` ≤ 200 lines | ✅ 102 lines |
| `src/crypto.service.hashing.ts` ≤ 200 lines | ✅ 57 lines |
| `src/utils/cache.ts` ≤ 200 lines | ✅ 130 lines |

---

## Plan Adherence

| Plan Item | Status | Notes |
|---|---|---|
| Create `src/utils/cache.ts` with `TtlCache`, `DecryptionCache`, `createDecryptionCache` | ✅ | Matches plan code block exactly. |
| Re-export cache from `src/index.ts` | ✅ | `TtlCache`, `createDecryptionCache`, and type exports added. |
| Extend `src/crypto.service.guards.ts` | ✅ | `assertValidPlaintext`, `assertValidHash`, base64/length checks added; existing messages preserved. |
| Add plaintext validation to `encryptWithAesGcm` | ✅ | Guard placed after destructure. |
| Add validation to `computeHmacSha256` / `verifyHmacSha256` | ✅ | Plaintext and expectedHash validated. |
| Add `reEncrypt` to facade | ✅ | Signature matches TODO exactly; class `@example` condensed to keep file ≤ 200 lines. |
| Update `.agent/project-structure.md` | ✅ | `src/utils/` documented. |
| Create `tests/utils.cache.spec.ts` | ✅ | Covers every method/branch. |
| Create `tests/crypto.input-validation.spec.ts` | ✅ | Direct guard + public-method validation tests. |
| Create `tests/crypto.reencrypt.spec.ts` | ✅ | Covers roundtrip, version, keyName, errors. |
| Update `tests/crypto.internals.spec.ts` | ✅ | `'AAA'` → `'AAAA'`. |
| Update `tests/crypto.hashing.spec.ts` | ✅ | Wrong hash → valid base64; empty hash → throw. |

---

## Detailed Findings

### 1. `reEncrypt` JSDoc uses invalid `{@link}` targets (minor)

**Location:** `src/crypto.service.ts`, line 159

```ts
/** Decrypt {@link encrypted} and re-encrypt the recovered plaintext at the current key version, optionally under {@link newKeyName}. */
```

`encrypted` and `newKeyName` are parameter names, not symbols. TypeDoc/JSDoc will produce unresolved-link warnings. The rest of the codebase uses `{@link}` only for actual exported symbols.

**Recommended fix:** rewrite without `{@link}` or add `@param` tags and link to `EncryptedValue`:

```ts
/**
 * Decrypt an encrypted value and re-encrypt the recovered plaintext at the
 * current key version, optionally under a new key name.
 *
 * @param encrypted - Payload previously produced by {@link encrypt}.
 * @param newKeyName - Optional target key name; defaults to `encrypted.keyName`.
 */
```

---

### 2. `TtlCache` does not reject `NaN` TTL values (minor robustness)

**Locations:** `src/utils/cache.ts`, lines 50–54 and 63–67

`if (options.defaultTtlMs <= 0)` and `if (params.ttlMs <= 0)` are false for `NaN`. A `NaN` TTL causes `expiresAt` to become `NaN`, so `isExpired` always returns false and entries never expire. This undermines the TTL contract and the "no unbounded growth" security expectation.

**Recommended fix:** add finite/number validation:

```ts
if (!Number.isFinite(options.defaultTtlMs) || options.defaultTtlMs <= 0) {
  throw new Error('Invalid defaultTtlMs: must be a positive finite number.');
}
```

and equivalently for `setWithTtl`. Add tests for `NaN`, `Infinity`, and `-Infinity`.

---

### 3. `TtlCache.has()` treats stored `undefined` as missing (minor generic correctness)

**Location:** `src/utils/cache.ts`, lines 84–86

```ts
has(key: K): boolean {
  return this.get(key) !== undefined;
}
```

If a generic `TtlCache<K, undefined>` is used, `has` incorrectly returns `false` for present entries. This does not affect `DecryptionCache` (`V = string`), but it violates the generic contract.

**Recommended fix:** check `Map.has` plus expiry explicitly:

```ts
has(key: K): boolean {
  const entry = this.entries.get(key);
  if (!entry) {
    return false;
  }
  if (this.isExpired(entry)) {
    this.entries.delete(key);
    return false;
  }
  return true;
}
```

---

### 4. Cache lacks a hard max-size bound (security caveat)

**Location:** `src/utils/cache.ts`

The cache relies on TTL and lazy/proactive eviction but has no maximum entry count. A caller that inserts many unique keys within the TTL window can grow memory unboundedly. The cache is opt-in (Decision B), so the risk is consumer-controlled, but the public API should document the limit.

**Recommended fix:** Either:

- (a) add a configurable `maxSize` with LRU eviction, or
- (b) document the caveat in `README.md` and `src/index.ts` JSDoc: "The cache grows with unique keys until entries expire; callers should size TTLs to their memory budget."

Option (b) is sufficient for the current scope and keeps the utility simple.

---

### 5. `src/index.ts` public API table omits new exports (documentation)

**Location:** `src/index.ts`, lines 6–11 and 29–31

The JSDoc API table and the methods list do not mention `TtlCache`, `createDecryptionCache`, `DecryptionCache`, or the new `reEncrypt` method. The README/docs update in step 4.4 should cover this, but the entrypoint JSDoc should also stay current.

**Recommended fix:** add rows to the table and update the methods paragraph:

```ts
 * | {@link TtlCache} | class | Generic in-memory TTL cache |
 * | {@link createDecryptionCache} | function | Factory for a string-to-string decryption cache |
 * | {@link DecryptionCache} | type | Alias for `TtlCache<string, string>` |
```

---

## Fix Plan

The following changes are recommended before final acceptance. Each is isolated and low-risk.

1. **`src/crypto.service.ts`**
   - Replace the single-line `reEncrypt` JSDoc with a proper multi-line JSDoc including `@param` tags and a valid `{@link EncryptedValue}` reference.

2. **`src/utils/cache.ts`**
   - Update constructor and `setWithTtl` TTL validation to reject `NaN`/`Infinity`/`-Infinity`.
   - Refactor `has()` to use `Map.has` + explicit expiry check so stored `undefined` values are handled correctly.

3. **`tests/utils.cache.spec.ts`**
   - Add tests for `NaN`, `Infinity`, and `-Infinity` default TTL and per-entry TTL.
   - Add a test proving `has()` returns `true` for a present entry when the value is `undefined` (use a generic `TtlCache<string, undefined>`).

4. **`src/index.ts`**
   - Update the exported API table and the methods paragraph to include `TtlCache`, `createDecryptionCache`, `DecryptionCache`, and `reEncrypt`.

5. **Documentation (step 4.4 responsibility)**
   - Add a cache security note to `README.md` clarifying that the cache is opt-in and bounded by TTL, not by a hard size limit.

---

## Security Assessment

- **Input validation:** plaintext length, encryptedData base64/length, and expectedHash base64/non-empty are correctly enforced.
- **Fail-closed:** `verifyHash` now throws on malformed `expectedHash` instead of returning `false`; documented and tested.
- **Cache:** TTL eviction works; lazy eviction on read and proactive `purgeExpired` are implemented. No hard size cap is present (see Finding 4).
- **`reEncrypt`:** correctly decrypts at the stored version and re-encrypts at the current version, preserving or switching `keyName` as requested.

---

## Conclusion

The Task 3 implementation is complete, correct, and covered. Apply the five minor fixes above for full polish, then proceed to step 4.4 (documentation updates).
