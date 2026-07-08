# Plan — Task 4: Testing Infrastructure (Phase 1)

- **TODO:** `.agent/todos/20260707/20260707-todo-1.md` → Task 4 (lines 82–88)
- **Brief ref:** `.agent/project-info/brief.md` §6 (Testing Support), §4.1 (Public API), §5 (EncryptionKey), §7 (Security)
- **Plan path:** `.kilo/plans/20260708-task4-testing.md`
- **Scope:** Phase 1 ONLY. No encryption/hashing logic. Deterministic test fixtures + initial spec for constructor validation, `hasKey`, `getAvailableKeys`.
- **DoD touched:** "Tests (even if minimal) run without errors."

---

## 1. Pre-Analysis & Key Decisions

### 1.1 Current state (verified)
- `src/testing/index.ts` → 5-line stub, `export {};` (Phase 2 placeholder comment).
- `src/testing/test-vectors.ts` → 8-line stub, `export {};`.
- `tests/` → only `.gitkeep` (no spec files yet; `npm test` currently passes via `--passWithNoTests`).
- `src/crypto.service.ts` → `SecureCrypto` skeleton; constructor calls `resolveConfig(config)`; `hasKey`/`getAvailableKeys` functional; all crypto methods throw `'Not implemented in Phase 1'`.
- `src/crypto.service.validation.ts` → `resolveConfig` throws on:
  - `!config` → `'Invalid config: expected a CryptoConfig object.'`
  - `!masterKey` (empty) → `'Invalid masterKey: expected a non-empty base64 string.'`
  - decoded `masterKey.length !== 32` → `'Invalid masterKey: expected 32 bytes after base64 decode, got N bytes.'`
  - `!hashSalt` (empty) → `'Invalid hashSalt: expected a non-empty base64 string.'`
- `src/config.ts` → `EncryptionKey` (5 members: pii, company_pii, bank_data, notification, general), `CryptoConfig` (required `masterKey`/`hashSalt`; optional readonly `currentVersion`/`defaultKeyName`).
- `package.json` jest config: `preset: ts-jest`, `testEnvironment: node`, `roots: ["<rootDir>/src","<rootDir>/tests"]`, `testMatch: ["**/tests/**/*.spec.ts"]`.
- `tsconfig.json`: `module/moduleResolution: NodeNext`, `strict`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `include: ["src/**/*.ts"]`, `exclude: ["tests","**/*.spec.ts"]`.

