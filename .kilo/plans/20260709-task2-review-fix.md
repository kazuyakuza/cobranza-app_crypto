# Task 2 Code Review Fix Plan

- **Date:** 2026-07-09
- **Reviewed plan:** `.kilo/plans/20260709-task2-auditing.md`
- **Branch:** `feat/phase4-advanced-features`
- **Critical Workflow step:** 4.3 (Code Review & Simplification)

---

## Review Verdict

Implementation closely follows the approved plan. Build, lint, and the full test suite pass with 100 % global coverage. The `AuditLogger` interface is type-safe, notifier errors are swallowed, and `src/crypto.service.ts` remains under the 200-line limit (191 lines). No functional bugs were found.

The three issues below are testing/coverage gaps only; they do not affect runtime behavior or security guarantees.

---

## Issue 1 — Sensitive-data proof only inspects the decrypt hook

**File:** `tests/crypto.audit.spec.ts`
**Line:** 127–144 (inside `describe('sensitive-data and error handling')`)

**Problem:** The test clears `calls` after `encrypt()` and then asserts sensitive-data exclusion only for calls made during `decrypt()`. The `onEncrypt` hook call from the preceding `encrypt()` is therefore never inspected.

**Fix:** Do not clear the calls array. Iterate over all calls after both `encrypt()` and `decrypt()` have run and assert each call has exactly two args and neither arg equals the plaintext or the base64 ciphertext.

**Suggested change:**

```ts
it('never passes plaintext or ciphertext to any hook', () => {
  const plaintext = 'my-sensitive-plaintext';
  const { logger, calls } = createSpyLogger();
  const crypto = buildCryptoWithAuditLogger(logger, 1);

  const encrypted = crypto.encrypt(plaintext, EncryptionKey.PII);
  crypto.decrypt(encrypted);

  expect(calls.length).toBeGreaterThanOrEqual(2);
  for (const call of calls) {
    expect(call.argCount).toBe(2);
    expect(typeof call.args[0]).toBe('string');
    expect(typeof call.args[1]).toBe('number');
    expect(call.args[0]).not.toBe(plaintext);
    expect(call.args[0]).not.toBe(encrypted.encryptedData);
    expect(call.args[1]).not.toBe(plaintext);
    expect(call.args[1]).not.toBe(encrypted.encryptedData);
  }
});
```

---

## Issue 2 — `reEncrypt()` hook test omits version assertions

**File:** `tests/crypto.audit.spec.ts`
**Line:** 97–109

**Problem:** The test verifies `onDecrypt` then `onEncrypt` ordering and the two `keyName` values, but it does not assert the `version` values. The plan documents that `onDecrypt` should use the old payload version and `onEncrypt` should use the current version.

**Fix:** Add `version` expectations to both calls.

**Suggested change:**

```ts
it('reEncrypt() fires onDecrypt then onEncrypt in order', () => {
  const { logger, calls } = createSpyLogger();
  const crypto = buildCryptoWithAuditLogger(logger, 2);

  const encrypted = crypto.encrypt('rotate-me', EncryptionKey.PII);
  calls.length = 0;

  crypto.reEncrypt(encrypted, EncryptionKey.BANK_DATA);

  expect(calls.map((c) => c.method)).toEqual(['onDecrypt', 'onEncrypt']);
  expect(calls[0]!.keyName).toBe(EncryptionKey.PII);
  expect(calls[0]!.version).toBe(2);
  expect(calls[1]!.keyName).toBe(EncryptionKey.BANK_DATA);
  expect(calls[1]!.version).toBe(2);
});
```

---

## Issue 3 — Bulk object tests do not assert per-field key names

**File:** `tests/crypto.audit.spec.ts`
**Lines:** 111–125 (`encryptObject` / `decryptObject` tests)

**Problem:** The tests confirm the correct number of hook calls and the correct method (`onEncrypt` / `onDecrypt`), but they do not verify that each field used the key name declared in the `fieldMap`. A regression where every field silently used the default key would still pass these tests.

**Fix:** Collect the `keyName` values from the calls and assert they match the field map.

**Suggested change for `encryptObject`:**

```ts
it('encryptObject() fires onEncrypt once per mapped field', () => {
  const { logger, calls } = createSpyLogger();
  const crypto = buildCryptoWithAuditLogger(logger, 1);

  const obj = { a: 'val1', b: 'val2', c: 'val3' };
  crypto.encryptObject(obj, { a: EncryptionKey.PII, b: EncryptionKey.BANK_DATA, c: EncryptionKey.GENERAL });

  expect(calls).toHaveLength(3);
  const keyNames = calls.map((c) => c.keyName);
  expect(keyNames).toEqual([EncryptionKey.PII, EncryptionKey.BANK_DATA, EncryptionKey.GENERAL]);
  for (const call of calls) {
    expect(call.method).toBe('onEncrypt');
  }
});
```

**Suggested change for `decryptObject`:**

```ts
it('decryptObject() fires onDecrypt once per mapped field', () => {
  const { logger, calls } = createSpyLogger();
  const crypto = buildCryptoWithAuditLogger(logger, 1);

  const obj = { a: 'val1', b: 'val2' };
  const encryptedObj = crypto.encryptObject(obj, { a: EncryptionKey.PII, b: EncryptionKey.GENERAL });
  calls.length = 0;

  crypto.decryptObject(encryptedObj, { a: EncryptionKey.PII, b: EncryptionKey.GENERAL });

  expect(calls).toHaveLength(2);
  const keyNames = calls.map((c) => c.keyName);
  expect(keyNames).toEqual([EncryptionKey.PII, EncryptionKey.GENERAL]);
  for (const call of calls) {
    expect(call.method).toBe('onDecrypt');
  }
});
```

---

## Verification After Fixes

Run the same commands as in the implementation plan:

```bash
npm run build
npm run lint
npm test
```

Expected result:

- `npm run build` passes with no TypeScript errors.
- `npm run lint` passes with no ESLint errors.
- All tests pass with 100 % coverage on `src/crypto.service.audit.ts` and 100 % global coverage.

---

## Out of Scope

- No source-code changes are required; the gaps are test-only.
- Documentation updates remain the responsibility of the docs-specialist step (4.4).
