# Context: `@cobranza-apps/crypto`

<!-- AI AGENT: This file tracks the current project state, recent changes, and next steps.
     For product vision see product.md. For technical design see architecture.md.
     For tech stack see tech.md. Always resolve inconsistencies in favor of brief.md. -->

> Source of truth: [brief.md](brief.md). Resolve inconsistencies in favor of brief.md.

**Last updated:** 2026-07-09

## Current Work Focus (2026-07-09)

Phase 4 complete. All advanced features implemented, security hardened, and production-ready.

## Recent Changes

- Phase 4 advanced features implemented:
  - `encryptObject`/`decryptObject` bulk field encryption in `src/crypto.service.bulk.ts`
  - `withCache()` cached decryptor wrapper in `src/utils/decryption-cache.ts`
  - `reEncrypt` parameter aligned to `targetKeyName`
- Phase 4 observability & auditing implemented:
  - Optional `AuditLogger` interface in `src/audit.ts` with `onEncrypt`/`onDecrypt` hooks
  - Hooks wired into all crypto operations via `src/crypto.service.audit.ts`
  - No sensitive data ever passed to hooks
- Phase 4 security hardening implemented:
  - Runtime `typeof` guards in all public methods (`src/crypto.service.facade-guards.ts`)
  - `version` and `algorithm` validation in `assertValidEncryptedValue`
  - Buffer zeroing in `decryptWithAesGcm` on success and failure paths
  - Unified `docs/security-guide.md` covering key storage, rotation, and pitfalls
- Phase 4 developer experience improved:
  - NestJS bulk multi-field encryption example added to `docs/nestjs-integration-example.md`
  - `CACHE_FIXTURE` and expanded `RE_ENCRYPT_SCENARIOS` in `src/testing/test-vectors.ts`
- 241 tests passing with 100% code coverage across all source files.
- Build (`tsc`) clean with no errors.

## Current State (2026-07-09)

- **Version:** 0.4.0
- **Source:** `src/` contains full implementation — `crypto.service.ts` (facade, 200 lines), mixins for encryption, hashing, keys, validation, guards, bulk ops, facade guards, and audit notifiers; `hkdf.ts` for key derivation; `config.ts` for types; `utils.ts` and `utils/cache.ts` for helpers; `testing/` subpath for consumer test utilities.
- **Tests:** 241 tests across 13 suites, 100% statement/branch/function/line coverage.
- **Build:** Clean `tsc` compilation to `dist/`.
- **Docs:** `README.md` (full library docs), `docs/` (testing utilities, NestJS config guide, NestJS integration example, DTO decorator integration, security guide, security checklist, key rotation guide, real-world scenarios, getting started, git setup, TODO writing guides), `.agent/project-info/` (brief, architecture, product, tech, context).
- **Package:** `@cobranza-apps/crypto` v0.4.0, Node.js ≥22.14.0, peer dependency on `@cobranza-apps/entities`.
- `.agent/project-info/` contains all 5 core files: `brief.md`, `product.md`, `context.md`, `architecture.md`, `tech.md`.

## Immediate Next Steps

Phase 4 is complete. Potential next phases:

1. Publish package to internal registry.
2. Integrate into consuming NestJS microservices.
3. Implement key rotation background job in a consuming service.

## Resolved Decisions

- AES-256-GCM + HKDF-SHA256 confirmed as final algorithms (per brief §3).
- Single-package layout at repo root (not monorepo) confirmed.
- Key rotation via `version` field on `EncryptedValue`, with external re-encryption job.
- No `process.env` reads inside the library — all config via `CryptoConfig`.
- Testing subpath uses fixed deterministic keys; safe to publish, not for production.
- Audit hooks are opt-in, post-success, and error-swallowing — never break crypto operations.
- Buffer zeroing is defense-in-depth, not a guarantee against GC copies.

## Reference

- [brief.md](brief.md) — authoritative scope and requirements.
- `.agent/todos/20260707/20260707-todo-4-DONE.md` — task list for Phase 4.