### 1.2 Key decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Test file is `tests/crypto.service.spec.ts`** (NOT `crypto.service.test.ts`). | jest `testMatch` is `**/tests/**/*.spec.ts`; a `.test.ts` file would be ignored and `npm test` would still show 0 tests. The TODO's `e.g.` name is corrected to match the configured matcher. |
| D2 | **`SecureCryptoTestModule` is a plain provider-config object**, not a NestJS `@Module` class. | `@nestjs/testing` / `@nestjs/common` are NOT in `package.json` (verified: no `nestjs` references). Per task instructions, avoid a full module class when the dep is absent. The object is spreadable into `Test.createTestingModule({ ...SecureCryptoTestModule })` at the consumer side. |
| D3 | **Fixed test master key = 32 zero bytes** (`Buffer.alloc(32).toString('base64')`); **hash salt = 64 zero bytes** (`Buffer.alloc(64).toString('base64')`). | Satisfies validation (32-byte master key; >=32-byte, non-empty salt). Clearly TEST-ONLY, safe to publish (brief §7 "Never hardcode keys" applies to production, not test fixtures). Computed at module load via `Buffer.alloc` to guarantee correct base64 (no hand-computed literals that could be wrong). |
| D4 | **6 test vectors** (>=5 required), one per `EncryptionKey` category + one unicode/emoji edge case. `expectedEncrypted`/`expectedHash` use a `PHASE2_PLACEHOLDER` sentinel. | encrypt/hash are unimplemented in Phase 1. Real deterministic values land in Phase 2. |
| D5 | **Phase 2 ciphertext caveat documented.** HMAC-SHA256 hash is deterministic → `expectedHash` can be a real literal in Phase 2. AES-256-GCM uses a random 12-byte IV → ciphertext is non-deterministic → Phase 2 must either inject a fixed IV in test mode or assert round-trip/structure rather than exact ciphertext. | Prevents a future incorrect assumption that `expectedEncrypted` can be a static literal under the current algorithm. |
| D6 | **`getTestCrypto()` returns a fresh `SecureCrypto` per call.** Also export `TEST_CRYPTO_CONFIG`, `TEST_MASTER_KEY`, `TEST_HASH_SALT`. | Tests never share mutable state (per-instance derived-key cache). Exported fixtures let tests construct invalid configs (wrong-length/empty keys) from a known-good base. |
| D7 | **Re-export `TEST_VECTORS` + `TestVector` type from `src/testing/index.ts`.** | `package.json` `exports` only declares the `./testing` subpath (no `./testing/test-vectors`). Re-exporting keeps vectors reachable via `@cobranza-apps/crypto/testing`. |
| D8 | **No change to `src/index.ts` main barrel.** | Testing utilities live ONLY behind the `./testing` subpath to keep the production bundle clean (brief §6). |
| D9 | **Imports use `.js` extensions** (NodeNext convention used by existing source). Spec imports `../src/index.js` and `../src/testing/index.js`. | Consistency with `module: NodeNext`; ts-jest resolves `.js` → `.ts`. |
| D10 | **"Missing hashSalt" simulated via empty string `''`.** | `CryptoConfig.hashSalt` is required (`string`); with `exactOptionalPropertyTypes` it cannot be omitted. Validation `!hashSalt` catches `''` (and `null`/`undefined` at runtime). |
| D11 | **Avoid unused imports in spec.** Import only `SecureCrypto`, `EncryptionKey`, `getTestCrypto`, `TEST_CRYPTO_CONFIG`. Build invalid keys via `Buffer.alloc(...).toString('base64')` inside the test. | `noUnusedLocals`/`noUnusedParameters` are inherited by ts-jest and would fail the test compile on unused imports. |
| D12 | **Contingency: ts-jest `.js` resolution.** If `npm test` fails with a module-not-found for `../src/*.js`, add `moduleNameMapper` to the jest config in `package.json`. | Proven ts-jest + NodeNext workaround; only applied if the default run fails (keeps config minimal). |
| D13 | **Leave `tests/.gitkeep` in place.** | Preserve existing files (code-guidelines §5); harmless once a real spec exists. |
| D14 | **Git: work on the existing Phase 1 feature branch** (created in Critical Workflow step 2). No new branch in this task. | Critical Workflow step 2 already created the branch; this task only commits. |

---

## 2. High-Level Approach

1. Confirm preconditions (feature branch, deps installed).
2. Replace the `src/testing/test-vectors.ts` stub with the `TestVector` interface + `TEST_VECTORS` array.
3. Replace the `src/testing/index.ts` stub with fixed fixtures, `getTestCrypto()`, `SecureCryptoTestModule`, and re-exports.
4. Create `tests/crypto.service.spec.ts` with constructor validation + `hasKey`/`getAvailableKeys` tests.
5. Build (`npm run build`) → expect `dist/testing/*` emitted.
6. Run tests (`npm test`) → expect the new spec to pass. Apply D12 contingency only if needed.
7. Gitignore-compliance check + commit on the feature branch.

---

## 3. Detailed Steps

### Step 0 — Preconditions (implementer, before any edit)
- [ ] Confirm current git branch is the Phase 1 feature branch from Critical Workflow step 2 (e.g. `feat/crypto-phase1`). **Do not create a new branch.** If not on a feature branch, STOP and escalate to the Plan Agent.
- [ ] Read `.gitignore` and run `git status` (gitignore-compliance rule). Ensure no `node_modules/`, `dist/`, `.env*` are staged.
- [ ] Ensure dependencies are installed: run `npm install` if `node_modules/` is missing. `@cobranza-apps/entities` must be resolvable (it is imported, type-only, by `src/crypto.service.ts`).

