# Plan — Task 3: Testing Module Polish (4.1 Analysis & Planning)

**TODO:** `.agent/todos/20260707/20260707-todo-2.md` → Task 3 (lines 47–66)
**Plan path:** `.kilo/plans/20260708-task3-testing-polish.md`
**Scope:** Single Task 3 sub-cycle (4.1 only). No other tasks, no implementation execution.
**Date:** 2026-07-08

---

## 1. Task Restatement

Task 3 requires finalizing the `@cobranza-apps/crypto/testing` subpath so that any
Cobranza microservice developer can import it and instantly obtain a reliable,
deterministic test `SecureCrypto` instance plus a curated, reproducible suite of
test vectors. Concretely:

1. `src/testing/index.ts` — export `getTestCrypto()` (done) and *optionally* a
   `SecureCryptoTestProvider` / NestJS `TestingModule` factory; ensure easy use
   in both plain Jest and NestJS tests.
2. `src/testing/test-vectors.ts` — ≥10 comprehensive vectors, each including
   `plaintext`, `keyName`, `expectedEncryptedValue` (partial or full match),
   `expectedHash`, and `version`; edge cases: empty, special chars, long text,
   different key categories; per-vector comments.
3. Update tests to **heavily** use these vectors for consistency/reproducibility.
4. Document (in code + a new `/docs` file, linked from README) how
   microservices import and use the utilities.

**Acceptance criteria**
- Import `@cobranza-apps/crypto/testing` → reliable test instance, no manual key config.
- All test vectors produce consistent, repeatable results across runs.

---

## 2. Current-State Analysis (researched via file reads)

### 2.1 `src/testing/index.ts` (116 lines)
Already exports:
- `TEST_MASTER_KEY` (all-zero 32 bytes, base64), `TEST_HASH_SALT` (all-zero 64 bytes, base64), `TEST_CRYPTO_CONFIG`.
- `buildTestCrypto(version?)` → fresh `SecureCrypto` with fixed config (version override optional).
- `getTestCrypto()` = alias for `buildTestCrypto()`.
- `SecureCryptoTestModule` (a `SecureCryptoProviderConfig` object — `{ providers:[{ provide: SecureCrypto, useFactory: getTestCrypto }], exports:[SecureCrypto] }`), documented as spreadable into `Test.createTestingModule`.
- Re-exports `TEST_VECTORS`, `TestVector`, `TEST_CRYPTO_CONFIG`.

Gaps vs. Task 3 wording:
- TODO mentions "optionally export `SecureCryptoTestProvider` or factory for NestJS `TestingModule`". Only `SecureCryptoTestModule` exists; no `SecureCryptoTestProvider` alias and no factory function that accepts a version override for NestJS DI in version-specific tests.
- No link/reference to the upcoming `/docs/testing-utilities.md`.

### 2.2 `src/testing/test-vectors.ts` (130 lines)
- Defines `PHASE2_PLACEHOLDER = 'PLACEHOLDER_PHASE2'`.
- `TestVector` interface fields: `plaintext`, `keyName`, `version`, `expectedEncrypted: string`, `expectedHash: string`.
- 11 vectors covering every `EncryptionKey` + edge cases (empty, CJK, unicode/emoji, embedded newline, long 10 000-char text, v2 isolation). Per-vector `/* N — … */` comments already present.
- All 11 `expectedHash` values are **real** base64 HMAC-SHA256 literals (computed from the fixed zero test keys) — fully deterministic and reproducible.
- All 11 `expectedEncrypted` values are `PHASE2_PLACEHOLDER` because AES-256-GCM uses a random 12-byte IV (`crypto.service.encryption.ts` → `encryptWithAesGcm` → `generateIv()` → `crypto.randomBytes(12)`), making the exact ciphertext non-deterministic.

### 2.3 Tests using vectors
- `tests/crypto.encrypt-decrypt.spec.ts`: uses `TEST_VECTORS` via `it.each` for roundtrip + structural `EncryptedValue` checks (algorithm, keyName, version, min payload length). No reference to `vector.expectedEncrypted`.
- `tests/crypto.hashing.spec.ts`: `it.each(TEST_VECTORS)` asserting `hash() === expectedHash` and `verifyHash` true. No reference to `vector.expectedEncrypted`.
- `tests/crypto.service.spec.ts`: `encryptAndHash` `it.each(TEST_VECTORS)` asserts roundtrip + `hash === expectedHash` + structural fields. No reference to `vector.expectedEncrypted`.
- `tests/crypto.internals.spec.ts`: module-internal coverage; imports `TEST_CRYPTO_CONFIG`, `TEST_MASTER_KEY`.

