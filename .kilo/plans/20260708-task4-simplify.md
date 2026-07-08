# Simplification Plan — Task 4: Testing Infrastructure, Step 4.3

**Plan file:** `.kilo/plans/20260708-task4-simplify.md`
**TODO source:** `.agent/todos/20260707/20260707-todo-1.md` → Task 4 (lines 82–88)
**Step under execution:** 4.3 Code Review & Simplification (code-simplifier sub-agent)
**Files reviewed:**
- `src/testing/test-vectors.ts` (84 lines)
- `src/testing/index.ts` (86 lines)
- `tests/crypto.service.spec.ts` (57 lines)

**Reference plan (implementation):** `.kilo/plans/20260708-task4-testing.md`
**Scope rule:** Phase 1 ONLY. No encryption/hashing logic. Simplification of the testing fixtures, vectors, and spec only.

## 1. Scope & Method

Single-discrete-step sub-agent task. Scope is **simplification planning only**: identify
opportunities, record concrete recommendations, and save this plan. **No code changes are
made in this step** — the implementer applies accepted changes in the subsequent 4.3-fix task.

Method: read all three files, cross-check against the approved testing plan
(`20260708-task4-testing.md`) and its decisions (D1–D14), assess against project rules
(`no-commented-code`, `self-documenting-code`, `prefer-private-members`, `max-arguments-per-method`,
`max-lines-per-file`, `max-lines-per-method`, `max-depth`, `single-section-boolean-conditions`,
code-guidelines §13 "Avoid Magic Numbers", §5 "Preserve Existing Code"), and the explicit
review targets named by the caller (redundant test cases, consolidate test setup, magic numbers,
`SecureCryptoTestModule` simplification).

## 2. Findings

### 2.1 `src/testing/test-vectors.ts` — repetitive placeholder fields

The `TEST_VECTORS` array (lines 41–84) repeats the pair
`expectedEncrypted: PHASE2_PLACEHOLDER` / `expectedHash: PHASE2_PLACEHOLDER` in all 6
entries (lines 46–47, 53–54, 60–61, 67–68, 74–75, 81–82) — 12 identical field assignments.

A factory helper that injects the placeholder defaults would remove the repetition:

```ts
interface TestVectorSeed {
  readonly plaintext: string;
  readonly keyName: EncryptionKey;
  readonly version: number;
}

function withPhase2Placeholders(seed: TestVectorSeed): TestVector {
  return { ...seed, expectedEncrypted: PHASE2_PLACEHOLDER, expectedHash: PHASE2_PLACEHOLDER };
}
```

The `max-arguments-per-method` rule (max 2 params) forces the object-param shape above
(a 3-arg `withPhase2Placeholders(plaintext, keyName, version)` would violate the rule).

**Verdict: DECLINE (optional, deferred to Phase 2).** Rationale:
1. This is a data file; explicit object literals are self-documenting (rule:
   self-documenting-code). Each vector reads as exactly what it is.
2. The uniformity the factory exploits is **Phase-1-only**. Phase 2 will populate
   `expectedHash` (deterministic HMAC-SHA256) and `expectedEncrypted` (per plan D5, a
   fixed-IV test mode) with **distinct real values per vector**, breaking the uniform
   default. The factory would then be reverted to per-entry literals — churn, not
   simplification.
3. The factory adds indirection + a `TestVectorSeed` interface for a transient Phase 1
   benefit; net line savings (~12) are offset by ~10 lines of helper boilerplate.

No change proposed. Recorded for awareness.

### 2.2 `src/testing/test-vectors.ts` — `version` literals

`version: 1` appears in 5 entries (lines 45, 52, 66, 73, 80) and `version: 2` once
(line 59, the `BANK_DATA` rotation case). These are intentional per-vector test data
(testing default version + a rotated version), not magic numbers.

**Verdict: DECLINE.** Inline test data with descriptive surrounding context is clearer
than `DEFAULT_KEY_VERSION`/`BANK_DATA_ROTATED_VERSION` constants here. No change.

### 2.3 `src/testing/index.ts` — magic numbers `32` and `64` in test fixtures

