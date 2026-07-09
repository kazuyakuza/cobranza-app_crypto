# Task 2 — Code Simplification Plan (Comprehensive Tests)

**Scope:** Review the test implementation produced in Task 2 4.2 (Testing — Comprehensive) and identify simplification opportunities while preserving coverage and behaviour.

**Files reviewed:**

- `tests/crypto.service.spec.ts`
- `tests/crypto.encrypt-decrypt.spec.ts`
- `tests/crypto.hashing.spec.ts`
- `tests/crypto.internals.spec.ts`
- `src/testing/test-vectors.ts`
- `src/testing/index.ts`

---

## 1. Simplification opportunities and rationale

### 1.1 Shared crypto factory is duplicated

`crypto.encrypt-decrypt.spec.ts` defines `buildCryptoWithVersion(version)` but the same pattern (`new SecureCrypto({ ...TEST_CRYPTO_CONFIG, currentVersion: version })`) is written inline in `crypto.service.spec.ts` inside the `encryptAndHash` tests.

**Rationale:** Centralising the factory removes duplication, makes version intent explicit, and keeps configuration in one place.

### 1.2 Payload tampering helpers are nearly identical

`crypto.encrypt-decrypt.spec.ts` has `flipAuthTagByte` and `flipCiphertextByte`. They both decode the payload, XOR a byte at a given offset, and re-encode.

**Rationale:** A single `mutateBase64Byte(encryptedValue, byteOffset)` helper removes duplicated XOR/re-encode logic and makes tests shorter.

### 1.3 Constructor validation tests repeat the same pattern

`crypto.service.spec.ts` contains four separate tests for invalid configs. Three of them throw `/non-empty base64 string/` and the structure is identical.

**Rationale:** Collapsing them into one `it.each` table improves readability and makes new invalid cases trivial to add.

### 1.4 `crypto.hashing.spec.ts` creates the test instance multiple times per test

Some tests call `getTestCrypto()` several times inside the same `it` block.

**Rationale:** Creating one local `crypto` variable per test removes noise and makes the subject under test obvious, while still keeping instances fresh (no shared mutable state across tests).

### 1.5 Long single-line assertions hurt readability

`crypto.internals.spec.ts` has many `expect(() => ...).toThrow(...)` calls that exceed a comfortable line length.

**Rationale:** Reformatting multi-line improves scanability and diffs without changing behaviour.

### 1.6 Test vector count is below TODO requirement

`src/testing/test-vectors.ts` currently contains 6 vectors; the TODO specifies at least 10 covering empty string, long text, different key categories, and numeric/special characters.

**Rationale:** Adding the missing vectors centralises test data, removes ad-hoc plaintext strings scattered through the specs, and makes the suite more consistent.

### 1.7 Redundant hash assertion in `encryptAndHash` tests

`crypto.service.spec.ts` asserts both:

```ts
expect(result.hash).toBe(cryptoInstance.hash(vector.plaintext));
expect(result.hash).toBe(vector.expectedHash);
```

The first assertion is redundant if the deterministic vector hash is already verified in `crypto.hashing.spec.ts`.

**Rationale:** Keep only the vector assertion to reduce duplication and improve test independence.

### 1.8 `expectedEncrypted` placeholder is carried but unused

`TestVector.expectedEncrypted` is `PLACEHOLDER_PHASE2` in every vector. It is never consumed by any spec in Task 2.

**Rationale:** Either make the field optional or remove it from the current interface to avoid misleading placeholder data. It can be reintroduced in Task 3 when deterministic encryption is implemented.

### 1.9 File line counts approach the project limit

- `crypto.encrypt-decrypt.spec.ts` is 189 lines.
- `crypto.internals.spec.ts` is 163 lines.

After excluding comments/blank lines/imports, the effective code lines are close to or above the 125-line target.

**Rationale:** Extracting shared helpers and removing redundant tests will bring both files comfortably under the limit.

---

## 2. Proposed changes

### 2.1 `src/testing/index.ts`

Add a factory helper that the specs can share:

```ts
export function buildTestCrypto(version?: number): SecureCrypto {
  if (version === undefined) {
    return new SecureCrypto(TEST_CRYPTO_CONFIG);
  }
  return new SecureCrypto({ ...TEST_CRYPTO_CONFIG, currentVersion: version });
}
```

