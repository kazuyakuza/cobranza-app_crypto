# Plan: Advanced Features (Task 3)

- **Date:** 2026-07-09
- **TODO:** `.agent/todos/20260707/20260707-todo-3.md` → Task 3
- **Plan path:** `.kilo/plans/20260709-task3-advanced-features.md`
- **Phase:** 3 — real-world integration / advanced utilities
- **Branch (already created in Critical Workflow step 2):** `feat/<descriptive-name>` (implementer confirms)
- **Version bump (step 3, separate sub-agent):** `0.3.0` → `0.3.1` (minor additions; implementer of step 3 decides patch vs minor)

---

## 1. Task Reference (verbatim requirements)

From `20260707-todo-3.md`, Task 3:

- [ ] Add optional in-memory decryption cache utility (with TTL) in `src/utils/cache.ts`.
- [ ] Implement `reEncrypt(encrypted: EncryptedValue, newKeyName?: string)` helper for manual key rotation support.
- [ ] Add input validation (length checks, encoding) in all public methods.

Caller-supplied scope for this plan (sub-task prompt):

- Add `src/utils/cache.ts` (TTL cache utility).
- Implement `reEncrypt` on `SecureCrypto` with the exact signature `reEncrypt(encrypted: EncryptedValue, newKeyName?: string)`.
- Add input validation (length + encoding) in all public methods.
- Constraints: max 200 lines/file, 50 lines/method, 2 nesting levels, 2 params max (use param objects), private members by default, self-documenting, no commented code, no runtime deps, 100% coverage on new source files, maintain existing tests/coverage.

---

## 2. Pre-Analysis & Architecture Decisions

### 2.1 Current State (verified)

- `SecureCrypto` facade in `src/crypto.service.ts` is **199 lines** (at the 200-line limit). Public methods: `encrypt`, `decrypt`, `hash`, `verifyHash`, `encryptAndHash`, `hasKey`, `getAvailableKeys`, `destroy`.
- Mixin files already extract primitives: `crypto.service.encryption.ts` (100 lines, `encryptWithAesGcm`/`decryptWithAesGcm`), `crypto.service.hashing.ts` (54 lines, `computeHmacSha256`/`verifyHmacSha256`), `crypto.service.keys.ts` (`deriveKeyForCategory`), `crypto.service.guards.ts` (38 lines, `assertValidEncryptedValue`), `crypto.service.validation.ts` (`resolveConfig`).
- `src/utils.ts` (80 lines) holds `base64ToBuffer`, `bufferToBase64`, `generateIv`, `concatBuffers`, `constantTimeCompare` + `IV_LENGTH_BYTES`/`AUTH_TAG_LENGTH_BYTES`. It is **internal** (not re-exported from `src/index.ts`).
- Existing validation: `deriveKeyForCategory` throws on empty `keyName`; `assertValidEncryptedValue` checks presence of `encryptedData`/`keyName`; `base64ToBuffer` checks non-empty only; `splitEncryptedPayload` checks min 28 bytes. **No** base64-encoding validation; **no** plaintext length limits.
- `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`, NodeNext module resolution. `.eslintrc.json`: `@typescript-eslint/recommended` + `jest/recommended`; `consistent-type-imports: warn`; no `no-explicit-any` rule.
- Jest `collectCoverageFrom`: `src/**/*.ts`, excludes `!src/testing/**`, `!src/index.ts`, `!src/nestjs/index.ts`, `!src/**/*.types.ts`. `src/utils/**` is **NOT** excluded → `src/utils/cache.ts` is coverage-tracked (must hit 100%). Global threshold 85%.
- Tests: 124 tests across `tests/` (incl. `tests/nestjs/`). Verified call-sites that constrain this plan:
  - `tests/crypto.internals.spec.ts` "accepts a fully-populated EncryptedValue" uses `encryptedData: 'AAA'` and expects `.not.toThrow()` — **'AAA' is NOT valid base64** (3 chars); adding base64 validation to `assertValidEncryptedValue` requires updating this to `'AAAA'`.
  - `tests/crypto.hashing.spec.ts`:
    - "returns false for a wrong expected hash" uses `'wrong-hash'` (invalid base64) expecting `false` — must change to a **valid base64** wrong hash to preserve the "returns false" intent once `verifyHash` validates encoding.
    - "returns false for an empty expected hash" uses `''` expecting `false` — must change to expect a throw once `verifyHash` validates presence.
    - "returns false for an expected hash of a different length (short-circuit)" uses `correct.slice(0, 4)` (valid 4-char base64) — **still passes** (base64-valid, then length short-circuit returns false). No change.
    - "differs by a single character" / "wrong salt" use valid base64 hashes — no change.
  - `tests/crypto.encrypt-decrypt.spec.ts`: "throws on invalid base64 encryptedData" uses `'!!!invalid-base64!!!'` expecting `.toThrow()` (no message) — **still passes** (now throws a base64 error). "throws on a malformed (truncated) payload" uses `Buffer.alloc(10).toString('base64')` (valid base64, 10 bytes) — **still passes** (base64-valid, then 28-byte min check). No changes needed there.
  - `tests/nestjs/*`: only normal roundtrips (valid base64, normal-length plaintext) — no breakage.

### 2.2 Architecture Decisions

**Decision A — `src/utils.ts` and `src/utils/` coexist (no move).**
The TODO mandates the path `src/utils/cache.ts`, which requires a `src/utils/` directory. Moving `src/utils.ts` → `src/utils/index.ts` would be cleaner BUT would break all existing `from './utils.js'` imports: under NodeNext, a specifier with a `.js` extension (`./utils.js`) resolves as a **file** (`utils.ts`), never falling back to a `utils/` directory. So a move would force updating 4 import sites (`crypto.service.encryption.ts`, `crypto.service.hashing.ts`, `testing/test-vectors.ts`, `tests/crypto.internals.spec.ts`) to `./utils/index.js` — unnecessary churn/risk on working, covered code. Coexistence is unambiguous: `./utils.js` → `utils.ts` (file); `./utils/cache.js` → `utils/cache.ts` (directory). The only downside is the minor smell of having both `utils.ts` and `utils/`; documented in `.agent/project-structure.md` with a note that a future refactor may consolidate. `src/utils/cache.ts` imports nothing from `utils.ts` (standalone).

