# Global Plan: Crypto Library Phase 1

## Overview

Implement Phase 1 of `@cobranza-apps/crypto`: set up package configuration, define all types/interfaces, implement HKDF and utility helpers, create the `SecureCrypto` class skeleton, prepare testing infrastructure, and ensure the build succeeds.

## Pre-Analysis

### Project State
- `package.json` exists with name `@cobranza-apps/crypto` v0.1.0, exports, scripts, peer/dev deps.
- `tsconfig.json` exists but uses `"moduleResolution": "Node"` (deprecated alias for node10 in TS 5.5+).
- Source files exist as empty placeholders with JSDoc headers: `src/index.ts`, `src/config.ts`, `src/crypto.service.ts`, `src/hkdf.ts`, `src/utils.ts`, `src/testing/index.ts`, `src/testing/test-vectors.ts`.
- `README.md` is comprehensive (done in previous todo-0).
- `.agent/project-structure.md` is accurate.
- `tests/` directory only contains `.gitkeep`.
- `.eslintrc` does not exist.
- No root monorepo `package.json` exists; workspace inclusion requirement is not applicable (standalone package).
- `node_modules` present; `npm install` already run.

### Technical Decisions
- **Package Manager**: npm (existing `package-lock.json`).
- **Language**: TypeScript 5.5+, target ES2022, Node 22.
- **Test Runner**: Jest + ts-jest (already configured in `package.json`).
- **Linting**: ESLint with `@typescript-eslint` (to be added).
- **Module Resolution**: Migrate from `"Node"` to `"Node16"` to resolve TS 5.5 deprecation warning and align with modern Node.js resolution.

---

## Step 2: Git Feature Branch Setup

- **Sub-agent**: implementer
- Commit unstaged changes (modified TODO file).
- Ensure on `main`, create `feat/crypto-phase1`.

## Step 3: Version Update

- **Sub-agent**: implementer
- Version already `0.1.0`; no bump needed for Phase 1 initialization.

---

## Task 1: Project Structure & Package Configuration

### Description
Fix `tsconfig.json` deprecation warning, add missing `lint` script, ensure `@cobranza-apps/entities` is in both `peerDependencies` and `dependencies`, verify `.eslintrc` setup.

### 4.1 Analysis & Planning
- **Sub-agent**: architect
- Analyze `tsconfig.json` moduleResolution migration path (`Node` → `Node16`).
- Determine minimal ESLint config needed.
- Save plan to `.kilo/plans/20260708-task1-config.md`.

### 4.2 Implementation
- **Sub-agent**: implementer
- Update `tsconfig.json`: change `"moduleResolution": "Node"` to `"Node16"`.
- Update `package.json`: add `lint` script, move/add `@cobranza-apps/entities` to `dependencies` (in addition to `peerDependencies`).
- Create `.eslintrc.json` with `@typescript-eslint` recommended rules.
- Install new dev deps if needed (`eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`).
- Commit: `chore: fix tsconfig moduleResolution and add lint setup`

### 4.3 Code Review & Simplification
- **Sub-agents**: code-reviewer, code-simplifier
- Validate JSON correctness, dependency placement, ESLint rules.
- Save fix plan to `.kilo/plans/20260708-task1-fix.md`.
- **Sub-agent**: implementer applies fixes.

### 4.4 Documentation
- **Sub-agent**: docs-specialist
- Add inline comment in `tsconfig.json` explaining `Node16` choice.
- Update `package.json` script descriptions in README if needed.

### 4.5 Verification
- **Sub-agent**: architect
- Verify `tsc --noEmit` passes without deprecation warnings.
- Verify `npm run lint` executes.

### 4.6 Task Completion
- **Sub-agent**: implementer
- Append `[DONE]` to Task 1 in TODO file.
- Commit: `chore: complete Task 1 config setup`

---

## Task 2: Core Types & Configuration

### Description
Implement `EncryptionKey` enum, `CryptoConfig` interface in `src/config.ts`; implement `deriveKey` in `src/hkdf.ts`; add helper utilities in `src/utils.ts`.

