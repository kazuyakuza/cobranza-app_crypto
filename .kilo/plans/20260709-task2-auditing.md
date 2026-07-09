# Per-Task Plan: Task 2 — Observability & Auditing

- **Date:** 2026-07-09
- **TODO:** `.agent/todos/20260707/20260707-todo-4.md` — Task 2: Observability & Auditing
- **Global Plan:** `.kilo/plans/20260709-phase4-advanced-features.md`
- **Branch:** `feat/phase4-advanced-features`
- **Critical Workflow step:** 4.1 (Analysis & Planning) for Task 2

---

## 1. Task Scope (verbatim from TODO)

> Add optional event hooks to `SecureCrypto`:
> - Allow passing an `AuditLogger` interface in `CryptoConfig` with methods like `onEncrypt(keyName: string, version: number)` and `onDecrypt(keyName: string, version: number)`.
> - Ensure no sensitive data (plaintext or full ciphertext) is ever logged.

---

## 2. Current State (verified)

| File | Lines | Role |
|---|---|---|
| `src/config.ts` | 61 | `EncryptionKey` enum + `CryptoConfig` interface (masterKey, hashSalt, currentVersion, defaultKeyName) |
| `src/crypto.service.ts` | 193 | `SecureCrypto` facade: encrypt, decrypt, hash, verifyHash, encryptAndHash, reEncrypt, encryptObject, decryptObject, withCache, hasKey, getAvailableKeys, destroy |
| `src/crypto.service.validation.ts` | 119 | `ResolvedConfig` + `resolveConfig` (validates masterKey + hashSalt, applies defaults) |
| `src/crypto.service.bulk.ts` | 192 | `encryptObjectFields` / `decryptObjectFields` — call `crypto.encrypt` / `crypto.decrypt` per field |
| `src/utils/decryption-cache.ts` | 122 | `createDecryptionCacheWrapper` — calls `decryptor.decrypt` only on cache miss |
| `src/index.ts` | 59 | Public entrypoint re-exports |
| `src/crypto.service.guards.ts` | 106 | input validation (assertValidEncryptedValue, assertValidPlaintext, assertValidHash) |
| `src/crypto.service.encryption.ts` | 102 | AES-256-GCM primitives |
| `tests/crypto.*.spec.ts` | 9 files | existing test suites |

**Facade line budget:** currently 193 lines. The plan adds ~6 net lines (1 import, 1 field, 1 ctor assignment, 2 call sites). Projected ~199 lines — under the 200-line limit. The implementer MUST run `wc -l src/crypto.service.ts` after edits and, if it reaches 200, trim a blank line or collapse a comment to stay ≤199.

---

## 3. Design Decisions (final)

### 3.1 Placement — new `src/audit.ts`
The `AuditLogger` interface lives in a new `src/audit.ts` (single responsibility). `src/config.ts` only imports the type and adds an optional `auditLogger?: AuditLogger` field. This mirrors the existing `crypto.service.*.ts` mixin-extraction pattern and keeps `config.ts` config-focused.

### 3.2 Facade line budget — extract notifiers to `src/crypto.service.audit.ts`
The null-guard + try/catch-swallow logic is encapsulated in `notifyEncrypt` / `notifyDecrypt` functions exported from `src/crypto.service.audit.ts`. The facade adds only thin call sites:
```ts
notifyEncrypt({ auditLogger: this.auditLogger, keyName, version: this.resolvedConfig.currentVersion });
```
This keeps the facade a thin orchestrator and isolates audit logic in its own ≤200-line module.

### 3.3 Transitive hook firing — no extra wiring
All compound operations delegate to the facade's public `encrypt` / `decrypt` methods. Because the two notifier call sites are placed inside `encrypt` and `decrypt`, every code path is covered automatically:

| Method | Hook(s) fired | Mechanism |
|---|---|---|
| `encrypt` | `onEncrypt(keyName, currentVersion)` ×1 | direct call site |
| `decrypt` | `onDecrypt(keyName, resolvedVersion)` ×1 | direct call site |
| `encryptAndHash` | `onEncrypt` ×1 | delegates to `this.encrypt` |
| `reEncrypt` | `onDecrypt` (old) then `onEncrypt` (target) | delegates to `this.decrypt` then `this.encrypt` — order preserved |
| `encryptObject` | `onEncrypt` ×N (per field in `fieldMap`) | bulk calls `crypto.encrypt` per field |
| `decryptObject` | `onDecrypt` ×N (per field in `fieldMap`) | bulk calls `crypto.decrypt` per field |
| `withCache` | `onDecrypt` on cache MISS only | wrapper calls `decryptor.decrypt` only on miss |
| `hash`, `verifyHash`, `hasKey`, `getAvailableKeys`, `destroy` | none | out of scope (no encrypt/decrypt) |

