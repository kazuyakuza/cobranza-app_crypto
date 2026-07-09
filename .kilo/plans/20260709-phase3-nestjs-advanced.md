# Global Plan: Phase 3 — NestJS Integration, Advanced Features, and Final Documentation

## Source

TODO file: `.agent/todos/20260707/20260707-todo-3.md`

## Objective

Make `@cobranza-apps/crypto` fully consumable in NestJS microservices, add advanced utilities, and complete all documentation so the library is ready for `ms-db-gateway` and other services.

## Current State

- `SecureCrypto` class is fully implemented (AES-256-GCM, HKDF-SHA256, HMAC-SHA256).
- 124 tests passing, 100% coverage.
- Testing subpath `@cobranza-apps/crypto/testing` exists.
- Docs exist: README.md, NestJS config guide, testing utilities guide.
- No `src/nestjs/` helpers yet.
- No `reEncrypt` or in-memory decryption cache.
- Input validation partially present in `crypto.service.validation.ts`.

## Git & Version

- Step 2: Create feature branch `feat/phase3-nestjs-advanced` from `main`.
- Step 3: Bump version to `0.3.0` (minor — new features).

## Per-Task Plans

### Task 1: NestJS Integration Helpers

**Goal:** Provide built-in NestJS module and injectable service so consumers do not hand-wire providers.

**Pre-analysis:**
- `@nestjs/common` and `@nestjs/config` will be **optional peer dependencies** (consumers already have them). No new runtime deps for the core library.
- Add a `./nestjs` subpath export in `package.json` alongside the existing `.` and `./testing`.
- Keep the core library framework-agnostic; NestJS helpers live under `src/nestjs/` and are tree-shakeable for non-NestJS consumers.

**Files to create:**
- `src/nestjs/index.ts` — public subpath exports.
- `src/nestjs/crypto.module.ts` — `CryptoModule.forRoot(config)` and `CryptoModule.forRootAsync({ useFactory, inject })`.
- `src/nestjs/crypto.service.ts` — `CryptoService` injectable wrapper exposing all `SecureCrypto` methods.
- `src/nestjs/crypto-config.interface.ts` — NestJS-specific async config interface.

**Files to update:**
- `package.json` — add `./nestjs` export; add `@nestjs/common` and `@nestjs/config` to `peerDependenciesMeta` as optional.
- `.agent/project-structure.md` — add `src/nestjs/` line.

**Tests:**
- `tests/nestjs/crypto.module.spec.ts` — test `forRoot` and `forRootAsync` compile and provide `CryptoService`.
- `tests/nestjs/crypto.service.spec.ts` — test wrapper delegates correctly to `SecureCrypto`.

**Docs:**
- Update `docs/how-to-configure-in-nestjs.md` with built-in `CryptoModule` examples (both sync and async).
- Link new examples in README.md.

**4.x cycle:**
- 4.1 Analysis & Planning → architect (detailed plan for this task).
- 4.2 Implementation → implementer.
- 4.3 Code Review & Simplification → code-reviewer + code-simplifier; fix → implementer.
- 4.4 Documentation → docs-specialist.
- 4.5 Verification → architect.
- 4.6 Task Completion → implementer (mark `[DONE]`).

---

### Task 2: DTO / Decorator Support Examples

**Goal:** Show consumers how to integrate `@IsEncryptedField()` with automatic encryption in request/response pipelines.

**Pre-analysis:**
- No new library code needed (no new `src/` files). This is documentation + examples.
- The existing `docs/how-to-configure-in-nestjs.md` has a basic interceptor example; we need more complete, production-ready patterns.

**Files to create:**
- `docs/dto-decorator-examples.md` — new doc with:
  - Custom `EncryptionPipe` that transforms plain string DTO fields → `EncryptedValue` + computes hash.
  - `CryptoInterceptor` for automatic outbound decryption.
  - TypeORM `@BeforeInsert` / `@BeforeUpdate` subscriber alternative.
  - Comparison table: Pipe vs Interceptor vs Subscriber — when to use each.
- `docs/ms-db-gateway-patterns.md` — recommendations specific to `ms-db-gateway` (interceptor for API gateway, subscriber for direct DB writes).