**Decision B — The cache is a standalone UTILITY, NOT auto-wired into `SecureCrypto.decrypt`.**
Rationale: (1) the TODO says "optional ... utility"; (2) brief §7 says "Document **recommendations** for in-memory caching of decrypted values (with TTL) where appropriate" — a recommendation, not built-in behavior; (3) security-first: caching plaintext in memory increases the attack surface (plaintext lingers), so caching must be an explicit, opt-in consumer choice, not implicit library behavior; (4) keeps `decrypt` pure and the facade line budget intact. The utility is a generic `TtlCache<K, V>` plus a purpose-built `DecryptionCache` type alias and `createDecryptionCache` factory. The recommended integration pattern (consumer wraps `decrypt`) is documented in Task 4 (docs), not wired here.

**Decision C — `reEncrypt` is inlined in the facade (mirroring `encryptAndHash`).**
The signature `reEncrypt(encrypted, newKeyName?)` is a 2-param method (≤2). Its body is a thin composition of existing validated methods (`this.decrypt` + `this.encrypt`), exactly like `encryptAndHash` which is already inlined in the facade. The mixin files extract PRIMITIVES (cipher/hash/key ops); `reEncrypt` is an orchestration, so inlining is on-pattern. No new mixin file is needed, avoiding an extra import. To stay ≤200 lines in the facade, the class-level `@example` JSDoc is condensed (frees the needed lines); the docs-specialist (step 4.4) owns expanding JSDoc within the budget (the detailed example belongs in README anyway). Semantics: decrypt with the value's stored version, then re-encrypt at `this.resolvedConfig.currentVersion` under `newKeyName ?? encrypted.keyName` — i.e. "rotate to the current version, optionally switch category."

**Decision D — Validation lives in the mixin/primitive functions, NOT the facade.**
The facade is at the 199-line limit and cannot absorb per-method validation calls. Each public method already delegates to a primitive: `encrypt`→`encryptWithAesGcm`, `decrypt`→`assertValidEncryptedValue`+`decryptWithAesGcm`, `hash`→`computeHmacSha256`, `verifyHash`→`verifyHmacSha256`. Adding validation at the primitive entry points gives every public method validation **for free** with zero facade growth (except `reEncrypt`, which inherits validation via `decrypt`/`encrypt`). This also gives direct callers of the primitives (tests) validation, which is desirable.

**Decision E — `verifyHash` fails closed (throws) on invalid `expectedHash` instead of returning `false`.**
Per brief §7 ("Fail closed: Throw clear, non-sensitive errors") and the TODO ("input validation ... encoding ... in all public methods"), a malformed/empty `expectedHash` is a programmer error (hashes originate from `hash()`, which emits valid base64) and now throws a clear error rather than silently returning `false`. This is a deliberate, documented behavior change; the two existing hashing-spec tests that asserted the old lenient behavior are updated (see 4.12). Valid-but-wrong hashes (correct base64, different content) still return `false`.

**Decision F — Validation scope: length + encoding only (per TODO); no `typeof` checks.**
The TODO explicitly says "length checks, encoding". Added checks: (1) plaintext UTF-8 byte length ≤ `MAX_PLAINTEXT_BYTES` (1,000,000) — empty plaintext remains allowed (it is a valid, tested input); (2) `encryptedData` is valid base64 and ≤ `MAX_ENCRYPTED_DATA_LENGTH_CHARS` (2,000,000) — checked on the **string** before decoding (DoS-safe: reject huge inputs before `Buffer.from` allocates); (3) `expectedHash` is non-empty valid base64. No `typeof string` runtime checks (the TS signatures enforce `string` at compile time); keeps branches minimal for 100% coverage. `keyName` validation remains via `deriveKeyForCategory` (non-empty) and `assertValidEncryptedValue` (presence) — already in place.

**Decision G — `base64ToBuffer` (utils.ts) is NOT changed.**
Encoding validation is added at the public-API boundary (guards layer), not in the shared `base64ToBuffer` util. This preserves the stable behavior of a shared internal helper (and its existing tests) while satisfying "validation in all public methods". Defense-in-depth is maintained: `splitEncryptedPayload`'s 28-byte min check still runs after the guard.

**Decision H — `MAX_PLAINTEXT_BYTES = 1_000_000` (1 MB) fixed constant.**
Largest existing test plaintext is 10,000 chars (vector 11) — well under the limit, so no existing test breaks. 1 MB generously covers PII fields, bank descriptions, and notification bodies while bounding oversized-input DoS. Not configurable (out of scope); documented as a named constant.

### 2.3 Constraints Compliance Matrix

| Rule | How satisfied |
|---|---|
| Max 200 lines/file | `cache.ts` ~95; `guards.ts` ~95; `encryption.ts` ~102; `hashing.ts` ~57; facade stays ≤200 via `@example` trim; `index.ts` ~47. |
| Max 50 lines/method | Largest: `TtlCache.get` ~10, `purgeExpired` ~8, `assertValidEncryptedValue` ~7. All ≤50. |
| Max 2 params/method | `TtlCache.set(key,value)`=2; `setWithTtl(params)`=1; `get/has/delete(key)`=1; `createDecryptionCache(defaultTtlMs)`=1; `reEncrypt(encrypted,newKeyName?)`=2; `assertValidBase64(value,fieldName)`=2; `assertValidPlaintext(plaintext)`=1. |
| Max 2 nesting levels | `TtlCache.get`: `if`→`if` (2). `purgeExpired`: `for`→`if` (2). Guards: `if`→ helper call (1). No level-3. |
| No runtime deps | `cache.ts` uses only `Date.now()` + `Map`; guards use only `Buffer` + `RegExp`. No imports added to `dependencies`. |
| Private members by default | `TtlCache.entries`, `defaultTtlMs`, `storeEntry`, `isExpired` private; public API methods public. Guards' `assertPresent`, `assertValidBase64`, `assertEncryptedDataFormat` private; `assertValidEncryptedValue`, `assertValidPlaintext`, `assertValidHash` exported (consumed by mixins). |
| No commented code / self-documenting | Descriptive names; JSDoc on public exports. |
| 100% coverage new code | `tests/utils.cache.spec.ts` covers every method/branch of `cache.ts`. |
| `exactOptionalPropertyTypes` | `cache.ts` uses required-only properties in option/param interfaces; `reEncrypt` optional param accepts `undefined`; no optional-property-`undefined` assignments. |
| `noUncheckedIndexedAccess` | `Map.get` results guarded with `if (!entry)`; `for...of` iterator values non-undefined. |

