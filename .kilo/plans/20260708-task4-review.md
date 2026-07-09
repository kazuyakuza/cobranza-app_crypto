# Task 4 Documentation Review — Findings & Fix Plan

**Scope:** Review `README.md`, `docs/how-to-configure-in-nestjs.md`, and `docs/README.md` from Task 4 4.2 for code-example accuracy, NestJS guide completeness, security advice correctness, link integrity, README TOC accuracy, and absence of sensitive data.

**Verification baseline:**
- `src/index.ts` exports: `SecureCrypto`, `EncryptionKey`, `CryptoConfig` (type). It does **not** export `EncryptedValue`.
- `EncryptedValue` lives in `@cobranza-apps/entities`.
- Actual source files differ from the layout shown in README §Package layout.
- All internal documentation links were verified against the working tree.

---

## Findings by Severity

### HIGH

#### 1. Wrong package import for `EncryptedValue` in NestJS interceptor example
- **File:** `docs/how-to-configure-in-nestjs.md`
- **Line:** 175
- **Current:**
  ```typescript
  import { SecureCrypto, EncryptionKey, EncryptedValue } from '@cobranza-apps/crypto';
  ```
- **Issue:** `EncryptedValue` is **not** exported by `@cobranza-apps/crypto`; it is defined in `@cobranza-apps/entities`. Importing it from the crypto package will fail at compile/runtime.
- **Fix:** Split the import:
  ```typescript
  import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';
  import type { EncryptedValue } from '@cobranza-apps/entities';
  ```

---

### MEDIUM

#### 2. README package layout is outdated
- **File:** `README.md`
- **Lines:** 296–312
- **Current layout lists:**
  ```text
  src/
    index.ts
    config.ts
    crypto.service.ts
    crypto.service.validation.ts
    hkdf.ts
    hkdf.types.ts
    utils.ts
    testing/
      index.ts
      test-vectors.ts
      encrypted-shape.ts
  ```
- **Issue:** `hkdf.ts` and `hkdf.types.ts` do not exist in `src/`. The actual implementation has split primitives into `crypto.service.encryption.ts`, `crypto.service.guards.ts`, `crypto.service.hashing.ts`, `crypto.service.keys.ts`, and `crypto.service.validation.ts` (plus `utils.ts`).
- **Fix:** Update the package layout block to reflect the real source tree:
  ```text
  src/
    index.ts
    config.ts
    crypto.service.ts
    crypto.service.encryption.ts
    crypto.service.guards.ts
    crypto.service.hashing.ts
    crypto.service.keys.ts
    crypto.service.validation.ts
    utils.ts
    testing/
      index.ts
      test-vectors.ts
      encrypted-shape.ts
  tests/
  dist/
  docs/
  ```

#### 3. Misleading explanation of `{ infer: true }` for numeric env vars
- **File:** `docs/how-to-configure-in-nestjs.md`
- **Line:** 314
- **Current:**
  > "When calling `config.get<number>('KEY_VERSION', { infer: true })`, the `infer` option ensures the value is cast to the correct type (important for numeric env vars)."
- **Issue:** `{ infer: true }` in `@nestjs/config` is a TypeScript type-inference hint; it does **not** cast a string env-var value to a `number` at runtime. `COBRANZA_CRYPTO_KEY_VERSION` from `.env` is still a string, so `currentVersion` may receive a string at runtime despite the `number` type annotation, causing validation failures.
- **Fix:** Update the explanation and example to parse the value:
  ```typescript
  currentVersion: parseInt(
    config.get<string>('COBRANZA_CRYPTO_KEY_VERSION', { infer: true }) ?? '1',
    10,
  ),
  ```
  Or document that a validated config class (e.g., `class-validator`) should be used.

---

### LOW

#### 4. Test example uses string literal instead of `EncryptionKey` enum
- **File:** `docs/how-to-configure-in-nestjs.md`
- **Line:** 293
- **Current:** `crypto.encrypt('test@example.com', 'pii');`
- **Issue:** Contradicts the Common Pitfalls section (line 317), which advises using the `EncryptionKey` enum consistently to avoid misspelling runtime errors.
- **Fix:** Change to `crypto.encrypt('test@example.com', EncryptionKey.PII);` and ensure `EncryptionKey` is imported in the snippet.

#### 5. DTO snippet omits `EncryptionKey` import
- **File:** `docs/how-to-configure-in-nestjs.md`
- **Line:** 244
- **Current:** `@IsEncryptedField(EncryptionKey.PII)` is used, but the preceding import block only shows `IsEncryptedField` and `EncryptedValue` from `@cobranza-apps/entities`.
- **Issue:** Missing import for `EncryptionKey` from `@cobranza-apps/crypto`.
- **Fix:** Add:
  ```typescript
  import { EncryptionKey } from '@cobranza-apps/crypto';
  ```

#### 6. Interceptor mutates `request.body` directly
- **File:** `docs/how-to-configure-in-nestjs.md`
- **Lines:** 183–195
- **Issue:** The example modifies `request.body[field]` in place. This is a NestJS anti-pattern; interceptors should generally treat request objects as read-only and return transformed data or use a pipe/decorator approach.
- **Fix:** Add a short clarifying comment that the snippet is illustrative only and that production code should clone the body or use a dedicated transformation pipe/decorator. Alternatively, rewrite to clone:
  ```typescript
  const body = { ...request.body };
  // mutate body instead of request.body
  ```

---

## Verified-OK Items

1. **No sensitive data / real keys in examples.** All keys are shown as `process.env.*` placeholders, `<base64...>` placeholders, or explicit zero-filled test keys documented as test-only.
2. **Security advice is correct.** Key storage, logging rules, fail-closed behavior, constant-time verification, separate secrets per environment, and rotation guidance are all accurate.
3. **Internal link integrity verified.** All relative links resolve:
   - `README.md` → `./docs/how-to-configure-in-nestjs.md`, `./docs/testing-utilities.md`, `./.agent/project-info/brief.md`, `./docs/how-to-set-up-git.md`, `./docs/how-to-write-todo-files.md`, `./docs/README.md`, `./LICENSE`, `./AGENTS.md`.
   - `docs/how-to-configure-in-nestjs.md` → `../README.md`, `./testing-utilities.md`, `../.agent/project-info/architecture.md`, `../.agent/project-info/brief.md`.
   - `docs/README.md` → all listed project-info, package config, and workflow files.
4. **README TOC is accurate.** All TOC entries map to existing headings/sections.
5. **NestJS guide completeness.** Covers prerequisites, env vars, `ConfigModule`, reusable `CryptoModule`, provider factory, interceptor pattern, DTO + decorator integration, key versioning/rotation, NestJS testing, deployment/secret management, common pitfalls, and reference links.

---

## Recommended Fix Order

1. Fix HIGH-severity wrong `EncryptedValue` import.
2. Update README package layout block to match actual source tree.
3. Correct `{ infer: true }` explanation and add numeric parsing guidance.
4. Apply LOW-severity consistency fixes (enum usage, missing import, interceptor mutation note).

---

## Files Requiring Changes

- `docs/how-to-configure-in-nestjs.md`
- `README.md`

**No changes required for:** `docs/README.md`.
