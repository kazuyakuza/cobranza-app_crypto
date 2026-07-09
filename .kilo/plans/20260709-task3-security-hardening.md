# Per-Task Plan: Task 3 — Security Hardening

- **Date:** 2026-07-09
- **TODO:** `.agent/todos/20260707/20260707-todo-4.md`
- **Task:** Task 3 — Security Hardening (Critical Workflow step 4.1)
- **Branch:** `feat/phase4-advanced-features`
- **Global plan:** `.kilo/plans/20260709-phase4-advanced-features.md`

---

## Pre-Analysis: Current State vs. Task 3 Scope

| Item | Status | Location |
|---|---|---|
| `assertValidPlaintext` (length only) | ✅ exists | `src/crypto.service.guards.ts:57-64` |
| `assertValidHash` (non-empty + base64) | ✅ exists | `src/crypto.service.guards.ts:72-75` |
| `assertValidEncryptedValue` (non-empty + base64 + length) | ✅ exists | `src/crypto.service.guards.ts:99-106` |
| `destroy()` zeroing of cached keys + salt | ✅ exists | `src/crypto.service.ts:185-191` |
| Security docs (checklist + rotation) | ✅ exist | `docs/security-checklist.md`, `docs/key-rotation-guide.md` |
| README Security Best Practices | ✅ exists | `README.md:331-356` |
| Bulk ops `fieldMap` shape validation | ⚠️ partial (per-field value checks exist; no top-level `fieldMap` guard) | `src/crypto.service.bulk.ts` |
| **NEW — runtime `typeof` guards** | ⬜ missing | all public facade methods + guard helpers |
| **NEW — `version` validation** | ⬜ missing | `assertValidEncryptedValue` |
| **NEW — `algorithm` validation** | ⬜ missing | `assertValidEncryptedValue` |
| **NEW — `fieldMap` top-level guard** | ⬜ missing | `src/crypto.service.bulk.ts` |
| **NEW — plaintext/payload buffer zeroing in `decryptWithAesGcm`** | ⬜ missing | `src/crypto.service.encryption.ts:90-102` |
| **NEW — unified `docs/security-guide.md`** | ⬜ missing | new file |
| **NEW — README + docs index links** | ⬜ missing | `README.md`, `docs/README.md` |

### Why runtime `typeof` guards in TypeScript

TypeScript guarantees are compile-time only. Consumers routinely bypass them with
`any`-typed JSON payloads, dynamic DTO intermediaries, or `JSON.parse` results.
The facade is the trust boundary; it must fail closed on shape mismatches rather
than hand non-strings to `Buffer.byteLength` / `createHmac` / `createCipheriv`,
which would either throw cryptic errors or silently coerce values.

### Why buffer zeroing

`destroy()` already zeros cached derived keys + salt. The decrypt primitive,
however, returns a freshly allocated plaintext `Buffer` that lives until GC.
Zeroing it immediately after `toString('utf8')` is defense-in-depth against
memory dumps / core dumps / shared-buffer reuse. It is **not** a guarantee
(no language-level support for secure memory in Node.js); the JSDoc must say so.

### EncryptedValue type (external, from `@cobranza-apps/entities`)

```ts
interface EncryptedValue {
  encryptedData: string;
  keyName: string;
  algorithm?: string;   // optional
  version?: number;     // optional
}
```

`encrypt()` always stamps `algorithm: 'aes-256-gcm'` and `version: currentVersion`.
`assertValidEncryptedValue` must accept payloads where `algorithm`/`version`
are absent (legacy/external) but reject wrong-typed or unsupported values when
present, to surface corruption/serialization bugs early rather than at
decipher time.

---

## High-Level Approach

1. **Strengthen guard helpers** (`crypto.service.guards.ts`): add runtime type
   checks + `version` / `algorithm` validators, executed **before** value
   checks so type errors are reported first.
2. **Add facade entry guards** (`crypto.service.ts`): tiny private asserters
   enforcing `typeof string` on `plaintext` and `keyName` at the public API
   edge, so malformed inputs never reach the cipher/HMAC primitives.
