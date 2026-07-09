# Task 4 Code Simplification Plan

## Scope

- `src/testing/test-vectors.ts`
- `src/testing/index.ts`
- `tests/crypto.cache-wrapper.spec.ts`

Behavior must remain unchanged; only readability, duplication, and naming are addressed.

## 1. `src/testing/test-vectors.ts`

### 1.1 Add a `createCacheFixture` factory

`CACHE_FIXTURE` repeats `expectedSizeAfterMiss: 1` and `expectedSizeAfterHit: 1` for every entry. Extract a factory that defaults these values:

```ts
function createCacheFixture(
  plaintext: string,
  keyName: EncryptionKey,
  ttlMs: number,
  expectedSizeAfterMiss = 1,
  expectedSizeAfterHit = 1,
): CacheFixtureShape {
  return {
    plaintext,
    keyName,
    ttlMs,
    expectedSizeAfterMiss,
    expectedSizeAfterHit,
  };
}
```

Replace the array literals:

```ts
export const CACHE_FIXTURE: readonly CacheFixtureShape[] = [
  createCacheFixture('cache-probe-pii', EncryptionKey.PII, 1000),
  createCacheFixture('cache-probe-bank', EncryptionKey.BANK_DATA, 1),
];
```

This removes duplicated constants and keeps the fixture focused on the variable data (`plaintext`, `keyName`, `ttlMs`).

### 1.2 Add a typed factory for re-encryption scenarios

`RE_ENCRYPT_SCENARIOS` is currently an untyped `as const` array. Add an explicit interface and a small factory to clarify the shape and remove positional raw-object noise:

```ts
export interface ReEncryptScenario {
  readonly plaintext: string;
  readonly keyName: EncryptionKey;
  readonly fromVersion: number;
  readonly toVersion: number;
}

function createReEncryptScenario(
  plaintext: string,
  keyName: EncryptionKey,
  fromVersion: number,
  toVersion: number,
): ReEncryptScenario {
  return { plaintext, keyName, fromVersion, toVersion };
}

export const RE_ENCRYPT_SCENARIOS: readonly ReEncryptScenario[] = [
  createReEncryptScenario('rotate-me', EncryptionKey.PII, 1, 2),
  createReEncryptScenario('switch-category', EncryptionKey.NOTIFICATION, 1, 1),
  createReEncryptScenario('escalate-tier', EncryptionKey.GENERAL, 2, 3),
] as const;
```

### 1.3 Do **not** share a single factory between `CACHE_FIXTURE` and `RE_ENCRYPT_SCENARIOS`

Both fixtures share `plaintext` and `keyName`, but their remaining fields and semantic purposes differ (cache TTL/sizes vs. version rotation). A shared factory would force optional, loosely-typed parameters and obscure each fixture's intent. Two small, domain-specific factories are the simpler choice.

## 2. `src/testing/index.ts`

### 2.1 Collapse `buildTestCrypto` conditional

The current implementation branches only to avoid overwriting `currentVersion` with `undefined`:

```ts
export function buildTestCrypto(version?: number): SecureCrypto {
  if (version === undefined) {
    return new SecureCrypto(TEST_CRYPTO_CONFIG);
  }
  return new SecureCrypto({ ...TEST_CRYPTO_CONFIG, currentVersion: version });
}
```

Simplify to a single constructor call using nullish coalescing:

```ts
export function buildTestCrypto(version?: number): SecureCrypto {
  return new SecureCrypto({
    ...TEST_CRYPTO_CONFIG,
    currentVersion: version ?? TEST_CRYPTO_CONFIG.currentVersion,
  });
}
```

This removes the `if` block and the duplicated `new SecureCrypto(...)` call without changing behavior.

### 2.2 Re-export the new `ReEncryptScenario` type

After `ReEncryptScenario` is added to `test-vectors.ts`, re-export it from `index.ts` alongside `CacheFixtureShape`:

```ts
export type {
  TestVector,
  CacheFixtureShape,
  ReEncryptScenario,
} from './test-vectors.js';
```

## 3. `tests/crypto.cache-wrapper.spec.ts`

### 3.1 Parameterize the TTL validation tests

The two tests for invalid `ttlMs` are identical except for the input value. Collapse them with `it.each`:

```ts
it.each([0, NaN])('throws when ttlMs is %p (delegated to TtlCache)', (ttlMs) => {
  expect(() => createDecryptionCacheWrapper(createFakeDecryptor(), { ttlMs })).toThrow(
    /positive finite number/,
  );
});
```

This removes the duplicated test body.

### 3.2 Remove redundant default-options test

`it('uses the default TTL when options are omitted')` only verifies that `withCache()` populates the cache to size 1. The first test in the same describe block already uses `withCache()` with no options and asserts both the decrypted value and `size() === 1`. Delete the redundant test to reduce noise and runtime.

### 3.3 (Optional) Inline `createFakeDecryptor`

`createFakeDecryptor` is used once. Inlining it into the TTL validation test removes a helper with no reuse, but the helper name does express intent. Treat this as optional; apply only if the team prefers fewer one-off helpers.

## Top 3 Simplification Opportunities

1. **Parameterize the TTL validation tests** in `tests/crypto.cache-wrapper.spec.ts` with `it.each([0, NaN])` to eliminate the duplicated test body.
2. **Add a `createCacheFixture` factory** in `src/testing/test-vectors.ts` with defaulted size assertions, removing the repeated `expectedSizeAfterMiss: 1, expectedSizeAfterHit: 1` pairs.
3. **Collapse `buildTestCrypto`** in `src/testing/index.ts` into a single `new SecureCrypto(...)` call using `version ?? TEST_CRYPTO_CONFIG.currentVersion`, removing the conditional branch and duplicate constructor invocation.