**Per-field vs per-call for object ops:** per field. The bulk functions already loop `crypto.encrypt` / `crypto.decrypt` per mapped field, so hooks fire once per field — free, accurate, and matches the TODO intent ("per field").

### 3.4 Hook timing — after successful completion
Audit hooks fire ONLY after the cryptographic operation succeeds. Failed operations (authentication errors, malformed payloads) do NOT emit audit events — failing closed avoids misleading "encrypt" entries for data that was never encrypted/decrypted, and avoids noise from error paths.

### 3.5 Logger errors are swallowed
`notifyEncrypt` / `notifyDecrypt` wrap the logger call in `try { ... } catch { /* swallow */ }`. A misbehaving logger (throws, writes to a downed sink, etc.) can never break a cryptographic operation. The swallow is intentional and documented.

### 3.6 Sensitive-data guarantee — enforced at the type level
The `AuditLogger` interface signature accepts ONLY `keyName: string` and `version: number`:
```ts
export interface AuditLogger {
  onEncrypt(keyName: string, version: number): void;
  onDecrypt(keyName: string, version: number): void;
}
```
No plaintext or ciphertext parameter exists on the interface, so it is impossible to pass sensitive data to a conforming logger. A dedicated test (spy with `toHaveBeenCalledWith`) asserts each call received exactly two metadata args and that neither arg contains plaintext/ciphertext.

### 3.7 Max-2-params compliance
- Consumer-facing `AuditLogger.onEncrypt(keyName, version)` / `onDecrypt(keyName, version)` keep exactly 2 args (ergonomic + within rule).
- Internal notifier functions take a single param object `AuditNotifyParams` (encapsulates `auditLogger`, `keyName`, `version`) to stay within the 2-arg rule and the "encapsulate >2 params in an object" rule.

### 3.8 Private members
`auditLogger` is a `private readonly` field on `SecureCrypto`. The notifier functions are module-private (only `notifyEncrypt` / `notifyDecrypt` exported, used by the facade). No public surface is added to `SecureCrypto` for audit (consumers configure it via `CryptoConfig.auditLogger`).

---

## 4. Implementation Steps

### Step 4.0 — Git pre-check (implementer)
```bash
git status
git branch --show-current   # must be feat/phase4-advanced-features
```
Commit any uncommitted Task 1 work first (should already be committed). No new branch.

### Step 4.1 — Create `src/audit.ts` (NEW)

```ts
/**
 * Audit logger interface for optional observability of SecureCrypto operations.
 *
 * Consumers implement this and pass an instance via `CryptoConfig.auditLogger`.
 * Hooks receive ONLY non-sensitive metadata (`keyName`, `version`) — never
 * plaintext or ciphertext. This is enforced at the type level: the interface
 * signatures have no parameter capable of carrying sensitive payload data.
 *
 * @packageDocumentation
 * @module audit
 */

/**
 * Optional observability hooks invoked after successful encrypt/decrypt
 * operations. Implementations MUST NOT throw; any thrown error is swallowed
 * by the notifier so a misbehaving logger can never break a crypto operation.
 *
 * @example
 * ```ts
 * import type { AuditLogger } from '@cobranza-apps/crypto';
 *
 * const logger: AuditLogger = {
 *   onEncrypt(keyName, version) { metrics.increment('encrypt', { keyName, version }); },
 *   onDecrypt(keyName, version) { metrics.increment('decrypt', { keyName, version }); },
 * };
 * // pass via CryptoConfig.auditLogger
 * ```
 */
export interface AuditLogger {
  /** Invoked once after each successful `encrypt` (incl. transitive callers). */
  onEncrypt(keyName: string, version: number): void;
  /** Invoked once after each successful `decrypt` (incl. transitive callers). */
  onDecrypt(keyName: string, version: number): void;
}
```
**Expected length:** ~38 lines. **Coverage:** type-only — no runtime code to cover.

