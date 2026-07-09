# Per-Task Plan: Task 1 — Advanced Cryptographic Features

- **Date:** 2026-07-09
- **TODO:** `.agent/todos/20260707/20260707-todo-4.md` — Task 1
- **Global plan:** `.kilo/plans/20260709-phase4-advanced-features.md`
- **Branch:** `feat/phase4-advanced-features` (already created in Step 2)
- **Version:** 0.4.0 (already bumped in Step 3)
- **Step:** Critical Workflow 4.1 — Analysis & Planning (this document)
- **Owner of execution:** Step 4.2 implementer sub-agent

---

## 1. Pre-Analysis

### 1.1 What already exists (verified by reading the codebase)

| Capability | Location | Status |
|---|---|---|
| `SecureCrypto` facade (encrypt/decrypt/hash/verifyHash/encryptAndHash/hasKey/getAvailableKeys/destroy) | `src/crypto.service.ts` (197 lines) | Present |
| `reEncrypt(encrypted, newKeyName?: string)` | `src/crypto.service.ts` lines 160–164 | Present — param name + type need alignment |
| Mixin pattern (encryption/hashing/keys/validation/guards extracted to peer files) | `src/crypto.service.*.ts` | Present — replicate for bulk |
| Generic `TtlCache<K,V>` + `createDecryptionCache(defaultTtlMs)` | `src/utils/cache.ts` (140 lines) | Present — generic, NOT bound to SecureCrypto |
| `EncryptionKey` enum + `CryptoConfig` | `src/config.ts` | Present |
| Test fixtures: `buildTestCrypto`, `getTestCrypto`, `TEST_VECTORS`, `encryptedMatchesShape` | `src/testing/` | Present |
| Existing specs: `crypto.reencrypt.spec.ts`, `utils.cache.spec.ts`, `crypto.service.spec.ts`, etc. | `tests/` | Present |
| Public re-exports | `src/index.ts` (48 lines) | Present |

### 1.2 What is new for Task 1

1. `encryptObject<T>(obj, fieldMap): T` — encrypt listed string fields into `EncryptedValue`.
2. `decryptObject<T>(obj, fieldMap): T` — decrypt listed `EncryptedValue` fields back to strings.
3. `reEncrypt` param aligned: `newKeyName?: string` → `targetKeyName?: EncryptionKey | string`.
4. `src/utils/decryption-cache.ts` — SecureCrypto-aware cache-through decrypt wrapper (distinct from generic `cache.ts`).
5. `SecureCrypto.withCache(options?): CachedDecryptor` — facade method delegating to the wrapper.

### 1.3 Key technical & architecture decisions

**D1 — Facade line budget forces extraction.** `src/crypto.service.ts` is at 197 lines (hard cap 200). Three new methods + imports would push it to ~215. Therefore the bulk logic MUST live in a new mixin `src/crypto.service.bulk.ts` (free functions taking a single `BulkOperationParams<T>` object), and the cache logic MUST live in `src/utils/decryption-cache.ts` (factory `createDecryptionCacheWrapper`). The facade keeps only thin delegating methods and trims its module header JSDoc to stay ≤198 total lines.

**D2 — `BulkFieldMap<T>` type refinement (deviation from literal TODO, justified).** The TODO literal `Record<keyof T, EncryptionKey>` has two latent problems:
- `Record<keyof T, X>` requires EVERY key of `T` to be present — unusable for partial field maps.
- The value type `EncryptionKey` excludes arbitrary key-name strings, while `encrypt(plaintext, keyName: EncryptionKey | string)` accepts both.

Refined type: `BulkFieldMap<T> = Partial<Record<keyof T, EncryptionKey | string>>`. This preserves the TODO intent (per-field key mapping, type-tied to `T`), fixes the partial-map usability bug, and matches the existing `encrypt` signature. Documented here for the reviewer.

**D3 — Max-2-params compliance.** `encryptObject(obj, fieldMap)` and `decryptObject(obj, fieldMap)` use exactly 2 params (allowed by `max-arguments-per-method.md`). No param object is needed for the facade methods. The extracted free functions take a single `BulkOperationParams<T>` object (1 param). `createDecryptionCacheWrapper(decryptor, options)` = 2 params. `withCache(options)` = 1 param. All compliant.

**D4 — Runtime dependency graph (no cycle).** `crypto.service.bulk.ts` imports `SecureCrypto` as `import type` (erased at compile). `crypto.service.ts` imports the bulk free functions at runtime. Runtime flow is facade → bulk (one-way); bulk → facade is type-only. Same pattern as `crypto.service.encryption.ts`.

**D5 — `withCache` return type.** Task instruction pins `{ decrypt: (encrypted: EncryptedValue) => string }`. The plan returns a richer `CachedDecryptor { decrypt; clear; size }` which structurally satisfies the required shape and enables cache management + hit/miss testing. `CachedDecryptor` is exported so consumers can type the result.

**D6 — `decryptObject` ignores fieldMap values.** `decrypt` reads `keyName` from each `EncryptedValue` itself, so the map's key-name values are redundant for decrypt. The map is used only to select WHICH fields to decrypt. This keeps behavior simple and is documented in JSDoc. API symmetry with `encryptObject` is preserved (same `BulkFieldMap<T>` type).