---

## 3. High-Level Approach

1. Create `src/utils/cache.ts` — generic `TtlCache<K, V>` (lazy-eviction TTL cache) + `DecryptionCache` alias + `createDecryptionCache` factory. (Coexists with `src/utils.ts` per Decision A.)
2. Re-export the cache from `src/index.ts` (public API).
3. Extend `src/crypto.service.guards.ts` — add `assertValidPlaintext`, `assertValidHash`, base64+length validation for `encryptedData`; keep `assertPresent` messages unchanged.
4. Add `assertValidPlaintext(plaintext)` at the start of `encryptWithAesGcm` (`crypto.service.encryption.ts`).
5. Add `assertValidPlaintext(plaintext)` in `computeHmacSha256` and `assertValidHash(expectedHash)` in `verifyHmacSha256` (`crypto.service.hashing.ts`).
6. Add `reEncrypt` method to the facade; condense the class `@example` JSDoc to keep the file ≤200 lines.
7. Update `.agent/project-structure.md` (add `src/utils/` folder).
8. Create `tests/utils.cache.spec.ts` (100% coverage of `cache.ts`).
9. Create `tests/crypto.input-validation.spec.ts` (guard functions + public-method validation).
10. Create `tests/crypto.reencrypt.spec.ts` (`reEncrypt` behavior).
11. Update `tests/crypto.internals.spec.ts` (`'AAA'` → `'AAAA'` in the "accepts fully-populated" test).
12. Update `tests/crypto.hashing.spec.ts` (wrong-hash → valid base64; empty-hash → throws).
13. `npm run build` + `npm test` + `npm run lint`; confirm 100% on `src/utils/cache.ts` and no regressions.
14. Commit on the feature branch.

---

## 4. Detailed Implementation Steps

> Tool preference: `vscode-mcp-server_create_file_code` / `vscode-mcp-server_replace_lines_code` for edits; `bash` only for `npm`/`git`. Follow `.kilo/rules/gitignore-compliance.md` before any commit.

### Step 1 — Create `src/utils/cache.ts`

Create the directory `src/utils/` and the file `src/utils/cache.ts`:

```ts
/**
 * TTL-based in-memory cache utility for optionally caching decrypted values.
 *
 * Generic lazy-eviction cache: entries are removed on first access after their
 * TTL expires, or proactively via {@link TtlCache.purgeExpired}. No timers,
 * no runtime dependencies (uses `Date.now()` + `Map` only).
 *
 * The {@link DecryptionCache} alias + {@link createDecryptionCache} factory
 * provide a purpose-built entry point for caching `decrypt` results. The cache
 * is intentionally NOT wired into {@link SecureCrypto.decrypt} (brief §7):
 * caching plaintext in memory is an explicit, opt-in consumer decision.
 *
 * @module utils/cache
 */

/** Options for constructing a {@link TtlCache}. */
export interface TtlCacheOptions {
  /** Default time-to-live in milliseconds applied by {@link TtlCache.set}. */
  readonly defaultTtlMs: number;
}

/** Inputs for {@link TtlCache.setWithTtl} (per-entry TTL override). */
export interface TtlCacheSetParams<K, V> {
  readonly key: K;
  readonly value: V;
  readonly ttlMs: number;
}

/** A single cache entry with its absolute expiry timestamp. */
interface TtlCacheEntry<V> {
  readonly value: V;
  readonly expiresAt: number;
}

/**
 * In-memory TTL cache with lazy eviction.
 *
 * @example
 * ```ts
 * const cache = new TtlCache<string, string>({ defaultTtlMs: 60_000 });
 * cache.set('payload', 'plaintext');
 * cache.get('payload'); // -> 'plaintext' (within TTL)
 * ```
 */
export class TtlCache<K, V> {
  private readonly entries: Map<K, TtlCacheEntry<V>> = new Map();

  private readonly defaultTtlMs: number;

  constructor(options: TtlCacheOptions) {
    if (options.defaultTtlMs <= 0) {
      throw new Error('Invalid defaultTtlMs: must be a positive number.');
    }
    this.defaultTtlMs = options.defaultTtlMs;
  }

  /** Store `value` under `key` using the cache default TTL. */
  set(key: K, value: V): void {
    this.storeEntry(key, value, this.defaultTtlMs);
  }

  /** Store `value` under `key` with an explicit per-entry TTL. */
  setWithTtl(params: TtlCacheSetParams<K, V>): void {
    if (params.ttlMs <= 0) {
      throw new Error('Invalid ttlMs: must be a positive number.');
    }
    this.storeEntry(params.key, params.value, params.ttlMs);
  }

  /** Return the value for `key`, or `undefined` when missing or expired (lazy eviction). */
  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (this.isExpired(entry)) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /** Whether `key` holds a fresh value (expired entries are lazily evicted). */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /** Remove `key`; returns `true` if it was present. */
  delete(key: K): boolean {
    return this.entries.delete(key);
  }

  /** Remove every entry. */
  clear(): void {
    this.entries.clear();
  }

  /** Raw entry count (may include stale entries not yet accessed). */
  size(): number {
    return this.entries.size;
  }

  /** Proactively remove all expired entries; returns the count removed. */
  purgeExpired(): number {
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (this.isExpired(entry)) {
        this.entries.delete(key);
        removed++;
      }
    }
    return removed;
  }

  private storeEntry(key: K, value: V, ttlMs: number): void {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  private isExpired(entry: TtlCacheEntry<V>): boolean {
    return Date.now() > entry.expiresAt;
  }
}

/** A TTL cache keyed by the encrypted-payload string and holding decrypted plaintext. */
export type DecryptionCache = TtlCache<string, string>;

/** Build a {@link DecryptionCache} with a default TTL in milliseconds. */
export function createDecryptionCache(defaultTtlMs: number): DecryptionCache {
  return new TtlCache<string, string>({ defaultTtlMs });
}
```