3. **Add `fieldMap` top-level guard** (`crypto.service.bulk.ts`): reject
   non-object field maps before iterating.
4. **Zero temporary buffers** in `decryptWithAesGcm` on both success and
   failure paths (the decoded `payload` covers its IV/ciphertext/authTag
   subarray views; the assembled `plaintext` buffer is zeroed after string
   conversion).
5. **Create `docs/security-guide.md`**: a unified, consolidated security guide
   that cross-links (does not duplicate) the existing checklist + rotation
   docs, plus three required subsections: key storage, rotation procedure,
   common pitfalls.
6. **Link the new doc** from `README.md` (Security section + TOC) and
   `docs/README.md` (Guides section), and add a cross-link in
   `docs/security-checklist.md`'s Reference section.
7. **Tests**: extend `tests/crypto.input-validation.spec.ts` with type/version/
   algorithm branches; create `tests/crypto.security.spec.ts` for facade
   entry guards + buffer-zeroing behavior + bulk `fieldMap` guard.

### Constraints compliance plan

| Rule | Mitigation |
|---|---|
| ≤200 lines/src file | `crypto.service.ts` is 192 lines; adding ~10 lines of private asserters brings it to ~202. Extract the asserters into a new `src/crypto.service.facade-guards.ts` if needed (decision point at implementation time; prefer extraction to keep the facade thin and orchestrator-only). `crypto.service.guards.ts` is 106 lines; adding ~35 lines keeps it under 200. `crypto.service.encryption.ts` is 102; adding ~6 keeps it ~108. `crypto.service.bulk.ts` is 192; adding ~6 keeps it ~198 — tight, acceptable. |
| ≤50 lines/method body | All new helpers are <10 lines. |
| ≤2 method params | All new functions use 2 params or a param object. |
| ≤2 nesting levels | Maintained; the new asserts are single-level. |
| Private members by default | All new facade asserters are `private`. |
| No runtime deps | None added. |
| 100% coverage on new files | New branches all covered by the test additions below. |
| Single-section boolean conditions | `assertValidVersion` uses a single `if`; `isPositiveInteger` helper keeps the condition single-section per rule. |

---

## Detailed Implementation Steps (atomic, verifiable)

### Step 0 — Pre-flight

- Verify branch: `git status` → on `feat/phase4-advanced-features`.
- Verify no uncommitted unrelated changes; commit pending work first if any.

### Step 1 — Strengthen `src/crypto.service.guards.ts`

**1.1** Add private `assertString(value: unknown, fieldName: string): asserts value is string`
near the top (after `BASE64_PATTERN`):

```ts
function assertString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}: expected a string.`);
  }
}
```

**1.2** Add constants and helpers for version/algorithm validation:

```ts
const SUPPORTED_ALGORITHM = 'aes-256-gcm';

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function assertValidVersion(version: unknown): void {
  if (version === undefined) return;
  if (!isPositiveInteger(version)) {
    throw new Error('Invalid version: expected a positive integer or undefined.');
  }
}

