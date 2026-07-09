# Global Plan: Phase 4 – Advanced Features & Production Readiness

- **Date:** 2026-07-09
- **TODO:** `.agent/todos/20260707/20260707-todo-4.md`
- **Phase:** 4 — advanced utilities, observability, security hardening, developer experience
- **Branch:** `feat/phase4-advanced-features`
- **Version bump:** `0.3.0` → `0.4.0`

---

## Pre-Analysis: What Already Exists vs. What Is New

| Feature | Status | Source |
|---|---|---|
| `TtlCache` / `createDecryptionCache` | ✅ Implemented (Phase 3) | `src/utils/cache.ts` |
| `reEncrypt(encrypted, newKeyName?)` | ✅ Implemented (Phase 3) | `src/crypto.service.ts` lines 160–164 |
| Input validation (length + base64) | ✅ Implemented (Phase 3) | `src/crypto.service.guards.ts` |
| Buffer cleanup (`destroy()`) | ✅ Implemented (Phase 3) | `src/crypto.service.ts` lines 190–196 |
| Security docs (checklist, rotation) | ✅ Implemented (Phase 2/3) | `docs/security-checklist.md`, `docs/key-rotation-guide.md` |
| NestJS examples | ✅ Implemented (Phase 2) | `docs/nestjs-integration-example.md`, `docs/dto-decorator-integration.md` |
| **What's NEW for Phase 4** | | |
| `encryptObject<T>` / `decryptObject<T>` | ⬜ **New** | Orchestrate encrypt/decrypt across multiple object fields |
| `withCache()` on `SecureCrypto` + `src/utils/decryption-cache.ts` | ⬜ **New** | SecureCrypto-aware cache wrapper (distinct from generic `TtlCache`) |
| `AuditLogger` hooks (`onEncrypt`/`onDecrypt`) | ⬜ **New** | Optional observability in `CryptoConfig` |
| Runtime type validation (`typeof` guards) | ⬜ **New** | Harden public methods against non-string inputs at runtime |
| `version` / `algorithm` field validation | ⬜ **New** | Validate `version` is positive integer; `algorithm` is supported |
| Buffer zeroing in decrypt primitives | ⬜ **New** | Zero plaintext buffer after string conversion |
| Unified security guide doc | ⬜ **New** | Consolidate key storage, rotation, pitfalls in one doc |
| Bulk encrypt/decrypt examples | ⬜ **New** | README + docs code samples for `encryptObject`/`decryptObject` |
| Expanded test vectors | ⬜ **New** | Cover object ops, re-encryption, cache in `src/testing/test-vectors.ts` |

---

## Task Breakdown

### Task 1: Advanced Cryptographic Features

**Scope:**
1. Implement `encryptObject<T>(obj: T, fieldMap: Record<string, EncryptionKey | string>): T` — encrypts specified string fields into `EncryptedValue`.
2. Implement `decryptObject<T>(obj: T, fieldMap: Record<string, EncryptionKey | string>): T` — decrypts specified `EncryptedValue` fields back to strings.
3. Rename `reEncrypt` parameter from `newKeyName?: string` to `targetKeyName?: EncryptionKey | string` for API consistency with `encrypt`.
4. Create `src/utils/decryption-cache.ts` — a `SecureCrypto`-aware cache wrapper using the existing `TtlCache`.
5. Add `withCache(options?: { ttlMs?: number }): { decrypt: (encrypted: EncryptedValue) => string }` to `SecureCrypto`.
6. Extract bulk operations to `src/crypto.service.bulk.ts` to keep the facade ≤200 lines.
7. Add tests for all new methods; expand test vectors.

**Files touched:** `src/crypto.service.ts`, `src/crypto.service.bulk.ts`, `src/utils/decryption-cache.ts`, `src/index.ts`, `src/testing/test-vectors.ts`, `tests/crypto.bulk.spec.ts`, `tests/crypto.cache-wrapper.spec.ts`, `tests/crypto.reencrypt.spec.ts` (update), `.agent/project-structure.md`.

---

### Task 2: Observability & Auditing

**Scope:**
1. Add `AuditLogger` interface to `src/config.ts` (or new `src/audit.ts`).
2. Add optional `auditLogger?: AuditLogger` to `CryptoConfig`.
3. Add `private readonly auditLogger?: AuditLogger` to `SecureCrypto`.
4. Add `private maybeLogEncrypt(keyName: string, version: number)` and `private maybeLogDecrypt(keyName: string, version: number)` helpers.
5. Wire hooks into `encrypt`, `decrypt`, `encryptAndHash`, `reEncrypt`, `encryptObject` (per field), `decryptObject` (per field).
6. Guarantee no sensitive data passes to hooks — only `keyName` and `version` metadata.
7. Add tests verifying hooks fire with correct metadata and never receive plaintext/ciphertext.

