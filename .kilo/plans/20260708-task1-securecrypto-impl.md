# Plan: Task 1 — Complete SecureCrypto Implementation (Critical Workflow 4.1)

- **Source TODO**: `.agent/todos/20260707/20260707-todo-2.md` → Task 1
- **Date**: 2026-07-08
- **Global plan**: `.kilo/plans/20260708-phase2-crypto-implementation.md`
- **Target branch**: `feat/phase2-crypto-implementation` (Step 2)
- **Version**: `0.2.0` (Step 3 already applied in `package.json`)
- **Role**: Architect — planning only. No code files are written by this step.

---

## 1. Task Reference (exact TODO excerpt)

> In `src/crypto.service.ts`:
> - Finish the constructor: validate `masterKey` (must be 32 bytes after decoding), `hashSalt`, and initialize internal key derivation cache.
> - Implement `deriveKey()` private method using the HKDF utility (cache results by `keyName + version`).
> - Implement `encrypt()`: AES-256-GCM, random 12-byte IV, return proper `EncryptedValue` (`encryptedData`, `keyName`, `algorithm`, `version`).
> - Implement `decrypt()`: parse Base64 `encryptedData` (extract IV, ciphertext, authTag); use correct key version; throw clear error if key is missing.
> - Implement `hash()` and `verifyHash()` using HMAC-SHA256 + `hashSalt`.
> - Implement `encryptAndHash()` (combine both operations efficiently).
> - Implement helper methods (`hasKey`, `getAvailableKeys`).
>
> Important: Never store the raw master key in memory longer than necessary. Use Buffers and clean up when possible.

---

## 2. Current State Analysis

| File | Lines | State |
|---|---|---|
| `src/crypto.service.ts` | 177 | Phase 1 skeleton. Constructor already calls `resolveConfig(config)` and inits `derivedKeysCache = new Map()`. `encrypt`/`decrypt`/`hash`/`verifyHash`/`encryptAndHash` throw `'Not implemented in Phase 1'`. `hasKey`/`getAvailableKeys` already functional. **Has stale `@ts-expect-error` directives** on `resolvedConfig` and `derivedKeysCache` fields. |
| `src/hkdf.ts` | 87 | Fully implemented `deriveKey(params: DeriveKeyParams): Buffer` via `crypto.hkdfSync`. `info = cobranza-encryption-v1:${keyName}:v${version}`. Accepts base64 **string** masterKey. No change required. |
| `src/hkdf.types.ts` | 16 | `DeriveKeyParams { masterKey: string; keyName: string; version?: number }`. No change required. |
| `src/utils.ts` | 76 | `generateIv`, `concatBuffers`, `base64ToBuffer`, `bufferToBase64`, `constantTimeCompare`. Reusable as-is. |
| `src/config.ts` | 61 | `CryptoConfig`, `EncryptionKey` enum. No change required. |
| `src/crypto.service.validation.ts` | 110 | `ResolvedConfig`, `resolveConfig`. `validateMasterKey` enforces 32 bytes. `validateHashSalt` only checks non-empty (comment says length "deferred to Phase 2"). |
| `src/index.ts` | 43 | Barrel exports `SecureCrypto`, `EncryptionKey`, `CryptoConfig`. No change required (new modules are internal). |
| `tests/crypto.service.spec.ts` | 67 | Phase 1 tests: constructor validation, `hasKey`, `getAvailableKeys`. Must stay green. |

### Already done (no rework needed)
- Constructor masterKey 32-byte validation → handled by `resolveConfig` → `validateMasterKey`.
- Key derivation cache Map initialization → already in constructor.
- HKDF derivation utility → `hkdf.ts` complete.
- Helper utilities → `utils.ts` complete.

### Latent build defect to fix
- The `@ts-expect-error` comments above `resolvedConfig` and `derivedKeysCache` are **stale**: the fields ARE assigned in the constructor, so there is no error to suppress. TypeScript reports `Unused '@ts-expect-error' directive` (a compile error). Phase 1 never ran `tsc` (`node_modules` absent), so this is latent. **Removing these directives is mandatory for a clean build.**

### Dependency state
- `node_modules/` is **absent**. `@cobranza-apps/entities@0.5.1` resolves from the npm registry (`package-lock.json` line 529). `npm install` is required before `tsc`/`jest` can run.
- `EncryptedValue` is imported `import type` (erased at runtime) but `tsc` must resolve its declaration. Assumed shape (from brief §2.2): `{ encryptedData: string; keyName: string; algorithm?: string; version?: number }`. **Build gate will validate the actual 0.5.1 shape.**

---

## 3. Ambiguities & Resolved Decisions

