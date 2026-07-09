# Task 2 — Testing (Comprehensive) Code Review

**Review date:** 2026-07-08  
**Reviewer:** Code Reviewer sub-agent (Critical Workflow 4.3)  
**Scope:** `tests/crypto.*.spec.ts`, `src/testing/test-vectors.ts`, `package.json` jest config  
**Source TODO:** `.agent/todos/20260707/20260707-todo-2.md`

---

## Executive Summary

The test implementation is well-structured, deterministic, and uses fixed test keys. It covers the public API surface, version handling, and several corruption scenarios. However, it does **not yet satisfy the Task 2 TODO requirements** for test-vector quantity (only 6 of the required >=10) and completeness (`expectedEncrypted` is a placeholder for every vector). A number of edge cases requested explicitly in the TODO are missing, and a few tests contradict the documented contract of the code under test.

Coverage is **real** for the production logic files; the Jest exclusions are limited to entrypoints, type files, and test utilities. The 85% threshold matches the TODO minimum but provides no buffer.

---

## Findings

### Must-fix

| # | Finding | Files | Evidence / Impact |
|---|---|---|---|
| M1 | `TEST_VECTORS` contains only **6** vectors; TODO requires **at least 10**. | `src/testing/test-vectors.ts` | TODO line 55: "Define at least **10 comprehensive test vectors**." |
| M2 | Every `expectedEncrypted` value is the literal placeholder `PLACEHOLDER_PHASE2`; TODO requires each vector to include an `expectedEncryptedValue` (partial or full match). | `src/testing/test-vectors.ts` | TODO line 56; current vectors cannot be used for ciphertext regression tests. |
| M3 | Missing explicit edge-case vectors requested in TODO: **empty string**, **long text**, **special characters** beyond unicode, and broader **different key categories / versions**. | `src/testing/test-vectors.ts` | TODO line 57: "Include edge cases: empty string, special characters, long text, different key categories." |

### Should-fix