**D7 — Fail-closed field handling (brief §7).** For each listed field: if absent from `obj` → skip (nothing to transform); if present but wrong type → throw a clear, non-sensitive error. This matches the existing guards pattern in `crypto.service.guards.ts`.

**D8 — Test-vector expansion boundary.** The global plan lists `src/testing/test-vectors.ts` under both Task 1 and Task 4. To avoid scope overlap, Task 1 adds only the minimal fixtures required to exercise the new methods (`BULK_OBJECT_FIXTURE`, `RE_ENCRYPT_SCENARIOS`); Task 4 will expand comprehensive vectors and examples later.

**D9 — `.agent/project-structure.md` ownership.** The `project-structure` command explicitly authorizes the implementer to update `.agent/project-structure.md`. This specific command overrides the general `markdown-generation-rule` for that file. The update is included in the 4.2 implementer steps.

---

## 2. High-Level Approach

1. Create `src/crypto.service.bulk.ts` with `encryptObjectFields` + `decryptObjectFields` free functions and the `BulkFieldMap<T>` / `BulkOperationParams<T>` types.
2. Create `src/utils/decryption-cache.ts` with `createDecryptionCacheWrapper` factory and the `CachedDecryptor` / `SecureCryptoDecryptor` / `DecryptionCacheOptions` types.
3. Modify `src/crypto.service.ts`: align `reEncrypt` param, add 3 thin delegating methods, add 2 imports, trim module header JSDoc to stay ≤198 lines.
4. Modify `src/index.ts`: re-export the new public types and the factory.
5. Update `.agent/project-structure.md` to mention the new files.
6. Add `tests/crypto.bulk.spec.ts` and `tests/crypto.cache-wrapper.spec.ts`; update `tests/crypto.reencrypt.spec.ts`.
7. Add minimal fixtures to `src/testing/test-vectors.ts`.
8. Build, lint, test (100% on new source files); commit per concern.

---

## 3. Detailed Implementation Steps (for Step 4.2 implementer)

> Rules: follow `.kilo/rules/*` (max 200 lines/src file, max 50 lines/method body, max 2 params, max 2 nesting levels, private-by-default, self-documenting, no commented code, single-section boolean conditions). Follow `.kilo/rules/gitignore-compliance.md` before any commit. Commit only on the `feat/phase4-advanced-features` branch.

### Step 3.1 — Create `src/crypto.service.bulk.ts` (NEW)

**File:** `src/crypto.service.bulk.ts`
**Target:** ~75 lines (well under 200). All method bodies ≤12 lines. Max nesting 2.

Full content:

```ts
/**
 * Bulk object encryption / decryption orchestration for {@link module:crypto.service}.
 *
 * Extracts {@link encryptObjectFields} and {@link decryptObjectFields} from the
 * SecureCrypto facade so it stays under the 200-line source file limit. Each
 * function receives the orchestrating {@link SecureCrypto} instance plus a
 * field map, transforms only the listed string / EncryptedValue fields, and
 * returns a shallow-cloned object (the input object is never mutated).
 *
 * @module crypto.service.bulk
 */

import type { EncryptedValue } from '@cobranza-apps/entities';

import type { EncryptionKey } from './config.js';
import type { SecureCrypto } from './crypto.service.js';

/** Per-field key mapping for bulk operations; only listed keys are transformed. */
export type BulkFieldMap<T> = Partial<Record<keyof T, EncryptionKey | string>>;

/** Inputs for {@link encryptObjectFields} and {@link decryptObjectFields}. */
export interface BulkOperationParams<T> {
  readonly crypto: SecureCrypto;
  readonly obj: T;
  readonly fieldMap: BulkFieldMap<T>;
}

/** Whether a value is shaped like an {@link EncryptedValue} (object with string `encryptedData`). */
function isEncryptedValue(value: unknown): value is EncryptedValue {
  return typeof value === 'object'
    && value !== null
    && typeof (value as EncryptedValue).encryptedData === 'string';
}

/** Throw when a field listed for encryption is present but not a string. */
function assertStringFieldValue<T>(obj: T, field: keyof T): void {
  const value = obj[field];
  if (typeof value !== 'string') {
    throw new Error(`Invalid field "${String(field)}": expected a string to encrypt.`);
  }
}

/** Throw when a field listed for decryption is present but not an EncryptedValue. */
function assertEncryptedFieldValue<T>(obj: T, field: keyof T): void {
  const value = obj[field];
  if (!isEncryptedValue(value)) {
    throw new Error(`Invalid field "${String(field)}": expected an EncryptedValue to decrypt.`);
  }
}

/**
 * Encrypt every string field listed in `fieldMap` under its mapped key name,
 * returning a shallow-cloned object with those fields replaced by EncryptedValue.
 * Fields absent from `obj` are skipped; fields present but non-string throw.
 */
export function encryptObjectFields<T>(params: BulkOperationParams<T>): T {
  const { crypto, obj, fieldMap } = params;
  const clone = { ...obj } as T;
  const entries = Object.entries(fieldMap) as Array<[keyof T, EncryptionKey | string]>;
  for (const [field, keyName] of entries) {
    if (!(field in obj)) {
      continue;
    }
    assertStringFieldValue(obj, field);
    clone[field] = crypto.encrypt(obj[field] as string, keyName) as T[keyof T];
  }
  return clone;
}

/**
 * Decrypt every EncryptedValue field listed in `fieldMap`, returning a shallow-
 * cloned object with those fields replaced by their plaintext strings. The map's
 * key-name values are ignored; each EncryptedValue carries its own keyName.
 * Fields absent from `obj` are skipped; fields present but non-EncryptedValue throw.
 */
export function decryptObjectFields<T>(params: BulkOperationParams<T>): T {
  const { crypto, obj, fieldMap } = params;
  const clone = { ...obj } as T;
  const entries = Object.entries(fieldMap) as Array<[keyof T, EncryptionKey | string]>;
  for (const [field] of entries) {
    if (!(field in obj)) {
      continue;
    }
    assertEncryptedFieldValue(obj, field);
    clone[field] = crypto.decrypt(obj[field] as unknown as EncryptedValue) as T[keyof T];
  }
  return clone;
}
```

