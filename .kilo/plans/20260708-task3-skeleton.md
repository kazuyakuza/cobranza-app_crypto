# Implementation Plan — Task 3: SecureCrypto Core Class (Skeleton)

**Plan file target:** `.kilo/plans/20260708-task3-skeleton.md`
**TODO source:** `.agent/todos/20260707/20260707-todo-1.md` → Task 3
**Phase:** 1 (skeleton only — no crypto logic)

## 1. Pre-Analysis & Key Decisions

### 1.1 Current state (verified)
- `src/crypto.service.ts`: empty stub (`export {};`).
- `src/index.ts`: empty stub (`export {};`).
- `src/config.ts`: defines `EncryptionKey` enum and `CryptoConfig` interface (masterKey, hashSalt, `readonly currentVersion?`, `readonly defaultKeyName?`).
- `src/hkdf.ts` + `src/hkdf.types.ts`: `deriveKey({ masterKey, keyName, version })` already implemented (Phase 2 will use it).
- `src/utils.ts`: `base64ToBuffer`, `bufferToBase64`, `generateIv`, `concatBuffers`, `constantTimeCompare` available.
- `src/testing/index.ts` and `src/testing/test-vectors.ts` exist as stubs (Task 4 scope — not touched here).
- `package.json` defines `"./testing"` subpath export; only `.` and `./testing` are public entrypoints.
- `tsconfig.json`: strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `module: NodeNext` → **imports need `.js` extensions**.
- `@cobranza-apps/entities` is declared as peer+regular dependency but is **not present in `node_modules`** (package not installed/resolvable yet). `EncryptedValue` is imported from there per brief §2.2.

### 1.2 Key decisions
- `EncryptedValue` **must** be imported from `@cobranza-apps/entities` (brief §2.2 mandates no local duplication). Skeleton introduces the dependency reference now. **Build DoD depends on `@cobranza-apps/entities` being resolvable** — a Task 1 dependency-install gap; flagged in Notes, not silently worked around. Use `import type { EncryptedValue }` to keep it type-only (no runtime coupling in skeleton phase).
- The constructor performs **validation only** (base64 decode + length check on masterKey; presence check on hashSalt). No HKDF/derive calls in the skeleton (Phase 2). masterKey length validation reuses the pattern already established in `hkdf.ts:decodeMasterKey` but is kept local to the service to avoid coupling the constructor to internals now; a small local helper avoids duplicating logic across files (kept private in the service).
- Derived-key cache: `private readonly derivedKeysCache: Map<string, Buffer>`. Cache key format: `${keyName}:v${version}`. No population in skeleton (Phase 2 populates on first `encrypt`/`decrypt`); but the map and version constant are declared now.
- Default version: `1` (constant). `currentVersion` from config is optional; resolved as `config.currentVersion ?? DEFAULT_VERSION`.
- Phase-1 stubs (`encrypt`, `decrypt`, `hash`, `verifyHash`, `encryptAndHash`) throw `new Error('Not implemented in Phase 1')` — exact mandated message.
- `hasKey` and `getAvailableKeys` are **minimally implemented** (no crypto): based on the `EncryptionKey` enum membership rather than cache contents, so the skeleton exposes a stable, useful API without key derivation.
- JSDoc on every public method (brief §9). No commented-out code. Private members by default (prefer-private-members rule).
- Max-arguments-per-method: stub methods already take ≤2 params. Constructor takes one object.
- File-size rule: `crypto.service.ts` will stay within limits (≤200 lines, ~125 non-boilerplate). If validation helpers push length, split a `crypto.service.types.ts` for the local `ResolvedConfig`/validation-result types — **only if** needed; planned inline constants keep the file well under the limit.
- `exactOptionalPropertyTypes` compliance: avoid setting optional fields unconditionally; use conditional spread or separate assignment paths when returning stub `EncryptedValue` where needed (stubs throw, so not actually returned — N/A, but the rule is noted for Phase 2).

### 1.3 Constructor validation strategy (error handling)
- `masterKey`:
  - Throw `Error('Invalid masterKey: expected a non-empty base64 string.')` when falsy/empty.
  - Decode via `Buffer.from(masterKey, 'base64')`. If decoded length ≠ 32 → throw `Error('Invalid masterKey: expected 32 bytes after base64 decode, got <N> bytes.')`.
- `hashSalt`:
  - Throw `Error('Invalid hashSalt: expected a non-empty base64 string.')` when falsy/empty.
  - (Skeleton validates presence only; ≥32-byte length enforcement deferred to Phase 2 where HMAC consumes it — kept minimal per Task 3 scope. Noted in plan as intentional, not an assumption.)