### Step 4.2 — Edit `src/config.ts`

Add import + optional field. Insert after the `EncryptionKey` enum, before `CryptoConfig`:
```ts
import type { AuditLogger } from './audit.js';
```
(Place at top with other imports — config.ts currently has no imports, so add a top-of-file import section.)

Add to `CryptoConfig` (after `defaultKeyName`):
```ts
  /** Optional audit hooks fired after successful encrypt/decrypt. See {@link AuditLogger}. */
  readonly auditLogger?: AuditLogger;
```
**Projected length:** ~69 lines (was 61).

### Step 4.3 — Edit `src/crypto.service.validation.ts`

Add `auditLogger` to `ResolvedConfig`:
```ts
import type { AuditLogger } from './audit.js';
// ...
export interface ResolvedConfig {
  readonly masterKey: string;
  readonly hashSalt: string;
  readonly currentVersion: number;
  readonly defaultKeyName: EncryptionKey | undefined;
  /** Optional audit hooks, passed through from CryptoConfig (never validated). */
  readonly auditLogger: AuditLogger | undefined;
}
```
Pass through in `resolveConfig`:
```ts
  return {
    masterKey: config.masterKey,
    hashSalt: config.hashSalt,
    currentVersion: config.currentVersion ?? DEFAULT_VERSION,
    defaultKeyName: config.defaultKeyName,
    auditLogger: config.auditLogger,
  };
```
**Projected length:** ~127 lines (was 119).

### Step 4.4 — Create `src/crypto.service.audit.ts` (NEW)

```ts
/**
 * Audit notifier helpers for {@link module:crypto.service}.
 *
 * Encapsulates the null-guard + error-swallowing logic so the facade stays
 * under the 200-line limit. Notifier functions are the ONLY bridge between
 * `SecureCrypto` and a consumer-provided {@link AuditLogger}.
 *
 * @remarks
 * Hooks fire ONLY after a successful crypto operation. A logger that throws
 * is silently swallowed — audit must never break encryption/decryption.
 *
 * @module crypto.service.audit
 */

import type { AuditLogger } from './audit.js';

/** Inputs for {@link notifyEncrypt} and {@link notifyDecrypt}. */
export interface AuditNotifyParams {
  /** Consumer-provided logger; no-op when undefined. */
  readonly auditLogger: AuditLogger | undefined;
  /** Key name used for the operation (never plaintext or ciphertext). */
  readonly keyName: string;
  /** Key version used for the operation. */
  readonly version: number;
}

/**
 * Fire `auditLogger.onEncrypt` after a successful encrypt.
 * No-op when `auditLogger` is undefined; swallows any thrown error.
 */
export function notifyEncrypt(params: AuditNotifyParams): void {
  const { auditLogger, keyName, version } = params;
  if (!auditLogger) {
    return;
  }
  try {
    auditLogger.onEncrypt(keyName, version);
  } catch {
    /* swallow — audit must never break crypto */
  }
}

/**
 * Fire `auditLogger.onDecrypt` after a successful decrypt.
 * No-op when `auditLogger` is undefined; swallows any thrown error.
 */
export function notifyDecrypt(params: AuditNotifyParams): void {
  const { auditLogger, keyName, version } = params;
  if (!auditLogger) {
    return;
  }
  try {
    auditLogger.onDecrypt(keyName, version);
  } catch {
    /* swallow — audit must never break crypto */
  }
}
```
**Expected length:** ~52 lines. **Coverage target:** 100% (null-guard + try-success + catch branches all exercised by tests).

### Step 4.5 — Edit `src/crypto.service.ts`

**4.5.1 Add import** (top, with other `crypto.service.*` imports):
```ts
import { notifyDecrypt, notifyEncrypt } from './crypto.service.audit.js';
```

**4.5.2 Add type import** (with the existing type imports):
```ts
import type { AuditLogger } from './audit.js';
```

**4.5.3 Add private field** (after `derivedKeysCache`):
```ts
  /** Optional audit logger; no-op hooks when undefined. */
  private readonly auditLogger: AuditLogger | undefined;
```

**4.5.4 Assign in constructor** (after `this.derivedKeysCache = ...`):
```ts
    this.auditLogger = this.resolvedConfig.auditLogger;
```