**Verification for this file:**
- Lines: ~75 (≤200). ✓
- Method bodies: `encryptObjectFields` / `decryptObjectFields` ≈ 10 lines each (≤50). ✓
- Params: each free function takes 1 param object (≤2). ✓
- Nesting: `for`(1) → `if`(2) → statement(2); max 2. ✓
- Single-section conditions: `if (!(field in obj))`, `if (typeof value !== 'string')`, `if (!isEncryptedValue(value))` — all single-section; the multi-section `isEncryptedValue` is the named helper for that complex condition. ✓
- Private-by-default: helpers `isEncryptedValue`/`assertStringFieldValue`/`assertEncryptedFieldValue` are module-private (not exported). ✓

### Step 3.2 — Create `src/utils/decryption-cache.ts` (NEW)

**File:** `src/utils/decryption-cache.ts`
**Target:** ~80 lines. Method bodies ≤20 lines. Max nesting 2.

Full content:

```ts
/**
 * SecureCrypto-aware decryption cache wrapper.
 *
 * Wraps the generic {@link TtlCache} to cache {@link SecureCrypto.decrypt}
 * results keyed by the encrypted payload's base64 `encryptedData`. Distinct
 * from {@link module:utils/cache.createDecryptionCache} (a bare
 * `TtlCache<string,string>` factory): this module binds a decryptor and exposes
 * a cache-through `decrypt` plus lifecycle helpers. Caching plaintext is an
 * explicit, opt-in consumer decision (brief §7).
 *
 * @module utils/decryption-cache
 */

import type { EncryptedValue } from '@cobranza-apps/entities';

import { TtlCache } from './cache.js';

/** Default cache time-to-live (60s) when `ttlMs` is not provided. */
const DEFAULT_DECRYPTION_TTL_MS = 60_000;

/** Options for {@link createDecryptionCacheWrapper}. */
export interface DecryptionCacheOptions {
  /** Cache time-to-live in milliseconds; defaults to {@link DEFAULT_DECRYPTION_TTL_MS}. */
  readonly ttlMs?: number;
}

/** Minimal decryptor accepted by {@link createDecryptionCacheWrapper} (SecureCrypto satisfies this). */
export interface SecureCryptoDecryptor {
  decrypt(encryptedValue: EncryptedValue): string;
}

/** Cache-through decryptor returned by {@link createDecryptionCacheWrapper}. */
export interface CachedDecryptor {
  decrypt(encrypted: EncryptedValue): string;
  clear(): void;
  size(): number;
}

/** Resolve the TTL, falling back to the default when unset. */
function resolveTtlMs(options?: DecryptionCacheOptions): number {
  return options?.ttlMs ?? DEFAULT_DECRYPTION_TTL_MS;
}

/**
 * Build a TTL-cached decryptor bound to `decryptor`.
 *
 * @param decryptor - Object exposing a `decrypt` method (e.g. a SecureCrypto instance).
 * @param options - Optional TTL override.
 * @returns A {@link CachedDecryptor} whose `decrypt` caches plaintext keyed by
 *   `encrypted.encryptedData`; cache misses delegate to `decryptor.decrypt`.
 */
export function createDecryptionCacheWrapper(
  decryptor: SecureCryptoDecryptor,
  options?: DecryptionCacheOptions,
): CachedDecryptor {
  const cache = new TtlCache<string, string>({ defaultTtlMs: resolveTtlMs(options) });
  return {
    decrypt(encrypted) {
      const cacheKey = encrypted.encryptedData;
      const cachedPlaintext = cache.get(cacheKey);
      if (cachedPlaintext !== undefined) {
        return cachedPlaintext;
      }
      const plaintext = decryptor.decrypt(encrypted);
      cache.set(cacheKey, plaintext);
      return plaintext;
    },
    clear() {
      cache.clear();
    },
    size() {
      return cache.size();
    },
  };
}
```