**Files touched:** `src/config.ts`, `src/crypto.service.ts`, `src/crypto.service.audit.ts`, `tests/crypto.audit.spec.ts`.

---

### Task 3: Security Hardening

**Scope:**
1. Add runtime `typeof` guards in all public facade methods: reject non-string `plaintext`, non-object `encryptedValue`, non-object `fieldMap`, etc.
2. Add `version` validation in `assertValidEncryptedValue` — must be a positive integer when present.
3. Add `algorithm` validation in `assertValidEncryptedValue` — must be `'aes-256-gcm'` or `undefined`.
4. Zero `plaintextBuffer` in `decryptWithAesGcm` after converting to string.
5. Create `docs/security-guide.md` — consolidated guide covering key storage, rotation procedure, common pitfalls; link from README.
6. Add tests for all new validation branches.

**Files touched:** `src/crypto.service.guards.ts`, `src/crypto.service.encryption.ts`, `src/crypto.service.ts`, `docs/security-guide.md`, `README.md`, `tests/crypto.input-validation.spec.ts` (extend), `tests/crypto.security.spec.ts`.

---

### Task 4: Developer Experience Improvements

**Scope:**
1. Add bulk encrypt/decrypt usage example to `README.md` (under Usage Examples).
2. Add `encryptObject`/`decryptObject` example to `docs/real-world-scenarios.md`.
3. Expand `src/testing/test-vectors.ts` with vectors for:
   - Object encryption (multiple fields, mixed key names)
   - Re-encryption (v1 → v2 roundtrip)
   - Cache hit/miss shape (no exact ciphertext needed)
4. Verify all examples compile conceptually.

**Files touched:** `README.md`, `docs/real-world-scenarios.md`, `src/testing/test-vectors.ts`.

---

## Execution Flow (Critical Workflow)

- **Step 2:** Git Feature Branch Setup → `feat/phase4-advanced-features`
- **Step 3:** Version Update → `0.4.0`
- **Task 1:** 4.1 Analysis & Planning → 4.2 Implementation → 4.3 Code Review & Simplification → 4.4 Documentation → 4.5 Verification → 4.6 Task Completion
- **Task 2:** 4.1 Analysis & Planning → 4.2 Implementation → 4.3 Code Review & Simplification → 4.4 Documentation → 4.5 Verification → 4.6 Task Completion
- **Task 3:** 4.1 Analysis & Planning → 4.2 Implementation → 4.3 Code Review & Simplification → 4.4 Documentation → 4.5 Verification → 4.6 Task Completion
- **Task 4:** 4.1 Analysis & Planning → 4.2 Implementation → 4.3 Code Review & Simplification → 4.4 Documentation → 4.5 Verification → 4.6 Task Completion
- **Step 5:** TODO File Completion (`20260707-todo-4.md` → `20260707-todo-4-DONE.md`)

---

## Constraints & Risks

| Risk | Mitigation |
|---|---|
| Facade exceeds 200 lines | Extract `encryptObject`/`decryptObject` to `crypto.service.bulk.ts`; extract audit helpers to `crypto.service.audit.ts`; keep facade as thin orchestrator. |
| `reEncrypt` parameter rename is breaking | Parameter name changes are not breaking at compile-time; type narrowing from `string` to `EncryptionKey \| string` is backward-compatible. |
| Audit hooks add branching overhead | Hooks are no-ops when `auditLogger` is absent (early-return guard). |
| Cache wrapper duplicates `createDecryptionCache` | `decryption-cache.ts` is a **SecureCrypto-specific** wrapper (accepts `SecureCrypto.decrypt` and manages the cache lifecycle); `cache.ts` remains generic. |
| `typeof` guards in TS feel redundant | Required for runtime safety (consumers may bypass compile-time checks, e.g., `any`-typed JSON payloads). |
| Buffer zeroing in Node.js is best-effort | Document that `.fill(0)` is defense-in-depth, not a guarantee against GC copies. |

---

## Acceptance Criteria (Global)

- [ ] All 4 tasks marked `[DONE]` in TODO file.
- [ ] `npm run build` clean.
- [ ] `npm test` passes with 100% coverage on new source files.
- [ ] `npm run lint` clean.
- [ ] README updated with new API entries and examples.
- [ ] `docs/security-guide.md` exists and is linked from README.
- [ ] No `.gitignore`-matching files staged.
- [ ] Feature branch merged to `main` and pushed to `origin`.