- `currentVersion`: `undefined` allowed (defaults to 1). No throw.
- `defaultKeyName`: optional; `undefined` allowed.
- Errors contain **no sensitive data** (brief §7): messages show length/expected only, never the key/salt bytes.
- Decoded master key buffer **not stored** in skeleton (Phase 2 will store base64 string + decode on demand, or store decoded buffer). Decision: store **base64 strings** (masterKey, hashSalt) on the resolved config to avoid holding decoded key material longer than necessary in skeleton; not a security commitment — Phase 2 revisits. For now, only the **length is validated**, the base64 string is retained for reuse by `deriveKey` later.

## 2. Deliverable 1 — `src/crypto.service.ts`

Whole-file replacement. Exact content:

```ts
/**
 * SecureCrypto implementation (Phase 1 skeleton).
 *
 * Core class providing (logic deferred to Phase 2):
 * - AES-256-GCM authenticated encryption / decryption
 * - HMAC-SHA256 deterministic hashing / verification
 * - Combined encryptAndHash operation for PII fields
 *
 * Phase 1 scope: constructor config validation, derived-key cache storage,
 * and method stubs with full signatures + JSDoc. All crypto methods throw
 * `Error('Not implemented in Phase 1')`. `hasKey` and `getAvailableKeys`
 * are minimally implemented (no crypto).
 *
 * Uses Node.js built-in `crypto` module only. No external runtime dependencies.
 */

import type { EncryptedValue } from '@cobranza-apps/entities';

import { CryptoConfig, EncryptionKey } from './config.js';

const DEFAULT_VERSION = 1;
const MASTER_KEY_LENGTH_BYTES = 32;
const PHASE_1_NOT_IMPLEMENTED = 'Not implemented in Phase 1';

/** Result of resolving a {@link CryptoConfig} into validated internal state. */
interface ResolvedConfig {
  /** Base64-encoded 32-byte master key (length-validated). */
  readonly masterKey: string;
  /** Base64-encoded hashing salt (presence-validated). */
  readonly hashSalt: string;
  /** Effective key version (config value or {@link DEFAULT_VERSION}). */
  readonly currentVersion: number;
  /** Default key category (may be undefined). */
  readonly defaultKeyName: EncryptionKey | undefined;
}

/**
 * Validate the master key: non-empty base64 that decodes to exactly 32 bytes.
 *
 * @param masterKey - Raw base64 master key from {@link CryptoConfig}.
 * @throws {Error} when empty or when decoded length is not 32 bytes.
 */
function validateMasterKey(masterKey: string): void {
  if (!masterKey) {
    throw new Error('Invalid masterKey: expected a non-empty base64 string.');
  }
  const decoded = Buffer.from(masterKey, 'base64');
  if (decoded.length !== MASTER_KEY_LENGTH_BYTES) {
    throw new Error(
      `Invalid masterKey: expected ${MASTER_KEY_LENGTH_BYTES} bytes after base64 decode, ` +
        `got ${decoded.length} bytes.`,
    );
  }
}

/**
 * Validate the hash salt: non-empty base64 string. Length enforcement is deferred
 * to Phase 2 (when HMAC consumes it).
 *
 * @param hashSalt - Raw base64 hash salt from {@link CryptoConfig}.
 * @throws {Error} when empty.
 */
function validateHashSalt(hashSalt: string): void {
  if (!hashSalt) {
    throw new Error('Invalid hashSalt: expected a non-empty base64 string.');
  }
}

/**
 * Core encryption + hashing service for the Cobranza App platform.
 *
 * Constructed once per service with a {@link CryptoConfig} (typically populated by a
 * NestJS `ConfigService`). All public methods are documented per brief §4.1.
 *
 * @example
 * const crypto = new SecureCrypto({
 *   masterKey: process.env.MASTER_KEY!,
 *   hashSalt: process.env.HASH_SALT!,
 *   currentVersion: 1,
 *   defaultKeyName: EncryptionKey.PII,
 * });
 */
export class SecureCrypto {
  /** Validated runtime configuration (length/presence-checked at construction). */
  private readonly resolvedConfig: ResolvedConfig;

  /** In-memory cache of derived per-category keys, keyed by `${keyName}:v${version}`. */
  private readonly derivedKeysCache: Map<string, Buffer>;

  /**
   * @param config - Caller-provided configuration. Reads from `process.env` are the
   *   caller's responsibility (brief §7).
   * @throws {Error} when `config` is null/undefined.
   * @throws {Error} when `masterKey` is empty or does not decode to exactly 32 bytes.
   * @throws {Error} when `hashSalt` is empty.
   */
  constructor(config: CryptoConfig) {
    this.resolvedConfig = resolveConfig(config);
    this.derivedKeysCache = new Map<string, Buffer>();
  }

  /**
   * Encrypt a plaintext string under a per-category derived key (brief §3.1).
   *
   * Output is an {@link EncryptedValue} whose `encryptedData` is base64
   * `IV(12) + ciphertext + authTag(16)` for AES-256-GCM.
   *
   * @param plaintext - Plaintext to encrypt.
   * @param keyName - Logical key category (enum) or arbitrary key name string.
   * @returns Encrypted payload carrying `encryptedData`, `keyName`, `algorithm`, `version`.
   * @throws {Error} Phase 1: always throws `'Not implemented in Phase 1'`.
   */
  encrypt(plaintext: string, keyName: EncryptionKey | string): EncryptedValue {
    throw new Error(PHASE_1_NOT_IMPLEMENTED);
  }

  /**
   * Decrypt an {@link EncryptedValue} back to its plaintext string (brief §3.1).
   *
   * Honors the `version` field so historical values can be decrypted during key rotation.
   *
   * @param encryptedValue - Payload previously produced by {@link encrypt}.
   * @returns Decrypted plaintext.
   * @throws {Error} Phase 1: always throws `'Not implemented in Phase 1'`.
   */
  decrypt(encryptedValue: EncryptedValue): string {
    throw new Error(PHASE_1_NOT_IMPLEMENTED);
  }

  /**
   * Compute a deterministic HMAC-SHA256 hash for indexed PII lookups (brief §3.2).
   *
   * @param plaintext - Plaintext to hash.
   * @returns Deterministic hash (encoding/format defined in Phase 2).
   * @throws {Error} Phase 1: always throws `'Not implemented in Phase 1'`.
   */
  hash(plaintext: string): string {
    throw new Error(PHASE_1_NOT_IMPLEMENTED);
  }

  /**
   * Verify a plaintext against an expected deterministic hash using
   * constant-time comparison (`crypto.timingSafeEqual`, brief §3.2).
   *
   * @param plaintext - Plaintext to re-hash and compare.
   * @param expectedHash - Previously computed hash.
   * @returns `true` when the recomputed hash matches `expectedHash`.
   * @throws {Error} Phase 1: always throws `'Not implemented in Phase 1'`.
   */
  verifyHash(plaintext: string, expectedHash: string): boolean {
    throw new Error(PHASE_1_NOT_IMPLEMENTED);
  }

  /**
   * Combined encrypt + hash operation, recommended for PII fields persisted as
   * both `EncryptedValue` and `*Hash` columns (brief §4.1).
   *
   * @param plaintext - Plaintext to encrypt and hash atomically.
   * @param keyName - Logical key category (enum) or arbitrary key name string.
   * @returns Object containing the encrypted payload and the deterministic hash.
   * @throws {Error} Phase 1: always throws `'Not implemented in Phase 1'`.
   */
  encryptAndHash(
    plaintext: string,
    keyName: EncryptionKey | string,
  ): { encrypted: EncryptedValue; hash: string } {
    throw new Error(PHASE_1_NOT_IMPLEMENTED);
  }

  /**
   * Report whether a key name is recognized by this library.
   *
   * Phase 1 implementation checks membership in the {@link EncryptionKey} enum
   * (no crypto derivation). Phase 2 may extend this to include arbitrary
   * configured key names.
   *
   * @param keyName - Key name to test (case-sensitive enum string value).
   * @returns `true` when `keyName` matches a known {@link EncryptionKey} value.
   */
  hasKey(keyName: string): boolean {
    return this.getAvailableKeys().includes(keyName);
  }

  /**
   * List all recognized key names (the string values of {@link EncryptionKey}).
   *
   * @returns New array of available key names.
   */
  getAvailableKeys(): string[] {
    return Object.values(EncryptionKey);
  }
}
```