(~95 lines.) No import of `utils.ts` (standalone). Verify it compiles under `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.

### Step 2 — Re-export the cache from `src/index.ts`

Add after the existing `export { SecureCrypto } from './crypto.service.js';` line:

```ts
export { TtlCache, createDecryptionCache } from './utils/cache.js';
export type { TtlCacheOptions, TtlCacheSetParams, DecryptionCache } from './utils/cache.js';
```

`src/index.ts` is excluded from coverage (`!src/index.ts`), so these re-exports do not need coverage. They make `TtlCache` / `createDecryptionCache` part of the public API.

### Step 3 — Extend `src/crypto.service.guards.ts`

Replace the file content with the extended guards (keep `assertPresent` and the null/presence error messages byte-identical to preserve existing tests; add new validators):

```ts
/**
 * Input-validation guards for {@link module:crypto.service}.
 *
 * Extracts validation helpers from `crypto.service.ts` to keep that file under
 * the 200-line source file limit. Contains {@link assertValidEncryptedValue},
 * {@link assertValidPlaintext}, {@link assertValidHash}, and internal helpers
 * for base64/length validation (length + encoding checks per TODO Task 3).
 *
 * @module crypto.service.guards
 */

import type { EncryptedValue } from '@cobranza-apps/entities';

/** Maximum allowed plaintext UTF-8 byte length (mitigates oversized-input DoS). */
const MAX_PLAINTEXT_BYTES = 1_000_000;

/** Maximum allowed encryptedData base64 string length (rejected before decoding). */
const MAX_ENCRYPTED_DATA_LENGTH_CHARS = 2_000_000;

/** Strict standard-alphabet base64 (with optional padding) validation pattern. */
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/**
 * Assert that a value is truthy, throwing a descriptive error for the field.
 *
 * @param value - Value to check.
 * @param fieldName - Human-readable field name used in the error message.
 * @throws {Error} when `value` is falsy.
 */
function assertPresent(value: unknown, fieldName: string): void {
  if (!value) {
    throw new Error(`Invalid encryptedValue: ${fieldName} is required.`);
  }
}

/**
 * Assert that a string is valid standard base64.
 *
 * @param value - String to validate.
 * @param fieldName - Human-readable field name used in the error message.
 * @throws {Error} when `value` is not valid base64.
 */
function assertValidBase64(value: string, fieldName: string): void {
  if (!BASE64_PATTERN.test(value)) {
    throw new Error(`Invalid ${fieldName}: expected a valid base64 string.`);
  }
}

/**
 * Assert that a plaintext is within the allowed UTF-8 byte length.
 *
 * Empty plaintext is permitted (it is a valid encrypt/hash input).
 *
 * @param plaintext - Plaintext to validate.
 * @throws {Error} when the UTF-8 byte length exceeds {@link MAX_PLAINTEXT_BYTES}.
 */
export function assertValidPlaintext(plaintext: string): void {
  const byteLength = Buffer.byteLength(plaintext, 'utf8');
  if (byteLength > MAX_PLAINTEXT_BYTES) {
    throw new Error(
      `Invalid plaintext: length ${byteLength} bytes exceeds maximum ${MAX_PLAINTEXT_BYTES} bytes.`,
    );
  }
}

/**
 * Assert that an expected hash is a non-empty, valid base64 string.
 *
 * @param expectedHash - Hash to validate.
 * @throws {Error} when `expectedHash` is empty or not valid base64.
 */
export function assertValidHash(expectedHash: string): void {
  if (!expectedHash) {
    throw new Error('Invalid expectedHash: expected a non-empty base64 string.');
  }
  assertValidBase64(expectedHash, 'expectedHash');
}

/**
 * Assert that encryptedData is within the length limit and valid base64.
 *
 * @param encryptedData - Base64 `IV + ciphertext + authTag` string to validate.
 * @throws {Error} when too long or not valid base64.
 */
function assertEncryptedDataFormat(encryptedData: string): void {
  if (encryptedData.length > MAX_ENCRYPTED_DATA_LENGTH_CHARS) {
    throw new Error(
      `Invalid encryptedData: length ${encryptedData.length} chars exceeds maximum ${MAX_ENCRYPTED_DATA_LENGTH_CHARS} chars.`,
    );
  }
  assertValidBase64(encryptedData, 'encryptedData');
}

/**
 * Validate that an {@link EncryptedValue} carries the fields required to decrypt.
 *
 * @param encryptedValue - Payload to check.
 * @throws {Error} when `encryptedValue`, `encryptedData`, or `keyName` is missing,
 *   or when `encryptedData` is too long or not valid base64.
 */