1. **Master key memory handling vs. TODO "clean up when possible"**
   - Decision: **Align with global plan decision #3.** Keep `masterKey` as the base64 string inside `resolvedConfig`; pass it to `hkdf.deriveKey` which re-decodes transiently **only on cache miss**. Derived keys are cached as `Buffer`s (no re-derivation). No `Buffer.fill(0)` / `destroy()` is added (Node.js GC; base64 strings are immutable and cannot be zeroed).
   - Rationale: The TODO's "when possible" caveat is satisfied by (a) caching derived keys, (b) never logging plaintext/keys, (c) transient master-key decoding on cache miss only. Explicit zeroing is unreliable in V8 and the approved global plan explicitly chose against it.
   - **Optional enhancement (NOT in implementation steps, flagged for reviewer):** add a `destroy()` method that zeroes cached derived-key `Buffer`s. Deferred unless requested.

2. **hashSalt validation strength**
   - Decision: Strengthen `validateHashSalt` to enforce decoded length **>= 32 bytes** (brief §3.2: "dedicated `hashSalt` (≥32 bytes, base64)"). Currently only checks non-empty.

3. **hashSalt decoding frequency**
   - Decision: Decode `hashSalt` to a `Buffer` **once** in the constructor (`hashSaltBytes`) and reuse across HMAC calls. HMAC requires a `Buffer` key (passing the base64 string would use the wrong key bytes). Decoding once avoids repeated base64 decoding on the hash hot path.

4. **File size management (max 200 lines / `src/`)**
   - Decision: Extract AES-256-GCM primitives to `src/crypto.service.encryption.ts` and HMAC-SHA256 primitives to `src/crypto.service.hashing.ts`, following the existing `crypto.service.validation.ts` extraction precedent. `crypto.service.ts` becomes a thin orchestrator (~166 lines).

5. **Arbitrary key names**
   - Decision: `encrypt`/`decrypt` accept any non-empty `keyName` string (brief §4.1: "enum or arbitrary key name string"). `hasKey`/`getAvailableKeys` reflect **enum membership only** (unchanged Phase 1 semantics); they do not gate derivability. `deriveKeyForCategory` throws on empty `keyName` only.

6. **Algorithm field on decrypt**
   - Decision: **Not validated** in Task 1 (TODO does not require it; keeps scope tight). `decrypt` always uses AES-256-GCM. Algorithm validation is a future enhancement for the post-quantum swap path.

7. **Version fallback on decrypt**
   - Decision: `encryptedValue.version ?? resolvedConfig.currentVersion`. Historical payloads carry an explicit `version`; if absent, fall back to current.

8. **`defaultKeyName` usage**
   - Decision: **Not stored/used.** The public API requires `keyName` explicitly on `encrypt`/`encryptAndHash`. Storing an unused private field would be dead code. If a future overload `encrypt(plaintext)` is added, `defaultKeyName` can be introduced then.

9. **`EncryptedValue` construction location**
   - Decision: `encryptWithAesGcm` returns the **complete** `EncryptedValue` (including `algorithm` and `version`), so the orchestrator does not need the algorithm constant.

---

## 4. High-Level Approach

Orchestrator (`crypto.service.ts`) + two extracted primitive modules + one validation strengthening. No changes to `hkdf.ts`, `hkdf.types.ts`, `utils.ts`, `config.ts`, `index.ts`.

**Encrypt path:**
`plaintext + keyName` → `deriveKeyForCategory(keyName, currentVersion)` (cache lookup, else `hkdf.deriveKey`) → `encryptWithAesGcm({ plaintext, key, keyName, version })` → `EncryptedValue { encryptedData: base64(IV12+ciphertext+authTag16), keyName, algorithm: 'aes-256-gcm', version }`.

**Decrypt path:**
`EncryptedValue` → `assertValidEncryptedValue` → `version = version ?? currentVersion` → `deriveKeyForCategory(keyName, version)` → `decryptWithAesGcm({ encryptedData, key })` → base64 decode → split `IV(12)/ciphertext/authTag(16)` → AES-256-GCM decipher → plaintext (auth failure → generic non-sensitive error).

**Hash path:**
`plaintext` → `computeHmacSha256({ plaintext, salt: hashSaltBytes })` → base64 HMAC-SHA256.

**Verify path:**
recompute hash → `constantTimeCompare(recomputed, expectedHash)`.

**encryptAndHash path:**
`{ encrypted: this.encrypt(plaintext, keyName), hash: this.hash(plaintext) }`.

---

## 5. Detailed Implementation Steps (atomic, verifiable)

### Step 0 — Preconditions (implementer, 4.2)
- Confirm on branch `feat/phase2-crypto-implementation` (Step 2 of Critical Workflow).
- `npm install` (fetch dev deps + `@cobranza-apps/entities@0.5.1`). Required because `node_modules/` is absent.
- Read `.gitignore` and run `git status` before any commit (gitignore-compliance rule).