| # | Finding | Files | Evidence / Impact |
|---|---|---|---|
| S1 | `destroy()` test reuses the instance after calling `destroy()`, contradicting the JSDoc: "the instance must not be used after calling." | `tests/crypto.service.spec.ts` | Creates false expectation that `destroy()` is reversible; weakens the security contract. |
| S2 | No hash tests for **empty string**, **unicode**, or **long plaintext**. | `tests/crypto.hashing.spec.ts` | Hashing is deterministic; these are cheap, high-value regression tests. |
| S3 | No corruption test for an **empty plaintext** ciphertext (28-byte payload edge case). | `tests/crypto.encrypt-decrypt.spec.ts` | Verifies auth-tag integrity when ciphertext length is zero. |
| S4 | No tests for **invalid base64** `encryptedData**, **wrong `keyName` decrypt**, or **missing old version key** during rotation. | `tests/crypto.encrypt-decrypt.spec.ts` | Gaps in error-path coverage for realistic operational failures. |
| S5 | No negative / zero `currentVersion` handling tests, and no test for an arbitrary non-enum `keyName` string through the public API. | `tests/crypto.service.spec.ts`, `tests/crypto.encrypt-decrypt.spec.ts` | Public API accepts `EncryptionKey \| string` and `number`; only happy-path enum values are exercised. |
| S6 | `--passWithNoTests` is still in the `test` script even though tests exist. | `package.json` | Masks accidental test-discovery failures in CI. |
| S7 | Coverage threshold is exactly the 85% minimum; no buffer to prevent threshold breaches from tiny refactors. | `package.json` | Recommended to raise to 90% once fixes land, or keep a coverage report artifact. |
| S8 | `constantTimeCompare` tests do not cover base64 characters that differ only in case or padding edge cases. | `tests/crypto.internals.spec.ts` | Low risk, but hash verification operates on base64 strings. |
| S9 | `getAvailableKeys()` test asserts equality with `Object.values(EncryptionKey)` but does not assert the returned array is a copy (mutating it should not affect the instance). | `tests/crypto.service.spec.ts` | Minor encapsulation gap. |

### Nit

| # | Finding | Files | Evidence / Impact |
|---|---|---|---|
| N1 | Test names embed vector plaintext via `%j`, which can leak fake-but-realistic-looking PII into failure logs. | `tests/crypto.service.spec.ts`, `tests/crypto.encrypt-decrypt.spec.ts` | Use an index or description field instead of `%j`. |
| N2 | `getTestCrypto()` is invoked repeatedly inside `it.each` callbacks; acceptable but slightly noisy. | Multiple test files | Could instantiate once per `describe` block and rely on instance immutability. |
| N3 | `crypto.encrypt-decrypt.spec.ts` and `crypto.internals.spec.ts` describe callbacks are long (spirit of max-lines-per-method), though test files are exempt from the `src/` file-length rule. | `tests/*.spec.ts` | Consider splitting future growth into additional focused files. |

---

## Fix Plan

### Phase A — Test vectors (`src/testing/test-vectors.ts`)

1. Expand `TEST_VECTORS` to at least 10 entries covering:
   - Empty string plaintext.
   - Very long plaintext (e.g., 10,000 ASCII chars).
   - Special characters / control chars (`<script>alert(1)</script>`, null byte `\0`, newlines).
   - Unicode beyond emoji (CJK, RTL, combining marks).
   - Every `EncryptionKey` category at least once.
   - Multiple versions (v1, v2, v3) with the same plaintext to demonstrate version isolation.
2. Replace `expectedEncrypted: PHASE2_PLACEHOLDER` with a deterministic partial match:
   - Store a regex or structural assertion helper (e.g., assert base64 length, decrypt roundtrip) since AES-256-GCM IV is random.
   - Add `expectedEncryptedPrefix` or `expectedEncryptedMinLength` fields if an exact match is impossible.
3. Verify every `expectedHash` against an independent HMAC-SHA256 computation (already real values; re-confirm with a one-off Node script or reference tool).
4. Add a short comment per vector explaining the edge case it covers.

### Phase B — Service tests (`tests/crypto.service.spec.ts`)

1. Rewrite `destroy()` test:
   - Assert `destroy()` does not throw.
   - Assert the internal derived-key cache is empty after destroy (if test can access internals) or that `getAvailableKeys` still works but new encryption re-derives keys.
   - **Do not encrypt after destroy**; instead create a fresh instance for any post-destroy operation.
2. Add constructor validation tests for:
   - `config` undefined/null.
   - `hashSalt` decoding to fewer than 32 bytes.
   - `currentVersion` = 0 (if allowed) or negative (if expected to be rejected).
3. Add `hasKey` / `getAvailableKeys` tests:
   - Mutating the returned array does not affect subsequent calls.
   - `hasKey` is case-sensitive.
4. Add `encryptAndHash` error case (e.g., empty `keyName`).

### Phase C — Encrypt/decrypt tests (`tests/crypto.encrypt-decrypt.spec.ts`)

1. Add corruption tests for empty plaintext ciphertext (encrypt `''`, flip auth tag / a ciphertext byte if any, assert decryption throws).
2. Add wrong `keyName` decrypt test (encrypt with `PII`, attempt decrypt treating payload as `BANK_DATA`).
3. Add missing old-version key test:
   - Encrypt with `currentVersion: 2`.
   - Configure a new instance with only version 1 master key material (or simulate missing v2) and assert a clear error.
   - *If the implementation always derives from the same master key per version, use a different master key to simulate a missing version.*
4. Add invalid `encryptedData` tests:
   - Non-base64 characters.
   - Base64 string decoding to length between 1 and 27 bytes.
5. Add arbitrary string `keyName` encrypt/decrypt roundtrip.

### Phase D — Hashing tests (`tests/crypto.hashing.spec.ts`)

1. Add vector-driven hash tests for empty string, unicode, and long plaintext.
2. Add `verifyHash` tests:
   - Empty expected hash.
   - Empty plaintext.
   - Single-character difference in expected hash.
   - Hash computed with a different salt (if a second fixture is available).

### Phase E — Internals tests (`tests/crypto.internals.spec.ts`)

1. Add `deriveKeyForCategory` tests:
   - Different `keyName` produces different key.
   - Different `version` produces different key.
   - Cache is not shared across instances.
2. Extend `constantTimeCompare` tests with base64-specific cases.
3. Add `base64ToBuffer` test for invalid base64 input behavior.

### Phase F — Configuration (`package.json`)

1. Remove `--passWithNoTests` from the `test` script.
2. After fixes are implemented and coverage is verified, raise `coverageThreshold` from 85% to **90%** for statements, branches, functions, and lines.
3. Ensure `collectCoverageFrom` still excludes only entrypoints (`src/index.ts`), type files (`src/**/*.types.ts`), and test utilities (`src/testing/**`).

---

## Coverage Assessment

- **Production files included in coverage:** `crypto.service.ts`, `crypto.service.validation.ts`, `crypto.service.guards.ts`, `crypto.service.keys.ts`, `crypto.service.hashing.ts`, `crypto.service.encryption.ts`, `utils.ts`, `hkdf.ts`. `config.ts` contains only enum/interface declarations and contributes no executable statements.
- **Excluded files:** `src/index.ts`, `src/**/*.types.ts`, `src/testing/**`. These exclusions are reasonable and do not materially inflate coverage of business logic.
- **Conclusion:** Coverage is **real** for the cryptographic logic. The 85% threshold is the minimum requested by the TODO, but it should be increased to 90% once the must-fix vector gaps are closed.

---

## Verification Steps

1. Run `npm test` and confirm all tests pass.
2. Confirm `TEST_VECTORS.length >= 10` and no vector uses `PLACEHOLDER_PHASE2`.
3. Confirm coverage report shows ≥90% across statements, branches, functions, and lines.
4. Confirm `npm run lint` and `npm run build` remain clean.

---

## Output

- Review file: `.kilo/plans/20260708-task2-review.md`
- Next step: Assign Phase A–F fixes to Implementer sub-agent (Critical Workflow 4.3-fix).