export function assertValidEncryptedValue(encryptedValue: EncryptedValue): void {
  if (!encryptedValue) {
    throw new Error('Invalid encryptedValue: expected an EncryptedValue object.');
  }
  assertPresent(encryptedValue.encryptedData, 'encryptedData');
  assertPresent(encryptedValue.keyName, 'keyName');
  assertEncryptedDataFormat(encryptedValue.encryptedData);
}
```

(~95 lines.) Critical ordering: presence of `encryptedData` → presence of `keyName` → format of `encryptedData`. This preserves the existing `/encryptedData is required/` and `/keyName is required/` messages and ensures the missing-keyName test (which uses `encryptedData: 'AAA'`) throws on keyName **before** the base64 check runs on `'AAA'`.

### Step 4 — Add plaintext validation to `src/crypto.service.encryption.ts`

Add the import (after the existing `./utils.js` import line):

```ts
import { assertValidPlaintext } from './crypto.service.guards.js';
```

In `encryptWithAesGcm`, add the guard immediately after the destructure (before `generateIv`):

```ts
export function encryptWithAesGcm(params: EncryptParams): EncryptedValue {
  const { plaintext, key, keyName, version } = params;
  assertValidPlaintext(plaintext);
  const initializationVector = generateIv(IV_LENGTH_BYTES);
```

(+2 lines; file 100 → ~102.) `decryptWithAesGcm` is unchanged (its `encryptedData` is already validated by `assertValidEncryptedValue` in the facade `decrypt`, and `splitEncryptedPayload`'s 28-byte check remains as defense-in-depth).

### Step 5 — Add validation to `src/crypto.service.hashing.ts`

Add the guards import (after the existing `./utils.js` import line):

```ts
import { constantTimeCompare } from './utils.js';
import { assertValidHash, assertValidPlaintext } from './crypto.service.guards.js';
```

In `computeHmacSha256`, add the guard after the destructure:

```ts
export function computeHmacSha256(params: HashParams): string {
  const { plaintext, salt } = params;
  assertValidPlaintext(plaintext);
  const hmac = createHmac(HMAC_ALGORITHM, salt);
```

In `verifyHmacSha256`, add the hash guard after the destructure (plaintext is validated by the internal `computeHmacSha256` call):

```ts
export function verifyHmacSha256(params: VerifyHashParams): boolean {
  const { plaintext, salt, expectedHash } = params;
  assertValidHash(expectedHash);
  const recomputedHash = computeHmacSha256({ plaintext, salt });
  return constantTimeCompare(recomputedHash, expectedHash);
}
```

(+3 lines; file 54 → ~57.) No double plaintext validation on the `verifyHash` path (plaintext is validated once, inside `computeHmacSha256`).

### Step 6 — Add `reEncrypt` to `src/crypto.service.ts` (facade)

**6a. Condense the class-level `@example` JSDoc** to free lines. Replace the current 14-line `@example` block (the block starting at `* @example` and ending at the closing ` ``` `) with:

```ts
 *
 * @example
 * ```ts
 * const crypto = new SecureCrypto(config);
 * const encrypted = crypto.encrypt('data', EncryptionKey.PII);
 * const plaintext = crypto.decrypt(encrypted);
 * ```
```

(Frees 8 lines.)

**6b. Add the `reEncrypt` method** immediately after `encryptAndHash` (before `hasKey`):

```ts
  /** Decrypt {@link encrypted} and re-encrypt the recovered plaintext at the current key version, optionally under {@link newKeyName}. */
  reEncrypt(encrypted: EncryptedValue, newKeyName?: string): EncryptedValue {
    const plaintext = this.decrypt(encrypted);
    const targetKeyName = newKeyName ?? encrypted.keyName;
    return this.encrypt(plaintext, targetKeyName);
  }
```

(+6 lines.) Net facade: 199 − 8 + 6 = 197 lines (≤200). The detailed class example belongs in README (docs-specialist, step 4.4). `reEncrypt` inherits all validation via `decrypt` (null/missing-field/base64 guards) and `encrypt` (plaintext length + keyName guards).

**6c. Verify** the final `src/crypto.service.ts` line count is ≤200 with the editor's line indicator; if it reads 201+, trim one more `*` blank line from the class JSDoc.

### Step 7 — Update `.agent/project-structure.md`

Under `# Folders in src/`, add a bullet after the `src/nestjs/` line:

```text
- src/utils/ - in-memory TTL cache utility (cache.ts) for optional decryption-result caching; base64/IV/concat helpers remain in src/utils.ts
```

### Step 8 — Create `tests/utils.cache.spec.ts`

```ts
/**
 * Unit tests for the TTL cache utility (src/utils/cache.ts) — 100% coverage target.
 */
import { TtlCache, createDecryptionCache } from '../src/utils/cache.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('TtlCache', () => {
  describe('constructor', () => {
    it('constructs with a positive defaultTtlMs', () => {
      expect(new TtlCache<string, string>({ defaultTtlMs: 100 })).toBeInstanceOf(TtlCache);
    });

    it('throws when defaultTtlMs is non-positive', () => {
      expect(() => new TtlCache<string, string>({ defaultTtlMs: 0 })).toThrow(/positive number/);
    });
  });

  describe('set / get', () => {
    it('returns the value within the TTL', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 1000 });
      cache.set('a', 1);

      expect(cache.get('a')).toBe(1);
    });

    it('returns undefined for a missing key', () => {
      expect(new TtlCache<string, number>({ defaultTtlMs: 1000 }).get('missing')).toBeUndefined();
    });

    it('returns undefined and evicts after the TTL expires', async () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 1 });
      cache.set('a', 1);
      await sleep(15);

      expect(cache.get('a')).toBeUndefined();
      expect(cache.size()).toBe(0);
    });
  });

  describe('setWithTtl', () => {
    it('stores with a per-entry TTL that expires independently of the default', async () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100000 });
      cache.setWithTtl({ key: 'a', value: 1, ttlMs: 1 });

      expect(cache.get('a')).toBe(1);
      await sleep(15);

      expect(cache.get('a')).toBeUndefined();
    });

    it('throws when ttlMs is non-positive', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 1000 });

      expect(() => cache.setWithTtl({ key: 'a', value: 1, ttlMs: 0 })).toThrow(/positive number/);
    });
  });

  describe('has', () => {
    it('returns true for a fresh entry and false for an expired or missing one', async () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 1 });
      cache.set('a', 1);

      expect(cache.has('a')).toBe(true);
      await sleep(15);

      expect(cache.has('a')).toBe(false);
      expect(cache.has('missing')).toBe(false);
    });
  });

  describe('delete', () => {
    it('returns true when deleting a present entry and false otherwise', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 1000 });
      cache.set('a', 1);

      expect(cache.delete('a')).toBe(true);
      expect(cache.delete('a')).toBe(false);
    });
  });

  describe('clear and size', () => {
    it('clears all entries', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 1000 });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();

      expect(cache.size()).toBe(0);
    });

    it('size reports the raw entry count', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 1000 });
      cache.set('a', 1);
      cache.set('b', 2);

      expect(cache.size()).toBe(2);
    });
  });

  describe('purgeExpired', () => {
    it('removes only expired entries and returns the count removed', async () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 1 });
      cache.set('expired', 1);
      await sleep(15);
      cache.set('fresh', 2);

      expect(cache.purgeExpired()).toBe(1);
      expect(cache.size()).toBe(1);
      expect(cache.get('fresh')).toBe(2);
    });
  });
});

describe('createDecryptionCache', () => {
  it('returns a TtlCache<string, string> that stores and returns plaintext', () => {
    const cache = createDecryptionCache(1000);
    cache.set('encrypted-payload-base64', 'decrypted-plaintext');

    expect(cache.get('encrypted-payload-base64')).toBe('decrypted-plaintext');
  });
});
```

This exercises every branch: constructor `<=0` true/false; `get` missing vs present vs expired; `setWithTtl` `<=0` true/false; `has` fresh/expired/missing; `delete` present/absent; `clear`; `size`; `purgeExpired` expired+fresh; private `storeEntry`/`isExpired` via the public methods. Real timers with a 1 ms TTL + 15 ms sleep are deterministic (15 ms ≫ 1 ms + jitter).

### Step 9 — Create `tests/crypto.input-validation.spec.ts`

```ts
/**
 * Unit tests for input-validation guards and public-method validation hardening.
 */
import { EncryptionKey } from '../src/index.js';
import { getTestCrypto } from '../src/testing/index.js';
import {
  assertValidEncryptedValue,
  assertValidHash,
  assertValidPlaintext,
} from '../src/crypto.service.guards.js';
import type { EncryptedValue } from '@cobranza-apps/entities';

const MAX_PLAINTEXT_BYTES = 1_000_000;
const OVER_LIMIT_PLAINTEXT = 'A'.repeat(MAX_PLAINTEXT_BYTES + 1);

describe('assertValidPlaintext', () => {
  it('passes for an empty string', () => {
    expect(() => assertValidPlaintext('')).not.toThrow();
  });

  it('passes for a plaintext at the maximum length', () => {
    expect(() => assertValidPlaintext('A'.repeat(MAX_PLAINTEXT_BYTES))).not.toThrow();
  });

  it('throws when the plaintext exceeds the maximum byte length', () => {
    expect(() => assertValidPlaintext(OVER_LIMIT_PLAINTEXT)).toThrow(/exceeds maximum/);
  });
});

describe('assertValidHash', () => {
  it('throws for an empty expectedHash', () => {
    expect(() => assertValidHash('')).toThrow(/non-empty base64/);
  });

  it('throws for a non-base64 expectedHash', () => {
    expect(() => assertValidHash('not-valid-base64!')).toThrow(/valid base64/);
  });

  it('passes for a valid base64 expectedHash', () => {
    expect(() => assertValidHash(getTestCrypto().hash('x'))).not.toThrow();
  });
});

describe('assertValidEncryptedValue — extended', () => {
  it('throws when encryptedData is not valid base64', () => {
    const value: EncryptedValue = { encryptedData: '!!!not-base64!!!', keyName: 'pii' };

    expect(() => assertValidEncryptedValue(value)).toThrow(/valid base64/);
  });

  it('throws when encryptedData exceeds the maximum length', () => {
    const value: EncryptedValue = { encryptedData: 'A'.repeat(2_000_001), keyName: 'pii' };

    expect(() => assertValidEncryptedValue(value)).toThrow(/exceeds maximum/);
  });
});

describe('SecureCrypto — public-method input validation', () => {
  it('encrypt throws when plaintext exceeds the maximum length', () => {
    expect(() => getTestCrypto().encrypt(OVER_LIMIT_PLAINTEXT, EncryptionKey.PII)).toThrow(/exceeds maximum/);
  });

  it('hash throws when plaintext exceeds the maximum length', () => {
    expect(() => getTestCrypto().hash(OVER_LIMIT_PLAINTEXT)).toThrow(/exceeds maximum/);
  });

  it('verifyHash throws when plaintext exceeds the maximum length', () => {
    const crypto = getTestCrypto();
    const hash = crypto.hash('small');

    expect(() => crypto.verifyHash(OVER_LIMIT_PLAINTEXT, hash)).toThrow(/exceeds maximum/);
  });

  it('verifyHash throws when expectedHash is empty', () => {
    expect(() => getTestCrypto().verifyHash('small', '')).toThrow(/non-empty base64/);
  });

  it('verifyHash throws when expectedHash is not valid base64', () => {
    expect(() => getTestCrypto().verifyHash('small', 'not-base64!')).toThrow(/valid base64/);
  });

  it('decrypt throws when encryptedData is not valid base64', () => {
    expect(() =>
      getTestCrypto().decrypt({ encryptedData: '!!!not-base64!!!', keyName: 'pii', version: 1 }),
    ).toThrow(/valid base64/);
  });
});
```

### Step 10 — Create `tests/crypto.reencrypt.spec.ts`

```ts
/**
 * Unit tests for SecureCrypto.reEncrypt (manual key rotation helper).
 */
import { EncryptionKey } from '../src/index.js';
import { buildTestCrypto } from '../src/testing/index.js';
import type { EncryptedValue } from '@cobranza-apps/entities';

describe('SecureCrypto — reEncrypt', () => {
  it('roundtrips: decrypt(reEncrypt(encrypted)) equals the original plaintext', () => {
    const crypto = buildTestCrypto(1);
    const encrypted = crypto.encrypt('rotate-me', EncryptionKey.PII);

    expect(crypto.decrypt(crypto.reEncrypt(encrypted))).toBe('rotate-me');
  });

  it('preserves the keyName when newKeyName is omitted', () => {
    const crypto = buildTestCrypto(1);
    const encrypted = crypto.encrypt('keep-key', EncryptionKey.BANK_DATA);

    expect(crypto.reEncrypt(encrypted).keyName).toBe(EncryptionKey.BANK_DATA);
  });

  it('stamps the current version onto the re-encrypted value', () => {
    const v1 = buildTestCrypto(1);
    const v2 = buildTestCrypto(2);
    const encrypted = v1.encrypt('version-rotation', EncryptionKey.PII);

    expect(v2.reEncrypt(encrypted).version).toBe(2);
  });

  it('switches to a new keyName when provided', () => {
    const crypto = buildTestCrypto(1);
    const encrypted = crypto.encrypt('switch-key', EncryptionKey.PII);

    const reEncrypted = crypto.reEncrypt(encrypted, EncryptionKey.NOTIFICATION);

    expect(reEncrypted.keyName).toBe(EncryptionKey.NOTIFICATION);
    expect(crypto.decrypt(reEncrypted)).toBe('switch-key');
  });

  it('produces a fresh ciphertext (new IV) distinct from the input', () => {
    const crypto = buildTestCrypto(1);
    const encrypted = crypto.encrypt('fresh-iv', EncryptionKey.PII);

    expect(crypto.reEncrypt(encrypted).encryptedData).not.toBe(encrypted.encryptedData);
  });

  it('rotates a historical v1 value to v2 and a v2 instance can decrypt it', () => {
    const v1 = buildTestCrypto(1);
    const v2 = buildTestCrypto(2);
    const encrypted = v1.encrypt('historical', EncryptionKey.PII);

    const rotated = v2.reEncrypt(encrypted);

    expect(rotated.version).toBe(2);
    expect(v2.decrypt(rotated)).toBe('historical');
  });

  it('throws when the input encryptedValue is null (via decrypt guard)', () => {
    expect(() => buildTestCrypto(1).reEncrypt(null as unknown as EncryptedValue)).toThrow(
      /expected an EncryptedValue object/,
    );
  });

  it('throws when newKeyName is empty (via encrypt guard)', () => {
    const crypto = buildTestCrypto(1);
    const encrypted = crypto.encrypt('x', EncryptionKey.PII);

    expect(() => crypto.reEncrypt(encrypted, '')).toThrow(/Invalid keyName/);
  });
});
```

### Step 11 — Update `tests/crypto.internals.spec.ts`

In the "accepts a fully-populated EncryptedValue" test, change `encryptedData: 'AAA'` → `encryptedData: 'AAAA'` (valid 4-char base64, so the new base64 guard passes):

```ts
  it('accepts a fully-populated EncryptedValue', () => {
    const value: EncryptedValue = {
      encryptedData: 'AAAA',
      keyName: 'pii',
      algorithm: 'aes-256-gcm',
      version: 1,
    };

    expect(() => assertValidEncryptedValue(value)).not.toThrow();
  });
```

No other change in this file. (The "throws when encryptedData is missing" and "throws when keyName is missing" tests are unchanged — see 2.1 for why they still pass.)

### Step 12 — Update `tests/crypto.hashing.spec.ts`

**12a.** Replace "returns false for a wrong expected hash" with a valid-base64 wrong hash (preserves the "returns false" intent under the new encoding validation):

```ts
    it('returns false for a wrong (valid base64) expected hash', () => {
      const crypto = getTestCrypto();
      const wrongHash = crypto.hash('a-completely-different-input');

      expect(crypto.verifyHash('john.doe@example.com', wrongHash)).toBe(false);
    });
```

**12b.** Replace "returns false for an empty expected hash" with the new fail-closed behavior:

```ts
    it('throws for an empty expected hash', () => {
      const crypto = getTestCrypto();

      expect(() => crypto.verifyHash('any-text', '')).toThrow(/non-empty base64/);
    });
```

The "different length (short-circuit)", "differs by a single character", and "wrong salt" tests are unchanged (they use valid base64 hashes).

### Step 13 — Build, test, lint

```bash
npm run build
npm test
npm run lint
```

**Verify:**

- `tsc` clean; `dist/utils/cache.{js,d.ts}` emitted; no "ambiguous module" errors from `utils.ts` + `utils/` coexistence.
- All tests pass (existing 124 + new cache/validation/reencrypt tests).
- `src/utils/cache.ts` coverage = 100% (statements/branches/functions/lines).
- `src/crypto.service.guards.ts`, `src/crypto.service.encryption.ts`, `src/crypto.service.hashing.ts` coverage stays 100% (new branches covered by the new validation tests).
- Global coverage ≥85%.
- `npm run lint` clean (use `import type` for type-only imports; no unused vars).

If any new file is below 100%, add/adjust a test to cover the missing branch. If `utils.ts`/`utils/` coexistence triggers a TS resolution error (not expected), fall back to renaming `utils.ts` → `utils/index.ts` and updating the 4 import sites to `./utils/index.js` / `../utils/index.js` / `../src/utils/index.js` (see Decision A fallback).

### Step 14 — Commit

Follow `.kilo/rules/gitignore-compliance.md`: read `.gitignore`, run `git status`, ensure no `node_modules/`, `dist/`, or `coverage/` are staged.

```bash
git add src/utils/cache.ts src/index.ts src/crypto.service.ts src/crypto.service.guards.ts src/crypto.service.encryption.ts src/crypto.service.hashing.ts .agent/project-structure.md tests/utils.cache.spec.ts tests/crypto.input-validation.spec.ts tests/crypto.reencrypt.spec.ts tests/crypto.internals.spec.ts tests/crypto.hashing.spec.ts
git status
git commit -m "feat(crypto): add TTL decryption cache utility, reEncrypt helper, and input validation hardening"
```

(Commit message style matches repo: `type(scope): subject`.)

---

## 5. Test Strategy

- **Cache (`tests/utils.cache.spec.ts`):** direct construction of `TtlCache`; every method and branch exercised (constructor validation, set/get fresh/missing/expired, `setWithTtl` validation + per-entry TTL, `has`, `delete`, `clear`, `size`, `purgeExpired`); `createDecryptionCache` factory. Real timers (1 ms TTL + 15 ms sleep) for deterministic expiry. Target: 100% on `src/utils/cache.ts`.
- **Validation (`tests/crypto.input-validation.spec.ts`):** direct tests of `assertValidPlaintext`, `assertValidHash`, extended `assertValidEncryptedValue` (base64 + length branches); integration tests through the public API (`encrypt`/`hash`/`verifyHash`/`decrypt` over-limit and invalid-encoding cases) proving validation is wired via the primitives.
- **reEncrypt (`tests/crypto.reencrypt.spec.ts`):** roundtrip, keyName preservation, version stamping, key switch, fresh IV, historical v1→v2 rotation, and error propagation (null input, empty newKeyName). Covers both `newKeyName ?? encrypted.keyName` branches.
- **Regression (updated existing tests):** `crypto.internals.spec.ts` (`'AAA'`→`'AAAA'`), `crypto.hashing.spec.ts` (wrong-hash → valid base64; empty-hash → throws). All other existing tests unchanged and green.
- **Coverage gate:** `src/utils/cache.ts` must be 100%; modified source files maintain 100%; global ≥85%.

---

## 6. Documentation Updates (for step 4.4 — docs-specialist)

| File | Change |
|---|---|
| `README.md` | Add `TtlCache` / `createDecryptionCache` / `reEncrypt` to the public API table; add an "Optional decryption cache" subsection with a consumer-side wrapper example (cache `decrypt` results by `encryptedData`); add a "Key rotation (manual)" subsection showing `reEncrypt`; add an "Input validation" note (max 1 MB plaintext, base64-encoded `encryptedData`/`expectedHash`, fail-closed on invalid `expectedHash`). |
| `docs/` (key-rotation guide, new or existing) | Document the `reEncrypt` rotation flow (decrypt historical version → re-encrypt at current version) and the cache recommendation (brief §7): when/whether to cache decrypted values, TTL guidance, security caveat (plaintext in memory). |
| `.agent/project-info/architecture.md` | Add `reEncrypt` to the Public API Surface; note the `TtlCache` utility and the validation hardening (length/encoding guards). |
| `.agent/project-info/context.md` | Updated at step 4.6 (task completion) by the implementer — not in this planning step. |

`.agent/project-structure.md` is updated in step 7 (implementation), per the Project Structure Maintenance Workflow.

---

## 7. Acceptance Criteria / Definition of Done

- [ ] `src/utils/cache.ts` exists with `TtlCache<K,V>` (TTL, lazy eviction, `purgeExpired`), `DecryptionCache` alias, `createDecryptionCache` factory — ≤200 lines, methods ≤50, ≤2 nesting, ≤2 params, private by default, no runtime deps.
- [ ] `TtlCache` / `createDecryptionCache` re-exported from `src/index.ts`.
- [ ] `SecureCrypto.reEncrypt(encrypted, newKeyName?)` implemented with the exact TODO signature; rotates to current version, preserves/switches keyName.
- [ ] Input validation (length + encoding) added to all public methods via the primitive layer: `encrypt`/`hash`/`verifyHash` plaintext length; `decrypt` `encryptedData` base64+length; `verifyHash` `expectedHash` non-empty base64.
- [ ] `src/crypto.service.ts` remains ≤200 lines (class `@example` condensed).
- [ ] `npm run build` clean; `dist/utils/cache.*` emitted.
- [ ] `npm test` passes: existing tests (with the 2+1 justified updates) + new cache/validation/reencrypt tests; `src/utils/cache.ts` at 100%; global ≥85%.
- [ ] `npm run lint` clean.
- [ ] `.agent/project-structure.md` lists `src/utils/`.
- [ ] Changes committed on the feature branch; no gitignored files staged.

---

## 8. Risks & Mitigations

- **`utils.ts` + `utils/` coexistence resolution error:** not expected (NodeNext resolves `./utils.js` to the file `utils.ts` and `./utils/cache.js` to the directory file). Mitigation: `npm run build` verification in step 13; fallback = rename `utils.ts`→`utils/index.ts` + update 4 import sites (Decision A).
- **Facade line budget:** adding `reEncrypt` would exceed 200 lines. Mitigation: condense the class `@example` (frees 8 lines) before adding the 6-line method; net 197. Implementer verifies with the editor line indicator.
- **`verifyHash` behavior change (fail-closed on bad `expectedHash`):** could surprise consumers relying on `verifyHash(...) === false` for malformed hashes. Mitigation: documented (Decision E) + README note (4.4); hashes originate from `hash()` (valid base64), so well-behaved consumers are unaffected; corrupted stored hashes now surface a clear error (fail closed, brief §7).
- **Existing test breakage from new validation:** fully audited (2.1). Only 3 tests need updates (1 in internals, 2 in hashing), all justified by the new validation behavior. No other existing test exercises an over-limit plaintext, a non-base64 `encryptedData` expecting success, or a non-base64/empty `expectedHash` expecting `false` (besides the 2 hashing tests being updated).
- **`exactOptionalPropertyTypes` + `reEncrypt(encrypted, newKeyName?)`:** optional function params accept `undefined` under this flag (it targets optional *properties*, not params); `newKeyName ?? encrypted.keyName` handles both cases. Verified by `tsc`.
- **Real-timer flakiness in cache tests:** 1 ms TTL + 15 ms sleep gives 15× margin over jitter; CI load could still delay. If flaky, switch to `jest.useFakeTimers()` + `jest.advanceTimersByTime(15)` within a scoped `describe` with `afterEach(jest.useRealTimers)`. Not expected to be needed.

---

## 9. Out of Scope (handled by other TODO-3 tasks / steps)

- Task 1 (NestJS helpers) and Task 2 (DTO/decorator examples) — already `[DONE]`.
- Task 4 (comprehensive docs overhaul, security checklist, key-rotation guide expansion, real-world examples) — separate task; this plan only lists doc touch-points for step 4.4.
- Wiring the cache into `SecureCrypto.decrypt` automatically — intentionally NOT done (Decision B).
- Making `MAX_PLAINTEXT_BYTES` configurable — out of scope (fixed constant).
- Updating `.agent/project-info/context.md` — step 4.6 (implementer).
- Version bump — Critical Workflow step 3 (separate sub-agent).

---

## 10. Notes for Subsequent Critical-Workflow Steps

- **4.2 (Implementation):** follow Steps 1–14 in order; commit per Step 14. Do NOT skip the class-`@example` trim (Step 6a) — the facade will exceed 200 lines otherwise.
- **4.3 (Review & Simplify):** reviewers should verify the constraints matrix (2.3), the 3 justified test updates (2.1), 100% on `src/utils/cache.ts`, and that no existing test beyond the 3 identified was affected. Confirm `verifyHash` fail-closed behavior is intentional (Decision E).
- **4.4 (Documentation):** ensure README documents `TtlCache`/`createDecryptionCache` (with the security caveat that caching plaintext is opt-in), `reEncrypt` (manual rotation), and the input-validation contract (limits + encoding + fail-closed). Move the detailed `SecureCrypto` usage example from the condensed class JSDoc into README.
- **4.5 (Verification):** confirm plan adherence — file list (`src/utils/cache.ts`, modified guards/encryption/hashing/service/index, 3 new test files, 2 updated test files, project-structure), `reEncrypt` signature, validation placement in primitives, cache not auto-wired, 100% cache coverage.
- **4.6 (Completion):** mark Task 3 checkboxes `[x]` in the TODO file; update `.agent/project-info/context.md` with the new cache utility, `reEncrypt`, and validation hardening.