**Files to update:**
- `README.md` — add links to new docs under "NestJS Integration Guide".
- `docs/README.md` — add entries for new docs.

**4.x cycle:**
- 4.1 Analysis & Planning → architect.
- 4.2 Implementation → implementer.
- 4.3 Code Review & Simplification → code-reviewer + code-simplifier; fix → implementer.
- 4.4 Documentation → docs-specialist.
- 4.5 Verification → architect.
- 4.6 Task Completion → implementer.

---

### Task 3: Advanced Features

**Goal:** Add `reEncrypt`, decryption cache with TTL, and tighten input validation.

**Pre-analysis:**
- `reEncrypt` is a consumer convenience for key rotation workflows: decrypt old → encrypt new version.
- Cache must be optional, in-memory only, with TTL to prevent unbounded growth. Must not cache plaintext in production by default; consumer opts in.
- Input validation: ensure all public methods reject empty/null/undefined inputs early with clear errors.

**Files to create:**
- `src/utils/cache.ts` — `DecryptionCache` class:
  - `get(key: string): string | undefined`
  - `set(key: string, value: string, ttlMs: number): void`
  - `clear(): void`
  - Internally uses `Map<string, { value: string; expiresAt: number }>`.
- `src/utils/index.ts` — re-export cache.

**Files to update:**
- `src/crypto.service.ts` — add:
  - `reEncrypt(encrypted: EncryptedValue, newKeyName?: string): EncryptedValue`
  - Optional `cache` parameter in constructor or a `withCache(cache)` builder.
  - Input validation guards in `encrypt`, `decrypt`, `hash`, `verifyHash`, `encryptAndHash`, `reEncrypt`.
- `src/index.ts` — export new utilities if appropriate.

**Tests:**
- `tests/utils/cache.spec.ts` — TTL eviction, clear, get/set.
- `tests/crypto.service.reEncrypt.spec.ts` — roundtrip, version bump, key name change.
- `tests/crypto.service.validation.spec.ts` — invalid inputs (empty string, null, undefined, too long plaintext).

**4.x cycle:**
- 4.1 Analysis & Planning → architect.
- 4.2 Implementation → implementer.
- 4.3 Code Review & Simplification → code-reviewer + code-simplifier; fix → implementer.
- 4.4 Documentation → docs-specialist.
- 4.5 Verification → architect.
- 4.6 Task Completion → implementer.

---

### Task 4: Comprehensive Documentation & Examples

**Goal:** Review all docs and fill gaps: Getting Started, NestJS integration, security checklist, key rotation guide, performance notes, real-world scenarios.

**Pre-analysis:**
- README already has most sections; need to verify completeness and add real-world examples.
- `docs/` needs an index update and the new guides from Tasks 1–3.

**Files to update:**
- `README.md`:
  - Expand "Getting Started" with a copy-pasteable minimal example.
  - Add full built-in NestJS integration example (using `CryptoModule.forRootAsync` with `ConfigService`).
  - Add Security Checklist subsection (quick bullet list).
  - Expand Key Rotation guide with `reEncrypt` usage.
  - Expand Performance considerations with cache TTL guidance.
  - Add real-world scenarios: encrypting `taxId`, `email`, `bank description` with exact code snippets.
- `docs/README.md` — update index with new files.

**4.x cycle:**
- 4.1 Analysis & Planning → architect.
- 4.2 Implementation → implementer.
- 4.3 Code Review & Simplification → code-reviewer + code-simplifier; fix → implementer.
- 4.4 Documentation → docs-specialist.
- 4.5 Verification → architect.
- 4.6 Task Completion → implementer.

---

## Step 5: TODO File Completion

- Mark all tasks `[DONE]`.
- Rename TODO file to `20260707-todo-3-DONE.md`.
- Merge `feat/phase3-nestjs-advanced` → `main`.
- Push `main` to `origin` only.

## Constraints & Rules

- Max 200 lines per source file; max 50 lines per method; max 2 levels nesting; max 2 params per method (use param objects).
- Prefer private members.
- Self-documenting code; minimal comments.
- No commented-out code.
- All new code must have unit tests.
- Maintain 100% coverage on new source files.
- Never call `plan_exit`.