function assertValidAlgorithm(algorithm: unknown): void {
  if (algorithm === undefined) return;
  if (algorithm !== SUPPORTED_ALGORITHM) {
    throw new Error(
      `Invalid algorithm: expected '${SUPPORTED_ALGORITHM}' or undefined.`,
    );
  }
}
```

**1.3** Update `assertValidPlaintext` to call `assertString` first:

```ts
export function assertValidPlaintext(plaintext: string): void {
  assertString(plaintext, 'plaintext');
  const byteLength = Buffer.byteLength(plaintext, 'utf8');
  if (byteLength > MAX_PLAINTEXT_BYTES) {
    throw new Error(
      `Invalid plaintext: length ${byteLength} bytes exceeds maximum ${MAX_PLAINTEXT_BYTES} bytes.`,
    );
  }
}
```

**1.4** Update `assertValidEncryptedValue` to use `assertString` on
`encryptedData` and `keyName` (replacing the `assertNonEmpty` calls that would
throw on non-strings), then add `version` + `algorithm` validation:

```ts
export function assertValidEncryptedValue(encryptedValue: EncryptedValue): void {
  if (!encryptedValue) {
    throw new Error('Invalid encryptedValue: expected an EncryptedValue object.');
  }
  assertString(encryptedValue.encryptedData, 'encryptedData');
  assertString(encryptedValue.keyName, 'keyName');
  assertValidVersion(encryptedValue.version);
  assertValidAlgorithm(encryptedValue.algorithm);
  assertNonEmpty(encryptedValue.encryptedData, 'encryptedData');
  assertNonEmpty(encryptedValue.keyName, 'keyName');
  assertEncryptedDataFormat(encryptedValue.encryptedData);
}
```

> Note: `assertString` runs before `assertNonEmpty` so the error message
> distinguishes type errors (`expected a string`) from empty-value errors
> (`expected a non-empty string`). `assertNonEmpty` is retained for empty
> string detection after the type check passes.

**1.5** Keep `assertNonEmpty` and `assertValidBase64` unchanged.

**Verification:** file under 200 lines; `npm run build` clean; existing tests in
`crypto.internals.spec.ts` and `crypto.input-validation.spec.ts` still pass
(error message matching: `/expected a non-empty string/` still produced for
empty strings; new branches added in Step 8).

### Step 2 — Add facade entry guards in `src/crypto.service.ts`

**2.1** If the facade would exceed 200 lines after additions, create
`src/crypto.service.facade-guards.ts` exporting:

```ts
export function assertPlaintextInput(plaintext: unknown): asserts plaintext is string {
  if (typeof plaintext !== 'string') {
    throw new Error('Invalid plaintext: expected a string.');
  }
}

export function assertKeyNameInput(keyName: unknown): asserts keyName is string {
  if (typeof keyName !== 'string') {
    throw new Error('Invalid keyName: expected a string.');
  }
}

export function assertOptionalKeyName(
  keyName: unknown,
): asserts keyName is string | undefined {
  if (keyName !== undefined && typeof keyName !== 'string') {
    throw new Error('Invalid keyName: expected a string or undefined.');
  }
}
```

**Decision:** prefer the extraction to keep `crypto.service.ts` an orchestrator
(max-depth and line-count rule). Implementer MUST confirm `crypto.service.ts`
remains ≤200 lines; if extraction keeps it under, use the extracted module;
otherwise inline as private methods and accept the line delta only if it does
not breach 200.

**2.2** Wire guards into facade methods:

```ts
encrypt(plaintext: string, keyName: EncryptionKey | string): EncryptedValue {
  assertPlaintextInput(plaintext);
  assertKeyNameInput(keyName);
  // ... unchanged body
}

hash(plaintext: string): string {
  assertPlaintextInput(plaintext);
  return computeHmacSha256({ plaintext, salt: this.hashSaltBytes });
}

verifyHash(plaintext: string, expectedHash: string): boolean {
  assertPlaintextInput(plaintext);
  // assertValidHash(expectedHash) already runs inside verifyHmacSha256
  return verifyHmacSha256({ plaintext, salt: this.hashSaltBytes, expectedHash });
}

encryptAndHash(
  plaintext: string,
  keyName: EncryptionKey | string,
): { encrypted: EncryptedValue; hash: string; } {
  assertPlaintextInput(plaintext);
  assertKeyNameInput(keyName);
  return { encrypted: this.encrypt(plaintext, keyName), hash: this.hash(plaintext) };
}

