# Global Plan: Phase 2 — Complete SecureCrypto Implementation

**Source TODO**: `.agent/todos/20260707/20260707-todo-2.md`
**Date**: 2026-07-08

## Overview

This plan executes all 5 tasks from the Phase 2 TODO, implementing the full cryptographic logic, comprehensive tests, testing utilities, documentation, and final build quality for the `@cobranza-apps/crypto` library.

## Current State

- Phase 1 skeleton is complete: `SecureCrypto` class exists with stubs, `hkdf.ts` is fully implemented, `config.ts` and validation are done, testing utilities have placeholder vectors.
- `package.json` at v0.1.0, Jest configured, TypeScript strict mode enabled.
- `src/crypto.service.ts` contains Phase 1 stubs for `encrypt`, `decrypt`, `hash`, `verifyHash`, `encryptAndHash`.
- `src/testing/test-vectors.ts` has 6 placeholder vectors.
- `tests/crypto.service.spec.ts` covers constructor validation and key introspection only.

## Pre-Analysis

### Technical Decisions

1. **Algorithm confirmation**: AES-256-GCM + HKDF-SHA256 + HMAC-SHA256 (as proposed in brief §3, confirmed by Phase 1 implementation).
2. **Key derivation caching**: `Map<string, Buffer>` keyed by `${keyName}:v${version}` to avoid repeated HKDF calls.
3. **Master key handling**: `Buffer.from(masterKey, 'base64')` in constructor; pass the base64 string to `deriveKey` which re-decodes (safe, minimal memory exposure). No explicit `Buffer.fill(0)` cleanup needed in Node.js GC environment.
4. **IV generation**: 12-byte random IV per encryption via `crypto.randomBytes`.
5. **Output format**: Base64 of `IV(12) + ciphertext + authTag(16)`.
6. **Hash format**: Base64 of HMAC-SHA256.
7. **Version handling**: `EncryptedValue.version` drives `deriveKey` version parameter; decrypt uses the version stored in the payload.
8. **Error handling**: Fail closed. Throw `Error` with non-sensitive messages.

### Architecture Notes

- `crypto.service.ts` will grow beyond 200 lines if all methods are inline. Consider extracting `encrypt`/`decrypt` internals to `utils.ts` or a new `aes-gcm.ts` module if needed (subject to max-lines-per-file rule).
- `hkdf.ts` is already complete and will be consumed by `SecureCrypto.deriveKey()`.
- `utils.ts` already has `generateIv`, `concatBuffers`, `base64ToBuffer`, `bufferToBase64`, `constantTimeCompare` — these will be used heavily.

## Execution Steps

### Step 2: Git Feature Branch Setup
- Sub-agent: **implementer**
- Actions: `git status`, commit any unstaged, switch to `main`, create `feat/phase2-crypto-implementation`, switch to it.

### Step 3: Version Update
- Sub-agent: **implementer**
- Actions: bump `package.json` version from 0.1.0 → 0.2.0 (minor, feature phase), commit as `chore: bump version to 0.2.0`.

---

### Task 1: Complete SecureCrypto Implementation

#### 4.1 Analysis & Planning
- Sub-agent: **architect**
- Research: review current `crypto.service.ts`, `hkdf.ts`, `utils.ts`, `config.ts`.
- Plan: detailed implementation plan for `encrypt`, `decrypt`, `hash`, `verifyHash`, `encryptAndHash`, `deriveKey`, `hasKey`, `getAvailableKeys`.
- Save per-task plan to `.kilo/plans/20260708-task1-securecrypto-impl.md`.

#### 4.2 Implementation
- Sub-agent: **implementer**
- Follow the per-task plan from 4.1.
- Implement all crypto methods in `src/crypto.service.ts`.
- May need to refactor `crypto.service.ts` if it exceeds 200 lines (extract helpers).
- Ensure `deriveKey` uses `hkdf.ts` and caches results.
- Commit with meaningful messages per method group.

#### 4.3 Code Review & Simplification
- Sub-agent: **code-reviewer** + **code-simplifier** (concurrent)
- Review for security issues, plan deviations, type safety.
- Simplify where possible.
- Save fix/simplification plan to `.kilo/plans/20260708-task1-fix.md`.
- Plan Agent reviews and assigns fixes to implementer if needed.

#### 4.4 Documentation
- Sub-agent: **docs-specialist**
- Add JSDoc to all new/modified methods in `src/crypto.service.ts`.
- Update `src/index.ts` barrel export docs if needed.

#### 4.5 Verification
- Sub-agent: **architect**
- Check implementation against per-task plan and brief.md requirements.
- Report deviations; propose TODO for unacceptable ones.

#### 4.6 Task Completion
- Sub-agent: **implementer**
- Mark `[DONE]` next to Task 1 in the TODO file.
- Commit.

---

### Task 2: Testing (Comprehensive)

#### 4.1 Analysis & Planning
- Sub-agent: **architect**
- Analyze current test suite and test vectors.
- Plan: expand `tests/crypto.service.spec.ts` with all required test categories.
- Save per-task plan to `.kilo/plans/20260708-task2-testing.md`.

#### 4.2 Implementation
- Sub-agent: **implementer**
- Expand tests covering:
  - Constructor validation (already partially covered, ensure completeness).
  - Encryption → Decryption roundtrip.
  - Deterministic hashing + verification.
  - Different `keyName` / `EncryptionKey` tests.
  - Version handling (old vs new version decryption).
  - Error cases (wrong auth tag, corrupted data, missing key).
  - `encryptAndHash` tests.
  - Test vectors from `src/testing/test-vectors.ts`.
- Ensure `npm test` passes.
- Target: 85%+ coverage.