**4.5.5 Call site in `encrypt`** — refactor to capture result before notifying:
```ts
  encrypt(plaintext: string, keyName: EncryptionKey | string): EncryptedValue {
    const key = this.deriveKey(keyName, this.resolvedConfig.currentVersion);
    const encrypted = encryptWithAesGcm({
      plaintext,
      key,
      keyName,
      version: this.resolvedConfig.currentVersion,
    });
    notifyEncrypt({
      auditLogger: this.auditLogger,
      keyName,
      version: this.resolvedConfig.currentVersion,
    });
    return encrypted;
  }
```
(Notify AFTER `encryptWithAesGcm` returns — preserves post-success ordering.)

**4.5.6 Call site in `decrypt`** — refactor to capture result before notifying:
```ts
  decrypt(encryptedValue: EncryptedValue): string {
    assertValidEncryptedValue(encryptedValue);
    const version = encryptedValue.version ?? this.resolvedConfig.currentVersion;
    const key = this.deriveKey(encryptedValue.keyName, version);
    const plaintext = decryptWithAesGcm({ encryptedData: encryptedValue.encryptedData, key });
    notifyDecrypt({
      auditLogger: this.auditLogger,
      keyName: encryptedValue.keyName,
      version,
    });
    return plaintext;
  }
```
(Notify AFTER `decryptWithAesGcm` returns — preserves post-success ordering.)

**4.5.7 Line-budget check:**
```bash
wc -l src/crypto.service.ts
```
Projected ~199 lines. If it reaches 200, trim one blank line or collapse a multi-line JSDoc to a single line. The implementer MUST report the final line count in the completion summary.

### Step 4.6 — Edit `src/index.ts`

Add to the export block (with the other type re-exports):
```ts
export type { AuditLogger } from './audit.js';
```
Also update the API table comment at the top of `src/index.ts` to add a row:
```
 * | {@link AuditLogger} | interface | Optional audit hooks for encrypt/decrypt observability |
```
**Projected length:** ~61 lines (was 59).

### Step 4.7 — Update `.agent/project-structure.md`

Update the `src/` bullet to mention the new audit modules:
```
- src/ - library root: main exports, config interfaces, SecureCrypto facade, HKDF derivation, helpers, mixins (encryption/hashing/keys/validation/guards, bulk object-operations, audit notifier), and AuditLogger interface (audit.ts)
```

### Step 4.8 — Create `tests/crypto.audit.spec.ts` (NEW)

```ts
/**
 * Unit tests for AuditLogger hooks wired into SecureCrypto.
 * Verifies hook firing, ordering, sensitive-data exclusion, error swallowing,
 * per-field bulk behavior, and cache-miss-only firing.
 */
import { EncryptionKey } from '../src/index.js';
import type { SecureCrypto, AuditLogger } from '../src/index.js';
import { SecureCrypto } from '../src/crypto.service.js';
import { TEST_CRYPTO_CONFIG } from '../src/testing/index.js';
import { notifyEncrypt, notifyDecrypt } from '../src/crypto.service.audit.js';
import type { EncryptedValue } from '@cobranza-apps/entities';

interface AuditCall {
  method: 'onEncrypt' | 'onDecrypt';
  keyName: string;
  version: number;
  argCount: number;
  args: unknown[];
}

function createSpyLogger(): { logger: AuditLogger; calls: AuditCall[] } {
  const calls: AuditCall[] = [];
  const logger: AuditLogger = {
    onEncrypt(keyName, version) {
      calls.push({ method: 'onEncrypt', keyName, version, argCount: 2, args: [keyName, version] });
    },
    onDecrypt(keyName, version) {
      calls.push({ method: 'onDecrypt', keyName, version, argCount: 2, args: [keyName, version] });
    },
  };
  return { logger, calls };
}

function buildCryptoWithAuditLogger(logger: AuditLogger, version = 1): SecureCrypto {
  return new SecureCrypto({ ...TEST_CRYPTO_CONFIG, currentVersion: version, auditLogger: logger });
}

describe('SecureCrypto — AuditLogger hooks', () => {
  // Case 1: encrypt fires onEncrypt once with correct metadata
  // Case 2: decrypt fires onDecrypt once with payload keyName + resolved version
  // Case 3: encryptAndHash fires onEncrypt exactly once (no hash hook)
  // Case 4: reEncrypt fires onDecrypt then onEncrypt, in order
  // Case 5: encryptObject fires onEncrypt once per field (count == fieldMap.size)
  // Case 6: decryptObject fires onDecrypt once per field
  // Case 7: sensitive-data proof — every call has exactly 2 args; neither contains plaintext/ciphertext
  // Case 8: logger throws -> swallowed; encryption/decryption still succeeds
  // Case 9: no auditLogger configured -> silent, no throws
  // Case 10: withCache - cache miss fires onDecrypt once; cache hit fires 0
  // Case 11: decrypt with version-less payload falls back to currentVersion in the hook
  // Case 12: notifyEncrypt/notifyDecrypt null-guard + swallow branches (direct unit tests)
});
```

