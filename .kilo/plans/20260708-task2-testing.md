# Plan — Task 2: Testing (Comprehensive) — Phase 2

- **TODO:** `.agent/todos/20260707/20260707-todo-2.md` → Task 2 (lines 33–45)
- **Brief ref:** `.agent/project-info/brief.md` §3 (crypto strategy), §4.1 (Public API), §6 (Testing Support), §7 (Security)
- **Architecture ref:** `.agent/project-info/architecture.md` §Cryptographic Architecture, §Critical Paths, §Security Boundaries
- **Plan path:** `.kilo/plans/20260708-task2-testing.md`
- **Scope:** Expand the unit-test suite so `npm test` passes AND coverage ≥ 85% across `src/`. Use the deterministic test vectors; add roundtrip / hash / version / error-case / `encryptAndHash` tests; expose internal-module branches for coverage.
- **DoD touched (Task 2):** "Use test vectors", "all tests pass `npm test`", "minimum 85% test coverage".

---

## 1. Pre-Analysis & Key Decisions

### 1.1 Current state (verified)

- `tests/crypto.service.spec.ts` (67 lines) — Phase 1 only: `describe('SecureCrypto — Phase 1 skeleton')`. Contains:
  - constructor/config validation (5): valid config, `getTestCrypto()` instance, short masterKey (16 bytes → `/expected 32 bytes/`), empty masterKey (`/non-empty base64 string/`), empty hashSalt (`/non-empty base64 string/`).
  - `hasKey` (6): `it.each(Object.values(EncryptionKey))` returns true + unknown-key false.
  - `getAvailableKeys` (1): returns every enum value.
  - Total: **12 passing** (per task prompt; consistent with file body).
- `src/testing/test-vectors.ts` (84 lines) — `TestVector` interface + `TEST_VECTORS` (6 entries, one per `EncryptionKey` + 1 unicode edge case) but `expectedEncrypted` and `expectedHash` are both `PHASE2_PLACEHOLDER` ('PLACEHOLDER_PHASE2'). The `PHASE2_PLACEHOLDER` const is module-private.
- `src/testing/index.ts` (92 lines) — exports `getTestCrypto`, `SecureCryptoTestModule`, `SecureCryptoProviderConfig`, `TEST_CRYPTO_CONFIG`, `TEST_MASTER_KEY` (`Buffer.alloc(32).toString('base64')`), `TEST_HASH_SALT` (`Buffer.alloc(64).toString('base64')`), and re-exports `TEST_VECTORS` + `TestVector`.
- `src/crypto.service.ts` (199 lines) — fully implemented (`encrypt/decrypt/hash/verifyHash/encryptAndHash/hasKey/getAvailableKeys/destroy`). Uses `resolveConfig`, `deriveKeyForCategory`, `encryptWithAesGcm/decryptWithAesGcm`, `computeHmacSha256/verifyHmacSha256`, `assertValidEncryptedValue`.
- `src/crypto.service.validation.ts` — `resolveConfig` branches: `!config` → `'Invalid config: expected a CryptoConfig object.'`; `!masterKey` → `'Invalid masterKey: expected a non-empty base64 string.'`; decoded len != 32 → `'Invalid masterKey: expected 32 bytes after base64 decode, got N bytes.'`; `!hashSalt` → `'Invalid hashSalt: expected a non-empty base64 string.'`; decoded len < 32 → `'Invalid hashSalt: expected at least 32 bytes after base64 decode, got N bytes.'`; defaults `currentVersion` to 1.
- `src/crypto.service.guards.ts` — `assertValidEncryptedValue`: `!encryptedValue` → `'Invalid encryptedValue: expected an EncryptedValue object.'`; `assertPresent(encryptedData,'encryptedData')` → `'Invalid encryptedValue: encryptedData is required.'`; same for `keyName`.
- `src/crypto.service.keys.ts` — `deriveKeyForCategory`: `!keyName` → `'Invalid keyName: must be a non-empty string.'`; cache key `${keyName}:v${version}`; returns cached buffer on hit, else `deriveKey(...)` and stores.
- `src/crypto.service.encryption.ts` — `encryptWithAesGcm` (AES-256-GCM, 12-byte IV, 16-byte authTag, base64 `IV+ct+tag`); `splitEncryptedPayload` throws `'Invalid encryptedData: expected at least 28 bytes, got N bytes.'` when `payload.length < 28`; `decryptWithAesGcm` try/catch → catch throws `'Decryption failed: invalid authentication tag or corrupted ciphertext.'`.
- `src/crypto.service.hashing.ts` — `computeHmacSha256` (HMAC-SHA256, base64); `verifyHmacSha256` → `constantTimeCompare(recomputed, expected)`.
- `src/utils.ts` — `base64ToBuffer` (`!value` → `'Invalid base64 input: expected a non-empty string.'`), `bufferToBase64`, `generateIv(byteLength=12)`, `concatBuffers`, `constantTimeCompare` (diff length → false; else `timingSafeEqual`).
- `src/hkdf.ts` — `deriveKey` (`!keyName` → `'Invalid keyName: must be a non-empty string.'`; `decodeMasterKey` len != 32 throw); `buildHkdfInfo` (prefix `cobranza-encryption-v1:${keyName}:v${version}` or no `:vN` when version undefined).
- `src/hkdf.types.ts` — type-only (no executable lines).
- `src/config.ts` — enum + interface (enum has runtime init; interfaces have no executable lines).
- `package.json` jest config: `preset: ts-jest`, `testEnvironment: node`, `roots: ["<rootDir>/src","<rootDir>/tests"]`, `testMatch: ["**/tests/**/*.spec.ts"]`, `moduleNameMapper: {"^(\\.{1,2}/.*)\\.js$":"$1"}`. Scripts: `test: "jest --passWithNoTests"`. **No `--coverage`, no `collectCoverageFrom`, no `coverageThreshold`.** → currently `npm test` cannot fail on coverage.
- `tsconfig.json` (per prior plan D1): NodeNext, strict, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `exclude: ["tests","**/*.spec.ts"]` (so specs are NOT compiled by `tsc`, only by ts-jest).

### 1.2 Coverage baseline (estimated, pre-change)

