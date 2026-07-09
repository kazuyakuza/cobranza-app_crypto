# Simplification Plan — Task 5: Final Quality & Build (4.3)

- **Task**: Task 5 — 4.3 Code Simplification
- **Scope**: `src/crypto.service.ts`, `src/crypto.service.encryption.ts`, `src/utils.ts`, `src/testing/test-vectors.ts`, `src/testing/encrypted-shape.ts`, `src/hkdf.ts`, `src/hkdf.types.ts`, `tests/crypto.hashing.spec.ts`
- **Date**: 2026-07-09
- **Goal**: Remove duplicated constants, consolidate tiny single-use files, reduce unnecessary indirection, and fix a misleading test discovered during review. Preserve 100% test coverage and a clean build/lint pass.

## Review Findings

### 1. `src/hkdf.types.ts` — single-use type file

`DeriveKeyParams` is imported only by `src/hkdf.ts`. Keeping it in a separate file adds an extra module and an import for a type that has no other consumers.

**Action**: Move the `DeriveKeyParams` interface into `src/hkdf.ts`; delete `src/hkdf.types.ts`.

**Before** (`src/hkdf.types.ts`):
```ts
export interface DeriveKeyParams {
  readonly masterKey: string;
  readonly keyName: string;
  readonly version?: number;
}
```

**After** (`src/hkdf.ts`):
```ts
export interface DeriveKeyParams {
  readonly masterKey: string;
  readonly keyName: string;
  readonly version?: number;
}
```

### 2. Duplicated cryptographic length constants

The same AES-256-GCM length constants are defined in three places:
- `src/utils.ts`: `IV_LENGTH_BYTES = 12`
- `src/crypto.service.encryption.ts`: `IV_LENGTH_BYTES = 12`, `AUTH_TAG_LENGTH_BYTES = 16`
- `src/testing/test-vectors.ts`: `IV_LENGTH_BYTES = 12`, `AUTH_TAG_LENGTH_BYTES = 16`

**Action**: Treat `src/utils.ts` as the canonical owner for these low-level crypto constants, export them, and import them in the other two files.

**`src/utils.ts`**:
```ts
export const IV_LENGTH_BYTES = 12;
export const AUTH_TAG_LENGTH_BYTES = 16;
```

**`src/crypto.service.encryption.ts`**: remove local definitions and import from `./utils.js`.

**`src/testing/test-vectors.ts`**: remove local definitions and import from `../utils.js`.

### 3. `src/testing/encrypted-shape.ts` — over-modularized matcher

Four one-line helper functions (`algorithmMatches`, `keyNameMatches`, `versionMatches`, `payloadLengthMatches`) wrap trivial equality checks. The indirection makes the matcher harder to follow than a single expression.

**Action**: Inline the checks inside `encryptedMatchesShape` and delete the helper functions.

**After**:
```ts
export function encryptedMatchesShape(params: EncryptedMatchParams): boolean {
  const { encrypted, vector } = params;
  const shape = vector.expectedEncryptedShape;

  return encrypted.algorithm === shape.algorithm
    && encrypted.keyName === shape.keyName
    && (encrypted.version ?? vector.version) === shape.version
    && Buffer.from(encrypted.encryptedData, 'base64').length === shape.encryptedDataByteLength;
}
```

### 4. `src/crypto.service.ts` — `availableKeys` can be module-level

`availableKeys` is derived from the static `EncryptionKey` enum, so it never changes per instance. It is currently an instance field initialized on every construction.

**Action**: Move it to a module-level constant and reference it from `hasKey`/`getAvailableKeys`.

**After**:
```ts
const AVAILABLE_KEYS = Object.values(EncryptionKey);

export class SecureCrypto {
  // ... existing fields ...

  hasKey(keyName: string): boolean {
    return AVAILABLE_KEYS.includes(keyName);
  }

  getAvailableKeys(): string[] {
    return [...AVAILABLE_KEYS];
  }
}
```

### 5. `src/crypto.service.ts` — split validation import

`ResolvedConfig` (type) and `resolveConfig` (value) are imported from the same file on separate lines.

**Action**: Combine into one import statement using inline `type`.

**After**:
```ts
import { resolveConfig, type ResolvedConfig } from './crypto.service.validation.js';
```

### 6. `tests/crypto.hashing.spec.ts` — misleading wrong-salt test

The test titled `returns false when verifying with a wrong salt (different instance)` asserts `toBe(true)` using the **same** `crypto` instance. It does not test a different salt and does not return false.