### Step 1 — Replace `src/testing/test-vectors.ts` (full file overwrite)

**Path:** `src/testing/test-vectors.ts`
**Rule checks:** source file in `src/` → <=200 lines (this file ~85 lines OK); max-args n/a; max-depth <=2 OK; no commented code OK; self-documenting OK; prefer-private: `PHASE2_PLACEHOLDER` is module-private (not exported) OK.

**Exact content:**

```ts
/**
 * Deterministic test vectors for SecureCrypto operations.
 *
 * Fixed input/output pairs for encrypt/decrypt/hash/verifyHash. In Phase 1 the
 * `expectedEncrypted` and `expectedHash` fields are placeholders because the crypto
 * methods are not implemented yet. Phase 2 will populate:
 * - `expectedHash` with real HMAC-SHA256 values (deterministic).
 * - `expectedEncrypted` requires a fixed-IV test mode: AES-256-GCM uses a random
 *   12-byte IV, so ciphertext is otherwise non-deterministic (see plan D5).
 *
 * @packageDocumentation
 */

import { EncryptionKey } from '../config.js';

/** Sentinel marking a value deferred to Phase 2. */
const PHASE2_PLACEHOLDER = 'PLACEHOLDER_PHASE2';

/** Deterministic input/output pair for a single SecureCrypto operation. */
export interface TestVector {
  /** Plaintext input to encrypt/hash. */
  readonly plaintext: string;

  /** Logical key category used for encryption. */
  readonly keyName: EncryptionKey;

  /** Key version (increment on rotation). */
  readonly version: number;

  /** Expected base64 `IV(12) + ciphertext + authTag(16)`. Placeholder until Phase 2. */
  readonly expectedEncrypted: string;

  /** Expected deterministic HMAC-SHA256 hash. Placeholder until Phase 2. */
  readonly expectedHash: string;
}

/**
 * Curated set of deterministic test vectors covering every {@link EncryptionKey}
 * category plus a unicode/emoji edge case.
 */
export const TEST_VECTORS: readonly TestVector[] = [
  {
    plaintext: 'john.doe@example.com',
    keyName: EncryptionKey.PII,
    version: 1,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: PHASE2_PLACEHOLDER,
  },
  {
    plaintext: '12-34567890-1',
    keyName: EncryptionKey.COMPANY_PII,
    version: 1,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: PHASE2_PLACEHOLDER,
  },
  {
    plaintext: 'PAYMENT-REF-2026-000001',
    keyName: EncryptionKey.BANK_DATA,
    version: 2,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: PHASE2_PLACEHOLDER,
  },
  {
    plaintext: 'Your invoice #12345 is ready',
    keyName: EncryptionKey.NOTIFICATION,
    version: 1,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: PHASE2_PLACEHOLDER,
  },
  {
    plaintext: 'generic-sensitive-value',
    keyName: EncryptionKey.GENERAL,
    version: 1,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: PHASE2_PLACEHOLDER,
  },
  {
    plaintext: 'José María — Cañón ünïcode😀',
    keyName: EncryptionKey.PII,
    version: 1,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: PHASE2_PLACEHOLDER,
  },
];
```

- [ ] Verify `TEST_VECTORS` has 6 entries (5 enum categories + 1 unicode edge case).
- [ ] Verify no unused symbols (`PHASE2_PLACEHOLDER`, `EncryptionKey`, `TestVector` all used).

### Step 2 — Replace `src/testing/index.ts` (full file overwrite)

**Path:** `src/testing/index.ts`
**Rule checks:** source file in `src/` → <=200 lines (this file ~90 lines OK); `getTestCrypto` 0 args OK; methods <=50 lines OK; max-depth <=2 OK; prefer-private: only intended symbols exported OK.

**Exact content:**