### Step 1 — Strengthen hashSalt validation
- File: `src/crypto.service.validation.ts`
- Add constant `MIN_HASH_SALT_LENGTH_BYTES = 32`.
- Replace `validateHashSalt` body to also decode and enforce `>= 32` bytes.
- Update its JSDoc and `resolveConfig` `@throws` line to mention the 32-byte salt requirement.
- Update the `ResolvedConfig.hashSalt` field JSDoc to state ">= 32 bytes decoded".
- Remove the "deferred to Phase 2" comment.

### Step 2 — Create AES-256-GCM primitives module
- File: `src/crypto.service.encryption.ts` (new)
- Add module JSDoc, constants (`ALGORITHM`, `IV_LENGTH_BYTES`, `AUTH_TAG_LENGTH_BYTES`, `MIN_PAYLOAD_BYTES`), types (`EncryptParams`, `DecryptParams`, internal `EncryptedPayloadParts`), and functions `encryptWithAesGcm`, `splitEncryptedPayload` (internal), `decryptWithAesGcm`.
- Use `createCipheriv`/`createDecipheriv` from `node:crypto`; reuse `generateIv`, `concatBuffers`, `base64ToBuffer`, `bufferToBase64` from `./utils.js`.

### Step 3 — Create HMAC-SHA256 primitives module
- File: `src/crypto.service.hashing.ts` (new)
- Add module JSDoc, constant `HMAC_ALGORITHM`, types (`HashParams`, `VerifyHashParams`), functions `computeHmacSha256`, `verifyHmacSha256`.
- Use `createHmac` from `node:crypto`; reuse `constantTimeCompare` from `./utils.js`.

### Step 4 — Rewrite the orchestrator
- File: `src/crypto.service.ts`
- Remove `PHASE_1_NOT_IMPLEMENTED` constant.
- Remove both stale `@ts-expect-error` directives.
- Add import of `encryptWithAesGcm`/`decryptWithAesGcm` and `computeHmacSha256`/`verifyHmacSha256`.
- Add `EMPTY_KEY_NAME_ERROR` constant.
- Add private `hashSaltBytes: Buffer` field; decode it once in the constructor.
- Add private `deriveKeyForCategory(keyName, version)` with `${keyName}:v${version}` cache.
- Add private `assertValidEncryptedValue(encryptedValue)`.
- Implement `encrypt`, `decrypt`, `hash`, `verifyHash`, `encryptAndHash` (replace stubs; rename `_plaintext`/`_keyName` params to `plaintext`/`keyName`).
- Keep `hasKey`/`getAvailableKeys` as-is.

### Step 5 — Barrel / structure
- `src/index.ts`: **no change** (new modules are internal; `SecureCrypto` already exported).
- `.agent/project-structure.md`: **no change** (no new folders; the doc is folder-level and `src/` is already listed).

### Step 6 — Build
- `npm run build` (→ `tsc`). Expect 0 errors.
- This gate validates the `@cobranza-apps/entities@0.5.1` `EncryptedValue` shape compatibility.

### Step 7 — Test
- `npm test` (→ `jest`). The existing Phase 1 suite (`tests/crypto.service.spec.ts`) must stay green.
- Confirm no existing test uses a `< 32`-byte hashSalt (none do; `TEST_HASH_SALT_BYTES = 64`).

### Step 8 — Lint (optional, debt avoidance)
- `npm run lint`. Resolve any new errors/warnings introduced by this task. (Formal lint is Task 5, but a quick check avoids debt.)

### Step 9 — Commit (implementer, 4.2)
- Stage only the intended files (no `node_modules/`, no `dist/`).
- Single cohesive commit:
  `feat(crypto): implement SecureCrypto AES-256-GCM and HMAC-SHA256 operations`

---

## 6. Exact Code per File

### 6.1 `src/crypto.service.validation.ts` (modified)

Add the constant near `DEFAULT_VERSION`:

```ts
/** Minimum decoded length of the base64 hash salt (HMAC-SHA256 security, brief §3.2). */
const MIN_HASH_SALT_LENGTH_BYTES = 32;
```

Replace `validateHashSalt`:

```ts
/**
 * Validate the hash salt: non-empty base64 that decodes to at least 32 bytes
 * (brief §3.2 requires a dedicated salt >= 32 bytes for HMAC-SHA256).
 *
 * @param hashSalt - Raw base64 hash salt from {@link CryptoConfig}.
 * @throws {Error} when empty or when decoded length is less than 32 bytes.
 */
function validateHashSalt(hashSalt: string): void {
  if (!hashSalt) {
    throw new Error('Invalid hashSalt: expected a non-empty base64 string.');
  }
  const decodedLength = Buffer.from(hashSalt, 'base64').length;
  if (decodedLength < MIN_HASH_SALT_LENGTH_BYTES) {
    throw new Error(
      `Invalid hashSalt: expected at least ${MIN_HASH_SALT_LENGTH_BYTES} bytes after base64 decode, ` +
        `got ${decodedLength} bytes.`,
    );
  }
}
```