**Concrete test list (one `it` each):**

1. `it('fires onEncrypt once with keyName and currentVersion after encrypt()')` — assert `calls.length === 1`, `calls[0].method === 'onEncrypt'`, `calls[0].keyName === EncryptionKey.PII`, `calls[0].version === 1`.
2. `it('fires onDecrypt once with payload keyName and resolved version after decrypt()')` — encrypt at v2, decrypt, assert `onDecrypt` with payload's `keyName` and version `2`.
3. `it('decrypt() falls back to currentVersion when payload has no version field')` — manually craft an `EncryptedValue` without `version`, assert hook received `currentVersion`.
4. `it('encryptAndHash() fires onEncrypt exactly once and never a decrypt hook')` — assert `calls.length === 1` and `calls[0].method === 'onEncrypt'`.
5. `it('reEncrypt() fires onDecrypt then onEncrypt in order')` — assert `calls.map(c => c.method).toEqual(['onDecrypt', 'onEncrypt'])`, and the onDecrypt uses the old `keyName`/`version`, onEncrypt uses the target keyName + currentVersion.
6. `it('encryptObject() fires onEncrypt once per mapped field')` — 3-field map -> 3 `onEncrypt` calls.
7. `it('decryptObject() fires onDecrypt once per mapped field')` — 3-field map -> 3 `onDecrypt` calls.
8. `it('never passes plaintext or ciphertext to any hook')` — for every call, assert `argCount === 2`, `typeof args[0] === 'string'` (keyName), `typeof args[1] === 'number'` (version), and that neither arg equals the known plaintext string nor the `encryptedData` base64 string.
9. `it('swallows errors thrown by the logger without breaking encrypt/decrypt')` — logger whose `onEncrypt` throws; assert `encrypt()` still returns a valid `EncryptedValue` and does not throw. Same for `onDecrypt` + `decrypt()`.
10. `it('works silently when no auditLogger is configured')` — `buildTestCrypto(1)` (no logger); assert encrypt/decrypt succeed and no throws.
11. `it('withCache() fires onDecrypt only on cache miss, not on cache hit')` — `crypto.withCache({ ttlMs: 10_000 })`; first `.decrypt()` -> 1 `onDecrypt`; second identical `.decrypt()` -> still 1 total (cache hit added 0).
12. `it('notifyEncrypt is a no-op when auditLogger is undefined')` — call `notifyEncrypt({ auditLogger: undefined, keyName: 'pii', version: 1 })` directly; assert no throw. Repeat for `notifyDecrypt`. Add a sub-case with a logger that throws; assert swallow (no throw propagates).

**Coverage goal:** 100% statements/branches/functions on `src/audit.ts` (type-only, trivially 100%), `src/crypto.service.audit.ts`, and the new lines in `config.ts` / `validation.ts` / `crypto.service.ts`.

### Step 4.9 — Build + lint + test
```bash
npm run build
npm run lint
npm test
```
The implementer MUST confirm:
- `npm run build` clean (no TS errors).
- `npm run lint` clean.
- `npm test` passes with coverage >=85% global **and** 100% on the new source files (`src/audit.ts`, `src/crypto.service.audit.ts`). Check the jest coverage report for these two files specifically.

### Step 4.10 — Commit
```bash
git add src/audit.ts src/crypto.service.audit.ts src/config.ts src/crypto.service.validation.ts src/crypto.service.ts src/index.ts tests/crypto.audit.spec.ts .agent/project-structure.md
git status   # verify no .gitignore-matching files staged (gitignore-compliance rule)
git commit -m "feat(audit): add optional AuditLogger hooks to SecureCrypto (Task 2)"
```
Verify branch is `feat/phase4-advanced-features`. **Do NOT push** — push happens at Step 5 of the global Critical Workflow.