**Verification for this file:**
- Lines: ~80 (≤200). ✓
- `createDecryptionCacheWrapper` body ≈ 18 lines (≤50). ✓
- Params: 2 (`decryptor`, `options`). ✓
- Nesting: object-method(1) → `if`(2); max 2. ✓
- Single-section: `if (cachedPlaintext !== undefined)`. ✓
- No runtime dependency on `crypto.service.ts` (only `cache.js` + entities type). ✓
- Non-positive `ttlMs` is rejected by `TtlCache`'s `assertPositive` (reused, no duplication). ✓

### Step 3.3 — Modify `src/crypto.service.ts`

**File:** `src/crypto.service.ts` (currently 197 lines; target ≤198 after edits)

**Edit 3.3.a — Trim module header JSDoc (lines 1–22) to ~9 lines.** Replace the 22-line header block with:

```ts
/**
 * SecureCrypto core service module — the single entrypoint for all cryptographic
 * operations in the Cobranza App platform (AES-256-GCM encryption, HMAC-SHA256
 * hashing, combined encryptAndHash). Uses Node.js built-in `crypto` only.
 *
 * Cipher primitives: {@link module:crypto.service.encryption}; HMAC:
 * {@link module:crypto.service.hashing}; bulk object ops:
 * {@link module:crypto.service.bulk}; config validation:
 * {@link module:crypto.service.validation}.
 *
 * @module crypto.service
 */
```

This saves ~12 lines, creating headroom for the new methods + imports.

**Edit 3.3.b — Add imports.** After the existing import block (current line 31, `import { resolveConfig, type ResolvedConfig } from './crypto.service.validation.js';`), add:

```ts
import { decryptObjectFields, encryptObjectFields, type BulkFieldMap } from './crypto.service.bulk.js';
import { createDecryptionCacheWrapper, type CachedDecryptor } from './utils/decryption-cache.js';
```

(Net +2 lines. `EncryptionKey` is already imported on line 26 — needed for the widened `reEncrypt` param.)

**Edit 3.3.c — Align `reEncrypt` (current lines 153–164).** Replace the method JSDoc + signature + body with:

```ts
  /**
   * Decrypt an encrypted value and re-encrypt the recovered plaintext at the
   * current key version, optionally under a (possibly different) key name.
   *
   * @param encrypted - Payload previously produced by {@link encrypt}.
   * @param targetKeyName - Optional target key name (enum or arbitrary string);
   *   defaults to `encrypted.keyName`.
   */
  reEncrypt(encrypted: EncryptedValue, targetKeyName?: EncryptionKey | string): EncryptedValue {
    const plaintext = this.decrypt(encrypted);
    const resolvedTargetKeyName = targetKeyName ?? encrypted.keyName;
    return this.encrypt(plaintext, resolvedTargetKeyName);
  }
```

(Net 0 lines — same count, text changes only. Param widened `string` → `EncryptionKey | string`; local var renamed to avoid shadowing the param name.)

**Edit 3.3.d — Insert `encryptObject`, `decryptObject`, `withCache` after `reEncrypt` (before the `hasKey` JSDoc).** Use single-line JSDoc to conserve lines:

```ts
  /** Encrypt every string field listed in `fieldMap`; returns a shallow clone (see crypto.service.bulk). */
  encryptObject<T>(obj: T, fieldMap: BulkFieldMap<T>): T {
    return encryptObjectFields({ crypto: this, obj, fieldMap });
  }

  /** Decrypt every EncryptedValue field listed in `fieldMap`; returns a shallow clone (see crypto.service.bulk). */
  decryptObject<T>(obj: T, fieldMap: BulkFieldMap<T>): T {
    return decryptObjectFields({ crypto: this, obj, fieldMap });
  }

  /** Return a TTL-cached decrypt wrapper bound to this instance (see utils/decryption-cache). */
  withCache(options?: { ttlMs?: number }): CachedDecryptor {
    return createDecryptionCacheWrapper(this, options);
  }
```

(Net +12 lines: 3 methods × 4 lines incl. single-line JSDoc + blank-line separators.)