reEncrypt(encrypted: EncryptedValue, targetKeyName?: EncryptionKey | string): EncryptedValue {
  // assertValidEncryptedValue(encrypted) runs inside this.decrypt
  assertOptionalKeyName(targetKeyName);
  const plaintext = this.decrypt(encrypted);
  const resolvedTargetKeyName = targetKeyName ?? encrypted.keyName;
  return this.encrypt(plaintext, resolvedTargetKeyName);
}
```

> `decrypt` already calls `assertValidEncryptedValue`, which now includes
> type/version/algorithm checks. No change to `decrypt` body required.

### Step 3 — Add `fieldMap` top-level guard in `src/crypto.service.bulk.ts`

**3.1** Update the file header JSDoc (module summary already mentions validation).

**3.2** Add a guard at the top of `encryptObjectFields` and `decryptObjectFields`:

```ts
function assertFieldMap<T>(fieldMap: BulkFieldMap<T>): asserts fieldMap is BulkFieldMap<T> {
  if (typeof fieldMap !== 'object' || fieldMap === null) {
    throw new Error('Invalid fieldMap: expected a non-null object.');
  }
}
```

Call at the entry of each function, before destructuring/logic.

**3.3** Optionally also guard `obj`:

```ts
function assertSourceObject<T>(obj: T): asserts obj is T {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Invalid obj: expected a non-null object.');
  }
}
```

> Keep file under 200 lines (currently 192; +6 ⇒ ~198). Verify before commit.

### Step 4 — Buffer zeroing in `src/crypto.service.encryption.ts`

**4.1** Update `decryptWithAesGcm`:

```ts
export function decryptWithAesGcm(params: DecryptParams): string {
  const { encryptedData, key } = params;
  const payload = base64ToBuffer(encryptedData);
  const { initializationVector, ciphertext, authTag } = splitEncryptedPayload(payload);
  const decipher = createDecipheriv(ALGORITHM, key, initializationVector);
  decipher.setAuthTag(authTag);
  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const result = plaintext.toString('utf8');
    zeroBuffer(plaintext);
    zeroBuffer(payload);
    return result;
  } catch {
    zeroBuffer(payload);
    throw new Error('Decryption failed: invalid authentication tag or corrupted ciphertext.');
  }
}

function zeroBuffer(buffer: Buffer): void {
  if (buffer.length > 0) {
    buffer.fill(0);
  }
}
```

> `payload` covers `initializationVector`, `ciphertext`, and `authTag` (they
> are `subarray` views sharing the same memory). One `payload.fill(0)` zeroes
> all three. The assembled `plaintext` buffer is separate and is zeroed after
> the UTF-8 string conversion has produced a JS string (immutable, copied).

**4.2** Update the function JSDoc:

```ts
/**
 * Decrypt a base64 `IV(12) + ciphertext + authTag(16)` payload with AES-256-GCM.
 *
 * Best-effort cleanup: the decoded payload and the assembled plaintext buffer
 * are zeroed (`fill(0)`) on both success and failure paths. This is
 * defense-in-depth against memory dumps / shared-buffer reuse and is NOT a
 * guarantee against GC copies or language-level secure-memory attacks.
 *
 * @param params - Base64 `encryptedData` and the 32-byte derived key.
 * @returns Recovered plaintext (UTF-8).
 * @throws {Error} when the authentication tag is invalid or data is corrupted.
 */