Verified via grep: **no test reads `vector.expectedEncrypted`** — only `test-vectors.ts` defines the placeholder. Renaming/changing its type is therefore safe.

### 2.4 Security / architectural constraints bearing on `expectedEncrypted`
- `brief.md §7` and `architecture.md` "Security Boundaries": **"Non-random IVs are prohibited."**
- `encryptWithAesGcm` (in `src/crypto.service.encryption.ts`) hard-codes the IV via `generateIv(IV_LENGTH_BYTES)`; the IV is **never** injectable through `SecureCrypto.encrypt`.
- `code-guidelines.md`: Security-First Approach; never weaken cryptography for test convenience.

### 2.5 Prior plan context (consistency)
- `.kilo/plans/20260708-task2-review.md` flagged the placeholder as an M2 deviation and recommended `expectedEncryptedPrefix` or `expectedEncryptedMinLength`.
- `.kilo/plans/20260708-task2-testing-simplify.md` suggested making `expectedEncrypted` optional or deferring real ciphertexts to Task 3.
- `.kilo/plans/20260708-task4-testing.md` (D5) recorded that Phase 2 must assert roundtrip/structure rather than exact ciphertext because of the random IV.

This plan resolves the deferred decision (Task 3's explicit mandate).

---

## 3. Design Decision — Handling `expectedEncrypted` Determinism

### Options considered
- **Option A — Test-only deterministic IV mode** (injectable IV in `encryptWithAesGcm`, or a `SecureCrypto` test subclass overriding `encrypt`). **REJECTED.** It ships a non-random-IV capability into a production-shipped module (`crypto.service.encryption.ts` is part of `dist/`), violating `brief.md §7` / `architecture.md` ("Non-random IVs are prohibited") and the Security-First rule. Even guarded/undocumented, it is a production footgun and an audit finding.
- **Option B — Remove `expectedEncrypted` entirely**, document non-determinism, rely solely on roundtrip. **Partially accepted but insufficient alone.** The TODO explicitly requires each vector to include an `expectedEncryptedValue` ("partial or full match"). Removing it fails the wording and loses a cheap regression signal (structural integrity of the payload).
- **Option C — Structural `expectedEncrypted` shape.** Store deterministic structural properties of `EncryptedValue` instead of an exact ciphertext: `algorithm`, `keyName`, `version`, and `encryptedDataByteLength`. The byte length **is** deterministic: `12 (IV) + utf8ByteLength(plaintext) (ciphertext) + 16 (authTag)` — the IV and authTag sizes are fixed by AES-256-GCM. Correctness of the ciphertext itself is covered by the encrypt→decrypt roundtrip (already present). **ACCEPTED.**

### Recommendation
**Adopt Option C** (structural shape) and **keep Option B's documentation** (explain in code + `/docs` why exact ciphertext is intentionally absent). This:
1. Satisfies the TODO "partial match" wording (structural fields are a partial match of the `EncryptedValue`).
2. Satisfies "consistent, repeatable results across test runs" — the structural fields are byte-identical across every run.
3. Preserves the security boundary (no non-random IV path anywhere).
4. Adds a real regression signal: a payload-length assertion catches IV-length, authTag-handling, or packing regressions that a roundtrip alone might mask if the underlying contract drifted.

The exact ciphertext will remain non-deterministic by design; roundtrip tests (already in place) verify cryptographic correctness.

---

## 4. High-Level Approach

1. **`src/testing/test-vectors.ts`**
   - Delete `PHASE2_PLACEHOLDER` sentinel.
   - Introduce `ExpectedEncryptedShape` interface + pure helper `encryptedDataByteLengthFor(plaintext)` (`28 + Buffer.byteLength(plaintext, 'utf8')`) + jest-agnostic predicate `encryptedMatchesShape(encrypted, vector)`.
   - Replace `expectedEncrypted: string` field on `TestVector` with `expectedEncryptedShape: ExpectedEncryptedShape`, deriving `encryptedDataByteLength` via the helper so values stay correct by construction.
   - Refresh file header JSDoc to describe the structural approach + random-IV rationale.
   - Per-vector comments already present; lightly extend the header of edge-case vectors if needed (already adequate — keep churn minimal).
2. **`src/testing/index.ts`**
   - Re-export `ExpectedEncryptedShape`, `encryptedDataByteLengthFor`, `encryptedMatchesShape`.
   - Add `SecureCryptoTestProvider` = alias of `SecureCryptoTestModule` (naming parity with TODO) + factory `createSecureCryptoTestProvider(version?)` returning a fresh provider config for version-specific NestJS tests.
   - Update file-level JSDoc to reference the new `/docs/testing-utilities.md` guide.
3. **Tests** — make structural-shape assertions vector-driven (expand the existing "encrypted value structure" block) so vectors are used **heavily** and consistently; refresh stale Phase-1/Phase-2 prose in spec headers.
4. **`docs/testing-utilities.md`** (new) — comprehensive guide; link from `README.md` (Testing section + Guides list) and `docs/README.md` index.
5. **Verify** — `npm run build`, `npm run test` (jest --coverage, ≥85% maintained), `npm run lint`.
6. **Commit** within the existing feature branch (Critical Workflow Step 2 already created the branch).

---

## 5. Detailed, Atomic, Verifiable Steps

### Step 0 — Preconditions (verify, do not branch)
- [ ] Confirm current branch is the Task-3 feature branch (`git status`). If not, **stop and return to caller** — branching is Critical Workflow Step 2, already executed.
- [ ] Confirm working tree has no uncommitted unintended files; do not stage `node_modules/`, `dist/`, `coverage/`, `.env*` (gitignore-compliance rule).

### Step 1 — `src/testing/test-vectors.ts` rewrite

**1.1** Replace file header JSDoc (lines 1–10) with:

```ts
/**
 * Deterministic test vectors for SecureCrypto operations.
 *
 * Fields:
 * - `expectedHash` — real base64 HMAC-SHA256 literal, fully deterministic
 *   (HMAC is salt-keyed and plaintext-deterministic). Asserted exactly.
 * - `expectedEncryptedShape` — deterministic STRUCTURAL shape of the
 *   `EncryptedValue`, NOT an exact ciphertext. AES-256-GCM uses a random
 *   12-byte IV per encryption, so the ciphertext itself is non-deterministic
 *   (brief §7 / architecture.md: "Non-random IVs are prohibited"). The shape
 *   asserts `algorithm`, `keyName`, `version`, and `encryptedDataByteLength`
 *   (= 12 IV + utf8(plaintext) ciphertext + 16 authTag). Ciphertext correctness
 *   is verified separately via encrypt→decrypt roundtrip tests.
 *
 * @packageDocumentation
 */
```

**1.2** Remove the `PHASE2_PLACEHOLDER` constant (line 15).

**1.3** After the `EncryptionKey` import, add the deterministic helper + shape type + predicate. Keep ≤2 nesting levels and ≤2 params (max-args rule). Use an object param for the predicate (3 logical fields) → define a small param type in this file (max-args rule; co-located with `TestVector` for cohesion; file stays under the line cap).

```ts
/** AES-256-GCM payload = 12-byte IV + 16-byte auth tag, both fixed by the algorithm. */
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const FIXED_OVERHEAD_BYTES = IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES;

/** Deterministic structural shape of an `EncryptedValue` (no exact ciphertext). */
export interface ExpectedEncryptedShape {
  readonly algorithm: 'aes-256-gcm';
  readonly keyName: string;
  readonly version: number;
  readonly encryptedDataByteLength: number;
}

/** Deterministic byte length of the base64-decoded `IV + ciphertext + authTag` payload. */
export function encryptedDataByteLengthFor(plaintext: string): number {
  return FIXED_OVERHEAD_BYTES + Buffer.byteLength(plaintext, 'utf8');
}
```

**1.4** Replace the `TestVector` interface field:

```ts
export interface TestVector {
  readonly plaintext: string;
  readonly keyName: EncryptionKey;
  readonly version: number;
  /** Deterministic structural shape; ciphertext itself is non-deterministic (random IV). */
  readonly expectedEncryptedShape: ExpectedEncryptedShape;
  readonly expectedHash: string;
}
```

**1.5** Add a small object-param type + jest-agnostic predicate (max-args: 1 object param). This avoids the multi-section inline boolean (single-section-boolean-conditions rule) by encapsulating checks.

```ts
/** Minimal `EncryptedValue`-like input for {@link encryptedMatchesShape}. */
export interface EncryptedMatchInput {
  readonly algorithm?: string;
  readonly keyName: string;
  readonly version?: number;
  readonly encryptedData: string;
}

/** Inputs to {@link encryptedMatchesShape}. */
export interface EncryptedMatchParams {
  readonly encrypted: EncryptedMatchInput;
  readonly vector: TestVector;
}

/** Whether an `EncryptedValue` matches the vector's deterministic structural shape. */
export function encryptedMatchesShape(params: EncryptedMatchParams): boolean {
  const { encrypted, vector } = params;
  const shape = vector.expectedEncryptedShape;
  const decodedLength = Buffer.from(encrypted.encryptedData, 'base64').length;
  return encrypted.algorithm === shape.algorithm
    && encrypted.keyName === shape.keyName
    && (encrypted.version ?? vector.version) === shape.version
    && decodedLength === shape.encryptedDataByteLength;
}
```
(The `&&` chain is a predicate return, not an `if` condition; it expresses a single boolean result. Should review flag it, encapsulate each clause in a private `sameAlgorithm(...)`, etc. helper — implementer decides based on reviewer feedback.)

**1.6** Rebuild each of the 11 vectors. Use the helper to derive `encryptedDataByteLength` so values are correct by construction (no manual byte counting). Example for vector 1; apply the same shape to all 11:

```ts
/* 1 — Typical PII email (v1). */
{
  plaintext: 'john.doe@example.com',
  keyName: EncryptionKey.PII,
  version: 1,
  expectedEncryptedShape: {
    algorithm: 'aes-256-gcm',
    keyName: EncryptionKey.PII,
    version: 1,
    encryptedDataByteLength: encryptedDataByteLengthFor('john.doe@example.com'),
  },
  expectedHash: 'oM9H5AO39AGxLZwhbmlmpwNP2rsmSJ/gLKh9ARt4UEA=',
},
```

Leave `plaintext`, `keyName`, `version`, `expectedHash` **unchanged** for all 11 vectors (Task 2 already produced correct hash literals — do NOT recompute or alter them).

**1.7 Determinism verification table (human review; the helper computes these at runtime, but listing them aids review):**

| # | plaintext | utf8 bytes | encryptedDataByteLength |
|---|-----------|-----------:|------------------------:|
| 1 | `john.doe@example.com` | 20 | 48 |
| 2 | `12-34567890-1` | 13 | 41 |
| 3 | `PAYMENT-REF-2026-000001` | 23 | 51 |
| 4 | `Your invoice #12345 is ready` | 29 | 57 |
| 5 | `generic-sensitive-value` | 23 | 51 |
| 6 | `José María — Cañón ünïcode😀` | 38 | 66 |
| 7 | `` (empty) | 0 | 28 |
| 8 | `42` | 2 | 30 |
| 9 | `你好世界` | 12 | 40 |
| 10 | `line1\nline2` | 11 | 39 |
| 11 | `A`.repeat(10000) | 10000 | 10028 |

Implementer must run a one-shot verifier (a temp `node -e` snippet — implementer sub-agent has bash) to confirm `Buffer.byteLength` for the multi-byte vectors (6, 9) before committing; table values are authoritative expectations.

**1.8 Rule checks for this file:** ≤200 lines (projecting ~160 lines OK); no `PHASE2_PLACEHOLDER` references remain; no commented code; self-documenting names; private-by-default (`IV_LENGTH_BYTES`, `AUTH_TAG_LENGTH_BYTES`, `FIXED_OVERHEAD_BYTES` are module-private — not exported).

### Step 2 — `src/testing/index.ts` additions

**2.1** Extend the re-export block (after `export { TEST_VECTORS }`) to:

```ts
export type {
  ExpectedEncryptedShape,
  EncryptedMatchInput,
  EncryptedMatchParams,
  TestVector,
} from './test-vectors.js';
export {
  TEST_VECTORS,
  encryptedDataByteLengthFor,
  encryptedMatchesShape,
} from './test-vectors.js';
```
(Remove the now-duplicate single `export type { TestVector }` and `export { TEST_VECTORS }` lines to avoid double-export errors.)

**2.2** Add `SecureCryptoTestProvider` alias + version-aware factory. Insert after the `SecureCryptoTestModule` const:

```ts
/** NestJS provider-config alias (naming parity with brief §6 "SecureCryptoTestProvider"). */
export const SecureCryptoTestProvider: SecureCryptoProviderConfig = SecureCryptoTestModule;

/**
 * Build a fresh NestJS provider config for {@link SecureCrypto} with an optional
 * key-version override, for version-specific `Test.createTestingModule` setups.
 */
export function createSecureCryptoTestProvider(version?: number): SecureCryptoProviderConfig {
  return {
    providers: [{ provide: SecureCrypto, useFactory: () => buildTestCrypto(version) }],
    exports: [SecureCrypto],
  };
}
```

**2.3** Update file-level JSDoc "Exports" list + add `@see` to the docs guide:

```
 * - {@link SecureCryptoTestProvider} / {@link createSecureCryptoTestProvider} — NestJS DI helpers.
 * - {@link encryptedMatchesShape}, {@link encryptedDataByteLengthFor}, {@link ExpectedEncryptedShape} — structural assertions.
 * @see `docs/testing-utilities.md` for the consumer guide (Jest + NestJS).
```
(Use a relative repo path reference, not an absolute URL.)

**2.4 Rule checks:** ≤200 lines (projecting ~150 lines OK); `max-args` satisfied (`createSecureCryptoTestProvider` has 1 param); `max-depth` ≤2 OK.

### Step 3 — Tests: vector-driven structural assertions

**3.1** `tests/crypto.encrypt-decrypt.spec.ts`
- In the existing `describe('encrypted value structure', ...)` block (lines 54–68), replace the inline assertions to read from `vector.expectedEncryptedShape` and add the **exact** byte-length assertion (currently only `>= MIN_PAYLOAD_BYTES`):

```ts
it.each(TEST_VECTORS)(
  'matches the deterministic expectedEncryptedShape for %j',
  (vector) => {
    const cryptoInstance = buildTestCrypto(vector.version);
    const encrypted = cryptoInstance.encrypt(vector.plaintext, vector.keyName);
    const shape = vector.expectedEncryptedShape;

    expect(encrypted.algorithm).toBe(shape.algorithm);
    expect(encrypted.keyName).toBe(shape.keyName);
    expect(encrypted.version).toBe(shape.version);
    expect(Buffer.from(encrypted.encryptedData, 'base64').length)
      .toBe(shape.encryptedDataByteLength);
  },
);
```

- Keep the existing empty-plaintext `MIN_PAYLOAD_BYTES === 28` test (it now also equals `encryptedDataByteLengthFor('')`); optionally assert equality to the helper to cross-check.
- Update the file header comment (lines 1–6) to drop "vectors are asserted structurally + via roundtrip (no exact-ciphertext literal)" phrasing that implied placeholders; reword to point at `expectedEncryptedShape`.

**3.2** `tests/crypto.service.spec.ts`
- In `describe('encryptAndHash', ...)` (lines 74–89), after the roundtrip + `hash === expectedHash` assertions, add structural-shape assertions:

```ts
const shape = vector.expectedEncryptedShape;
expect(result.encrypted.algorithm).toBe(shape.algorithm);
expect(Buffer.from(result.encrypted.encryptedData, 'base64').length)
  .toBe(shape.encryptedDataByteLength);
```

- Optionally add one consumer-style test using the jest-agnostic predicate to lock its behavior:

```ts
it('encryptedMatchesShape returns true for a vector-aligned encryption', () => {
  const cryptoInstance = buildTestCrypto(1);
  const vector = TEST_VECTORS[0];
  const encrypted = cryptoInstance.encrypt(vector.plaintext, vector.keyName);
  expect(encryptedMatchesShape({ encrypted, vector })).toBe(true);
});
```

- Import `encryptedMatchesShape` from `../src/testing/index.js`.

**3.3** `tests/crypto.hashing.spec.ts` — no functional change needed (already heavily vector-driven). Optionally add a one-line comment confirming `expectedHash` literals are the deterministic contract; do NOT alter hash assertions.

**3.4** `tests/crypto.internals.spec.ts` — no change required.

**3.5** Refresh any stale Phase-1/Phase-2 prose in spec file headers (remove references to `PLACEHOLDER_PHASE2`). Grep the `tests/` dir for `PLACEHOLDER` / `Phase 1` and update wording only (no logic change).

### Step 4 — New `docs/testing-utilities.md`

File must include a TOC (it will exceed 100 lines → critical-workflow 4.4 rule). Suggested outline (≥100 lines, TOC at top):

```markdown
# Testing Utilities — `@cobranza-apps/crypto/testing`

## Table of Contents
- [Overview](#overview)
- [Imports](#imports)
- [Plain Jest Usage](#plain-jest-usage)
- [NestJS TestingModule Usage](#nestjs-testingmodule-usage)
- [Test Vectors](#test-vectors)
- [Why No Exact Ciphertext](#why-no-exact-ciphertext)
- [Exported API Reference](#exported-api-reference)
- [Recipes](#recipes)

## Overview
Any microservice can `import { getTestCrypto } from '@cobranza-apps/crypto/testing'`
and obtain a `SecureCrypto` pre-configured with fixed, deterministic, TEST-ONLY
keys (zero-filled buffers). No manual key configuration. Safe to publish; never
usable in production (brief §7).

## Imports
Two subpaths:
- `@cobranza-apps/crypto` → `SecureCrypto`, `EncryptionKey`, `CryptoConfig`.
- `@cobranza-apps/crypto/testing` → all testing utilities (listed below).

## Plain Jest Usage
[getTestCrypto() / buildTestCrypto(version) + TEST_VECTORS + encryptedMatchesShape example]

## NestJS TestingModule Usage
[Spread SecureCryptoTestModule / SecureCryptoTestProvider; createSecureCryptoTestProvider(version) for version-scoped modules]

## Test Vectors
[Explain TEST_VECTORS structure; 11 vectors; edge cases; expectedEncryptedShape is structural; expectedHash is exact.]

## Why No Exact Ciphertext
[AES-256-GCM random 12-byte IV → non-deterministic ciphertext; "Non-random IVs are prohibited" (brief §7, architecture.md); correctness verified via encrypt→decrypt roundtrip; structural shape provides the deterministic regression signal.]

## Exported API Reference
[Table of every export from testing/index.ts with one-line description.]

## Recipes
- [Encrypt + assert shape]
- [Hash exact match]
- [encryptAndHash dual-column pattern]
- [Version rotation test]
```

Content rules: real newlines (newline-prevention rule); no emojis; concise; cross-link to `README.md` and `.agent/project-info/architecture.md`.

### Step 5 — Link the docs file

**5.1** `README.md` — Testing section (around lines 245–276):
- Replace the stale Phase-1 note (lines 259–263 about `PLACEHOLDER_PHASE2`) with Phase-2-finalized wording: vectors now carry a real `expectedHash` literal and a deterministic `expectedEncryptedShape`; no `PLACEHOLDER` remains.
- Add a Guides bullet: `- [Testing Utilities](./docs/testing-utilities.md) — Importing and using the testing subpath (Jest + NestJS).`
- **Scope guard:** do NOT rewrite the rest of README (Task 4 owns full README/docs revision). Only the Testing section + the Guides link.

**5.2** `docs/README.md` — add under "For Library Consumers":
```
- [Testing Utilities](./testing-utilities.md) — Importing and using `@cobranza-apps/crypto/testing` (Jest + NestJS), test-vector design.
```

### Step 6 — `.agent/project-structure.md` check
No new `src/` folders are created (the `docs/` folder already exists and is documented). No update required. If the implementer adds anything new under `src/`, update this file per project-structure rule. (Current plan adds only `docs/testing-utilities.md` — no `src/` change.)

### Step 7 — Build, test, coverage, lint
- [ ] `npm run build` (tsc) — must succeed with no type errors (the `TestVector` field rename and new exports must compile cleanly; verify no consumer of `expectedEncrypted: string` remains — confirmed by grep).
- [ ] `npm run test` (jest --coverage) — all suites green; global coverage thresholds (statements/branches/functions/lines ≥85%) still met. Note: `src/testing/**` is excluded from coverage collection (`package.json` jest config), so new helpers don't move the threshold either way, but they are exercised by tests.
- [ ] `npm run lint` — no new eslint errors.

### Step 8 — Commit (within existing feature branch)
- [ ] `git status` — confirm only intended files staged; ensure no `node_modules/`, `dist/`, `coverage/`, `.env*` staged (gitignore-compliance).
- [ ] Stage: `src/testing/test-vectors.ts`, `src/testing/index.ts`, the touched `tests/*.spec.ts`, `docs/testing-utilities.md`, `README.md`, `docs/README.md`.
- [ ] Commit message (matches repo style — concise, imperative):
  `feat(testing): finalize test vectors with structural encrypted shape and docs`
- [ ] Do NOT push (Plan Agent handles push in Critical Workflow Step 5; git-remote-safety rule).

---

## 6. Verification Against Original Task

| TODO requirement (Task 3) | Addressed by |
|---|---|
| Export `getTestCrypto()` factory (fixed deterministic keys) | Already present (Step 0); preserved. |
| Optionally export `SecureCryptoTestProvider` / NestJS `TestingModule` factory | Step 2.2 (alias + `createSecureCryptoTestProvider`). |
| Easy in Jest **and** NestJS tests | Step 4 docs recipes + existing `getTestCrypto`/`SecureCryptoTestModule`. |
| ≥10 comprehensive vectors | 11 vectors (unchanged count); finalized shape in Step 1.6. |
| Each vector: `plaintext`, `keyName`, `expectedEncryptedValue` (partial/full), `expectedHash`, `version` | `expectedEncryptedShape` is the partial-match `expectedEncryptedValue` (Option C, justified). All fields present. |
| Edge cases: empty, special chars, long text, different key categories | Vectors 6,7,9,10,11 + 5 key categories — already present; preserved. |
| Comments explaining each test case | Already present per-vector `/* N — … */`; header JSDoc refreshed (Step 1.1). |
| Update tests to heavily use vectors | Step 3 (shape assertions vector-driven). |
| Document in code + new `/docs` file, link to README | Step 4 (new doc) + Step 5 (links). Code docs via JSDoc in Steps 1.1, 1.3, 2.3. |
| Acceptance: import → reliable test instance, no manual config | `getTestCrypto()` / `SecureCryptoTestModule` (existing) + docs. |
| Acceptance: consistent, repeatable results across runs | `expectedHash` exact + `expectedEncryptedShape` structural — both deterministic by construction. |

---

## 7. Risks & Mitigations
- **Risk:** Renaming `expectedEncrypted` → `expectedEncryptedShape` breaks a consumer outside this repo. **Mitigation:** This package is `private: true` (package.json), workspace-internal, no external consumers yet. Grep confirms no internal usages of the field. Safe.
- **Risk:** Manual byte-count errors for multi-byte vectors (6, 9). **Mitigation:** Derive via `encryptedDataByteLengthFor` at module load; implementer runs a one-shot verifier (Step 1.7).
- **Risk:** `TestVector` becomes coupled to `EncryptedMatchParams`. **Mitigation:** Co-located in `test-vectors.ts` (cohesion); file stays ≤200 lines.
- **Risk:** Exposing `encryptedMatchesShape` widens the public testing surface. **Mitigation:** Testing subpath is test-only (brief §6); acceptable by design.

---

## 8. Out of Scope (NOT done by this plan)
- Any change to `SecureCrypto` or `crypto.service.encryption.ts` (no deterministic-IV mode).
- Full README rewrite / NestJS config guide / TOC at top of README — those are **Task 4** (Documentation & Examples).
- Lint config / final build hardening — **Task 5** (Final Quality & Build).
- Git branch creation / version bump / TODO `[DONE]` marking / merge — Critical Workflow Steps 2, 3, 4.6, 5 (handled by Plan Agent + other sub-agents).

---

## 9. Files Touched (summary)
- `src/testing/test-vectors.ts` (rewrite: shape type, helpers, 11 vectors, predicate, header)
- `src/testing/index.ts` (re-exports, `SecureCryptoTestProvider`, `createSecureCryptoTestProvider`, JSDoc link)
- `tests/crypto.encrypt-decrypt.spec.ts` (vector-driven structural assertions, header prose)
- `tests/crypto.service.spec.ts` (shape assertions in `encryptAndHash`, optional predicate test)
- `tests/crypto.hashing.spec.ts` (comment-only, optional)
- `docs/testing-utilities.md` (new)
- `README.md` (Testing section wording + Guides link only)
- `docs/README.md` (index entry)

**No `src/` folder changes; no production crypto code changes.**

---

## 10. Sign-Off
Plan adheres to all `.kilo/rules/`: max-args (helpers use ≤2 params or a typed object), max-depth ≤2, single-section boolean conditions (encapsulated in `encryptedMatchesShape`), private members by default, no commented code, self-documenting names, security-first (no non-random IV path), newline-prevention (real newlines), max-lines-per-file ≤200, max-lines-per-method ≤50, project-structure (no new `src/` folders), gitignore-compliance (Step 8), markdown-generation-rule (Architect authoring plan — permitted).