---

## 5. Verification Checklist (for Step 4.5)

- [ ] `AuditLogger` interface in `src/audit.ts` accepts ONLY `(keyName: string, version: number)` — no plaintext/ciphertext parameter possible.
- [ ] `CryptoConfig.auditLogger?: AuditLogger` is optional; existing consumers compile unchanged.
- [ ] `ResolvedConfig.auditLogger` is pass-through (never validated — loggers are consumer-owned).
- [ ] `notifyEncrypt` / `notifyDecrypt` are the only call sites in the facade (2 total).
- [ ] Hooks fire AFTER successful crypto (post-success ordering).
- [ ] Hooks are no-ops when `auditLogger` is undefined (early return).
- [ ] Logger errors are swallowed (try/catch) — audit never breaks crypto.
- [ ] `src/crypto.service.ts` <= 200 lines (report exact count after edits).
- [ ] `src/audit.ts` and `src/crypto.service.audit.ts` each < 200 lines and < 50 lines per method body.
- [ ] Notifier functions use a param object (<=2 args).
- [ ] `auditLogger` field is `private readonly`.
- [ ] No new runtime dependencies.
- [ ] `src/index.ts` re-exports `AuditLogger` type.
- [ ] `tests/crypto.audit.spec.ts` covers all 12 cases above.
- [ ] 100% coverage on `src/audit.ts` + `src/crypto.service.audit.ts`.
- [ ] `npm run build`, `npm run lint`, `npm test` all clean.
- [ ] `.agent/project-structure.md` updated.
- [ ] Commit on `feat/phase4-advanced-features` with meaningful message; no `.gitignore`-matching files staged.

---

## 5b. Correction to Section 6 (Out of Scope)

- Documentation updates (JSDoc additions, README audit section, `docs/` guide) -> Step 4.4 (docs-specialist).
- Code review & simplification -> Step 4.3 (code-reviewer + code-simplifier).
- Final verification report -> Step 4.5 (architect).
- `[DONE]` marking on TODO -> Step 4.6 (implementer).
- Branch merge + push -> Step 5 (implementer).
- Task 3 (security hardening) and Task 4 (DX) are separate per-task cycles.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Facade exceeds 200 lines after edits | Notifier logic extracted to `crypto.service.audit.ts`; refactor `encrypt`/`decrypt` to capture result in a const (net +~6 lines). Implementer verifies with `wc -l` and trims a blank/comment line if needed. |
| Logger error breaks crypto | Notifier swallows all errors in try/catch. Dedicated test case 9. |
| Sensitive data leaks to logger | Interface signature accepts only `(keyName, version)` — type-level guarantee. Test case 8 asserts exactly 2 args, both non-sensitive. |
| Hook fires on failed operations | Hooks placed AFTER the crypto call returns successfully; failed throws skip the notifier. Control flow guarantees it. |
| `withCache` double-fires on hits | Wrapper only calls `decryptor.decrypt` on miss; hits return cached plaintext without entering `decrypt()`. Test case 11. |
| Transitive callers (encryptAndHash, reEncrypt, bulk) miscount | They all delegate to facade `encrypt`/`decrypt` — covered by transitive tests 4-6. |
| `notifyEncrypt`/`notifyDecrypt` symbol clash with existing code | New unique names; no existing exports collide. |

---

## 8. Acceptance Criteria for Task 2 (per-task)

- [ ] `AuditLogger` interface exported from `@cobranza-apps/crypto`.
- [ ] `CryptoConfig.auditLogger` is optional and pass-through validated.
- [ ] `encrypt` and `decrypt` fire hooks post-success with correct metadata.
- [ ] `encryptAndHash`, `reEncrypt`, `encryptObject`, `decryptObject`, `withCache` fire hooks transitively in the documented matrix.
- [ ] No hook ever receives plaintext or ciphertext (type + test proof).
- [ ] Logger errors are swallowed; crypto operations never fail due to audit.
- [ ] All new source files under 200 lines; all method bodies under 50 lines; <=2 params; <=2 nesting levels; private members.
- [ ] 100% coverage on `src/audit.ts` + `src/crypto.service.audit.ts`.
- [ ] `npm run build`, `npm run lint`, `npm test` all clean.
- [ ] Committed on `feat/phase4-advanced-features`; no gitignore violations.