```ts
/**
 * Public entrypoint for the `@cobranza-apps/crypto/testing` subpath.
 *
 * Exports test-only utilities for deterministic SecureCrypto testing:
 * - {@link getTestCrypto} — factory returning a pre-configured instance with fixed keys.
 * - {@link SecureCryptoTestModule} — NestJS-friendly provider config (spreadable into
 *   `Test.createTestingModule`; requires `@nestjs/testing` at the consumer side).
 * - {@link TEST_CRYPTO_CONFIG}, {@link TEST_MASTER_KEY}, {@link TEST_HASH_SALT} — fixed
 *   test fixtures.
 * - Re-exports {@link TEST_VECTORS} (+ {@link TestVector} type) from `./test-vectors.js`.
 *
 * @remarks
 * All keys/salts here are TEST-ONLY, derived from zero-filled buffers, and MUST NEVER
 * be used in production (brief §7). They are safe to publish.
 *
 * @packageDocumentation
 */

import { EncryptionKey } from '../config.js';
import type { CryptoConfig } from '../config.js';
import { SecureCrypto } from '../crypto.service.js';

export type { TestVector } from './test-vectors.js';
export { TEST_VECTORS } from './test-vectors.js';

/** Fixed 32-byte (all-zero) master key, base64-encoded. TEST-ONLY. */
export const TEST_MASTER_KEY: string = Buffer.alloc(32).toString('base64');

/** Fixed 64-byte (all-zero) hash salt (>=32 bytes), base64-encoded. TEST-ONLY. */
export const TEST_HASH_SALT: string = Buffer.alloc(64).toString('base64');

/** Fixed test configuration assembled from the known test keys. */
export const TEST_CRYPTO_CONFIG: CryptoConfig = {
  masterKey: TEST_MASTER_KEY,
  hashSalt: TEST_HASH_SALT,
  currentVersion: 1,
  defaultKeyName: EncryptionKey.PII,
};

/**
 * Build a fresh {@link SecureCrypto} instance pre-configured with fixed test keys.
 *
 * Each call returns a new instance so tests never share mutable state.
 *
 * @returns A {@link SecureCrypto} configured with {@link TEST_CRYPTO_CONFIG}.
 *
 * @example
 * ```ts
 * import { getTestCrypto } from '@cobranza-apps/crypto/testing';
 * const crypto = getTestCrypto();
 * crypto.hasKey('pii'); // => true
 * ```
 */
export function getTestCrypto(): SecureCrypto {
  return new SecureCrypto(TEST_CRYPTO_CONFIG);
}

/** Provider-config shape spreadable into NestJS `Test.createTestingModule`. */
export interface SecureCryptoProviderConfig {
  readonly providers: Array<{
    readonly provide: typeof SecureCrypto;
    readonly useFactory: () => SecureCrypto;
  }>;
  readonly exports: Array<typeof SecureCrypto>;
}

/**
 * NestJS-friendly provider config for {@link SecureCrypto} using fixed test keys.
 *
 * Not a NestJS module class (this library does not depend on `@nestjs/testing`).
 * Spread it into a `Test.createTestingModule` call at the consumer side:
 *
 * ```ts
 * import { Test } from '@nestjs/testing';
 * import { SecureCryptoTestModule } from '@cobranza-apps/crypto/testing';
 *
 * const moduleRef = await Test.createTestingModule({
 *   ...SecureCryptoTestModule,
 * }).compile();
 * const crypto = moduleRef.get(SecureCrypto);
 * ```
 */
export const SecureCryptoTestModule: SecureCryptoProviderConfig = {
  providers: [{ provide: SecureCrypto, useFactory: getTestCrypto }],
  exports: [SecureCrypto],
};
```

- [ ] Verify all imports are used: `EncryptionKey` (in `TEST_CRYPTO_CONFIG.defaultKeyName`), `CryptoConfig` (type annotation), `SecureCrypto` (factory return type + module). The `TestVector`/`TEST_VECTORS` are re-exported (no bare import → no unused-local error).
- [ ] Verify `SecureCryptoTestModule` is a plain `const` object (not a class), per D2.

### Step 3 — Create `tests/crypto.service.spec.ts` (new file)

**Path:** `tests/crypto.service.spec.ts` (NOT `.test.ts` — see D1)
**Rule checks:** `tests/` is outside `src/`, so `max-lines-per-file` does not apply; still keep tidy. Imports limited to what is used (D11).

