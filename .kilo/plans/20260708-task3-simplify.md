# Task 3 — Testing Module Simplification Plan

## Simplification Opportunities

### 1. `src/testing/test-vectors.ts` — vector definition boilerplate

- **Issue**: Every `TestVector` repeats the same `expectedEncryptedShape` fields:
  - `algorithm: 'aes-256-gcm'` (literal repeated 11 times)
  - `keyName` (already present at top level, repeated inside shape)
  - `version` (already present at top level, repeated inside shape)
  - `encryptedDataByteLength: encryptedDataByteLengthFor(plaintext)` (same formula every time)
- **Impact**: 231 lines for 11 vectors; adding a new vector requires copying ~10 lines and risks drift between top-level and shape-level `keyName`/`version`.
- **Simplification**: Introduce a private `createVector` factory that accepts `plaintext`, `keyName`, `version`, and `expectedHash`, then auto-builds `expectedEncryptedShape` from the top-level values and `encryptedDataByteLengthFor(plaintext)`.
- **Expected benefit**: Vector definitions shrink to ~4 fields each; single source of truth for algorithm and byte-length formula.

### 2. `src/testing/test-vectors.ts` — `encryptedDataByteLengthFor`

- **Issue**: Function is already minimal and clear. No simplification needed beyond keeping it as the single formula used by the factory.
- **Simplification**: Leave as-is; only ensure it is reused by the new `createVector` helper.

### 3. `src/testing/index.ts` — export organization

- **Issue**: Type re-exports and value re-exports from `./test-vectors.js` are split into two blocks (`export type` and `export`). This is correct but slightly verbose.
- **Simplification**: Consolidate into one `export` statement per symbol or keep the current explicit split. Prefer the current explicit split because it preserves "type-only" semantics; no change required.
- **Issue**: `getTestCrypto()` is a thin alias for `buildTestCrypto()`.
- **Simplification**: Acceptable convenience alias; no change required. Alternatively, inline it as `export const getTestCrypto = buildTestCrypto;` to remove the function wrapper, but this loses the JSDoc example. Keep as function with docs.
- **Issue**: `SecureCryptoTestProvider` is a pure alias for `SecureCryptoTestModule`.
- **Simplification**: Keep for brief §6 naming parity; document the equivalence more explicitly if needed.

### 4. `docs/testing-utilities.md` — redundant sections

- **Issue**: "Plain Jest Usage" already demonstrates vector-driven shape and hash assertions, and "Recipes" repeats nearly the same patterns (Encrypt + Assert Shape, Hash Exact Match, encryptAndHash Dual-Column).
- **Simplification**:
  - Merge the vector-driven examples from "Plain Jest Usage" into "Recipes".
  - Keep "Plain Jest Usage" focused on `getTestCrypto` / `buildTestCrypto` basic instantiation only.
  - Remove the duplicated `buildTestCrypto(vector.version)` + `crypto.encrypt` + `encryptedMatchesShape` pattern that appears in both sections.
- **Issue**: The "Why No Exact Ciphertext" section explains the same rationale already present in `test-vectors.ts` header comments.
- **Simplification**: Keep the section because docs should be self-contained, but trim it to one concise paragraph and link to `test-vectors.ts` for the full rationale.

### 5. Tests using vectors — duplicated assertion patterns

- **Issue**: `tests/crypto.service.spec.ts` (lines 86-91) and `tests/crypto.encrypt-decrypt.spec.ts` (lines 62-65) both manually assert the four structural fields of `expectedEncryptedShape`. This duplicates the logic already encapsulated in `encryptedMatchesShape`.
- **Simplification**:
  - Replace the manual four-field assertions in both files with `expect(encryptedMatchesShape({ encrypted, vector })).toBe(true)`.
  - Remove the local `decodePayloadLength` helper in `crypto.encrypt-decrypt.spec.ts` once the shape matcher is used.
- **Issue**: `tests/crypto.service.spec.ts` (lines 83-85) asserts `decrypt`, exact `hash`, and `verifyHash` together. This triple assertion is valuable but could be extracted into a shared helper if it repeats.
- **Simplification**: It appears only once in this form; leave as-is. If the pattern grows, extract a `assertEncryptAndHash(vector, result)` helper later.
- **Issue**: `tests/crypto.hashing.spec.ts` line 46 calls `crypto.hash(longText)` twice in one assertion.
- **Simplification**: Reuse the `hash` variable already computed on line 43; change to `expect(hash).toBe(crypto.hash(longText))` or similar. Minor cleanup.

## Implementation Plan

1. **Refactor `src/testing/test-vectors.ts`**
   - Add a private `createVector` factory function at the top of the vector list.
   - Rewrite all 11 `TEST_VECTORS` entries using the factory, reducing each to `plaintext`, `keyName`, `version`, `expectedHash`.
   - Keep `encryptedDataByteLengthFor` unchanged.
   - Ensure the exported types and `encryptedMatchesShape` remain untouched.

2. **Simplify vector assertions in tests**
   - In `tests/crypto.service.spec.ts`, replace lines 86-91 with `encryptedMatchesShape({ encrypted: result.encrypted, vector })`.
   - In `tests/crypto.encrypt-decrypt.spec.ts`, replace lines 62-65 with `encryptedMatchesShape({ encrypted, vector })`.
   - Remove the now-unused `decodePayloadLength` helper and `MIN_PAYLOAD_BYTES` constant from `crypto.encrypt-decrypt.spec.ts` (verify nothing else uses them).

3. **Tighten `tests/crypto.hashing.spec.ts`**
   - Reuse the `hash` local variable in the long-plaintext assertion instead of calling `crypto.hash(longText)` a second time.

4. **Trim `docs/testing-utilities.md`**
   - Move vector-driven shape/hash examples from "Plain Jest Usage" into "Recipes".
   - Keep "Plain Jest Usage" to basic `getTestCrypto` / `buildTestCrypto` examples.
   - Condense "Why No Exact Ciphertext" to one paragraph plus a link to `src/testing/test-vectors.ts`.

5. **Verify**
   - Run `npm test` (or the project's test command) to ensure all vector-driven tests still pass.
   - Confirm TypeScript compiles without errors.

## Out of Scope

- No changes to production code (`src/crypto.service.ts`, `src/hkdf.ts`, etc.).
- No changes to the public API surface (all existing exports remain).
- No removal of `SecureCryptoTestProvider` alias; it is kept for brief compatibility.
- No reduction of security assertions; only structural duplication is removed.