- Line 27: `Buffer.alloc(32)` — the test master key length.
- Line 30: `Buffer.alloc(64)` — the test hash salt length.

`32` is a magic number with a **hidden invariant**: it MUST equal
`MASTER_KEY_LENGTH_BYTES = 32` in `src/crypto.service.validation.ts` (line 26), otherwise
the test fixture fails validation (`validateMasterKey` rejects ≠32 bytes). That constant is
NOT exported, so the testing module cannot import it. The salt `64` has no upstream
constant but encodes "≥32 bytes" (brief §4.2) as a chosen test size.

**Verdict: SHOULD — name the local constants.** This satisfies code-guidelines §13 (Avoid
Magic Numbers) and makes the test-key-length invariant explicit at the fixture site.

Recommended:

```ts
/** Test master-key byte length; MUST match the validated length (AES-256 = 32 bytes). */
const TEST_MASTER_KEY_BYTES = 32;
/** Test hash-salt byte length (≥32 per brief §4.2); chosen generously as 64. */
const TEST_HASH_SALT_BYTES = 64;

export const TEST_MASTER_KEY: string = Buffer.alloc(TEST_MASTER_KEY_BYTES).toString('base64');
export const TEST_HASH_SALT: string = Buffer.alloc(TEST_HASH_SALT_BYTES).toString('base64');
```

The JSDoc on the existing constants (lines 26, 29) already says "32-byte" / "64-byte"; the
named constants replace the inline literals so the comment + the value cannot drift apart.
Net: +2 constant lines, −2 magic literals, stronger intent. Export stays unchanged
(only `TEST_MASTER_KEY`/`TEST_HASH_SALT` are exported; the byte-length constants are
module-private, satisfying `prefer-private-members`).

### 2.4 `src/testing/index.ts` — `SecureCryptoTestModule` simplification (caller target)

The module (lines 83–86) is already minimal:

```ts
export const SecureCryptoTestModule: SecureCryptoProviderConfig = {
  providers: [{ provide: SecureCrypto, useFactory: getTestCrypto }],
  exports: [SecureCrypto],
};
```

Its companion type `SecureCryptoProviderConfig` (lines 58–65) is an 8-line interface that
gives the public export a named, documented shape (consumers may type their own spreading
per plan D2). Inlining the type would save ~8 lines but lose the named, JSDoc-documented
public type and would inline a nested generic (`Array<{ provide: typeof SecureCrypto;
useFactory: () => SecureCrypto }>`) onto the `const` declaration — less readable.

**Verdict: NO CHANGE.** `SecureCryptoTestModule` is as simple as it can be while remaining
correctly typed and NestJS-spreadable. The `SecureCryptoProviderConfig` interface is
justified as a public type of the `./testing` subpath. No simplification available.

### 2.5 `src/testing/index.ts` — remaining structure

`getTestCrypto()` (lines 54–56) is a 1-line body, 0 args — clean. `TEST_CRYPTO_CONFIG`
(lines 33–38) assembles the fixtures; no redundancy. Imports are all used
(`EncryptionKey` in `defaultKeyName`, `CryptoConfig` as the type annotation, `SecureCrypto`
in factory + module). Re-exports of `TEST_VECTORS`/`TestVector` are correct (plan D7).

**Verdict: NO CHANGE** beyond §2.3.

### 2.6 `tests/crypto.service.spec.ts` — magic number `5` + redundant length assertion

`getAvailableKeys` test, lines 53–54:

```ts
expect(available).toEqual(Object.values(EncryptionKey));
expect(available).toHaveLength(5);
```

Two issues on line 54:
1. **Magic number `5`** — hardcodes the `EncryptionKey` member count. It duplicates
   `Object.values(EncryptionKey).length` and will **break** if an enum member is added,
   while line 53 (`toEqual`) would still pass correctly. This is an actively-harmful magic
   number (code-guidelines §13).
2. **Redundant assertion** — `toEqual(Object.values(EncryptionKey))` already asserts the
   complete array, length included. `toHaveLength(5)` adds no new information.