**Line-budget arithmetic:** 197 − 12 (header trim) + 2 (imports) + 0 (reEncrypt) + 12 (3 methods) = 199. To land at ≤198, also remove ONE blank line between two existing methods (e.g., the blank line before `destroy`'s JSDoc) OR trim the header by one more line. Implementer: after edits, run `wc -l src/crypto.service.ts` (or read file end) and ensure ≤200 (target ≤198). If at 199/200, remove one non-essential blank separator line. Do NOT remove logic or JSDoc content.

**Verification for this file:**
- Total lines ≤200 (target ≤198). ✓ (verify after edit)
- New method bodies: 1 line each (≤50). ✓
- Params: `encryptObject`/`decryptObject` = 2; `withCache` = 1. ✓
- `reEncrypt` param type widening is backward-compatible (enum ⊆ `EncryptionKey | string`). ✓

### Step 3.4 — Modify `src/index.ts`

**File:** `src/index.ts` (currently 48 lines)

**Edit 3.4.a — Add re-exports.** After the existing `export type { TtlCacheOptions, TtlCacheSetParams, DecryptionCache } from './utils/cache.js';` line (current line 48), append:

```ts
export { createDecryptionCacheWrapper } from './utils/decryption-cache.js';
export type {
  DecryptionCacheOptions,
  SecureCryptoDecryptor,
  CachedDecryptor,
} from './utils/decryption-cache.js';
export type { BulkFieldMap } from './crypto.service.bulk.js';
```

**Edit 3.4.b — Update the export-table JSDoc (lines 6–14).** Add three rows to the table:

```ts
 * | {@link createDecryptionCacheWrapper} | function | SecureCrypto-aware cache-through decrypt wrapper |
 * | {@link CachedDecryptor} | interface | Cache-through decryptor returned by withCache |
 * | {@link BulkFieldMap} | type | Per-field key mapping for encryptObject/decryptObject |
```

And append to the `@remarks` paragraph: `…, encryptObject/decryptObject (bulk), and withCache (cached decrypt).`

(`src/index.ts` is excluded from coverage in `package.json` jest config, so adding exports does not affect coverage thresholds.)

### Step 3.5 — Update `.agent/project-structure.md`

**File:** `.agent/project-structure.md` (authority: `project-structure` command; implementer is authorized to update this specific file.)

**Edit:** Update the two relevant bullets:

```markdown
- src/ - library root: main exports, config interfaces, SecureCrypto facade, HKDF derivation, helpers, and mixins (encryption/hashing/keys/validation/guards, plus bulk object-operations mixin crypto.service.bulk.ts)
- src/utils/ - in-memory TTL cache utility (cache.ts) and SecureCrypto-aware decryption cache wrapper (decryption-cache.ts); base64/IV/concat helpers remain in src/utils.ts
```

### Step 3.6 — Add minimal fixtures to `src/testing/test-vectors.ts`

**File:** `src/testing/test-vectors.ts` (excluded from coverage; safe to extend.)

**Edit:** After the `TEST_VECTORS` array (end of file, current line 99), append:

```ts

/** Fixture: object + field map for encryptObject/decryptObject roundtrip tests. */
export const BULK_OBJECT_FIXTURE = {
  object: { name: 'John Doe', email: 'john@x.com', reference: 'REF-1', publicScore: 42 },
  fieldMap: {
    name: EncryptionKey.PII,
    email: EncryptionKey.PII,
    reference: EncryptionKey.BANK_DATA,
  },
} as const;

/** Re-encryption scenario descriptors (v1 → v2 rotation + key-name switch). */
export const RE_ENCRYPT_SCENARIOS = [
  { plaintext: 'rotate-me', fromVersion: 1, toVersion: 2, keyName: EncryptionKey.PII },
  { plaintext: 'switch-category', fromVersion: 1, toVersion: 1, keyName: EncryptionKey.NOTIFICATION },
] as const;
```

Then re-export them from `src/testing/index.ts`:

```ts
export {
  TEST_VECTORS,
  encryptedDataByteLengthFor,
  BULK_OBJECT_FIXTURE,
  RE_ENCRYPT_SCENARIOS,
} from './test-vectors.js';
```

(Modify the existing `export { … } from './test-vectors.js';` block to add the two new names.)

### Step 3.7 — Create `tests/crypto.bulk.spec.ts` (NEW)

**File:** `tests/crypto.bulk.spec.ts`

Full content:

```ts
/**
 * Unit tests for SecureCrypto.encryptObject / decryptObject (bulk operations).
 */
import { EncryptionKey, SecureCrypto } from '../src/index.js';
import { buildTestCrypto, BULK_OBJECT_FIXTURE } from '../src/testing/index.js';
import type { EncryptedValue } from '@cobranza-apps/entities';

interface Person {
  name: string;
  email: string;
  note: string;
  counter: number;
}

const asEncryptedRecord = (obj: unknown): Record<string, EncryptedValue> =>
  obj as unknown as Record<string, EncryptedValue>;

describe('SecureCrypto — encryptObject / decryptObject', () => {
  let crypto: SecureCrypto;

  beforeEach(() => {
    crypto = buildTestCrypto(1);
  });

  it('roundtrips multiple fields through encryptObject then decryptObject', () => {
    const person: Person = { name: 'John', email: 'john@x.com', note: 'secret', counter: 5 };
    const fieldMap = { name: EncryptionKey.PII, email: EncryptionKey.PII, note: EncryptionKey.BANK_DATA };

    const encrypted = crypto.encryptObject(person, fieldMap);
    const decrypted = crypto.decryptObject(encrypted, fieldMap);

    expect(decrypted).toEqual(person);
  });

  it('encrypts only the listed fields and leaves others untouched', () => {
    const person: Person = { name: 'John', email: 'john@x.com', note: 'n', counter: 5 };

    const encrypted = crypto.encryptObject(person, { name: EncryptionKey.PII });

    expect(typeof asEncryptedRecord(encrypted).name.encryptedData).toBe('string');
    expect((encrypted as Person).email).toBe('john@x.com');
    expect((encrypted as Person).counter).toBe(5);
  });

  it('does not mutate the original object', () => {
    const person: Person = { name: 'John', email: 'e', note: 'n', counter: 1 };
    const fieldMap = { name: EncryptionKey.PII, email: EncryptionKey.PII };

    crypto.encryptObject(person, fieldMap);

    expect(person.name).toBe('John');
    expect(person.email).toBe('e');
  });

  it('returns a shallow-cloned equal object when fieldMap is empty', () => {
    const person: Person = { name: 'John', email: 'e', note: 'n', counter: 1 };

    const result = crypto.encryptObject(person, {});

    expect(result).toEqual(person);
    expect(result).not.toBe(person);
  });

  it('skips fields listed in the map but absent from the object', () => {
    const partial = { name: 'John', counter: 1 } as Person;
    const fieldMap = { name: EncryptionKey.PII, email: EncryptionKey.PII };

    const result = crypto.encryptObject(partial, fieldMap);

    expect(typeof asEncryptedRecord(result).name.encryptedData).toBe('string');
    expect((result as Person).email).toBeUndefined();
  });

  it('throws when an encrypt field is present but not a string', () => {
    const person: Person = { name: 'John', email: 'e', note: 'n', counter: 5 };

    expect(() => crypto.encryptObject(person, { counter: EncryptionKey.GENERAL })).toThrow(
      /expected a string to encrypt/,
    );
  });

  it('throws when a decrypt field is present but not an EncryptedValue', () => {
    const person: Person = { name: 'John', email: 'e', note: 'n', counter: 5 };

    expect(() => crypto.decryptObject(person, { name: EncryptionKey.PII })).toThrow(
      /expected an EncryptedValue to decrypt/,
    );
  });

  it('decryptObject ignores the fieldMap key-name values and uses each EncryptedValue keyName', () => {
    const person = { name: 'John' };
    const encrypted = crypto.encryptObject(person, { name: EncryptionKey.PII });

    const decrypted = crypto.decryptObject(encrypted, { name: EncryptionKey.BANK_DATA });

    expect(decrypted.name).toBe('John');
  });

  it('encryptObject stamps the current version on each encrypted field', () => {
    const v2 = buildTestCrypto(2);

    const encrypted = v2.encryptObject(
      { a: 'x', b: 'y' },
      { a: EncryptionKey.PII, b: EncryptionKey.GENERAL },
    );
    const record = asEncryptedRecord(encrypted);

    expect(record.a.version).toBe(2);
    expect(record.b.version).toBe(2);
  });

  it('roundtrips the shared BULK_OBJECT_FIXTURE', () => {
    const { object, fieldMap } = BULK_OBJECT_FIXTURE;

    const encrypted = crypto.encryptObject(object, fieldMap);
    const decrypted = crypto.decryptObject(encrypted, fieldMap);

    expect(decrypted).toEqual(object);
  });
});
```

**Coverage mapping for `crypto.service.bulk.ts`:**
- `encryptObjectFields`: valid-field assign ✓, empty-map clone ✓, absent-field skip ✓, wrong-type throw ✓ (via `assertStringFieldValue`).
- `decryptObjectFields`: valid-field roundtrip ✓, wrong-type throw ✓ (via `assertEncryptedFieldValue`), absent-field skip (covered by the `decryptObject` roundtrip with a partial map), ignored key-name ✓.
- `isEncryptedValue`: true branch (roundtrip) + false branch (wrong-type throw) ✓.
- `assertStringFieldValue`: string path + non-string path ✓.
- `assertEncryptedFieldValue`: EncryptedValue path + non-EncryptedValue path ✓.

### Step 3.8 — Create `tests/crypto.cache-wrapper.spec.ts` (NEW)

**File:** `tests/crypto.cache-wrapper.spec.ts`

Full content:

```ts
/**
 * Unit tests for SecureCrypto.withCache and createDecryptionCacheWrapper.
 */
import {
  EncryptionKey,
  SecureCrypto,
  createDecryptionCacheWrapper,
} from '../src/index.js';
import { buildTestCrypto } from '../src/testing/index.js';
import type { EncryptedValue } from '@cobranza-apps/entities';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('SecureCrypto — withCache', () => {
  let crypto: SecureCrypto;

  beforeEach(() => {
    crypto = buildTestCrypto(1);
  });

  it('returns the plaintext on first call and populates the cache', () => {
    const cached = crypto.withCache();
    const encrypted = crypto.encrypt('secret', EncryptionKey.PII);

    expect(cached.decrypt(encrypted)).toBe('secret');
    expect(cached.size()).toBe(1);
  });

  it('does not call the underlying decrypt on a cache hit', () => {
    const calls: string[] = [];
    const decryptor = {
      decrypt(encrypted: EncryptedValue) {
        calls.push(encrypted.encryptedData);
        return `plain-${encrypted.encryptedData}`;
      },
    };
    const cached = createDecryptionCacheWrapper(decryptor, { ttlMs: 1000 });
    const encrypted: EncryptedValue = { encryptedData: 'AAAA', keyName: 'pii' };

    cached.decrypt(encrypted);
    cached.decrypt(encrypted);

    expect(calls).toHaveLength(1);
  });

  it('re-invokes the underlying decrypt after the TTL expires', async () => {
    const calls: string[] = [];
    const decryptor = {
      decrypt(encrypted: EncryptedValue) {
        calls.push(encrypted.encryptedData);
        return 'plain';
      },
    };
    const cached = createDecryptionCacheWrapper(decryptor, { ttlMs: 1 });
    const encrypted: EncryptedValue = { encryptedData: 'AAAA', keyName: 'pii' };

    cached.decrypt(encrypted);
    await sleep(15);
    cached.decrypt(encrypted);

    expect(calls).toHaveLength(2);
  });

  it('uses the default TTL when options are omitted', () => {
    const cached = crypto.withCache();
    const encrypted = crypto.encrypt('secret', EncryptionKey.PII);

    cached.decrypt(encrypted);

    expect(cached.size()).toBe(1);
  });

  it('clear() empties the cache', () => {
    const cached = crypto.withCache();
    const encrypted = crypto.encrypt('secret', EncryptionKey.PII);

    cached.decrypt(encrypted);
    cached.clear();

    expect(cached.size()).toBe(0);
  });

  it('does not cache a result when the underlying decrypt throws', () => {
    const cached = crypto.withCache();

    expect(() => cached.decrypt(null as unknown as EncryptedValue)).toThrow();
    expect(cached.size()).toBe(0);
  });
});

describe('createDecryptionCacheWrapper', () => {
  it('throws when ttlMs is non-positive (delegated to TtlCache)', () => {
    const decryptor = { decrypt: () => 'x' };

    expect(() => createDecryptionCacheWrapper(decryptor, { ttlMs: 0 })).toThrow(
      /positive finite number/,
    );
  });

  it('throws when ttlMs is NaN (delegated to TtlCache)', () => {
    const decryptor = { decrypt: () => 'x' };

    expect(() => createDecryptionCacheWrapper(decryptor, { ttlMs: NaN })).toThrow(
      /positive finite number/,
    );
  });
});
```

**Coverage mapping for `src/utils/decryption-cache.ts`:**
- `resolveTtlMs`: provided ttlMs ✓ + omitted (default) ✓.
- `createDecryptionCacheWrapper`: cache miss + set ✓, cache hit (early return) ✓, TTL expiry re-decrypt ✓, `clear` ✓, `size` ✓, throw-not-cached ✓, non-positive ttlMs throw ✓, NaN throw ✓.
- `TtlCache` integration reused (not re-tested exhaustively — already covered by `utils.cache.spec.ts`).

### Step 3.9 — Update `tests/crypto.reencrypt.spec.ts`

**File:** `tests/crypto.reencrypt.spec.ts`

**Edit 3.9.a — Rename `newKeyName` → `targetKeyName` in test descriptions.**
- Line 22: `'preserves the keyName when newKeyName is omitted'` → `'preserves the keyName when targetKeyName is omitted'`
- Line 66: `'throws when newKeyName is empty (via encrypt guard)'` → `'throws when targetKeyName is empty (via encrypt guard)'`

**Edit 3.9.b — Add `RE_ENCRYPT_SCENARIOS` to the import block** at the top of the file:

```ts
import { buildTestCrypto, RE_ENCRYPT_SCENARIOS } from '../src/testing/index.js';
```

**Edit 3.9.c — Add two tests** (inside the `describe` block, before the closing `});`):

```ts
  it('accepts a non-enum string key name as targetKeyName (widened type)', () => {
    const encrypted = encrypt('custom-key');

    const reEncrypted = crypto.reEncrypt(encrypted, 'custom_category');

    expect(reEncrypted.keyName).toBe('custom_category');
    expect(crypto.decrypt(reEncrypted)).toBe('custom-key');
  });

  it('roundtrips each RE_ENCRYPT_SCENARIO from fromVersion to toVersion', () => {
    for (const scenario of RE_ENCRYPT_SCENARIOS) {
      const source = buildTestCrypto(scenario.fromVersion);
      const target = buildTestCrypto(scenario.toVersion);
      const encrypted = source.encrypt(scenario.plaintext, scenario.keyName);

      const rotated = target.reEncrypt(encrypted);

      expect(rotated.version).toBe(scenario.toVersion);
      expect(target.decrypt(rotated)).toBe(scenario.plaintext);
    }
  });
```

> Use the ESM `import` form (Edit 3.9.b), not CommonJS `require`, to match the project's ESM test conventions.

**Coverage note:** `reEncrypt` param rename does not change branch structure; existing tests + the new non-enum-string test keep `reEncrypt` fully covered. The new test exercises the widened `EncryptionKey | string` union at runtime (non-enum string path).

### Step 3.10 — Build, lint, test, commit

Run from repo root (`C:\projects\cobranza-app\crypto`):

```bash
npm run build
npm run lint
npm test
```

**Acceptance gates (all must pass):**
- `npm run build` (tsc) — zero errors.
- `npm run lint` — zero errors/warnings on touched files.
- `npm test` — all tests pass; **100% statement/branch/function/line coverage on `src/crypto.service.bulk.ts` and `src/utils/decryption-cache.ts`**; global thresholds (≥85%) maintained; `src/crypto.service.ts` coverage not regressed.
- `src/crypto.service.ts` total lines ≤200 (target ≤198).

**Gitignore compliance check before each commit:** read `.gitignore`, run `git status`, ensure no `dist/`, `node_modules/`, or other ignored paths are staged.

**Commit grouping (on `feat/phase4-advanced-features`):**

1. After Steps 3.1 + 3.3 (bulk) + 3.4 (index bulk export) + 3.5 (structure) + 3.7 (bulk spec) + 3.6 (bulk fixture):
   ```
   feat(crypto): add encryptObject/decryptObject bulk operations mixin
   ```
2. After Steps 3.2 + 3.3 (withCache) + 3.4 (cache exports) + 3.8 (cache spec):
   ```
   feat(crypto): add SecureCrypto-aware decryption cache wrapper and withCache
   ```
3. After Step 3.3 (reEncrypt) + 3.9 (reencrypt spec):
   ```
   refactor(crypto): align reEncrypt targetKeyName param to EncryptionKey | string
   ```

(Implementer may collapse into fewer commits if cleaner, but keep the three logical concerns distinguishable in history. Each commit must leave the build green.)

---

## 4. Files Touched (summary)

| File | Action | New/Modified |
|---|---|---|
| `src/crypto.service.bulk.ts` | Create | NEW |
| `src/utils/decryption-cache.ts` | Create | NEW |
| `src/crypto.service.ts` | Modify (header trim, imports, reEncrypt param, 3 methods) | Modified |
| `src/index.ts` | Modify (re-exports + JSDoc table) | Modified |
| `src/testing/test-vectors.ts` | Modify (add 2 fixtures) | Modified |
| `src/testing/index.ts` | Modify (re-export 2 fixtures) | Modified |
| `.agent/project-structure.md` | Modify (2 bullet updates) | Modified |
| `tests/crypto.bulk.spec.ts` | Create | NEW |
| `tests/crypto.cache-wrapper.spec.ts` | Create | NEW |
| `tests/crypto.reencrypt.spec.ts` | Modify (rename desc + 2 new tests) | Modified |

**Out of scope for Task 1 (handled by later tasks):** AuditLogger hooks (Task 2), runtime `typeof` hardening of facade methods / version+algorithm validation / buffer zeroing (Task 3), README + `docs/real-world-scenarios.md` examples + comprehensive test-vector expansion (Task 4), full JSDoc expansion on new methods (Step 4.4 docs-specialist).

---

## 5. Verification Checklist (for Step 4.5 architect)

- [ ] `src/crypto.service.bulk.ts` exists, ≤200 lines, 100% coverage.
- [ ] `src/utils/decryption-cache.ts` exists, ≤200 lines, 100% coverage.
- [ ] `src/crypto.service.ts` ≤200 lines (target ≤198); `reEncrypt` param is `targetKeyName?: EncryptionKey | string`.
- [ ] `encryptObject`/`decryptObject`/`withCache` present on `SecureCrypto` as thin delegators.
- [ ] `src/index.ts` re-exports `createDecryptionCacheWrapper`, `CachedDecryptor`, `DecryptionCacheOptions`, `SecureCryptoDecryptor`, `BulkFieldMap`.
- [ ] `npm run build` clean; `npm run lint` clean; `npm test` green with 100% coverage on the two new source files.
- [ ] `.agent/project-structure.md` updated.
- [ ] No `.gitignore`-matching files staged; all commits on `feat/phase4-advanced-features`.

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Facade exceeds 200 lines after edits | Header JSDoc trim (−12) + single-line method JSDoc; implementer verifies `wc -l` ≤200 and removes one blank separator if needed. |
| `BulkFieldMap<T>` deviates from literal TODO | Documented in §1.3 D2; refinement fixes a latent `Record<keyof T,…>` partial-map bug and aligns with `encrypt`'s `EncryptionKey \| string`. |
| `decryptObject` fieldMap values unused | Documented in JSDoc (D6); map used only for field selection; preserves API symmetry with `encryptObject`. |
| Cache caches plaintext in memory (security) | Opt-in only via explicit `withCache()`; brief §7 already documents this trade-off; no plaintext logged. |
| Test-vector scope overlap with Task 4 | Task 1 adds only minimal fixtures (D8); Task 4 expands comprehensively. |
| `reEncrypt` param rename breaks callers | Parameter rename is not a compile-time break; type widening (`string` → `EncryptionKey \| string`) is backward-compatible. |

---

## 7. Plan vs. Original Task Compliance

| TODO Task 1 item | Covered by |
|---|---|
| `encryptObject<T>(obj, fieldMap): T` | Step 3.1 (free fn) + Step 3.3 (facade method) + Step 3.7 (tests) |
| `decryptObject<T>(obj, fieldMap): T` | Step 3.1 + Step 3.3 + Step 3.7 |
| `reEncrypt(encrypted, targetKeyName?: EncryptionKey): EncryptedValue` (aligned to `EncryptionKey \| string`) | Step 3.3.c + Step 3.9 |
| Decryption cache utility in `src/utils/decryption-cache.ts` (in-memory, configurable TTL) | Step 3.2 + Step 3.8 |
| `withCache()` wrapper method on `SecureCrypto` | Step 3.2 (factory) + Step 3.3.d (facade method) + Step 3.8 |

All five TODO Task 1 sub-items are fully covered. Plan is complete and ready for approval.