Update the `resolveConfig` JSDoc `@throws` block to add:
`@throws {Error} when `hashSalt` is empty or decodes to fewer than 32 bytes.`

Update the `ResolvedConfig.hashSalt` field JSDoc to:
`/** Base64-encoded hashing salt (presence + >= 32 bytes validated). */`

### 6.2 `src/crypto.service.encryption.ts` (new)

```ts
/**
 * AES-256-GCM encryption / decryption primitives for {@link module:crypto.service}.
 *
 * Encapsulates the cipher operations and the `IV(12) + ciphertext + authTag(16)`
 * payload packing/unpacking (brief §3.1) so the orchestrator stays under the
 * 200-line source file limit.
 *
 * @remarks Uses Node.js built-in `crypto` only. All errors fail closed with
 * non-sensitive messages.
 * @module crypto.service.encryption
 */

import { createCipheriv, createDecipheriv } from 'node:crypto';
import type { EncryptedValue } from '@cobranza-apps/entities';

import { base64ToBuffer, bufferToBase64, concatBuffers, generateIv } from './utils.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const MIN_PAYLOAD_BYTES = IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES;

/** Inputs required to encrypt a plaintext under a derived AES-256 key. */
export interface EncryptParams {
  readonly plaintext: string;
  readonly key: Buffer;
  readonly keyName: string;
  readonly version: number;
}

/** Inputs required to decrypt a base64 payload with a derived AES-256 key. */
export interface DecryptParams {
  readonly encryptedData: string;
  readonly key: Buffer;
}

/** Sliced components of an `IV + ciphertext + authTag` payload buffer. */
interface EncryptedPayloadParts {
  readonly initializationVector: Buffer;
  readonly ciphertext: Buffer;
  readonly authTag: Buffer;
}

/**
 * Encrypt `plaintext` with AES-256-GCM under the provided derived key.
 *
 * @param params - Plaintext, 32-byte key, key name, and version to embed.
 * @returns {@link EncryptedValue} whose `encryptedData` is base64
 *   `IV(12) + ciphertext + authTag(16)`.
 */
export function encryptWithAesGcm(params: EncryptParams): EncryptedValue {
  const { plaintext, key, keyName, version } = params;
  const initializationVector = generateIv(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, initializationVector);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const encryptedData = bufferToBase64(
    concatBuffers(initializationVector, ciphertext, authTag),
  );
  return { encryptedData, keyName, algorithm: ALGORITHM, version };
}

/**
 * Split a decoded payload buffer into its IV, ciphertext, and authTag slices.
 *
 * @param payload - Decoded `IV(12) + ciphertext + authTag(16)` buffer.
 * @returns The three payload components (buffer views, zero-copy).
 * @throws {Error} when the payload is shorter than `IV + authTag` (28 bytes).
 */
function splitEncryptedPayload(payload: Buffer): EncryptedPayloadParts {
  if (payload.length < MIN_PAYLOAD_BYTES) {
    throw new Error(
      `Invalid encryptedData: expected at least ${MIN_PAYLOAD_BYTES} bytes, ` +
        `got ${payload.length}.`,
    );
  }
  const initializationVector = payload.subarray(0, IV_LENGTH_BYTES);
  const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH_BYTES);
  const ciphertext = payload.subarray(IV_LENGTH_BYTES, payload.length - AUTH_TAG_LENGTH_BYTES);
  return { initializationVector, ciphertext, authTag };
}

/**
 * Decrypt a base64 `IV(12) + ciphertext + authTag(16)` payload with AES-256-GCM.
 *
 * @param params - Base64 `encryptedData` and the 32-byte derived key.
 * @returns Recovered plaintext (UTF-8).
 * @throws {Error} when the authentication tag is invalid or data is corrupted.
 */
export function decryptWithAesGcm(params: DecryptParams): string {
  const { encryptedData, key } = params;
  const payload = base64ToBuffer(encryptedData);
  const { initializationVector, ciphertext, authTag } = splitEncryptedPayload(payload);
  const decipher = createDecipheriv(ALGORITHM, key, initializationVector);
  decipher.setAuthTag(authTag);
  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  } catch {
    throw new Error('Decryption failed: invalid authentication tag or corrupted ciphertext.');
  }
}
```

### 6.3 `src/crypto.service.hashing.ts` (new)