#### 4.3 Code Review & Simplification
- Sub-agent: **code-reviewer** + **code-simplifier** (concurrent)
- Review test quality, edge case coverage, assertions.
- Simplify test setup where possible.
- Save fix plan to `.kilo/plans/20260708-task2-fix.md`.
- Assign fixes to implementer.

#### 4.4 Documentation
- Sub-agent: **docs-specialist**
- Add JSDoc/comments to test file if needed.
- Document test structure for AI agents.

#### 4.5 Verification
- Sub-agent: **architect**
- Verify test coverage ≥ 85%, all tests pass, edge cases covered.

#### 4.6 Task Completion
- Sub-agent: **implementer**
- Mark `[DONE]` next to Task 2 in the TODO file.
- Commit.

---

### Task 3: Testing Module Polish

#### 4.1 Analysis & Planning
- Sub-agent: **architect**
- Plan: finalize `src/testing/index.ts` and `src/testing/test-vectors.ts`.
- Define 10+ comprehensive test vectors with real expected values (computed from fixed test keys).
- Plan docs file for testing utilities usage.
- Save per-task plan to `.kilo/plans/20260708-task3-testing-polish.md`.

#### 4.2 Implementation
- Sub-agent: **implementer**
- In `src/testing/index.ts`: ensure `getTestCrypto()` is complete; verify `SecureCryptoTestModule` works.
- In `src/testing/test-vectors.ts`: replace all `PLACEHOLDER_PHASE2` with real computed values (run a small script or manual compute using the fixed test keys).
- Add at least 10 vectors covering: empty string, special characters, long text, different key categories, unicode/emoji, different versions.
- Update tests to use vectors heavily.
- Create/update docs file about testing utilities.

#### 4.3 Code Review & Simplification
- Sub-agent: **code-reviewer** + **code-simplifier** (concurrent)
- Review vector accuracy, testing module API clarity.
- Save fix plan to `.kilo/plans/20260708-task3-fix.md`.
- Assign fixes to implementer.

#### 4.4 Documentation
- Sub-agent: **docs-specialist**
- Document `src/testing/index.ts` exports with JSDoc.
- Add comments to each test vector explaining its purpose.
- Create or update `docs/testing-guide.md` (or similar) linked from README.

#### 4.5 Verification
- Sub-agent: **architect**
- Verify test vectors produce consistent, repeatable results.
- Verify `@cobranza-apps/crypto/testing` import works as expected.

#### 4.6 Task Completion
- Sub-agent: **implementer**
- Mark `[DONE]` next to Task 3 in the TODO file.
- Commit.

---

### Task 4: Documentation & Examples

#### 4.1 Analysis & Planning
- Sub-agent: **architect**
- Plan: README TOC update, usage examples, NestJS config doc.
- Save per-task plan to `.kilo/plans/20260708-task4-docs.md`.

#### 4.2 Implementation
- Sub-agent: **implementer**
- Update `README.md`:
  - Ensure TOC at top is complete.
  - Replace Phase 1 notes with real usage examples (encrypt, decrypt, hash, encryptAndHash).
  - Add security recommendations section (key storage, rotation, logging).
  - Add performance notes (caching decrypted values).
  - Update API Summary table to mark all methods as functional.
- Create `docs/nestjs-configuration.md` with ConfigService example.
- Link new doc in README.

#### 4.3 Code Review & Simplification
- Sub-agent: **code-reviewer** + **code-simplifier** (concurrent)
- Review docs for accuracy, clarity, security advice correctness.
- Save fix plan to `.kilo/plans/20260708-task4-fix.md`.
- Assign fixes to implementer.

#### 4.4 Documentation
- Sub-agent: **docs-specialist**
- Final polish on README and docs/nestjs-configuration.md.
- Ensure all cross-links work.

#### 4.5 Verification
- Sub-agent: **architect**
- Verify README reflects actual Phase 2 API.
- Verify docs are complete and linked.

#### 4.6 Task Completion
- Sub-agent: **implementer**
- Mark `[DONE]` next to Task 4 in the TODO file.
- Commit.

---

### Task 5: Final Quality & Build

#### 4.1 Analysis & Planning
- Sub-agent: **architect**
- Plan: `tsc` build, `eslint` run, fix any issues.
- Save per-task plan to `.kilo/plans/20260708-task5-quality.md`.

#### 4.2 Implementation
- Sub-agent: **implementer**
- Run `npm run build` (tsc), fix any compilation errors.
- Run `npm run lint`, fix any lint issues.
- Run `npm test`, ensure all pass.
- Verify coverage ≥ 85%.

#### 4.3 Code Review & Simplification
- Sub-agent: **code-reviewer** + **code-simplifier** (concurrent)
- Review any fixes made during build/lint.
- Save fix plan to `.kilo/plans/20260708-task5-fix.md`.
- Assign fixes to implementer.

#### 4.4 Documentation
- Sub-agent: **docs-specialist**
- Ensure README build/lint commands are accurate.

#### 4.5 Verification
- Sub-agent: **architect**
- Verify clean build, zero lint errors, all tests pass, coverage met.

#### 4.6 Task Completion
- Sub-agent: **implementer**
- Mark `[DONE]` next to Task 5 in the TODO file.
- Commit.

---

### Step 5: TODO File Completion
- Sub-agent: **implementer**
- Rename TODO file to `20260707-todo-2-DONE.md`.
- Ensure all files committed in feature branch.
- Merge `feat/phase2-crypto-implementation` → `main`.
- Push `main` to `origin` (only).

### Step 6: Continuation
- Propose next TODO file: `20260707-todo-3.md`.