```

**4.3** Keep `encryptWithAesGcm` unchanged. Its transient buffers (IV,
ciphertext, authTag) are returned inside `encryptedData` and are owned by the
caller; zeroing them would corrupt the output. Do NOT zero there.

### Step 5 — Create `docs/security-guide.md`

New file. Required subsections (per TODO + global plan "unified security guide"):

1. Overview (1 paragraph: scope, audience, this doc consolidates guidance).
2. Table of Contents (file > 100 lines ⇒ mandatory per rules).
3. Key Storage Practices (load from vault/KMS, env isolation, distinct
   masterKey/hashSalt, restrict IAM, never log).
4. Rotation Procedure (version-increment summary + link to
   `key-rotation-guide.md`; master-key-material rotation note with link).
5. Common Pitfalls to Avoid (logging plaintext, `===` on hashes, sharing
   caching across tenants, mixing key material + version, using testing keys
   in prod, assuming buffer zeroing guarantees secure memory, trusting
   unvalidated `EncryptedValue` payloads from JSON sources).
6. Buffer & Memory Hygiene (best-effort zeroing in `decryptWithAesGcm` + `destroy()`;
   trade-offs; consumer responsibilities).
7. Runtime Input Validation (what the library now enforces at the facade;
   what consumers must still validate upstream — e.g. request DTO shapes).
8. Cross-references (Security Checklist, Key Rotation Guide, README Security
   Best Practices, brief §7).

Suggested skeleton (actual content drafted by docs specialist in step 4.4;
this plan defines the structure and required links):

````markdown
# Security Guide

## Table of Contents
- [Overview](#overview)
- [Key Storage Practices](#key-storage-practices)
- [Rotation Procedure](#rotation-procedure)
- [Common Pitfalls to Avoid](#common-pitfalls-to-avoid)
- [Buffer & Memory Hygiene](#buffer--memory-hygiene)
- [Runtime Input Validation](#runtime-input-validation)
- [Reference](#reference)

## Overview
...

## Key Storage Practices
- Load `masterKey` and `hashSalt` from a secrets manager / vault / KMS at boot.
- Keep them as distinct secrets with independent rotation lifecycles.
- Use separate secrets per environment (dev/staging/prod).
- Restrict secret access to the service identity.
- Never expose via logs, traces, error responses, or client payloads.
- Never use the `@cobranza-apps/crypto/testing` keys in production.

## Rotation Procedure
1. Increment `currentVersion` (no new master key).
2. Deploy — new encryptions carry the new version.
3. Run an external `reEncrypt` background job to migrate stale records.
4. Verify migration; clear the decryption cache.
5. (Master-key material rotation is out of library scope — see Key Rotation Guide.)

See full procedure: [Key Rotation Guide](./key-rotation-guide.md).

## Common Pitfalls to Avoid
- Logging plaintext / decrypted values.
- Using `===` to compare hashes (use `verifyHash`).
- Sharing a decryption cache across users or tenants.
- Changing `masterKey` material and `currentVersion` simultaneously.
- Using `@cobranza-apps/crypto/testing` keys in production.
- Assuming buffer zeroing guarantees secure memory (best-effort only).
- Trusting `EncryptedValue` payloads from untrusted JSON without validation
  (the library now validates version/algorithm shape, but DTO-level validation
  is the consumer's responsibility).

## Buffer & Memory Hygiene
- `decryptWithAesGcm` zeros the decoded payload and the assembled plaintext
  buffer on both success and failure paths (best-effort, defense-in-depth).
- `SecureCrypto.destroy()` zeros cached derived keys and the decoded hash salt.
- Zeroing is NOT a guarantee against GC copies; do not rely on it for
  classified-level threat models.

## Runtime Input Validation
- The facade now enforces `typeof string` on `plaintext` and `keyName` at
  every public method.
- `assertValidEncryptedValue` validates `version` (positive integer or
  undefined) and `algorithm` (`'aes-256-gcm'` or undefined).
- Bulk operations reject non-object `fieldMap` / `obj`.
- Consumers must still validate request DTO shapes and reject non-string /
  non-EncryptedValue fields before they reach the library.

## Reference
- [Security Checklist](./security-checklist.md)
- [Key Rotation Guide](./key-rotation-guide.md)
- [README — Security Best Practices](../README.md#security-best-practices)
- [`brief.md`](../.agent/project-info/brief.md) §7
````

### Step 6 — Link the new doc

**6.1** `README.md` — add to TOC after "Security Best Practices":

```markdown
- [Security Guide](#security-guide)
```

> Or, to avoid a duplicate anchor, add a one-line link block under the
> existing "Security Best Practices" section:

```markdown
> **Consolidated guide:** [Security Guide](./docs/security-guide.md) — key storage, rotation summary, common pitfalls, buffer hygiene, runtime validation.
```

Add the same link inside the "Guides" list near `README.md:513`.

**6.2** `docs/README.md` — add under Guides:

```markdown
- [Security Guide](./security-guide.md) — Consolidated guide: key storage, rotation procedure, common pitfalls, buffer hygiene, runtime validation.
```

**6.3** `docs/security-checklist.md` — add to Reference section:

```markdown
- [Security Guide](./security-guide.md) — Consolidated prose guide (key storage, rotation, pitfalls, buffer hygiene).
```

### Step 7 — Tests

**7.1** Extend `tests/crypto.input-validation.spec.ts`:

```ts
describe('assertValidPlaintext — runtime type guards', () => {
  it('throws when plaintext is not a string', () => {
    expect(() => assertValidPlaintext(123 as unknown as string)).toThrow(/expected a string/);
    expect(() => assertValidPlaintext(null as unknown as string)).toThrow(/expected a string/);
    expect(() => assertValidPlaintext(undefined as unknown as string)).toThrow(/expected a string/);
    expect(() => assertValidPlaintext({} as unknown as string)).toThrow(/expected a string/);
  });
});

describe('assertValidEncryptedValue — version & algorithm', () => {
  const base = (overrides: Partial<EncryptedValue>): EncryptedValue =>
    ({ encryptedData: 'AAAA', keyName: 'pii', ...overrides });

  it('throws when version is zero', () => {
    expect(() => assertValidEncryptedValue(base({ version: 0 }))).toThrow(/positive integer/);
  });
  it('throws when version is negative', () => {
    expect(() => assertValidEncryptedValue(base({ version: -1 }))).toThrow(/positive integer/);
  });
  it('throws when version is a non-integer', () => {
    expect(() => assertValidEncryptedValue(base({ version: 1.5 }))).toThrow(/positive integer/);
  });
  it('throws when version is a string', () => {
    expect(() => assertValidEncryptedValue(base({ version: '1' as unknown as number }))).toThrow(/positive integer/);
  });
  it('passes when version is a positive integer', () => {
    expect(() => assertValidEncryptedValue(base({ version: 1 }))).not.toThrow();
  });
  it('passes when version is undefined', () => {
    expect(() => assertValidEncryptedValue(base({ version: undefined }))).not.toThrow();
  });
  it('throws when algorithm is unsupported', () => {
    expect(() => assertValidEncryptedValue(base({ algorithm: 'aes-128-gcm' }))).toThrow(/aes-256-gcm/);
  });
  it('throws when algorithm is a number', () => {
    expect(() => assertValidEncryptedValue(base({ algorithm: 1 as unknown as string }))).toThrow(/aes-256-gcm/);
  });
  it('passes when algorithm is aes-256-gcm', () => {
    expect(() => assertValidEncryptedValue(base({ algorithm: 'aes-256-gcm' }))).not.toThrow();
  });
  it('passes when algorithm is undefined', () => {
    expect(() => assertValidEncryptedValue(base({ algorithm: undefined }))).not.toThrow();
  });
  it('throws when encryptedData is not a string', () => {
    expect(() => assertValidEncryptedValue(base({ encryptedData: 123 as unknown as string }))).toThrow(/expected a string/);
  });
  it('throws when keyName is not a string', () => {
    expect(() => assertValidEncryptedValue(base({ keyName: 42 as unknown as string }))).toThrow(/expected a string/);
  });
});
```

**7.2** Create `tests/crypto.security.spec.ts` for facade + bulk + encryption guards:

```ts
describe('SecureCrypto — runtime type guards (facade)', () => {
  let crypto: ReturnType<typeof getTestCrypto>;
  beforeEach(() => { crypto = getTestCrypto(); });

  it('encrypt rejects non-string plaintext', () => {
    expect(() => crypto.encrypt(123 as unknown as string, EncryptionKey.PII)).toThrow(/expected a string/);
    expect(() => crypto.encrypt(null as unknown as string, EncryptionKey.PII)).toThrow(/expected a string/);
  });
  it('encrypt rejects non-string keyName', () => {
    expect(() => crypto.encrypt('x', 42 as unknown as string)).toThrow(/expected a string/);
  });
  it('hash rejects non-string plaintext', () => {
    expect(() => crypto.hash(null as unknown as string)).toThrow(/expected a string/);
  });
  it('verifyHash rejects non-string plaintext', () => {
    const h = crypto.hash('x');
    expect(() => crypto.verifyHash(null as unknown as string, h)).toThrow(/expected a string/);
  });
  it('encryptAndHash rejects non-string plaintext', () => {
    expect(() => crypto.encryptAndHash(undefined as unknown as string, EncryptionKey.PII)).toThrow(/expected a string/);
  });
  it('encryptAndHash rejects non-string keyName', () => {
    expect(() => crypto.encryptAndHash('x', 9 as unknown as string)).toThrow(/expected a string/);
  });
  it('reEncrypt rejects non-string optional keyName', () => {
    const enc = crypto.encrypt('x', EncryptionKey.PII);
    expect(() => crypto.reEncrypt(enc, 9 as unknown as string)).toThrow(/expected a string or undefined/);
  });
  it('decrypt rejects bad version on the encrypted payload', () => {
    const enc = crypto.encrypt('x', EncryptionKey.PII);
    expect(() => crypto.decrypt({ ...enc, version: 0 })).toThrow(/positive integer/);
    expect(() => crypto.decrypt({ ...enc, algorithm: 'aes-128-gcm' })).toThrow(/aes-256-gcm/);
  });
});

describe('encryptObject / decryptObject — fieldMap & obj guards', () => {
  let crypto: ReturnType<typeof getTestCrypto>;
  beforeEach(() => { crypto = getTestCrypto(); });

  it('encryptObject rejects non-object fieldMap', () => {
    expect(() => crypto.encryptObject({}, null as never)).toThrow(/fieldMap.*non-null object/);
    expect(() => crypto.encryptObject({}, 'x' as never)).toThrow(/fieldMap.*non-null object/);
  });
  it('decryptObject rejects non-object fieldMap', () => {
    expect(() => crypto.decryptObject({}, null as never)).toThrow(/fieldMap.*non-null object/);
  });
  it('encryptObject rejects non-object obj', () => {
    expect(() => crypto.encryptObject(null as never, {})).toThrow(/obj.*non-null object/);
  });
});

describe('decryptWithAesGcm — buffer zeroing (best-effort)', () => {
  let crypto: ReturnType<typeof getTestCrypto>;
  beforeEach(() => { crypto = getTestCrypto(); });

  it('recovers plaintext on success (roundtrip)', () => {
    const enc = crypto.encrypt('s3cret', EncryptionKey.PII);
    expect(crypto.decrypt(enc)).toBe('s3cret');
  });
  it('throws a closed error on a corrupted auth tag', () => {
    const enc = crypto.encrypt('s3cret', EncryptionKey.PII);
    const corrupted = corruptAuthTag(enc);  // helper using tests/payload-mutators.ts
    expect(() => crypto.decrypt(corrupted)).toThrow(/Decryption failed/);
  });
});
```

> `corruptAuthTag` helper either reuses `tests/payload-mutators.ts` if a
> suitable mutator exists, or is added locally. Implementer MUST verify
> existing mutator coverage before adding a duplicate.

### Step 8 — Verify

- `npm run build` — clean, no type errors.
- `npm run lint` — clean.
- `npm test` — all specs pass; coverage 100% on new branches:
  - `crypto.service.guards.ts` `assertString`, `assertValidVersion`,
    `assertValidAlgorithm`, `isPositiveInteger` (true + false branches).
  - `crypto.service.encryption.ts` `zeroBuffer` (length > 0 and 0 branches).
  - `crypto.service.bulk.ts` `assertFieldMap`, `assertSourceObject` (pass + fail).
  - Facade guard entry points (pass + fail for each method).
- `git status` confirms only the intended files changed; no
  `.gitignore`-matching files staged.

### Step 9 — Commit

Single task-scoped commit on `feat/phase4-advanced-features`:

```text
feat(security): harden input validation, zero decrypt buffers, add security guide

- Add runtime typeof guards to all public SecureCrypto methods
- Validate EncryptedValue.version (positive integer) and algorithm
  ('aes-256-gcm' or undefined) in assertValidEncryptedValue
- Reject non-object fieldMap/obj in bulk object operations
- Zero decoded payload and assembled plaintext buffer in decryptWithAesGcm
  on both success and failure paths (best-effort, defense-in-depth)
- Create docs/security-guide.md (consolidated key storage, rotation, pitfalls)
- Link the new guide from README, docs/README, and security checklist
- Extend tests for all new validation branches + buffer-zeroing behavior
```

---

## Files Touched (summary)

| File | Action | Approx. delta |
|---|---|---|
| `src/crypto.service.guards.ts` | edit | +~35 lines (≤200) |
| `src/crypto.service.encryption.ts` | edit | +~6 lines |
| `src/crypto.service.ts` | edit | wire existing guards (≤200) |
| `src/crypto.service.bulk.ts` | edit | +~6 lines (≤200) |
| `src/crypto.service.facade-guards.ts` | **new** (only if needed to keep facade ≤200) | ~30 lines |
| `docs/security-guide.md` | **new** | ~120-160 lines |
| `docs/README.md` | edit | +1 line |
| `docs/security-checklist.md` | edit | +1 line |
| `README.md` | edit | +2 lines (TOC + Guides) |
| `tests/crypto.input-validation.spec.ts` | extend | +~50 lines |
| `tests/crypto.security.spec.ts` | **new** | ~80-120 lines |

If `src/crypto.service.facade-guards.ts` is created, update
`.agent/project-structure.md` `src/` bullet to mention it (the
project-structure rule requires the doc to reflect reality).

---

## Test Strategy (coverage matrix)

| New branch | Test location | Verifies |
|---|---|---|
| `assertString` rejects non-string plaintext | `crypto.input-validation.spec.ts` | type guard fires before length check |
| `assertValidVersion` rejects 0 / -1 / 1.5 / `'1'` | `crypto.input-validation.spec.ts` | error matches `/positive integer/` |
| `assertValidVersion` accepts 1 and undefined | `crypto.input-validation.spec.ts` | passes |
| `assertValidAlgorithm` rejects `'aes-128-gcm'` / `1` | `crypto.input-validation.spec.ts` | error matches `/aes-256-gcm/` |
| `assertValidAlgorithm` accepts `'aes-256-gcm'` / undefined | `crypto.input-validation.spec.ts` | passes |
| `assertValidEncryptedValue` rejects non-string `encryptedData` / `keyName` | `crypto.input-validation.spec.ts` | error matches `/expected a string/` |
| Facade `encrypt` / `hash` / `verifyHash` / `encryptAndHash` / `reEncrypt` reject bad types | `crypto.security.spec.ts` | each method fails closed |
| Bulk `encryptObject` / `decryptObject` reject non-object `fieldMap` / `obj` | `crypto.security.spec.ts` | error matches `/non-null object/` |
| `decryptWithAesGcm` success path returns plaintext AND zeroes buffers | `crypto.security.spec.ts` | roundtrip + (best-effort, documented) — indirectly assert no throw on zeroing; the zeroing's correctness is documented as defense-in-depth, not asserted via memory inspection |
| `decryptWithAesGcm` failure path throws closed error AND zeroes payload | `crypto.security.spec.ts` | corrupted auth tag → `/Decryption failed/` |
| `zeroBuffer` length-0 branch | `crypto.security.spec.ts` or `crypto.internals.spec.ts` | feeding an empty buffer doesn't throw |

> Coverage of "buffer actually zeroed" via memory inspection is brittle and
> not part of the assertion contract. The test strategy asserts the success
> and failure **paths execute without error and return the documented
> behavior**, and relies on the documented best-effort guarantee. This is
> acceptable per the planned JSDoc and the global plan's risk note
> ("Buffer zeroing in Node.js is best-effort").

---

## Documentation Plan (for the 4.4 docs step)

The `docs/security-guide.md` content above is the **plan-defined structure**;
the docs-specialist sub-agent in step 4.4 owns the final prose. This plan
mandates:

- TOC present (file > 100 lines).
- All three required subsections present: key storage, rotation procedure,
  common pitfalls.
- Cross-links to existing `security-checklist.md` and `key-rotation-guide.md`
  (do not duplicate their content).
- A Buffer & Memory Hygiene section covering the new `decryptWithAesGcm`
  zeroing and `destroy()`.
- A Runtime Input Validation section documenting what the library now
  enforces and what consumers must still do.
- README + `docs/README.md` + `docs/security-checklist.md` updated with links.