### 2.1 Implementation notes for the file
- `ResolvedConfig.defaultKeyName` is `EncryptionKey | undefined` to satisfy `exactOptionalPropertyTypes`.
- The `decrypt` param name is `encryptedValue` (matches brief §4.1 exactly), not `data`.

## 3. Deliverable 2 — `src/index.ts`

Barrel exports for the `.` entrypoint only. The `./testing` subpath is Task 4 scope and is **not** re-exported from the main barrel (it has its own entrypoint in `package.json`). Testing utilities will be exported from `src/testing/index.ts` in Task 4.

Exact content:

```ts
/**
 * Public entrypoint for `@cobranza-apps/crypto` (`.` export).
 *
 * Barrel re-exports of the public API:
 * - {@link SecureCrypto} — core encryption/hashing service.
 * - {@link EncryptionKey} — logical key category enum.
 * - {@link CryptoConfig} — constructor configuration interface.
 *
 * The dedicated testing subpath is available as `@cobranza-apps/crypto/testing`
 * (see `src/testing/index.ts`, populated in Task 4).
 *
 * @packageDocumentation
 */

export { EncryptionKey } from './config.js';
export type { CryptoConfig } from './config.js';
export { SecureCrypto } from './crypto.service.js';
```

### 3.1 Notes
- `EncryptedValue` is **not** re-exported here; consumers import it directly from `@cobranza-apps/entities` (single source of truth, brief §2.2). Re-exporting would create an ambiguous second import path.
- `type`-only import re-exports make intent explicit for `CryptoConfig` (interface).

