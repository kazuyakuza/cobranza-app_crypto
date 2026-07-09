# Code Review: Task 1 — Complete SecureCrypto Implementation

- **Source TODO**: `.agent/todos/20260707/20260707-todo-2.md` → Task 1
- **Implementation plan**: `.kilo/plans/20260708-task1-securecrypto-impl.md`
- **Date**: 2026-07-08
- **Reviewer role**: Code Reviewer (Critical Workflow 4.3)
- **Scope**: `src/crypto.service.ts`, `src/crypto.service.encryption.ts`, `src/crypto.service.hashing.ts`, `src/crypto.service.validation.ts`, `src/hkdf.ts`, `src/utils.ts`, `tests/crypto.service.spec.ts`

---

## Executive Summary

The implementation is functionally correct and secure in its cryptographic operations. AES-256-GCM usage, HMAC-SHA256 usage, key derivation, and error handling all follow the approved plan and security best practices. Build (`tsc`), tests (`jest`), and lint (`eslint`) all pass.

One **must-fix** project-rule violation exists: `src/crypto.service.ts` exceeds the 200-line source-file limit. The plan already identified this contingency; extracting two private helpers resolves it cleanly.

---

## Findings

### Must-fix

#### 1. `src/crypto.service.ts` exceeds the 200-line file limit

- **Severity**: Must-fix
- **Rule**: `.kilo/rules/max-lines-per-file.md` — source files in `src/` must not exceed 200 lines.
- **File**: `src/crypto.service.ts`
- **Lines**: 1–221 (221 lines total)
- **Details**: The orchestrator grew to 221 lines after adding JSDoc and public method implementations. The implementation plan §4/§9 noted this contingency.
- **Required action**: Extract `deriveKeyForCategory` and `assertValidEncryptedValue` into a new helper module (e.g., `src/crypto.service.keys.ts` or `src/crypto.service.guards.ts`) so `crypto.service.ts` drops below 200 lines. See Fix Plan §1 below.

---

### Should-fix

#### 2. No explicit cleanup of cached derived keys

- **Severity**: Should-fix
- **File**: `src/crypto.service.ts`
- **Lines**: 66 (`derivedKeysCache`), 89–105 (`deriveKeyForCategory`)
- **Details**: Derived key `Buffer`s are cached for the lifetime of the `SecureCrypto` instance. The plan §7 explicitly deferred a `destroy()` method. Adding one would let callers zero derived keys when the instance is no longer needed, better satisfying the TODO's "clean up when possible" requirement.
- **Required action**: Add a public `destroy(): void` method that iterates the cache, fills each `Buffer` with zeros, and clears the map. Re-run tests/build.

#### 3. `hkdf.ts` uses an empty HKDF salt

- **Severity**: Should-fix (design note)
- **File**: `src/hkdf.ts`
- **Lines**: 22 (`EMPTY_SALT`), 79–85 (`hkdfSync` call)
- **Details**: HKDF is invoked with `salt = Buffer.alloc(0)`. This is cryptographically acceptable (RFC 5869 allows zero-length salt), but a non-empty random salt would improve domain separation. The brief/plan specify this design, so changing it is not required for Task 1. Flag for future hardening if the master key ever rotates.
- **Required action**: None for Task 1; document as future hardening in Task 4/5 docs if desired.

#### 4. `base64ToBuffer` does not reject invalid base64 characters

- **Severity**: Should-fix (low)
- **File**: `src/utils.ts`
- **Lines**: 22–27
- **Details**: `Buffer.from(value, 'base64')` silently ignores invalid characters. For decryption, malformed base64 will either fail the length check or fail GCM authentication, so it does not create a security hole. However, stricter validation would make error handling more predictable.
- **Required action**: Optional — add base64 character-set validation in `base64ToBuffer`. Not required for Task 1 because auth-tag verification already fails closed.

---

### Nit

#### 5. Hash verification compares base64 strings instead of raw digest bytes

- **Severity**: Nit
- **File**: `src/crypto.service.hashing.ts`
- **Lines**: 50–53
- **Details**: `verifyHmacSha256` recomputes the base64 digest and compares strings with `constantTimeCompare`. This is safe because HMAC output is uniform and the base64 encoding is deterministic. Comparing raw `Buffer`s would be marginally more idiomatic but provides no practical security advantage here.
- **Required action**: None.