**Verdict: SHOULD — remove line 54.** This removes both the magic number and the
redundancy in one edit; `toEqual` on line 53 fully covers the contract.

Alternative (acceptable, less preferred): replace `5` with
`Object.values(EncryptionKey).length` to keep an explicit length sanity check while
removing the magic number. Preferred action is removal — the equality assertion is the
stronger, self-maintaining check.

### 2.7 `tests/crypto.service.spec.ts` — consolidate the three invalid-config tests?

The three constructor-validation tests (lines 16–33) share structure: build
`invalidConfig = { ...TEST_CRYPTO_CONFIG, <field>: <badValue> }` then assert
`expect(() => new SecureCrypto(invalidConfig)).toThrow(/<pattern>/)`. They could collapse
into one `it.each` table:

```ts
it.each([
  ['masterKey', Buffer.alloc(16).toString('base64'), /expected 32 bytes/],
  ['masterKey', '', /non-empty base64 string/],
  ['hashSalt', '', /non-empty base64 string/],
])('throws when %s is invalid', (field, badValue, pattern) => {
  const invalidConfig = { ...TEST_CRYPTO_CONFIG, [field]: badValue };
  expect(() => new SecureCrypto(invalidConfig)).toThrow(pattern);
});
```

**Verdict: DECLINE.** Rationale:
1. The three cases are **not redundant** — they exercise 3 distinct validation branches
   (short key → length check; empty key → presence check; empty salt → presence check).
   The caller's "redundant test cases" target does not apply; only the *structure* repeats.
2. The current names are descriptive failure messages
   ("throws when masterKey decodes to fewer than 32 bytes") — a real benefit when a test
   fails. The `it.each` form produces generic names ("throws when masterKey is invalid")
   that lose the per-case reason.
3. The dynamic-key spread `{ ...TEST_CRYPTO_CONFIG, [field]: badValue }` fights TS strict
   mode (`exactOptionalPropertyTypes` + computed string keys weaken type safety) and would
   likely need a cast — trading type safety for DRY in a 3-case block is a poor trade.
4. Tests should favor readable failure diagnostics over DRY; at 3 cases the repetition is
   acceptable and clearer.

No change proposed.

### 2.8 `tests/crypto.service.spec.ts` — consolidate `getTestCrypto()` calls (setup)?

`getTestCrypto()` is called inline in 4 places (lines 40, 45, 51, and indirectly tested at
13). A `beforeEach`/shared `const crypto = getTestCrypto()` could reduce the repetition.

**Verdict: DO NOT CONSOLIDATE — the per-call pattern is intentional.** Plan D6 explicitly
mandates "Each call returns a new instance so tests never share mutable state." Hoisting to
a shared `const` would share one `SecureCrypto` (and its derived-key cache `Map`) across
tests, coupling them and violating D6. The inline `getTestCrypto()` calls are **not**
repetition to remove — they are the mechanism that guarantees test isolation. This is a
deliberate non-simplification; recorded to prevent a future agent from "fixing" it.

### 2.9 `tests/crypto.service.spec.ts` — `Buffer.alloc(16)` magic number