```ts
/**
 * HMAC-SHA256 deterministic hashing primitives for {@link module:crypto.service}.
 *
 * Encapsulates the keyed-hash operations used for indexed PII lookups (brief §3.2)
 * so the orchestrator stays under the 200-line source file limit. Verification
 * uses constant-time comparison via {@link module:utils.constantTimeCompare}.
 *
 * @remarks Uses Node.js built-in `crypto` only.
 * @module crypto.service.hashing
 */

import { createHmac } from 'node:crypto';

import { constantTimeCompare } from './utils.js';

const HMAC_ALGORITHM = 'sha256';

/** Inputs required to compute a deterministic HMAC-SHA256 hash. */
export interface HashParams {
  readonly plaintext: string;
  readonly salt: Buffer;
}

/** Inputs required to verify a plaintext against an expected HMAC-SHA256 hash. */
export interface VerifyHashParams {
  readonly plaintext: string;
  readonly salt: Buffer;
  readonly expectedHash: string;
}

/**
 * Compute a deterministic base64 HMAC-SHA256 hash of `plaintext` keyed by `salt`.
 *
 * @param params - Plaintext and the decoded hash salt (>= 32 bytes).
 * @returns Base64-encoded HMAC-SHA256 digest.
 */
export function computeHmacSha256(params: HashParams): string {
  const { plaintext, salt } = params;
  const hmac = createHmac(HMAC_ALGORITHM, salt);
  hmac.update(plaintext, 'utf8');
  return hmac.digest('base64');
}

/**
 * Verify `plaintext` against an expected hash using constant-time comparison.
 *
 * @param params - Plaintext, decoded hash salt, and the expected base64 hash.
 * @returns `true` when the recomputed hash matches `expectedHash`.
 */
export function verifyHmacSha256(params: VerifyHashParams): boolean {
  const { plaintext, salt, expectedHash } = params;
  const recomputedHash = computeHmacSha256({ plaintext, salt });
  return constantTimeCompare(recomputedHash, expectedHash);
}
```

### 6.4 `src/crypto.service.ts` (rewrite)