### 4.1 Analysis & Planning
- **Sub-agent**: architect
- Define exact shapes for `CryptoConfig`, `EncryptionKey`, HKDF parameters, and utility signatures.
- Save plan to `.kilo/plans/20260708-task2-types.md`.

### 4.2 Implementation
- **Sub-agent**: implementer
- `src/config.ts`: export `EncryptionKey` enum (PII, COMPANY_PII, BANK_DATA, NOTIFICATION, GENERAL) and `CryptoConfig` interface with JSDoc examples.
- `src/hkdf.ts`: export `deriveKey(masterKey: string, keyName: string, version?: number): Buffer` using `crypto.hkdfSync('sha256', ...)`. Add validation for 32-byte master key.
- `src/utils.ts`: export `base64ToBuffer(value: string): Buffer`, `bufferToBase64(buffer: Buffer): string`, `constantTimeCompare(a: string, b: string): boolean`.
- Commit: `feat: add core types, HKDF derivation, and utility helpers`

### 4.3 Code Review & Simplification
- **Sub-agents**: code-reviewer, code-simplifier
- Check HKDF parameter alignment with brief §3.1 (`info: "cobranza-encryption-v1:${keyName}"`).
- Save fix plan to `.kilo/plans/20260708-task2-fix.md`.
- **Sub-agent**: implementer applies fixes.

### 4.4 Documentation
- **Sub-agent**: docs-specialist
- Ensure JSDoc on all exported types and functions includes usage examples.

### 4.5 Verification
- **Sub-agent**: architect
- Verify `tsc --noEmit` passes.
- Spot-check HKDF output length (32 bytes).

### 4.6 Task Completion
- **Sub-agent**: implementer
- Append `[DONE]` to Task 2 in TODO file.
- Commit: `feat: complete Task 2 core types and utilities`

---

## Task 3: SecureCrypto Core Class (Skeleton)

### Description
Create the `SecureCrypto` class skeleton with constructor, private key cache, and stubbed public methods. Update barrel exports.

### 4.1 Analysis & Planning
- **Sub-agent**: architect
- Define class layout: constructor validation, private `deriveKey` wrapper with Map cache, stub signatures for all public API methods per brief §4.1.
- Save plan to `.kilo/plans/20260708-task3-skeleton.md`.

### 4.2 Implementation
- **Sub-agent**: implementer
- `src/crypto.service.ts`: implement `SecureCrypto` class:
  - Constructor accepts `CryptoConfig`, validates `masterKey` length (base64-decoded 32 bytes), validates `hashSalt` presence.
  - Private `#keyCache: Map<string, Buffer>`.
  - Private `deriveKey(keyName: string, version?: number): Buffer` — delegates to `hkdf.ts`, caches result.
  - Stub public methods: `encrypt`, `decrypt`, `hash`, `verifyHash`, `encryptAndHash`, `hasKey`, `getAvailableKeys` — each throws `new Error('Not implemented in Phase 1')`.
  - JSDoc on constructor and every public method.
- `src/index.ts`: export `SecureCrypto`, `CryptoConfig`, `EncryptionKey`; re-export from `config.ts` and `crypto.service.ts`.
- Commit: `feat: add SecureCrypto class skeleton and barrel exports`

### 4.3 Code Review & Simplification
- **Sub-agents**: code-reviewer, code-simplifier
- Verify class does not store raw master key longer than necessary; validate encapsulation.
- Save fix plan to `.kilo/plans/20260708-task3-fix.md`.
- **Sub-agent**: implementer applies fixes.

### 4.4 Documentation
- **Sub-agent**: docs-specialist
- Add JSDoc class-level summary and method-level parameter/return docs.

### 4.5 Verification
- **Sub-agent**: architect
- Verify `tsc --noEmit` passes and `dist/` can be built (`npm run build`).
- Ensure no runtime logic leaks secrets in error messages.

### 4.6 Task Completion
- **Sub-agent**: implementer
- Append `[DONE]` to Task 3 in TODO file.
- Commit: `feat: complete Task 3 SecureCrypto skeleton`

---