Export it from the testing entrypoint. Update `getTestCrypto()` to delegate to `buildTestCrypto()` if desired, or keep it as a convenience alias.

### 2.2 New helper: `tests/payload-mutators.ts` (or `src/testing/payload-mutators.ts`)

Create a single helper for tampering with encoded payloads:

```ts
import type { EncryptedValue } from '@cobranza-apps/entities';

export function mutateBase64Byte(
  encrypted: EncryptedValue,
  byteOffset: number,
): EncryptedValue {
  const payload = Buffer.from(encrypted.encryptedData, 'base64');
  payload[byteOffset] = (payload[byteOffset] ?? 0) ^ 0x01;
  return { ...encrypted, encryptedData: payload.toString('base64') };
}
```

Replace `flipAuthTagByte` and `flipCiphertextByte` in `crypto.encrypt-decrypt.spec.ts` with calls to `mutateBase64Byte(encrypted, payload.length - 1)` and `mutateBase64Byte(encrypted, 12)`.

### 2.3 `tests/crypto.service.spec.ts`

- Replace inline `new SecureCrypto({ ...TEST_CRYPTO_CONFIG, currentVersion: vector.version })` with `buildTestCrypto(vector.version)`.
- Refactor constructor validation tests into an `it.each` table:

```ts
it.each([
  { field: 'masterKey', value: Buffer.alloc(16).toString('base64'), expected: /expected 32 bytes/ },
  { field: 'masterKey', value: '', expected: /non-empty base64 string/ },
  { field: 'hashSalt', value: '', expected: /non-empty base64 string/ },
])('throws when $field is invalid', ({ field, value, expected }) => {
  const invalidConfig = { ...TEST_CRYPTO_CONFIG, [field]: value };
  expect(() => new SecureCrypto(invalidConfig)).toThrow(expected);
});
```

- Remove the redundant `result.hash === cryptoInstance.hash(...)` assertion from the `encryptAndHash` test, keeping only the vector assertion.

### 2.4 `tests/crypto.hashing.spec.ts`

- In each test, create one local `const crypto = getTestCrypto();` instead of calling `getTestCrypto()` repeatedly.
- Optionally use `beforeEach` to set `crypto` for all tests in the describe block, because the instance is immutable for hashing purposes.

### 2.5 `tests/crypto.internals.spec.ts`

- Reformat long `expect(() => ...).toThrow(...)` lines to multi-line style.
- Extract the repeated `resolveConfig(TEST_CRYPTO_CONFIG)` call into a local helper or `beforeEach` if it does not hurt clarity.

### 2.6 `src/testing/test-vectors.ts`

- Add at least 4 new vectors so the total is 10, covering:
  - empty string plaintext,
  - a long text (e.g. 500+ characters),
  - a numeric/special-character value,
  - a plaintext under `EncryptionKey.COMPANY_PII` or `EncryptionKey.BANK_DATA` that is not already present.
- Recalculate `expectedHash` for each new vector using the fixed test salt.
- Consider making `expectedEncrypted` optional (`expectedEncrypted?: string`) and removing the placeholder values. If Task 3 needs them, they can be re-added with real deterministic ciphertexts.

### 2.7 `tests/crypto.encrypt-decrypt.spec.ts`

- Replace `buildCryptoWithVersion` with the shared `buildTestCrypto`.
- Replace `flipAuthTagByte` / `flipCiphertextByte` with `mutateBase64Byte`.
- Keep `MIN_PAYLOAD_BYTES` local, or move it to testing utils only if other specs need it.
- Use a single `const crypto = buildTestCrypto(1);` inside tests where only one instance is needed.

---

## 3. Acceptance criteria

- [ ] All proposed simplifications are applied.
- [ ] `npm test` / `pnpm test` passes with no failures.
- [ ] Test coverage remains at or above 85%.
- [ ] No commented-out code is introduced.
- [ ] All source files in `src/` and `tests/` pass linting.
- [ ] Effective lines per file stay under the project target after simplification.
- [ ] The `TestVector` interface and placeholder handling are consistent with Task 3 expectations.

---

## 4. Out of scope

- Implementing deterministic encryption or replacing `expectedEncrypted` with real ciphertexts (Task 3).
- Modifying production code (`src/crypto.service.ts`, HKDF, utils) beyond what is necessary to keep tests compiling.
- Rewriting tests that already provide unique coverage.