#### 6. `decrypt` does not validate the `algorithm` field

- **Severity**: Nit
- **File**: `src/crypto.service.ts`
- **Lines**: 155–160
- **Details**: The `EncryptedValue.algorithm` field is written on encrypt but ignored on decrypt. This matches the plan's explicit decision (plan §3.6) because post-quantum algorithm rotation is out of Task 1 scope.
- **Required action**: None for Task 1; add algorithm validation when a second algorithm is introduced.

---

## Security Assessment

| Area | Status | Notes |
|---|---|---|
| AES-256-GCM key length | OK | HKDF produces 32 bytes; `createCipheriv` receives 32-byte key. |
| AES-256-GCM IV | OK | 12-byte random IV per encryption via `generateIv(12)`. |
| AES-256-GCM authTag | OK | 16-byte tag appended; verified via `setAuthTag` + `final()`. |
| IV reuse | OK | Random IV per call; collision probability negligible. |
| Payload format | OK | `IV(12) + ciphertext + authTag(16)` as specified. |
| Decrypt error handling | OK | Auth failure rethrows a generic, non-sensitive message. |
| HMAC algorithm | OK | `sha256` with decoded `hashSalt` >= 32 bytes. |
| HMAC verification | OK | `constantTimeCompare` uses `crypto.timingSafeEqual`. |
| Key derivation cache | OK | Caches by `${keyName}:v${version}`; reduces master-key decoding. |
| Master key in memory | OK | Stored as immutable base64 string; decoded transiently on cache miss. |
| `process.env` reads | OK | None inside the library; config is caller-supplied. |
| Sensitive data logging | OK | No `console.log`; error messages reveal no plaintext/key bytes. |

---

## TypeScript / Build Assessment

| Check | Result |
|---|---|
| `npm run build` | Passed (0 errors, strict mode enabled). |
| `npm test` | Passed (12/12 Phase 1 tests). |
| `npm run lint` | Passed (0 errors/warnings). |
| `exactOptionalPropertyTypes` | OK — `EncryptedValue` always sets `algorithm` and `version`. |
| `noUncheckedIndexedAccess` | OK — no indexed access used. |
| `consistent-type-imports` | OK — type-only imports use `import type`. |
| Stale `@ts-expect-error` | Removed as required. |

---

## Plan Adherence Assessment

| Plan Step | Status | Notes |
|---|---|---|
| Step 1 — Strengthen `hashSalt` validation | Done | `MIN_HASH_SALT_LENGTH_BYTES = 32` enforced. |
| Step 2 — AES-256-GCM primitives module | Done | `src/crypto.service.encryption.ts` matches plan. |
| Step 3 — HMAC-SHA256 primitives module | Done | `src/crypto.service.hashing.ts` matches plan. |
| Step 4 — Rewrite orchestrator | Done with deviation | All methods implemented; file is 221 lines (must-fix). |
| Step 5 — Barrel / structure | Done | No changes to `index.ts` or project-structure.md. |
| Step 6 — Build gate | Passed | |
| Step 7 — Test gate | Passed | Phase 1 suite green. |
| Step 8 — Lint gate | Passed | |
| Step 9 — Commit | Not in scope | To be handled by Implementer in 4.3-fix / 4.6. |

---

## Fix Plan

### Fix 1 — Extract helpers to bring `src/crypto.service.ts` under 200 lines

**Goal**: Reduce `src/crypto.service.ts` to ≤ 200 lines by extracting `deriveKeyForCategory` and `assertValidEncryptedValue`.

**Approach**:

1. Create `src/crypto.service.keys.ts`.
2. Move `deriveKeyForCategory` logic there as a standalone exported function that receives `resolvedConfig`, `derivedKeysCache`, `keyName`, and `version` via a single params object (keeps function arity at 1, satisfying max-args rule).
3. Move `assertValidEncryptedValue` to `src/crypto.service.guards.ts` as a standalone exported function.
4. Update `src/crypto.service.ts`:
   - Import the two helpers.
   - Replace the private methods with calls to the helpers.
   - Remove the `EMPTY_KEY_NAME_ERROR` constant if it moves with `deriveKeyForCategory`, or keep it shared in `crypto.service.ts`.