**Exact content:**

```ts
import { SecureCrypto, EncryptionKey } from '../src/index.js';
import { getTestCrypto, TEST_CRYPTO_CONFIG } from '../src/testing/index.js';

describe('SecureCrypto — Phase 1 skeleton', () => {
  describe('constructor / config validation', () => {
    it('constructs without throwing given a valid config', () => {
      const crypto = new SecureCrypto(TEST_CRYPTO_CONFIG);

      expect(crypto).toBeInstanceOf(SecureCrypto);
    });

    it('getTestCrypto() returns a configured SecureCrypto instance', () => {
      expect(getTestCrypto()).toBeInstanceOf(SecureCrypto);
    });

    it('throws when masterKey decodes to fewer than 32 bytes', () => {
      const shortKey = Buffer.alloc(16).toString('base64');
      const invalidConfig = { ...TEST_CRYPTO_CONFIG, masterKey: shortKey };

      expect(() => new SecureCrypto(invalidConfig)).toThrow(/expected 32 bytes/);
    });

    it('throws when masterKey is empty', () => {
      const invalidConfig = { ...TEST_CRYPTO_CONFIG, masterKey: '' };

      expect(() => new SecureCrypto(invalidConfig)).toThrow(/non-empty base64 string/);
    });

    it('throws when hashSalt is empty (simulates a missing salt)', () => {
      const invalidConfig = { ...TEST_CRYPTO_CONFIG, hashSalt: '' };

      expect(() => new SecureCrypto(invalidConfig)).toThrow(/non-empty base64 string/);
    });
  });

  describe('hasKey', () => {
    it.each(Object.values(EncryptionKey))(
      'returns true for known key "%s"',
      (keyName) => {
        expect(getTestCrypto().hasKey(keyName)).toBe(true);
      },
    );

    it('returns false for an unknown key name', () => {
      expect(getTestCrypto().hasKey('unknown_key')).toBe(false);
    });
  });

  describe('getAvailableKeys', () => {
    it('returns every EncryptionKey value', () => {
      const available = getTestCrypto().getAvailableKeys();

      expect(available).toEqual(Object.values(EncryptionKey));
      expect(available).toHaveLength(5);
    });
  });
});
```

- [ ] Verify test count: 5 in constructor block + 5 `it.each` (one per enum value) + 1 unknown-key + 1 getAvailableKeys = **12 tests**.
- [ ] Verify regex matchers align with `crypto.service.validation.ts` messages:
  - `/expected 32 bytes/` matches `'Invalid masterKey: expected 32 bytes after base64 decode, got 16 bytes.'`
  - `/non-empty base64 string/` matches masterKey-empty and hashSalt-empty messages.
- [ ] Verify `Buffer` is available (jest `testEnvironment: node` + `@types/node`).

### Step 4 — Build verification
- [ ] Run `npm run build` (`tsc`).
  - Expect: succeeds; `dist/testing/index.js`, `dist/testing/index.d.ts`, `dist/testing/test-vectors.js`, `dist/testing/test-vectors.d.ts` emitted.
  - `tests/` is excluded from `tsc` (tsconfig `exclude`), so the spec is NOT compiled into `dist`.
- [ ] If `tsc` reports errors:
  - Unused import → remove it (D11).
  - `@cobranza-apps/entities` not found → run `npm install`, re-build.
  - Any other error → STOP, capture message, escalate.

### Step 5 — Test verification
- [ ] Run `npm test` (`jest --passWithNoTests`).
  - Expect: jest discovers `tests/crypto.service.spec.ts` (matches `**/tests/**/*.spec.ts`); **12 tests pass**.
- [ ] **Contingency (D12):** if jest fails with a module-resolution error for `../src/index.js` or `../src/testing/index.js` (ts-jest + NodeNext `.js` extension), add to the `jest` block in `package.json`:
  ```json
  "moduleNameMapper": {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  }
  ```
  Then re-run `npm test`. (Only add if the default run fails.)
- [ ] If any test fails for a non-resolution reason → STOP, capture the failure output, escalate (do not weaken assertions to force green).