**Action**: Fix the test to create a second `SecureCrypto` instance with a different `hashSalt` and verify the hash from the first instance fails verification.

**After**:
```ts
it('returns false when verifying with a wrong salt (different instance)', () => {
  const cryptoA = getTestCrypto();
  const differentSalt = Buffer.alloc(64, 1).toString('base64');
  const cryptoB = new SecureCrypto({ ...TEST_CRYPTO_CONFIG, hashSalt: differentSalt });
  const hash = cryptoA.hash('wrong-salt-test');

  expect(cryptoB.verifyHash('wrong-salt-test', hash)).toBe(false);
});
```

## Verified Non-Issues (No Action)

- **Max lines per file**: All affected files remain under the 200-line limit after changes.
- **Max lines per method**: All method bodies remain under 50 lines.
- **Max depth**: No method exceeds 2 levels of nesting.
- **Max arguments**: All functions continue to use ≤2 parameters or param objects.
- **`MASTER_KEY_LENGTH_BYTES` duplication**: Defined in both `crypto.service.validation.ts` and `hkdf.ts`, but these are separate layers (config validation vs. low-level derivation). Sharing would create an awkward cross-layer dependency; keep independent.
- **`SecureCryptoTestProvider` alias**: Kept for brief §6 naming parity.
- **`getTestCrypto()` alias**: Convenience wrapper with distinct JSDoc; keep.
- **Security primitives**: AES-256-GCM, HMAC-SHA256, HKDF, and constant-time comparison remain unchanged.
- **No commented-out code**: None found.

## Implementation Plan

1. **Consolidate `hkdf.types.ts` into `hkdf.ts`**
   - Move `DeriveKeyParams` interface into `src/hkdf.ts`.
   - Remove `import type { DeriveKeyParams } from './hkdf.types.js';` from `src/hkdf.ts`.
   - Delete `src/hkdf.types.ts`.

2. **Centralize AES-256-GCM constants in `src/utils.ts`**
   - Export `IV_LENGTH_BYTES` and `AUTH_TAG_LENGTH_BYTES` from `src/utils.ts`.
   - Import and use them in `src/crypto.service.encryption.ts` instead of local definitions.
   - Import and use them in `src/testing/test-vectors.ts` instead of local definitions.

3. **Simplify `src/testing/encrypted-shape.ts`**
   - Inline the four match helpers into `encryptedMatchesShape`.
   - Delete `algorithmMatches`, `keyNameMatches`, `versionMatches`, and `payloadLengthMatches`.

4. **Move `availableKeys` to module scope in `src/crypto.service.ts`**
   - Define `const AVAILABLE_KEYS = Object.values(EncryptionKey);` at module level.
   - Remove the `private readonly availableKeys` field.
   - Update `hasKey` and `getAvailableKeys` to use `AVAILABLE_KEYS`.

5. **Combine validation imports in `src/crypto.service.ts`**
   - Replace the two-line import with a single inline-type import.

6. **Fix wrong-salt test in `tests/crypto.hashing.spec.ts`**
   - Add imports for `SecureCrypto` and `TEST_CRYPTO_CONFIG` from `../src/index.js` / `../src/testing/index.js`.
   - Rewrite the test to use a second instance with a different salt and assert `false`.

## Verification Steps (for 4.3-fix implementer)

1. Apply changes 1–6.
2. Run `npm run build` — must compile cleanly with zero diagnostics.
3. Run `npm run lint` — must exit 0 with zero warnings.
4. Run `npm test` — all tests must pass; coverage thresholds must still be met.
5. Confirm `src/hkdf.types.ts` is removed and no file imports from it.
6. Confirm `dist/` is regenerated and gitignored (do not commit `dist/`).

## Risk Assessment

- **Deleting `hkdf.types.ts`**: LOW — type is only consumed by `hkdf.ts`; no public API change.
- **Moving constants to `utils.ts`**: LOW — pure relocation; behavior unchanged.
- **Inlining `encryptedMatchesShape` checks**: LOW — equivalent logic, fewer functions.
- **Module-level `AVAILABLE_KEYS`**: LOW — avoids per-instance allocation; defensive copy preserved in `getAvailableKeys`.
- **Import style change**: LOW — no runtime effect.
- **Fixing wrong-salt test**: LOW-MEDIUM — changes a previously incorrect assertion to match its intent; confirms an important security property.

## Out of Scope

- No changes to `README.md` or `docs/` (handled in Task 4).
- No new features or public API additions.
- No version bump.
- No changes to `package.json` scripts or config.
- No merge or commit actions beyond the 4.3-fix scope.