Without crypto-operation tests, the bulk of `crypto.service.encryption.ts` / `hashing.ts` / `keys.ts` / `hkdf.ts` / `utils.ts` / `guards.ts` / `validation.ts` branches (decrypt auth-failure catch, payload-too-short throw, cache-hit branch, empty-keyName throw, constantTimeCompare length-mismatch, base64ToBuffer empty throw) are UNexecuted → well below 85%. Expanding only the public-api roundtrip tests leaves several internal branches uncovered (e.g. `base64ToBuffer` empty throw is unreachable through the public `decrypt` path because `assertValidEncryptedValue` rejects empty `encryptedData` first). → Decision D3 introduces internal-module specs to reach the threshold cleanly.

### 1.3 Key decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Populate REAL `expectedHash` literals for the existing 6 vectors** in `src/testing/test-vectors.ts` so hashing tests can assert exactness. Keep `expectedEncrypted = PHASE2_PLACEHOLDER` (AES-256-GCM uses a random 12-byte IV → ciphertext is non-deterministic; structural + roundtrip assertions are used instead). | Deterministic hashing (HMAC-SHA256) is reproducible → a real literal is a valid vector. The full ≥10-vectors / edge-case / comments / `/docs` expansion is **Task 3**'s scope; this is the minimum enabling edit for Task 2. |
| D2 | **Compute the 6 `expectedHash` literals via a one-off Node script** (HMAC-SHA256 keyed by `Buffer.alloc(64)` over each vector's plaintext, base64). Implementer pastes the printed literals. | Guarantees values match the implementation exactly; avoids hand-encoding errors; deterministic + reproducible. |
| D3 | **Add internal-module specs** (`tests/crypto.internals.spec.ts`) that import `resolveConfig`, `assertValidEncryptedValue`, `deriveKeyForCategory`, `deriveKey`, and `utils` helpers directly. | Several branches (`base64ToBuffer('')`, `constantTimeCompare` length-mismatch, `deriveKeyForCategory` cache-hit, `deriveKey` empty keyName / wrong-length masterKey, `splitEncryptedPayload` too-short) are unreachable or awkward through the public API. Testing pure helpers directly is standard for a library and is the cleanest way to exceed 85% branch coverage without contorting API tests. |
| D4 | **Split the suite into multiple focused `.spec.ts` files** rather than one giant file (TODO line 35 says "or equivalent"). Files: (a) `crypto.service.spec.ts` (expanded), (b) `crypto.encrypt-decrypt.spec.ts`, (c) `crypto.hashing.spec.ts`, (d) `crypto.encrypt-and-hash.spec.ts`, (e) `crypto.internals.spec.ts`. Each ≤ ~170 lines for readability. jest `testMatch: "**/tests/**/*.spec.ts"` picks up all of them. | Keeps each spec focused, readable, under the spirit of the 200-line guideline, and honors the readability rules. Multi-file is explicitly allowed by "or equivalent". |
| D5 | **Version-handling tests**: build crypto instances with `currentVersion: 1` and `currentVersion: 2` from `TEST_CRYPTO_CONFIG` overrides; assert (i) v1-encrypted payload carries `version: 1` and is decryptable by a v2 instance (uses payload `version`, NOT `currentVersion`), (ii) v2-encrypted payload carries `version: 2`, (iii) decrypt falls back to `currentVersion` when `encryptedValue.version` is undefined. Covers the `encryptedValue.version ?? currentVersion` branch both ways. | `encrypt` always stamps `resolvedConfig.currentVersion`; cross-version decrypt validates the `??` fallback without needing key-rotation storage. |
| D6 | **"Missing key" error case = empty `keyName` string** (`encrypt('x','')` and `decrypt({...encrypted, keyName:''})`) throwing `/Invalid keyName/`. | The implementation derives a key for ANY non-empty `keyName` (it does NOT consult the `EncryptionKey` enum); there is no "key-not-found" branch. The only key-absence error is an empty `keyName`. This matches the real control flow. |
| D7 | **Wrong-auth-tag / corrupted-data tests**: tamper one byte of the decoded payload (bit-flip in the authTag slice or ciphertext slice) → decrypt throws `/Decryption failed/`. **Short-payload test**: `encryptedData = Buffer.alloc(10).toString('base64')` → decrypt throws `/expected at least 28 bytes/`. | Hits `splitEncryptedPayload` too-short throw AND `decryptWithAesGcm` catch. Distinct error messages let assertions be precise. |
| D8 | **Encrypted-structure assertions** (because ciphertext is non-deterministic): for every encrypt, assert `keyName` echoed as the enum string, `algorithm === 'aes-256-gcm'`, `version === currentVersion`, and that `Buffer.from(encryptedData,'base64').length >= 28` (12 IV + 16 authTag min). | Replaces an exact-ciphertext vector (impossible with random IV) with reproducible structural + roundtrip guarantees. |
| D9 | **Hashing tests use `TEST_VECTORS`** via `it.each(TEST_VECTORS)`: `crypto.hash(vector.plaintext) === vector.expectedHash` (exact literal), `crypto.verifyHash(vector.plaintext, vector.expectedHash) === true`, `crypto.verifyHash(vector.plaintext, 'wrong') === false`, and `verifyHash` short-circuits on differing-length expected. Plus determinism: `hash(x) === hash(x)` and `hash('a') !== hash('b')`. | Exercises `computeHmacSha256` + `verifyHmacSha256` + `constantTimeCompare` both branches, and validates the vector literals. |
| D10 | **`encryptAndHash` tests**: for `it.each(TEST_VECTORS)`, assert `result.encrypted` is a valid `EncryptedValue`, `result.hash === crypto.hash(plaintext) === vector.expectedHash`, `crypto.decrypt(result.encrypted) === plaintext`, and `crypto.verifyHash(plaintext, result.hash) === true`. Plus a `destroy()` test on a fresh instance. | Covers `encryptAndHash` (delegator) plus the otherwise-uncovered `destroy()` method. `destroy()` is asserted via the no-throw + subsequent-encrypt-still-works contract (cache rebuild path) — testing private `derivedKeysCache` would require `@ts-ignore`. |
| D11 | **Coverage config in `package.json`**: set `test` script to `jest --coverage --passWithNoTests` (so `npm test` enforces the 85% threshold), add `"coverage"` collectors:
```
"collectCoverageFrom": ["src/**/*.ts", "!src/testing/**", "!src/index.ts", "!src/**/*.types.ts"],
"coverageThreshold": { "global": { "statements": 85, "branches": 85, "functions": 85, "lines": 85 } }
```
| The TODO requires both "`npm test` passes" AND "≥85% coverage"; wiring `--coverage` + `coverageThreshold` into `npm test` satisfies both in one command. Excluding `src/testing/**` (fixtures), `src/index.ts` (re-export barrel), `*.types.ts` (type-only, 0 executable) prevents coverage skew without weakening the real-code threshold. |
| D12 | **Imports use `.js` extensions** (NodeNext; `moduleNameMapper` already maps `^(\.{1,2}/.*)\.js$` → `$1`). | ts-jest already resolves via the mapper; Phase 1 proved this works. |
| D13 | **`exactOptionalPropertyTypes` discipline**: override `currentVersion` via spread `{ ...TEST_CRYPTO_CONFIG, currentVersion: N }` (the property already exists as a literal, not `?`); for "missing hashSalt" keep the Phase-1 `hashSalt: ''` (not omit) pattern. | Avoids TS errors caused by `exactOptionalPropertyTypes`. |
| D14 | **No production-code changes** in this task. Only `tests/*`, `src/testing/test-vectors.ts` (populate `expectedHash`), and `package.json` (jest config). | Task 2 is test-only; `SecureCrypto` is already complete (Task 1). |
| D15 | **Do NOT finalize the testing module / ≥10 vectors / `/docs`** — those are Task 3 (`20260707-todo-2.md` lines 47–66). | Scope boundary with the adjacent TODO task. |
| D16 | **Git: commit on the existing Phase 2 feature branch** (created in Critical Workflow step 2). No new branch. | Critical Workflow step 2 owns branch creation. |
| D17 | **Keep `tests/.gitkeep`** (preserve existing files per code-guidelines §5). | Harmless; preservation rule. |
| D18 | **`noUnusedLocals` / `noUnusedParameters` apply via ts-jest** — every import in each spec must be used; `it.each` callback params must be used. | Avoids ts-jest compile failures. |

---

## 2. High-Level Approach

1. Preconditions check (feature branch, gitignore compliance, deps installed).
2. Populate real `expectedHash` literals in `src/testing/test-vectors.ts` (via a one-off Node bootstrap script).
3. Expand `tests/crypto.service.spec.ts`: keep the existing constructor/hasKey/getAvailableKeys tests (rename the outer `describe` from "Phase 1 skeleton" → "SecureCrypto — service surface"), add `encryptAndHash` + `destroy` describe blocks.
4. Create `tests/crypto.encrypt-decrypt.spec.ts`: roundtrip per vector + per enum key, encrypted-value structure, version handling (v1↔v2 + undefined-version fallback), error cases (corrupted, wrong-auth-tag, short payload, empty keyName, missing/invalid `EncryptedValue` fields).
5. Create `tests/crypto.hashing.spec.ts`: determinism + `verifyHash` true/false + `TEST_VECTORS` exact `expectedHash` assertions + differing-length short-circuit.
6. Create `tests/crypto.internals.spec.ts`: direct unit tests for `resolveConfig`, `assertValidEncryptedValue`, `deriveKeyForCategory`, `deriveKey` (HKDF), and `utils` helpers.
7. Update `package.json`: `test` script gains `--coverage`; add `collectCoverageFrom` + `coverageThreshold`.
8. Build (`npm run build`) and run `npm test`; verify all tests pass and coverage ≥85% per category. Iterate only if a genuinely uncovered branch remains (no weakening of assertions).
9. Lint (`npm run lint`).
10. Gitignore-compliance + commit on the feature branch.

---

## 3. Detailed Steps

### Step 0 — Preconditions (implementer, before any edit)
- [ ] Confirm the current git branch is the Phase 2 feature branch from Critical Workflow step 2 (e.g. `feat/crypto-phase2`). **Do not create a new branch.** If on `main`, STOP and escalate to the Plan Agent.
- [ ] Read `.gitignore` and run `git status`. Ensure no `node_modules/`, `dist/`, `.env*`, `.kilo/agent-manager.json`, `coverage/` are staged. Unstage if present (gitignore-compliance rule).
- [ ] Ensure `node_modules/` exists and `@cobranza-apps/entities` is resolvable; run `npm install` if missing.
- [ ] Confirm the current 12 Phase-1 tests still pass: `npx jest --passWithNoTests` (no coverage) → 12 passed (baseline). **Note:** once Step 7 changes the `test` script to `--coverage`, coverage will be below threshold until all new specs are in place — that is expected mid-task, not a regression.

### Step 1 — Populate `expectedHash` literals in `src/testing/test-vectors.ts`

**Path:** `src/testing/test-vectors.ts`
**Rule checks:** src file ≤200 lines (still ~84 lines OK); `PHASE2_PLACEHOLDER` stays used (still referenced by every `expectedEncrypted`); no new public surface.

**Sub-step 1a — Compute the 6 HMAC-SHA256 literals.** Run the one-off Node bootstrap (prints 6 `expectedHash` base64 strings in file order):

```bash
node -e "
const { createHmac } = require('node:crypto');
const salt = Buffer.alloc(64); // == TEST_HASH_SALT decoded
const pts = [
  'john.doe@example.com',
  '12-34567890-1',
  'PAYMENT-REF-2026-000001',
  'Your invoice #12345 is ready',
  'generic-sensitive-value',
  'José María — Cañón ünïcode😀',
];
for (const p of pts) {
  const h = createHmac('sha256', salt).update(p, 'utf8').digest('base64');
  console.log(JSON.stringify(p) + ' => ' + h);
}
"
```

- [ ] Capture the 6 printed base64 digests (one per plaintext, in the file's vector order).

**Sub-step 1b — Replace the 6 `expectedHash: PHASE2_PLACEHOLDER,` lines** with the corresponding real literals. Only the `expectedHash` field changes; `expectedEncrypted` stays `PHASE2_PLACEHOLDER`. Leave the file header comment and `PHASE2_PLACEHOLDER` const intact.

Example (with `<LITERAL_N>` replaced by the captured base64):

```ts
  {
    plaintext: 'john.doe@example.com',
    keyName: EncryptionKey.PII,
    version: 1,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: '<LITERAL_1>',
  },
  // ... (5 more, in order)
```

- [ ] Verify all 6 vectors have a real base64 `expectedHash` (44-char HMAC-SHA256) and `expectedEncrypted` still `PHASE2_PLACEHOLDER`.
- [ ] Update the file's top JSDoc: change "Phase 1 the `expectedEncrypted` and `expectedHash` fields are placeholders" → "the `expectedHash` fields are real HMAC-SHA256 literals; `expectedEncrypted` remains a placeholder because AES-256-GCM uses a random IV (Task 3 will revisit)."

### Step 2 — Expand `tests/crypto.service.spec.ts`

**Path:** `tests/crypto.service.spec.ts` (existing — MODIFY)
**Rule checks:** `tests/` outside `src/` (200-line rule N/A); still keep ≤~170 lines; imports used (D18).

**Changes:**
- Rename outer `describe('SecureCrypto — Phase 1 skeleton', ...)` → `describe('SecureCrypto — service surface', ...)`.
- Update the file header JSDoc: replace "Phase 1 skeleton ... Phase 2 will extend this suite" with "Covers constructor/config validation, key enumeration, `encryptAndHash`, and `destroy`. Encryption/decryption/hashing/internals live in focused sibling spec files."
- Keep the existing 3 describe blocks (constructor/config validation, `hasKey`, `getAvailableKeys`) verbatim.
- Add `TEST_VECTORS` to the existing import line:
  ```ts
  import { getTestCrypto, TEST_CRYPTO_CONFIG, TEST_VECTORS } from '../src/testing/index.js';
  ```
- Append two new describe blocks inside the outer describe:

```ts
  describe('encryptAndHash', () => {
    it.each(TEST_VECTORS)(
      'combines encrypt + hash for plaintext %j',
      (vector) => {
        const cryptoInstance = new SecureCrypto({
          ...TEST_CRYPTO_CONFIG,
          currentVersion: vector.version,
        });

        const result = cryptoInstance.encryptAndHash(vector.plaintext, vector.keyName);

        expect(cryptoInstance.decrypt(result.encrypted)).toBe(vector.plaintext);
        expect(result.hash).toBe(cryptoInstance.hash(vector.plaintext));
        expect(result.hash).toBe(vector.expectedHash);
        expect(cryptoInstance.verifyHash(vector.plaintext, result.hash)).toBe(true);
        expect(result.encrypted.keyName).toBe(vector.keyName);
        expect(result.encrypted.version).toBe(vector.version);
      },
    );
  });

  describe('destroy', () => {
    it('clears the derived-key cache without throwing and a fresh encrypt still works', () => {
      const cryptoInstance = getTestCrypto();
      cryptoInstance.encrypt('warm-up', EncryptionKey.PII);
      expect(() => cryptoInstance.destroy()).not.toThrow();
      const encrypted = cryptoInstance.encrypt('after-destroy', EncryptionKey.PII);
      expect(cryptoInstance.decrypt(encrypted)).toBe('after-destroy');
    });
  });
```

- [ ] Test count in this file: 12 (existing) + 6 (`encryptAndHash`) + 1 (`destroy`) = **19**.

### Step 3 — Create `tests/crypto.encrypt-decrypt.spec.ts` (new)

**Path:** `tests/crypto.encrypt-decrypt.spec.ts`

```ts
/**
 * SecureCrypto AES-256-GCM encrypt/decrypt: roundtrip, key-category coverage,
 * version handling, and error cases (corrupted data, wrong auth tag, missing key,
 * malformed payload). Ciphertext is non-deterministic (random 12-byte IV), so
 * vectors are asserted structurally + via roundtrip (no exact-ciphertext literal).
 */

import { SecureCrypto, EncryptionKey } from '../src/index.js';
import { TEST_CRYPTO_CONFIG, TEST_VECTORS } from '../src/testing/index.js';
import type { EncryptedValue } from '@cobranza-apps/entities';

const MIN_PAYLOAD_BYTES = 28; // 12 IV + 16 authTag (zero ciphertext)

function buildCryptoWithVersion(version: number): SecureCrypto {
  return new SecureCrypto({ ...TEST_CRYPTO_CONFIG, currentVersion: version });
}

function decodePayloadLength(encrypted: EncryptedValue): number {
  return Buffer.from(encrypted.encryptedData, 'base64').length;
}

describe('SecureCrypto — encrypt / decrypt', () => {
  describe('roundtrip', () => {
    it.each(TEST_VECTORS)(
      'roundtrips plaintext %j under key %s v%d',
      (vector) => {
        const cryptoInstance = buildCryptoWithVersion(vector.version);

        const encrypted = cryptoInstance.encrypt(vector.plaintext, vector.keyName);

        expect(cryptoInstance.decrypt(encrypted)).toBe(vector.plaintext);
      },
    );

    it.each(Object.values(EncryptionKey))(
      'roundtrips under every EncryptionKey enum value %s',
      (keyName) => {
        const cryptoInstance = buildCryptoWithVersion(1);

        const encrypted = cryptoInstance.encrypt('payload', keyName);

        expect(cryptoInstance.decrypt(encrypted)).toBe('payload');
        expect(encrypted.keyName).toBe(keyName);
      },
    );

    it('roundtrips empty plaintext', () => {
      const cryptoInstance = buildCryptoWithVersion(1);

      const encrypted = cryptoInstance.encrypt('', EncryptionKey.PII);

      expect(cryptoInstance.decrypt(encrypted)).toBe('');
      expect(decodePayloadLength(encrypted)).toBe(MIN_PAYLOAD_BYTES);
    });
  });

  describe('encrypted value structure', () => {
    it.each(TEST_VECTORS)(
      'produces a well-formed EncryptedValue for %j',
      (vector) => {
        const cryptoInstance = buildCryptoWithVersion(vector.version);

        const encrypted = cryptoInstance.encrypt(vector.plaintext, vector.keyName);

        expect(encrypted.algorithm).toBe('aes-256-gcm');
        expect(encrypted.keyName).toBe(vector.keyName);
        expect(encrypted.version).toBe(vector.version);
        expect(decodePayloadLength(encrypted)).toBeGreaterThanOrEqual(MIN_PAYLOAD_BYTES);
      },
    );
  });

  describe('version handling', () => {
    it('stamps the current config version onto the EncryptedValue', () => {
      const encrypted = buildCryptoWithVersion(2).encrypt('v2-payload', EncryptionKey.BANK_DATA);

      expect(encrypted.version).toBe(2);
    });

    it('decrypts a v1 payload using a v2-configured instance (uses payload version)', () => {
      const v1Crypto = buildCryptoWithVersion(1);
      const v2Crypto = buildCryptoWithVersion(2);
      const plaintext = 'historical-value';
      const encrypted = v1Crypto.encrypt(plaintext, EncryptionKey.PII);

      expect(encrypted.version).toBe(1);
      expect(v2Crypto.decrypt(encrypted)).toBe(plaintext);
    });

    it('falls back to currentVersion when EncryptedValue.version is undefined', () => {
      const v2Crypto = buildCryptoWithVersion(2);
      const encrypted = v2Crypto.encrypt('no-version', EncryptionKey.PII);
      const withoutVersion: EncryptedValue = {
        encryptedData: encrypted.encryptedData,
        keyName: encrypted.keyName,
        algorithm: encrypted.algorithm,
      };

      expect(encrypted.version).toBe(2);
      expect(v2Crypto.decrypt(withoutVersion)).toBe('no-version');
    });
  });

  describe('error cases', () => {
    it('throws when keyName is empty on encrypt (missing key)', () => {
      expect(() => buildCryptoWithVersion(1).encrypt('x', '')).toThrow(/Invalid keyName/);
    });

    it('throws when keyName is empty on decrypt (missing key)', () => {
      const cryptoInstance = buildCryptoWithVersion(1);
      const encrypted = cryptoInstance.encrypt('x', EncryptionKey.PII);

      expect(() => cryptoInstance.decrypt({ ...encrypted, keyName: '' })).toThrow(/Invalid keyName/);
    });

    it('throws on a malformed (truncated) payload', () => {
      const malformed = Buffer.alloc(10).toString('base64');

      expect(() =>
        buildCryptoWithVersion(1).decrypt({
          encryptedData: malformed,
          keyName: EncryptionKey.PII,
          version: 1,
        }),
      ).toThrow(/expected at least 28 bytes/);
    });

    it('throws on a corrupted auth tag', () => {
      const cryptoInstance = buildCryptoWithVersion(1);
      const encrypted = cryptoInstance.encrypt('tamper-me', EncryptionKey.PII);

      expect(() => cryptoInstance.decrypt(flipAuthTagByte(encrypted))).toThrow(/Decryption failed/);
    });

    it('throws on corrupted ciphertext', () => {
      const cryptoInstance = buildCryptoWithVersion(1);
      const encrypted = cryptoInstance.encrypt('flip-me', EncryptionKey.PII);

      expect(() => cryptoInstance.decrypt(flipCiphertextByte(encrypted))).toThrow(/Decryption failed/);
    });

    it('throws when encryptedValue is null', () => {
      expect(() =>
        buildCryptoWithVersion(1).decrypt(null as unknown as EncryptedValue),
      ).toThrow(/expected an EncryptedValue object/);
    });

    it('throws when encryptedData is missing', () => {
      const cryptoInstance = buildCryptoWithVersion(1);
      const encrypted = cryptoInstance.encrypt('x', EncryptionKey.PII);
      const withoutData: EncryptedValue = {
        keyName: encrypted.keyName,
        algorithm: encrypted.algorithm,
        version: encrypted.version,
      };

      expect(() => cryptoInstance.decrypt(withoutData)).toThrow(/encryptedData is required/);
    });

    it('throws when keyName is missing on the EncryptedValue', () => {
      const cryptoInstance = buildCryptoWithVersion(1);
      const encrypted = cryptoInstance.encrypt('x', EncryptionKey.PII);
      const withoutKeyName: EncryptedValue = {
        encryptedData: encrypted.encryptedData,
        algorithm: encrypted.algorithm,
        version: encrypted.version,
      };

      expect(() => cryptoInstance.decrypt(withoutKeyName)).toThrow(/keyName is required/);
    });
  });
});

function flipAuthTagByte(encrypted: EncryptedValue): EncryptedValue {
  const payload = Buffer.from(encrypted.encryptedData, 'base64');
  const lastByteIndex = payload.length - 1;
  payload[lastByteIndex] = (payload[lastByteIndex] ?? 0) ^ 0x01;
  return { ...encrypted, encryptedData: payload.toString('base64') };
}

function flipCiphertextByte(encrypted: EncryptedValue): EncryptedValue {
  const payload = Buffer.from(encrypted.encryptedData, 'base64');
  const ciphertextByteIndex = 12;
  payload[ciphertextByteIndex] = (payload[ciphertextByteIndex] ?? 0) ^ 0x01;
  return { ...encrypted, encryptedData: payload.toString('base64') };
}
```

- [ ] Verify imports all used: `SecureCrypto`, `EncryptionKey`, `TEST_CRYPTO_CONFIG`, `TEST_VECTORS`, `EncryptedValue`.
- [ ] Test count: roundtrip 6+5+1=12; structure 6; version 3; errors 8 → **34**.
  - (Note: counting corrected here — `it.each(TEST_VECTORS)` roundtrip = 6, `it.each(Object.values(EncryptionKey))` = 5, empty plaintext = 1, structure `it.each(TEST_VECTORS)` = 6, version = 3, errors = 8 → **29**. Use the precise per-file tally in §5.)
- [ ] `noUncheckedIndexedAccess`: use `(payload[i] ?? 0)` to satisfy the optional-index rule (no raw `!`).

### Step 4 — Create `tests/crypto.hashing.spec.ts` (new)

**Path:** `tests/crypto.hashing.spec.ts`

```ts
/**
 * SecureCrypto HMAC-SHA256 hashing: determinism, verification (true/false),
 * exact assertions against TEST_VECTORS expectedHash literals, and the
 * constant-time-comparison length short-circuit.
 */

import { getTestCrypto, TEST_VECTORS } from '../src/testing/index.js';

describe('SecureCrypto — hashing', () => {
  describe('hash', () => {
    it.each(TEST_VECTORS)(
      'produces the deterministic expectedHash for %j',
      (vector) => {
        expect(getTestCrypto().hash(vector.plaintext)).toBe(vector.expectedHash);
      },
    );

    it('is deterministic: the same plaintext yields the same hash twice', () => {
      const cryptoInstance = getTestCrypto();

      expect(cryptoInstance.hash('repeatable')).toBe(cryptoInstance.hash('repeatable'));
    });

    it('differs across distinct plaintexts', () => {
      const cryptoInstance = getTestCrypto();

      expect(cryptoInstance.hash('alpha')).not.toBe(cryptoInstance.hash('beta'));
    });
  });

  describe('verifyHash', () => {
    it.each(TEST_VECTORS)(
      'returns true for the matching expectedHash of %j',
      (vector) => {
        expect(getTestCrypto().verifyHash(vector.plaintext, vector.expectedHash)).toBe(true);
      },
    );

    it('returns false for a wrong expected hash', () => {
      expect(getTestCrypto().verifyHash('john.doe@example.com', 'wrong-hash')).toBe(false);
    });

    it('returns false for an expected hash of a different length (short-circuit)', () => {
      const cryptoInstance = getTestCrypto();
      const correct = cryptoInstance.hash('length-mismatch');
      const tooShort = correct.slice(0, 4);

      expect(cryptoInstance.verifyHash('length-mismatch', tooShort)).toBe(false);
    });
  });
});
```

- [ ] Imports: `getTestCrypto`, `TEST_VECTORS` — both used (single merged import line).
- [ ] Test count: hash 6+2=8; verifyHash 6+1+1=8 → **16**.

### Step 5 — Create `tests/crypto.internals.spec.ts` (new)

**Path:** `tests/crypto.internals.spec.ts`

```ts
/**
 * Direct unit tests for SecureCrypto internal modules to reach branch coverage
 * that is awkward or impossible through the public API alone (config guards,
 * decryption guards, key-derivation cache, HKDF derivation, low-level utils).
 */

import { resolveConfig } from '../src/crypto.service.validation.js';
import { assertValidEncryptedValue } from '../src/crypto.service.guards.js';
import { deriveKeyForCategory } from '../src/crypto.service.keys.js';
import { deriveKey } from '../src/hkdf.js';
import {
  base64ToBuffer,
  bufferToBase64,
  concatBuffers,
  constantTimeCompare,
  generateIv,
} from '../src/utils.js';
import { TEST_CRYPTO_CONFIG, TEST_MASTER_KEY } from '../src/testing/index.js';
import type { EncryptedValue } from '@cobranza-apps/entities';

describe('resolveConfig', () => {
  it('throws when config is null', () => {
    expect(() => resolveConfig(null as never)).toThrow(/expected a CryptoConfig object/);
  });

  it('throws when masterKey is empty', () => {
    expect(() => resolveConfig({ ...TEST_CRYPTO_CONFIG, masterKey: '' })).toThrow(/non-empty base64 string/);
  });

  it('throws when masterKey decodes to the wrong length', () => {
    const shortKey = Buffer.alloc(16).toString('base64');
    expect(() => resolveConfig({ ...TEST_CRYPTO_CONFIG, masterKey: shortKey })).toThrow(/expected 32 bytes/);
  });

  it('throws when hashSalt is empty', () => {
    expect(() => resolveConfig({ ...TEST_CRYPTO_CONFIG, hashSalt: '' })).toThrow(/non-empty base64 string/);
  });

  it('throws when hashSalt decodes to fewer than 32 bytes', () => {
    const shortSalt = Buffer.alloc(16).toString('base64');
    expect(() => resolveConfig({ ...TEST_CRYPTO_CONFIG, hashSalt: shortSalt })).toThrow(/at least 32 bytes/);
  });

  it('defaults currentVersion to 1 when omitted', () => {
    const trimmed = { masterKey: TEST_CRYPTO_CONFIG.masterKey, hashSalt: TEST_CRYPTO_CONFIG.hashSalt };

    expect(resolveConfig(trimmed).currentVersion).toBe(1);
  });
});

describe('assertValidEncryptedValue', () => {
  it('throws when the value is null', () => {
    expect(() => assertValidEncryptedValue(null as unknown as EncryptedValue)).toThrow(/expected an EncryptedValue object/);
  });

  it('throws when encryptedData is missing', () => {
    const value = { keyName: 'pii' } as EncryptedValue;
    expect(() => assertValidEncryptedValue(value)).toThrow(/encryptedData is required/);
  });

  it('throws when keyName is missing', () => {
    const value = { encryptedData: 'AAA' } as EncryptedValue;
    expect(() => assertValidEncryptedValue(value)).toThrow(/keyName is required/);
  });

  it('accepts a fully-populated EncryptedValue', () => {
    const value: EncryptedValue = { encryptedData: 'AAA', keyName: 'pii', algorithm: 'aes-256-gcm', version: 1 };
    expect(() => assertValidEncryptedValue(value)).not.toThrow();
  });
});

describe('deriveKeyForCategory', () => {
  it('throws on an empty keyName', () => {
    const resolved = resolveConfig(TEST_CRYPTO_CONFIG);

    expect(() =>
      deriveKeyForCategory({
        keyName: '',
        version: 1,
        resolvedConfig: resolved,
        derivedKeysCache: new Map(),
      }),
    ).toThrow(/Invalid keyName/);
  });

  it('returns the same Buffer reference on a cache hit', () => {
    const resolved = resolveConfig(TEST_CRYPTO_CONFIG);
    const cache = new Map<string, Buffer>();

    const first = deriveKeyForCategory({ keyName: 'pii', version: 1, resolvedConfig: resolved, derivedKeysCache: cache });
    const second = deriveKeyForCategory({ keyName: 'pii', version: 1, resolvedConfig: resolved, derivedKeysCache: cache });

    expect(second).toBe(first);
    expect(cache.size).toBe(1);
  });
});

describe('deriveKey (HKDF)', () => {
  it('throws when the masterKey decodes to the wrong length', () => {
    expect(() => deriveKey({ masterKey: Buffer.alloc(16).toString('base64'), keyName: 'pii', version: 1 })).toThrow(/expected 32 bytes/);
  });

  it('throws on an empty keyName', () => {
    expect(() => deriveKey({ masterKey: TEST_MASTER_KEY, keyName: '', version: 1 })).toThrow(/Invalid keyName/);
  });

  it('derives a 32-byte key', () => {
    expect(deriveKey({ masterKey: TEST_MASTER_KEY, keyName: 'pii', version: 1 }).length).toBe(32);
  });

  it('derives a different key when the version suffix differs', () => {
    const v1 = deriveKey({ masterKey: TEST_MASTER_KEY, keyName: 'pii', version: 1 });
    const v2 = deriveKey({ masterKey: TEST_MASTER_KEY, keyName: 'pii', version: 2 });

    expect(v2.equals(v1)).toBe(false);
  });

  it('derives a key without the :vN suffix when version is omitted', () => {
    const withVersion = deriveKey({ masterKey: TEST_MASTER_KEY, keyName: 'pii', version: 1 });
    const noVersion = deriveKey({ masterKey: TEST_MASTER_KEY, keyName: 'pii' });

    expect(noVersion.equals(withVersion)).toBe(false);
    expect(noVersion.length).toBe(32);
  });
});

describe('utils', () => {
  it('base64ToBuffer throws on an empty string', () => {
    expect(() => base64ToBuffer('')).toThrow(/non-empty string/);
  });

  it('bufferToBase64 roundtrips a buffer', () => {
    const buffer = Buffer.from([1, 2, 3, 4]);

    expect(base64ToBuffer(bufferToBase64(buffer)).equals(buffer)).toBe(true);
  });

  it('generateIv produces the requested number of bytes', () => {
    expect(generateIv(12).length).toBe(12);
    expect(generateIv().length).toBe(12);
  });

  it('concatBuffers concatenates inputs in order', () => {
    expect(concatBuffers(Buffer.from([1]), Buffer.from([2, 3])).equals(Buffer.from([1, 2, 3]))).toBe(true);
  });

  it('constantTimeCompare returns true for equal strings', () => {
    expect(constantTimeCompare('abc', 'abc')).toBe(true);
  });

  it('constantTimeCompare returns false for differing lengths', () => {
    expect(constantTimeCompare('abc', 'abcd')).toBe(false);
  });

  it('constantTimeCompare returns false for equal lengths with different content', () => {
    expect(constantTimeCompare('abc', 'abd')).toBe(false);
  });
});
```

- [ ] Imports: `resolveConfig`, `assertValidEncryptedValue`, `deriveKeyForCategory`, `deriveKey`, `base64ToBuffer`, `bufferToBase64`, `concatBuffers`, `constantTimeCompare`, `generateIv`, `TEST_CRYPTO_CONFIG`, `TEST_MASTER_KEY`, `EncryptedValue` — all used.
- [ ] Test count: resolveConfig 6; guards 4; keys 2; hkdf 5; utils 7 → **24**.

### Step 6 — Update `package.json` jest config (coverage)

**Path:** `package.json` (MODIFY `"jest"` block + `"test"` script).

**Change the `test` script** from:
```json
"test": "jest --passWithNoTests",
```
to:
```json
"test": "jest --coverage --passWithNoTests",
```

**Add inside the `"jest"` block** (after `"moduleFileExtensions"`):

```json
    "collectCoverageFrom": [
      "src/**/*.ts",
      "!src/testing/**",
      "!src/index.ts",
      "!src/**/*.types.ts"
    ],
    "coverageThreshold": {
      "global": {
        "statements": 85,
        "branches": 85,
        "functions": 85,
        "lines": 85
      }
    }
```

- [ ] Valid JSON (commas between keys, no trailing comma).
- [ ] A `coverage/` directory will be generated — confirm `.gitignore` ignores `coverage/`; if NOT, add `coverage/` to `.gitignore` (do NOT commit coverage artifacts).

### Step 7 — Build verification
- [ ] Run `npm run build` (`tsc`). `tests/` is excluded from `tsc`; only `src/` compiles. Expect success (no production-code changes).
- [ ] If `tsc` errors → STOP, capture, escalate.

### Step 8 — Test verification (the gate)
- [ ] Run `npm test` (now `--coverage` + threshold).
- [ ] Expected total test count: `crypto.service.spec.ts` 19 + `crypto.encrypt-decrypt.spec.ts` 29 + `crypto.hashing.spec.ts` 16 + `crypto.internals.spec.ts` 24 = **88 tests**.
- [ ] Expected: 88 passed, 0 failed, every measured `src/` file ≥85% in all four categories. If the threshold fails, inspect the coverage report and add a targeted test (D3-style). Do NOT lower the threshold or weaken assertions.
- [ ] If a branch remains stubbornly uncovered after genuine effort, escalate to the Plan Agent with the specific uncovered line.

### Step 9 — Lint
- [ ] Run `npm run lint`. Expect no errors. Fix per eslint guidance (e.g. merge duplicate imports).

### Step 10 — Gitignore compliance + commit (implementer)
- [ ] `git status`. Intended staged set:
  - `src/testing/test-vectors.ts` (modified)
  - `tests/crypto.service.spec.ts` (modified)
  - `tests/crypto.encrypt-decrypt.spec.ts` (new)
  - `tests/crypto.hashing.spec.ts` (new)
  - `tests/crypto.internals.spec.ts` (new)
  - `package.json` (modified)
  - `.gitignore` (only if `coverage/` added)
- [ ] NO `dist/`, `node_modules/`, `.env*`, `coverage/`, `.kilo/agent-manager.json` staged. Unstage if present.
- [ ] Stage only intended files (add `.gitignore` only if modified):
  ```
  git add src/testing/test-vectors.ts tests/crypto.service.spec.ts tests/crypto.encrypt-decrypt.spec.ts tests/crypto.hashing.spec.ts tests/crypto.internals.spec.ts package.json
  ```
- [ ] Commit on the feature branch:
  ```
  git commit -m "test(crypto): expand SecureCrypto suite to comprehensive coverage (Task 2)

  - src/testing/test-vectors.ts: populate real HMAC-SHA256 expectedHash
    literals for the 6 existing vectors (expectedEncrypted stays a
    placeholder; AES-256-GCM random IV makes ciphertext non-deterministic).
  - tests/crypto.service.spec.ts: expand to include encryptAndHash +
    destroy; keep constructor/hasKey/getAvailableKeys.
  - tests/crypto.encrypt-decrypt.spec.ts: roundtrip per test vector + per
    enum key + empty plaintext, encrypted-value structure assertions,
    version handling (v1<->v2, undefined version fallback), error cases
    (corrupted auth tag / ciphertext, truncated payload, empty keyName,
    null + missing-field EncryptedValue).
  - tests/crypto.hashing.spec.ts: deterministic hash, verifyHash true/false,
    exact expectedHash assertions vs TEST_VECTORS, length-mismatch
    short-circuit.
  - tests/crypto.internals.spec.ts: direct tests for resolveConfig,
    assertValidEncryptedValue, deriveKeyForCategory (cache hit),
    deriveKey (HKDF info version suffix), and utils helpers.
  - package.json: jest --coverage + collectCoverageFrom (exclude
    testing/index/types) + coverageThreshold 85% (statements/branches/
    functions/lines). npm test now enforces the 85% gate."
  ```

---

## 4. Coverage Strategy (how 85%+ is reached)

| Source file | Covered by | Key branches exercised |
|---|---|---|
| `src/crypto.service.ts` | `crypto.service.spec.ts` + `crypto.encrypt-decrypt.spec.ts` | all public methods; `destroy()` loop+clear; `encryptAndHash` delegation |
| `src/crypto.service.encryption.ts` | `crypto.encrypt-decrypt.spec.ts` | `encryptWithAesGcm` happy; `splitEncryptedPayload` too-short throw; `decryptWithAesGcm` happy + catch (corrupted) |
| `src/crypto.service.hashing.ts` | `crypto.hashing.spec.ts` | `computeHmacSha256` + `verifyHmacSha256` true/false |
| `src/crypto.service.keys.ts` | `crypto.internals.spec.ts` | empty-keyName throw, cache-miss + cache-hit |
| `src/crypto.service.guards.ts` | `crypto.internals.spec.ts` + `crypto.encrypt-decrypt.spec.ts` | null, missing `encryptedData`, missing `keyName`, valid |
| `src/crypto.service.validation.ts` | `crypto.internals.spec.ts` + `crypto.service.spec.ts` | null config, empty masterKey, wrong-length masterKey, empty hashSalt, short hashSalt, default `currentVersion` |
| `src/hkdf.ts` | `crypto.internals.spec.ts` | `deriveKey` wrong-length masterKey, empty keyName, version-suffix vs no-version `info`, 32-byte output |
| `src/utils.ts` | `crypto.internals.spec.ts` | `base64ToBuffer` empty throw + happy; `bufferToBase64` roundtrip; `generateIv` default+explicit; `concatBuffers`; `constantTimeCompare` equal + length-mismatch + same-length-diff-content |
| `src/config.ts` | imported everywhere | enum runtime init (covered by import) |
| `src/index.ts`, `src/testing/**`, `src/**/*.types.ts` | EXCLUDED (D11) | — |

Net: every executable branch in every measured `src/` file is directly exercised → comfortably ≥85% in all four categories.

---

## 5. Test Inventory (final)

| Spec file | Tests |
|---|---|
| `tests/crypto.service.spec.ts` (constructor 5, hasKey 6, getAvailableKeys 1, encryptAndHash 6, destroy 1) | **19** |
| `tests/crypto.encrypt-decrypt.spec.ts` (roundtrip 12, structure 6, version 3, errors 8) | **29** |
| `tests/crypto.hashing.spec.ts` (hash 8, verifyHash 8) | **16** |
| `tests/crypto.internals.spec.ts` (resolveConfig 6, guards 4, keys 2, hkdf 5, utils 7) | **24** |
| **Total** | **88** |

(Phase 1 had 12; this plan adds 76 new tests + 2 new describe blocks in the existing file.)

---

## 6. Out of Scope (do NOT do in this task)

- Expanding `TEST_VECTORS` to ≥10 vectors, adding edge-case vectors with comments, adding `expectedEncryptedValue` literals/matchers, or writing the `/docs` testing-utilities guide — **Task 3** (`20260707-todo-2.md` lines 47–66).
- Changing production `SecureCrypto` or any other `src/crypto*.ts` / `src/hkdf.ts` / `src/utils.ts` / `src/config.ts` / `src/index.ts`.
- Adding `getTestCryptoWithConfig`/`getTestCryptoWithVersion` helpers to `src/testing/index.ts` (would expand the testing module surface — Task 3). Spec files build version-overridden instances inline.
- Adding `@nestjs/testing` or a `SecureCryptoTestModule` integration test (Task 3 / beyond).
- Creating a git branch (D16) or merging to `main` (Critical Workflow step 5).
- Removing `tests/.gitkeep` (D17).
- Updating `.agent/project-structure.md` or `.agent/project-info/context.md` (handled elsewhere).

---

## 7. Verification Checklist (for step 4.5 Verification agent)

- [ ] `src/testing/test-vectors.ts`: 6 vectors each carry a real base64 `expectedHash`; `expectedEncrypted` stays `PHASE2_PLACEHOLDER`; `PHASE2_PLACEHOLDER` still used.
- [ ] `tests/crypto.service.spec.ts`: outer describe renamed to "SecureCrypto — service surface"; constructor/hasKey/getAvailableKeys unchanged; `encryptAndHash` (6) + `destroy` (1) added; 19 tests.
- [ ] `tests/crypto.encrypt-decrypt.spec.ts`: roundtrip 12 + structure 6 + version 3 + errors 8 = 29 tests.
- [ ] `tests/crypto.hashing.spec.ts`: hash 8 + verifyHash 8 = 16 tests; exact `expectedHash` literals.
- [ ] `tests/crypto.internals.spec.ts`: resolveConfig 6 + guards 4 + keys 2 + hkdf 5 + utils 7 = 24 tests.
- [ ] `package.json`: `test` = `jest --coverage --passWithNoTests`; `collectCoverageFrom` excludes `src/testing/**`, `src/index.ts`, `src/**/*.types.ts`; `coverageThreshold` = 85% (statements/branches/functions/lines).
- [ ] `npm run build` succeeds; no `src/` changes.
- [ ] `npm test`: 88 passed, 0 failed; coverage ≥85% per category; threshold PASSES.
- [ ] `npm run lint`: no errors.
- [ ] `.gitignore` ignores `coverage/`; no `coverage/`, `dist/`, `node_modules/`, `.env*` staged.
- [ ] Commit exists on the Phase 2 feature branch with the message above.
- [ ] No production crypto keys hardcoded; all fixtures TEST-ONLY zero-filled buffers.

---

## 8. Risks / Notes

- **R1 — `expectedHash` literal correctness.** Computed via the same primitives (`createHmac('sha256', Buffer.alloc(64))`) and same salt as `TEST_HASH_SALT`. A wrong literal fails the `crypto.hashing.spec.ts` exact-match assertions loudly → recalculate via Step 1a.
- **R2 — `exactOptionalPropertyTypes`.** `currentVersion` overrides via `{ ...TEST_CRYPTO_CONFIG, currentVersion: N }` are safe (property already a literal). The `trimmed` literal object in `internals.spec.ts` avoids the spread-without-optional pitfall.
- **R3 — `--coverage` making `npm test` fail mid-task.** Expected between Steps 3–6 until all specs exist; the Step-0 baseline uses `npx jest --passWithNoTests` (no coverage).
- **R4 — Stubborn uncovered branch.** Escalate with the specific uncovered line rather than lowering `coverageThreshold`.
- **R5 — `coverage/` artifacts.** Ensure `.gitignore` covers them; never stage `coverage/`.
- **R6 — Scope creep into Task 3.** Only the minimum `expectedHash` literals; full vectors expansion / edge cases / comments / `/docs` stays for Task 3.