## Task 4: Testing Infrastructure

### Description
Create testing utilities (`getTestCrypto`, `SecureCryptoTestModule`), deterministic test vectors, and initial test file with constructor/config validation.

### 4.1 Analysis & Planning
- **Sub-agent**: architect
- Define fixed test master key and hash salt (base64, 32 bytes, safe to publish).
- Design 5+ test vectors with known plaintext, keyName, version.
- Design `SecureCryptoTestModule` as a simple NestJS-compatible provider factory.
- Save plan to `.kilo/plans/20260708-task4-testing.md`.

### 4.2 Implementation
- **Sub-agent**: implementer
- `src/testing/index.ts`: export `getTestCrypto()` returning `new SecureCrypto({...})` with fixed keys; export `SecureCryptoTestModule` as a plain object/provider config for NestJS `Test.createTestingModule`.
- `src/testing/test-vectors.ts`: export at least 5 test vectors (plain text → encrypted + hash pairs). Since encryption is not yet implemented, define the vector structure and placeholder expected values, or use the test vectors for constructor/config tests.
- `tests/crypto.service.test.ts`: basic tests for constructor (valid config, invalid master key length, missing hashSalt) and `hasKey` / `getAvailableKeys` stubs.
- Commit: `test: add testing utilities and initial test skeleton`

### 4.3 Code Review & Simplification
- **Sub-agents**: code-reviewer, code-simplifier
- Ensure test keys are clearly non-production and well-documented.
- Save fix plan to `.kilo/plans/20260708-task4-fix.md`.
- **Sub-agent**: implementer applies fixes.

### 4.4 Documentation
- **Sub-agent**: docs-specialist
- Add JSDoc to `getTestCrypto` and `SecureCryptoTestModule` explaining their purpose.
- Document test vector format.

### 4.5 Verification
- **Sub-agent**: architect
- Run `npm test` and verify tests pass (even if minimal).
- Verify `ts-jest` compiles test files without errors.

### 4.6 Task Completion
- **Sub-agent**: implementer
- Append `[DONE]` to Task 4 in TODO file.
- Commit: `test: complete Task 4 testing infrastructure`

---

## Task 5: Documentation & Quality

### Description
Review/update README, add `.eslintrc`, ensure copyright headers, verify clean build.

### 4.1 Analysis & Planning
- **Sub-agent**: architect
- Determine if README needs Phase 1-specific updates.
- Confirm license/copyright header policy.
- Save plan to `.kilo/plans/20260708-task5-docs.md`.

### 4.2 Implementation
- **Sub-agent**: implementer
- Review `README.md` for accuracy against implemented skeleton (update if API signatures changed).
- Ensure `.eslintrc.json` created in Task 1 is referenced.
- Add copyright/license headers to all new source files if required.
- Run `npm run build` and `npm test`, fix any issues.
- Commit: `docs: final quality pass and build verification`

### 4.3 Code Review & Simplification
- **Sub-agents**: code-reviewer, code-simplifier
- Review README for stale references.
- Save fix plan to `.kilo/plans/20260708-task5-fix.md`.
- **Sub-agent**: implementer applies fixes.

### 4.4 Documentation
- **Sub-agent**: docs-specialist
- Ensure README TOC is up to date.
- Cross-link docs and README.

### 4.5 Verification
- **Sub-agent**: architect
- Verify `npm run build` produces `dist/` with `.d.ts` files.
- Verify `npm test` passes with zero errors.
- Verify `npm run lint` passes (or has zero errors on new code).

### 4.6 Task Completion
- **Sub-agent**: implementer
- Append `[DONE]` to Task 5 in TODO file.
- Commit: `chore: complete Task 5 docs and quality`

---

## Step 5: TODO File Completion

- **Sub-agent**: implementer
- Rename TODO file to `20260707-todo-1-DONE.md`.
- Ensure all changes committed in `feat/crypto-phase1`.
- Merge to `main`.
- Push `main` to `origin` only.

## Continuation

Propose user proceed with next TODO file (`20260707-todo-2.md`) for Phase 2 (full cryptographic implementation).