### Step 6 — Lint (optional but recommended)
- [ ] Run `npm run lint` (`eslint . --ext .ts`).
  - Expect: no errors. If eslint flags the spec or testing files, fix per eslint guidance (do not disable rules silently).

### Step 7 — Gitignore compliance + commit (implementer)
- [ ] Run `git status`. Confirm staged set is exactly:
  - `src/testing/index.ts` (modified)
  - `src/testing/test-vectors.ts` (modified)
  - `tests/crypto.service.spec.ts` (new)
  - (optionally `package.json` IF the D12 contingency was applied)
- [ ] Confirm NO `dist/`, `node_modules/`, `.env*`, `.kilo/agent-manager.json` are staged (gitignore-compliance rule). Unstage any that slipped in.
- [ ] Stage only the intended files: `git add src/testing/index.ts src/testing/test-vectors.ts tests/crypto.service.spec.ts` (add `package.json` only if D12 applied).
- [ ] Commit on the feature branch:
  ```
  git commit -m "test(crypto): add testing infrastructure (Task 4)

  - src/testing/index.ts: getTestCrypto factory, SecureCryptoTestModule
    provider config, fixed test fixtures (TEST_MASTER_KEY/TEST_HASH_SALT/
    TEST_CRYPTO_CONFIG), re-export test vectors.
  - src/testing/test-vectors.ts: 6 deterministic TestVector entries (all
    EncryptionKey categories + unicode edge case) with Phase 2 placeholders.
  - tests/crypto.service.spec.ts: constructor/config validation, hasKey,
    getAvailableKeys (12 tests)."
  ```

---

## 4. Out of Scope (do NOT do in this task)
- Implementing `encrypt`/`decrypt`/`hash`/`verifyHash`/`encryptAndHash` (Phase 2).
- Populating real `expectedEncrypted`/`expectedHash` literals (Phase 2; see D5).
- Adding `@nestjs/testing` as a dependency or writing a NestJS `@Module` class (D2).
- Changing `src/index.ts` main barrel (D8).
- Removing `tests/.gitkeep` (D13).
- Creating a new git branch (D14) or merging to `main` (handled by Critical Workflow step 5).
- Updating `.agent/project-structure.md` (no new folders created; `src/testing/` and `tests/` already documented).
- Updating `context.md` (handled by the docs/verification steps of the Critical Workflow, not this planning step).

---

## 5. Verification Checklist (for step 4.5 Verification agent)
- [ ] `src/testing/index.ts` exports: `getTestCrypto`, `SecureCryptoTestModule`, `SecureCryptoProviderConfig`, `TEST_CRYPTO_CONFIG`, `TEST_MASTER_KEY`, `TEST_HASH_SALT`, `TEST_VECTORS`, `TestVector`.
- [ ] `src/testing/test-vectors.ts` exports: `TestVector`, `TEST_VECTORS` (6 entries).
- [ ] `tests/crypto.service.spec.ts` exists with `.spec.ts` extension and 12 passing tests.
- [ ] `npm run build` succeeds; `dist/testing/*` present.
- [ ] `npm test` shows 12 passed, 0 failed.
- [ ] No production crypto keys hardcoded; test fixtures are zero-filled buffers, clearly TEST-ONLY.
- [ ] No changes to `src/index.ts`, `src/crypto.service.ts`, `src/config.ts`.
- [ ] Commit exists on the feature branch with the message above.

---

## 6. Risks / Notes
- **R1 — ts-jest + NodeNext `.js` imports:** Mitigated by D12 contingency. Default path should work (ts-jest 29.1 supports NodeNext and the source already compiles with `.js` extensions).
- **R2 — `noUnusedLocals` via ts-jest:** Mitigated by D11 (spec imports only what it uses).
- **R3 — Deterministic ciphertext in Phase 2:** Recorded as D5 so the Phase 2 planner does not assume `expectedEncrypted` can be a static literal under random-IV AES-256-GCM.
- **R4 — `exactOptionalPropertyTypes`:** "Missing hashSalt" is simulated with `''` (D10) rather than omitting the property, to satisfy TS.