5. Re-run `npm run build`, `npm test`, `npm run lint`.
6. Estimated resulting line count for `crypto.service.ts`: ~195 lines.

**Suggested new file `src/crypto.service.keys.ts` (illustrative)**:

```ts
import { deriveKey } from './hkdf.js';
import type { ResolvedConfig } from './crypto.service.validation.js';

const EMPTY_KEY_NAME_ERROR = 'Invalid keyName: must be a non-empty string.';

export interface DeriveKeyForCategoryParams {
  readonly keyName: string;
  readonly version: number;
  readonly resolvedConfig: ResolvedConfig;
  readonly derivedKeysCache: Map<string, Buffer>;
}

export function deriveKeyForCategory(params: DeriveKeyForCategoryParams): Buffer {
  const { keyName, version, resolvedConfig, derivedKeysCache } = params;
  if (!keyName) {
    throw new Error(EMPTY_KEY_NAME_ERROR);
  }
  const cacheKey = `${keyName}:v${version}`;
  const cachedKey = derivedKeysCache.get(cacheKey);
  if (cachedKey) {
    return cachedKey;
  }
  const derivedKeyBuffer = deriveKey({
    masterKey: resolvedConfig.masterKey,
    keyName,
    version,
  });
  derivedKeysCache.set(cacheKey, derivedKeyBuffer);
  return derivedKeyBuffer;
}
```

**Suggested new file `src/crypto.service.guards.ts` (illustrative)**:

```ts
import type { EncryptedValue } from '@cobranza-apps/entities';

export function assertValidEncryptedValue(encryptedValue: EncryptedValue): void {
  if (!encryptedValue) {
    throw new Error('Invalid encryptedValue: expected an EncryptedValue object.');
  }
  if (!encryptedValue.encryptedData) {
    throw new Error('Invalid encryptedValue: encryptedData is required.');
  }
  if (!encryptedValue.keyName) {
    throw new Error('Invalid encryptedValue: keyName is required.');
  }
}
```

**Updated call sites in `src/crypto.service.ts`**:

```ts
import { assertValidEncryptedValue } from './crypto.service.guards.js';
import { deriveKeyForCategory } from './crypto.service.keys.js';

// in encrypt():
const key = deriveKeyForCategory({
  keyName: resolvedKeyName,
  version: this.resolvedConfig.currentVersion,
  resolvedConfig: this.resolvedConfig,
  derivedKeysCache: this.derivedKeysCache,
});

// in decrypt():
this.assertValidEncryptedValue(encryptedValue);
const version = encryptedValue.version ?? this.resolvedConfig.currentVersion;
const key = deriveKeyForCategory({
  keyName: encryptedValue.keyName,
  version,
  resolvedConfig: this.resolvedConfig,
  derivedKeysCache: this.derivedKeysCache,
});
```

### Fix 2 — Optional `destroy()` method for explicit key cleanup

**Goal**: Provide a way to zero cached derived-key `Buffer`s.

**Approach**:

1. In `src/crypto.service.ts`, add:

```ts
/**
 * Zero cached derived keys and clear the derivation cache.
 *
 * @remarks Best-effort cleanup; the instance must not be used after calling.
 */
destroy(): void {
  for (const key of this.derivedKeysCache.values()) {
    key.fill(0);
  }
  this.derivedKeysCache.clear();
}
```

2. Add a unit test asserting the method does not throw and that subsequent operations re-derive keys.

**Note**: This is flagged as should-fix; if time is constrained, Fix 1 alone unblocks the workflow.

---

## Verification After Fixes

- [ ] `src/crypto.service.ts` ≤ 200 lines.
- [ ] `npm run build` passes.
- [ ] `npm test` passes (12/12 Phase 1 tests).
- [ ] `npm run lint` passes.
- [ ] No new security regressions introduced.

---

## Review Output

- **Review file**: `.kilo/plans/20260708-task1-review.md`
- **Must-fix issues**: 1 (file length in `src/crypto.service.ts`).
- **Should-fix issues**: 3 (explicit `destroy()`, HKDF salt, base64 strictness).
- **Nits**: 2 (base64 hash comparison, algorithm field validation).
- **Build/Test/Lint**: All green before fixes.