Line 16: `Buffer.alloc(16)` — a 16-byte key (half the required 32) to trigger the
"fewer than 32 bytes" branch. The test name already states the intent ("decodes to fewer
than 32 bytes").

**Verdict: DECLINE.** One-off test input with a descriptive test name; naming it
`SHORT_KEY_BYTES = 16` adds a constant for a single use. No change.

### 2.10 `tests/crypto.service.spec.ts` — overall

12 tests confirmed (5 constructor + 5 `it.each` known-key + 1 unknown-key + 1
`getAvailableKeys`), matching the implementation plan's expectation. Imports limited to
what is used (plan D11 satisfied). `it.each(Object.values(EncryptionKey))` for `hasKey` is
already the correct consolidation. No commented code, no unused symbols.

## 3. Concrete Simplification Steps (for the implementer, next 4.3-fix task)

### 3.1 Primary change A — `src/testing/index.ts`: name the fixture byte-lengths

Replace lines 26–30:

**Before:**
```ts
/** Fixed 32-byte (all-zero) master key, base64-encoded. TEST-ONLY. */
export const TEST_MASTER_KEY: string = Buffer.alloc(32).toString('base64');

/** Fixed 64-byte (all-zero) hash salt (>=32 bytes), base64-encoded. TEST-ONLY. */
export const TEST_HASH_SALT: string = Buffer.alloc(64).toString('base64');
```

**After:**
```ts
/** Test master-key byte length; MUST match the validated length (AES-256 = 32 bytes). */
const TEST_MASTER_KEY_BYTES = 32;

/** Test hash-salt byte length (>=32 per brief §4.2); chosen generously as 64. */
const TEST_HASH_SALT_BYTES = 64;

/** Fixed all-zero master key, base64-encoded. TEST-ONLY. */
export const TEST_MASTER_KEY: string = Buffer.alloc(TEST_MASTER_KEY_BYTES).toString('base64');

/** Fixed all-zero hash salt, base64-encoded. TEST-ONLY. */
export const TEST_HASH_SALT: string = Buffer.alloc(TEST_HASH_SALT_BYTES).toString('base64');
```

Net: +2 named constants, −2 magic literals. The "32-byte"/"64-byte" detail moves from the
JSDoc into the constant names; the JSDoc is trimmed to avoid duplicating what the constant
name now states. Module-private constants satisfy `prefer-private-members`.

### 3.2 Primary change B — `tests/crypto.service.spec.ts`: remove magic `5` + redundant length

Replace lines 53–54:

**Before:**
```ts
      expect(available).toEqual(Object.values(EncryptionKey));
      expect(available).toHaveLength(5);
```

**After:**
```ts
      expect(available).toEqual(Object.values(EncryptionKey));
```

Net: −1 line. Removes the magic number `5` and the redundant length assertion. `toEqual`
already asserts the full array (length implied) and self-maintains when the enum grows.

### 3.3 Verification gate (mandatory after applying 3.1 + 3.2)

Run:
```
npm run build
npm test
npm run lint
```
- `npm run build`: expect success; the new private constants are used, no unused-symbol
  errors (`noUnusedLocals`).
- `npm test`: expect **11 tests pass** (was 12; the removed `toHaveLength` line was the
  body of the single `getAvailableKeys` test, which remains — so the test COUNT stays 12;
  only one assertion inside that one test is removed). Correction for the implementer:
  **test count stays 12**; only an assertion within the `getAvailableKeys` test is dropped.
- `npm run lint`: expect no new errors.

If any step fails for a reason caused by these edits, STOP, capture the output, and
escalate to the Plan Agent. Do NOT weaken other assertions to force green.

### 3.4 No change (explicitly retained)

- `TEST_VECTORS` placeholder repetition (`test-vectors.ts`) — declined (§2.1, Phase 2 will
  diverge).
- `version` literals in test vectors (§2.2) — declined (descriptive test data).
- `SecureCryptoTestModule` + `SecureCryptoProviderConfig` (§2.4) — already minimal.
- The three invalid-config tests (§2.7) — declined (distinct branches, descriptive names,
  type-safety cost of consolidation).
- Inline `getTestCrypto()` per test (§2.8) — intentional per plan D6; do NOT hoist.
- `Buffer.alloc(16)` (§2.9) — declined (one-off test input).

### 3.5 Out of scope (explicitly NOT done in this step)

- Implementing crypto methods (Phase 2).
- Populating real `expectedEncrypted`/`expectedHash` (Phase 2; plan D5).
- Adding `@nestjs/testing` / a NestJS `@Module` class (plan D2).
- Changes to `src/index.ts`, `src/config.ts`, `src/crypto.service.ts`,
  `src/crypto.service.validation.ts`.
- Steps 4.4 (docs), 4.5 (verification), 4.6 (completion) — separate steps.
- Exporting `MASTER_KEY_LENGTH_BYTES` from `crypto.service.validation.ts` to share with the
  testing module — considered and rejected (would couple the testing public API to an
  internal validation module; a local named constant in §3.1 is cleaner).

## 4. Compliance Notes

- **max-lines-per-file**: `test-vectors.ts` 84 lines and `index.ts` 86 lines are both under
  the ≤200 src-file cap; after §3.1 `index.ts` is ~88 lines — still well under. The spec
  is in `tests/` (not `src/`), so the rule does not apply to it. OK.
- **max-lines-per-method**: longest method body is `getTestCrypto()` at 1 line. OK.
- **max-arguments-per-method**: `getTestCrypto()` 0 args. The declined `withPhase2Placeholders`
  factory (§2.1) would use a 1-arg object param to comply. OK.
- **max-depth / single-section boolean**: no violations in any of the three files. OK.
- **no-commented-code**: none present. OK.
- **prefer-private-members**: `PHASE2_PLACEHOLDER` (`test-vectors.ts`) is module-private; the
  new `TEST_MASTER_KEY_BYTES`/`TEST_HASH_SALT_BYTES` (§3.1) are module-private. All
  exported symbols are the intentional public testing API. OK.
- **self-documenting-code**: §3.1 moves the byte-length intent into constant names; §3.2
  removes a redundant assertion. Both improve self-documentation. OK.
- **Avoid Magic Numbers (code-guidelines §13)**: §3.1 removes `32`/`64`; §3.2 removes `5`.
  The remaining literals (`16` in spec, `1`/`2` versions) are intentional, context-named
  test data — accepted. OK after edits.
- **Preserve Existing Code (code-guidelines §5)**: edits are surgical (2 fixture lines + 1
  assertion line); no unrelated functionality removed. OK.
- **max-args / max-lines rules**: unaffected by the two edits.

## 5. Summary Table

| Item | File | Action | Priority | Effort |
|------|------|--------|----------|--------|
| Magic `32`/`64` in test fixtures | `src/testing/index.ts` | Name local constants | Should | Trivial |
| Magic `5` + redundant `toHaveLength` | `tests/crypto.service.spec.ts` | Remove line 54 | Should | Trivial |
| `TEST_VECTORS` placeholder repetition | `src/testing/test-vectors.ts` | Decline (Phase 2 diverges) | Optional | — |
| `version` literals in vectors | `src/testing/test-vectors.ts` | Decline (test data) | Optional | — |
| `SecureCryptoTestModule` simplification | `src/testing/index.ts` | No change (already minimal) | — | — |
| Consolidate 3 invalid-config tests | `tests/crypto.service.spec.ts` | Decline (distinct branches) | Optional | — |
| Hoist `getTestCrypto()` to shared setup | `tests/crypto.service.spec.ts` | DO NOT (plan D6 isolation) | — | — |
| `Buffer.alloc(16)` magic | `tests/crypto.service.spec.ts` | Decline (one-off input) | Optional | — |

**Net effect of accepted changes:** −1 assertion line, +2 named constants / −2 magic
literals. Two trivial, low-risk edits; test count unchanged at 12.

## 6. What was done / not done

- **Done:** Reviewed all three target files (`src/testing/test-vectors.ts`,
  `src/testing/index.ts`, `tests/crypto.service.spec.ts`) against the approved testing
  plan (`20260708-task4-testing.md`, decisions D1–D14) and project rules. Assessed every
  caller-named target (redundant cases, setup consolidation, magic numbers,
  `SecureCryptoTestModule`). Produced this decisive simplification plan and saved it to
  `.kilo/plans/20260708-task4-simplify.md`. Two "Should" changes identified (magic-number
  removal in fixtures and in the `getAvailableKeys` assertion); five optional items
  evaluated and declined with rationale; one non-simplification (`getTestCrypto()` per-call)
  explicitly protected from future "consolidation".
- **Not done (by design):** No source edits (this is the planning step 4.3; the implementer
  applies accepted changes in the 4.3-fix task). Verification (`npm run build`/`npm test`/
  `npm run lint`) was NOT executed in this step — delegated to the implementer as the
  mandatory gate in §3.3. No changes to non-target files. No Phase 2 crypto logic.