## 4. Git / Build / Verification Steps

1. Confirm feature branch is current (Task 3 inherits the active Phase 1 branch from previous tasks; do not branch per small task).
2. Implement `src/crypto.service.ts` and `src/index.ts` (verbatim per §2/§3).
3. Ensure no `node_modules`/`dist`/gitignored artifacts get staged (gitignore-compliance rule). Run `git status` and verify.
4. Typecheck/build:
   - `npm run build` (maps to `tsc`). Expected pass **only if** `@cobranza-apps/entities` resolves a type for `EncryptedValue`.
   - If `@cobranza-apps/entities` is not resolvable, build will fail on `import type { EncryptedValue } from '@cobranza-apps/entities'`. This is a **Task 1 dependency-install gap**, not a Task 3 code defect. Resolution options (caller decision):
     - (A) Run `npm install` to materialize the workspace dependency (build then passes).
     - (B) Temporarily comment the import with a `// TODO(phase2): re-enable` is **not allowed** (no-commented-code rule). Instead, define a local type alias in a Task 1 fix — **out of scope here**.
   - Recommended action for this step: run `npm install` if needed, then `npm run build`.
5. Lint: `npm run lint` (eslint). Must pass.
6. Tests: `npm test` — no new tests required in Task 3 (Task 4 creates the test file); existing tests (if any) must still pass. `--passWithNoTests` guards the empty case.
7. Code review verification (self): confirm signatures match brief §4.1 byte-for-byte.
8. Stage exactly `src/crypto.service.ts` and `src/index.ts`. Commit:
   ```
   feat(crypto): add SecureCrypto skeleton with constructor validation and API stubs

   - Implement SecureCrypto class constructor (masterKey length + hashSalt presence validation)
   - Add private derivedKeysCache Map (keyed by `${keyName}:v${version}`; populated in Phase 2)
   - Stub encrypt/decrypt/hash/verifyHash/encryptAndHash per brief §4.1 (throw 'Not implemented in Phase 1')
   - Minimally implement hasKey/getAvailableKeys via EncryptionKey enum membership
   - Add barrel exports for SecureCrypto, EncryptionKey, CryptoConfig in src/index.ts

   Refs: .agent/todos/20260707/20260707-todo-1.md Task 3
   ```
9. Verification against plan (step 4.5-equivalent, self pre-check): diff staged files against this plan; any deviation → fix before commit.

## 5. Out of Scope (explicitly NOT done in this step)
- Task 4 (`testing/index.ts`, `test-vectors.ts`, test file) — untouched.
- Task 5 (README/.gitignore/eslint) — untouched.
- Any real crypto logic (HKDF calls, AES, HMAC) — Phase 2.
- Installing `@cobranza-apps/entities` if missing — flagged as Task 1 resolution need; not assumed/done autonomously here.

## 6. Open Items / Flags
- **Flag (not a blocker):** `@cobranza-apps/entities` is not present under `node_modules` in the current tree. `crypto.service.ts` skeleton depends on `import type { EncryptedValue }` from that package. Build success (DoD) requires resolving it. Recommended: `npm install` before `npm run build`. Caller to confirm whether to run `npm install` as part of Task 3 execution or leave to Task 1 remediation.
- **Decision pending:** hashSalt length enforcement (≥32 bytes) intentionally deferred to Phase 2; Task 3 validates presence only. Acceptable per brief §3.2 wording (≥32 is a runtime HMAC concern).