```ts
/**
 * SecureCrypto core service module.
 *
 * Provides the {@link SecureCrypto} class — the single entrypoint for all
 * cryptographic operations in the Cobranza App platform:
 *
 * - **AES-256-GCM** authenticated encryption / decryption (brief §3.1)
 * - **HMAC-SHA256** deterministic hashing / verification (brief §3.2)
 * - **Combined encryptAndHash** for PII fields stored in dual columns (brief §4.1)
 *
 * @remarks
 * Uses Node.js built-in `crypto` module only. No external runtime dependencies.
 * Cipher primitives live in {@link module:crypto.service.encryption}, HMAC
 * primitives in {@link module:crypto.service.hashing}, and config validation in
 * {@link module:crypto.service.validation} — each extracted to keep this file
 * under the 200-line source file limit.
 *
 * @see {@link module:crypto.service.encryption} for AES-256-GCM primitives
 * @see {@link module:crypto.service.hashing} for HMAC-SHA256 primitives
 * @see {@link module:crypto.service.validation} for config resolution helpers
 * @module crypto.service
 */

import type { EncryptedValue } from '@cobranza-apps/entities';

import type { CryptoConfig } from './config.js';
import { EncryptionKey } from './config.js';
import { decryptWithAesGcm, encryptWithAesGcm } from './crypto.service.encryption.js';
import { computeHmacSha256, verifyHmacSha256 } from './crypto.service.hashing.js';
import type { ResolvedConfig } from './crypto.service.validation.js';
import { resolveConfig } from './crypto.service.validation.js';
import { deriveKey } from './hkdf.js';

const EMPTY_KEY_NAME_ERROR = 'Invalid keyName: must be a non-empty string.';

/**
 * Core encryption + hashing service for the Cobranza App platform.
 *
 * Constructed once per service with a {@link CryptoConfig} (typically populated
 * by a NestJS `ConfigService`). All public methods are documented per brief §4.1.
 *
 * @example
 * ```ts
 * import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';
 *
 * const crypto = new SecureCrypto({
 *   masterKey: process.env.MASTER_KEY!,
 *   hashSalt: process.env.HASH_SALT!,
 *   currentVersion: 1,
 *   defaultKeyName: EncryptionKey.PII,
 * });
 *
 * const encrypted = crypto.encrypt('sensitive-data', EncryptionKey.PII);
 * const plaintext = crypto.decrypt(encrypted);
 * const emailHash = crypto.hash('user@example.com');
 * ```
 */
export class SecureCrypto {
  /** Validated runtime configuration (length/presence-checked at construction). */
  private readonly resolvedConfig: ResolvedConfig;

  /** Decoded hash salt (>= 32 bytes) reused across HMAC operations. */
  private readonly hashSaltBytes: Buffer;

  /** In-memory cache of derived per-category keys, keyed by `${keyName}:v${version}`. */
  private readonly derivedKeysCache: Map<string, Buffer>;

  /**
   * @param config - Caller-provided configuration. Reads from `process.env` are
   *   the caller's responsibility (brief §7).
   * @throws {Error} when `config` is null/undefined.
   * @throws {Error} when `masterKey` is empty or does not decode to exactly 32 bytes.
   * @throws {Error} when `hashSalt` is empty or decodes to fewer than 32 bytes.
   */
  constructor(config: CryptoConfig) {
    this.resolvedConfig = resolveConfig(config);
    this.hashSaltBytes = Buffer.from(this.resolvedConfig.hashSalt, 'base64');
    this.derivedKeysCache = new Map<string, Buffer>();
  }

  /**
   * Derive (or return cached) 32-byte AES-256 key for a key category + version.
   *
   * @param keyName - Logical key category or arbitrary key name string.
   * @param version - Key version (drives HKDF `info` for rotation support).
   * @returns 32-byte derived key buffer.
   * @throws {Error} when `keyName` is empty.
   */
  private deriveKeyForCategory(keyName: string, version: number): Buffer {
    if (!keyName) {
      throw new Error(EMPTY_KEY_NAME_ERROR);
    }
    const cacheKey = `${keyName}:v${version}`;
    const cachedKey = this.derivedKeysCache.get(cacheKey);
    if (cachedKey) {
      return cachedKey;
    }
    const derivedKeyBuffer = deriveKey({
      masterKey: this.resolvedConfig.masterKey,
      keyName,
      version,
    });
    this.derivedKeysCache.set(cacheKey, derivedKeyBuffer);
    return derivedKeyBuffer;
  }

  /**
   * Validate that an {@link EncryptedValue} carries the fields required to decrypt.
   *
   * @param encryptedValue - Payload to check.
   * @throws {Error} when `encryptedValue`, `encryptedData`, or `keyName` is missing.
   */
  private assertValidEncryptedValue(encryptedValue: EncryptedValue): void {
    if (!encryptedValue) {
      throw new Error('Invalid encryptedValue: expected an EncryptedValue object.');
    }
    if (!encryptedValue.encryptedData) {
      throw new Error('Invalid encryptedValue: encryptedData is required.');
    }
    if (!encryptedValue.keyName) {
      throw new Error('Invalid encryptedValue: keyName is required.');
    }
  }

  /**
   * Encrypt a plaintext string under a per-category derived key (brief §3.1).
   *
   * @param plaintext - Plaintext to encrypt.
   * @param keyName - Logical key category (enum) or arbitrary key name string.
   * @returns {@link EncryptedValue} carrying base64 `IV(12)+ciphertext+authTag(16)`,
   *   `keyName`, `algorithm`, and the current key `version`.
   */
  encrypt(plaintext: string, keyName: EncryptionKey | string): EncryptedValue {
    const resolvedKeyName: string = keyName;
    const key = this.deriveKeyForCategory(resolvedKeyName, this.resolvedConfig.currentVersion);
    return encryptWithAesGcm({
      plaintext,
      key,
      keyName: resolvedKeyName,
      version: this.resolvedConfig.currentVersion,
    });
  }

  /**
   * Decrypt an {@link EncryptedValue} back to its plaintext string (brief §3.1).
   *
   * Honors the `version` field so historical values can be decrypted during
   * key rotation; falls back to the current version when `version` is absent.
   *
   * @param encryptedValue - Payload previously produced by {@link encrypt}.
   * @returns Decrypted plaintext.
   * @throws {Error} when the payload is malformed, the key is missing, or
   *   authentication fails (non-sensitive message).
   */
  decrypt(encryptedValue: EncryptedValue): string {
    this.assertValidEncryptedValue(encryptedValue);
    const version = encryptedValue.version ?? this.resolvedConfig.currentVersion;
    const key = this.deriveKeyForCategory(encryptedValue.keyName, version);
    return decryptWithAesGcm({ encryptedData: encryptedValue.encryptedData, key });
  }

  /**
   * Compute a deterministic HMAC-SHA256 hash for indexed PII lookups (brief §3.2).
   *
   * @param plaintext - Plaintext to hash.
   * @returns Base64-encoded HMAC-SHA256 digest keyed by the configured `hashSalt`.
   */
  hash(plaintext: string): string {
    return computeHmacSha256({ plaintext, salt: this.hashSaltBytes });
  }

  /**
   * Verify a plaintext against an expected deterministic hash using constant-time
   * comparison (brief §3.2).
   *
   * @param plaintext - Plaintext to re-hash and compare.
   * @param expectedHash - Previously computed base64 hash.
   * @returns `true` when the recomputed hash matches `expectedHash`.
   */
  verifyHash(plaintext: string, expectedHash: string): boolean {
    return verifyHmacSha256({
      plaintext,
      salt: this.hashSaltBytes,
      expectedHash,
    });
  }

  /**
   * Combined encrypt + hash operation, recommended for PII fields persisted as
   * both `EncryptedValue` and `*Hash` columns (brief §4.1).
   *
   * @param plaintext - Plaintext to encrypt and hash.
   * @param keyName - Logical key category (enum) or arbitrary key name string.
   * @returns Object containing the encrypted payload and the deterministic hash.
   */
  encryptAndHash(
    plaintext: string,
    keyName: EncryptionKey | string,
  ): { encrypted: EncryptedValue; hash: string } {
    return { encrypted: this.encrypt(plaintext, keyName), hash: this.hash(plaintext) };
  }

  /**
   * Report whether a key name is recognized by this library.
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

---

## 7. Security Notes (TODO "clean up when possible")

- **Master key**: held as base64 string in `resolvedConfig.masterKey`; decoded to a 32-byte `Buffer` **transiently inside `hkdf.deriveKey`** only on cache miss. With caching, this happens at most once per `(keyName, version)` pair.
- **Derived keys**: cached as `Buffer`s in `derivedKeysCache`; not re-derived on subsequent calls.
- **Hash salt**: decoded once to `hashSaltBytes` in the constructor (HMAC requires a `Buffer` key; the base64 string would be the wrong key material).
- **No logging**: no `console.*` calls; all thrown errors carry non-sensitive messages (e.g., `Decryption failed: invalid authentication tag or corrupted ciphertext.` — no key/plaintext/ciphertext bytes leaked).
- **No `process.env`** reads inside the library (config is caller-supplied).
- **Constant-time** hash verification via `utils.constantTimeCompare` (`crypto.timingSafeEqual` with length-guard).
- **Random IV**: 12-byte `crypto.randomBytes` per encryption (never reused).
- **Explicit zeroing (`Buffer.fill(0)`)**: **not added**, per global plan decision #3 (V8 GC; base64 strings are immutable and cannot be zeroed reliably). The TODO's "when possible" caveat is met by the measures above.
- **Optional future enhancement (flagged, not implemented)**: a `destroy()` method that zeroes cached derived-key `Buffer`s and clears the cache. Deferred unless the reviewer requests stricter cleanup.

---

## 8. Rules Compliance Checklist

| Rule | Status |
|---|---|
| Max lines per file (<=200, `src/`) | crypto.service ~166; encryption ~85; hashing ~50; validation ~120 — all OK |
| Max lines per method body (<=50) | Largest: `deriveKeyForCategory` ~10 — OK |
| Max depth (<=2) | All `if` blocks at level 2 max; no 3rd level — OK |
| Max arguments per method (<=2) | All methods <=2; extracted fns use param objects — OK |
| Single-section boolean conditions | No `&&`/`||` in any `if` condition — OK |
| Prefer private members | Fields + `deriveKeyForCategory` + `assertValidEncryptedValue` private; only API public — OK |
| No commented code | Stubs/`@ts-expect-error`/`PHASE_1_NOT_IMPLEMENTED` removed — OK |
| Self-documenting code | Descriptive names; JSDoc on public + key private methods — OK |
| No magic numbers | `IV_LENGTH_BYTES`, `AUTH_TAG_LENGTH_BYTES`, `MIN_PAYLOAD_BYTES`, `MIN_HASH_SALT_LENGTH_BYTES` named — OK |
| Newline prevention | Real newlines in all written content — OK |
| `exactOptionalPropertyTypes` | `EncryptedValue` always sets `algorithm` + `version` (no `undefined`) — OK |
| `noUncheckedIndexedAccess` | No indexed access used — OK |
| `noUnusedLocals`/`noUnusedParameters` | All imports/params used; underscore stub params renamed — OK |
| `consistent-type-imports` | `import type` for type-only imports — OK |
| Security-first | Fail-closed, non-sensitive errors, constant-time compare, random IV — OK |
| No `process.env` in library | Config passed explicitly — OK |

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `@cobranza-apps/entities@0.5.1` `EncryptedValue` shape differs from brief §2.2 | Step 6 build gate (`tsc`) catches it. If it fails on the interface, the implementer escalates to the user (authoring the entities package is out of Task 1 scope). |
| `node_modules` absent → build/test cannot run | Step 0 `npm install` first. `package-lock.json` is committed; entities resolves from registry. |
| Strengthened hashSalt validation breaks an existing test | Verified: `TEST_CRYPTO_CONFIG` uses 64-byte salt (passes); the empty-salt test hits the non-empty branch first (passes). No existing test uses a 1–31 byte salt. |
| `crypto.service.ts` still exceeds 200 lines after JSDoc | Estimated ~166 lines. If it exceeds, further extract `assertValidEncryptedValue` + `deriveKeyForCategory` into `src/crypto.service.guards.ts` (contingency, not primary plan). |
| Stale `@ts-expect-error` directives cause build failure | Removed in Step 4 (mandatory). |
| Reviewer wants explicit key cleanup (`destroy()`) | Listed as optional enhancement (§7); can be added in 4.3 review cycle without rework. |

---

## 10. Verification Checklist

- [ ] `npm install` succeeds; `node_modules/@cobranza-apps/entities` present.
- [ ] `src/crypto.service.validation.ts` enforces hashSalt >= 32 bytes decoded.
- [ ] `src/crypto.service.encryption.ts` created; `encryptWithAesGcm` returns full `EncryptedValue`; `decryptWithAesGcm` splits IV/ciphertext/authTag and rethrows generic error on auth failure.
- [ ] `src/crypto.service.hashing.ts` created; `computeHmacSha256` returns base64; `verifyHmacSha256` uses `constantTimeCompare`.
- [ ] `src/crypto.service.ts`: no `PHASE_1_NOT_IMPLEMENTED`; no stale `@ts-expect-error`; `deriveKeyForCategory` caches by `${keyName}:v${version}`; all public methods implemented; `hasKey`/`getAvailableKeys` unchanged.
- [ ] No changes to `hkdf.ts`, `hkdf.types.ts`, `utils.ts`, `config.ts`, `index.ts`.
- [ ] `npm run build` → 0 errors.
- [ ] `npm test` → Phase 1 suite green (all existing tests pass).
- [ ] `npm run lint` → no new errors/warnings (optional but recommended).
- [ ] Commit on `feat/phase2-crypto-implementation` with the specified message; no `node_modules/` or `dist/` staged.

---

## 11. Out of Scope (handled by other tasks)

- Task 2: comprehensive test expansion (`tests/crypto.service.spec.ts`), coverage >= 85%.
- Task 3: testing utilities polish, real `TEST_VECTORS` values, testing docs.
- Task 4: README update, `docs/nestjs-configuration.md`.
- Task 5: formal `tsc` + `eslint` clean-up pass.
- 4.3 Code review/simplification; 4.4 Documentation (JSDoc polish); 4.5 Verification; 4.6 Task completion (`[DONE]` mark, TODO rename, merge to `main`).
- Algorithm validation on decrypt (future, post-quantum swap path).
- `destroy()` explicit key-zeroing (optional enhancement, deferred).

---

## 12. Git / Commit

- Branch: `feat/phase2-crypto-implementation` (do not push; Step 5 of Critical Workflow handles merge + push to `origin` only).
- Files to stage: `src/crypto.service.validation.ts`, `src/crypto.service.encryption.ts`, `src/crypto.service.hashing.ts`, `src/crypto.service.ts`.
- Commit message: `feat(crypto): implement SecureCrypto AES-256-GCM and HMAC-SHA256 operations`
- Before commit: read `.gitignore`, run `git status`, ensure no `node_modules/`/`dist/`/`.env*` staged (gitignore-compliance rule).

---

## 13. Plan vs. Original Task Cross-Check

| TODO requirement | Covered by |
|---|---|
| Constructor: validate masterKey (32 bytes), hashSalt, init cache | §6.4 constructor (masterKey via `resolveConfig`; hashSalt now >= 32 bytes via §6.1; cache Map already inited) |
| `deriveKey()` private, HKDF, cache by `keyName + version` | §6.4 `deriveKeyForCategory` (cache key `${keyName}:v${version}`, calls `hkdf.deriveKey`) |
| `encrypt()`: AES-256-GCM, 12-byte IV, proper `EncryptedValue` | §6.2 `encryptWithAesGcm` + §6.4 `encrypt` |
| `decrypt()`: parse base64 (IV, ciphertext, authTag), correct version, clear error if key missing | §6.2 `splitEncryptedPayload` + `decryptWithAesGcm` + §6.4 `decrypt`/`assertValidEncryptedValue` |
| `hash()` / `verifyHash()` HMAC-SHA256 + hashSalt | §6.3 `computeHmacSha256`/`verifyHmacSha256` + §6.4 `hash`/`verifyHash` |
| `encryptAndHash()` | §6.4 `encryptAndHash` |
| `hasKey`, `getAvailableKeys` | §6.4 (unchanged) |
| Never store raw master key longer than necessary; Buffers; clean up when possible | §7 (transient decode, caching, no logging; explicit zeroing deferred per global plan) |

All TODO requirements are covered. Plan is complete.
