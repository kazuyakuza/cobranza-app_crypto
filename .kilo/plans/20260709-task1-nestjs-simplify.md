# Task 1 — NestJS Integration Helpers: Simplification Plan

## Review Outcome

**Status:** Simplifications proposed. The implementation from step 4.2 is already concise and follows NestJS conventions, but two small refactorings will reduce duplication and remove an unnecessary conditional spread.

## Proposed Simplifications

### 1. `src/nestjs/crypto.module.ts` — Remove redundant conditional spread

**Current issue:** `forRootAsync` uses `...(options.imports !== undefined && { imports: options.imports })` even though `buildModule` already defaults `imports` to `[]` via `parts.imports ?? []`.

**Change:** Pass `imports: options.imports` directly into `buildModule`.

**Rationale:** The private `buildModule` helper already handles the `undefined` fallback, so the conditional spread in `forRootAsync` is redundant and slightly harder to read.

### 2. `tests/nestjs/crypto.service.spec.ts` — DRY up service instantiation

**Current issue:** Every test repeats `const service = new CryptoService(TEST_CRYPTO_CONFIG);`.

**Change:** Introduce a shared `service` variable and create a fresh instance in `beforeEach`.

**Rationale:** Each test currently needs a fresh `CryptoService` instance. Moving construction to `beforeEach` removes duplication while preserving isolation. It also makes it easier to add new tests that reuse the same setup.

## Files to Modify

1. `src/nestjs/crypto.module.ts`
2. `tests/nestjs/crypto.service.spec.ts`

## Files That Do Not Need Changes

- `src/nestjs/crypto-config.interface.ts` — Interface is minimal and matches the standard NestJS async-module pattern.
- `src/nestjs/crypto.service.ts` — Only a constructor forwarding config to `SecureCrypto`; no meaningful duplication.
- `src/nestjs/index.ts` — Barrel file is already minimal.
- `tests/nestjs/crypto.module.spec.ts` — Each test exercises a distinct registration path; extracting helpers would add abstraction without improving readability.
