# Context: `@cobranza-apps/crypto`

<!-- AI AGENT: This file tracks the current project state, recent changes, and next steps.
     For product vision see product.md. For technical design see architecture.md.
     For tech stack see tech.md. Always resolve inconsistencies in favor of brief.md. -->

> Source of truth: [brief.md](brief.md). Resolve inconsistencies in favor of brief.md.

**Last updated:** 2026-07-09

## Current Work Focus (2026-07-09)

Phase 2 complete. All cryptographic methods implemented, tested, and documented.

## Recent Changes

- Phase 2 crypto implementation finalized: `SecureCrypto` class fully operational with AES-256-GCM encryption, HKDF-SHA256 key derivation, HMAC-SHA256 hashing, and `encryptAndHash` combined operation.
- Testing module polished: `getTestCrypto()` factory, `SecureCryptoTestModule`, and 11 deterministic test vectors in `src/testing/`.
- Documentation completed: README with TOC, usage examples, security recommendations; NestJS integration guide; testing utilities guide.
- 124 tests passing with 100% code coverage across all source files.
- Build (`tsc`) clean with no errors.

## Current State (2026-07-09)

- **Version:** 0.2.0
- **Source:** `src/` contains full implementation — `crypto.service.ts` (facade) with mixins for encryption, hashing, keys, validation, and guards; `hkdf.ts` for key derivation; `config.ts` for types; `utils.ts` for helpers; `testing/` subpath for consumer test utilities.
- **Tests:** 124 tests across 4 suites, 100% statement/branch/function/line coverage.
- **Build:** Clean `tsc` compilation to `dist/`.
- **Docs:** `README.md` (full library docs), `docs/` (testing utilities, NestJS config guide, git setup, TODO writing guides), `.agent/project-info/` (brief, architecture, product, tech, context).
- **Package:** `@cobranza-apps/crypto` v0.2.0, Node.js ≥22.14.0, peer dependency on `@cobranza-apps/entities`.
- `.agent/project-info/` contains all 5 core files: `brief.md`, `product.md`, `context.md`, `architecture.md`, `tech.md`.

## Immediate Next Steps

Phase 2 is complete. Potential next phases:

1. Publish package to internal registry.
2. Integrate into consuming NestJS microservices.
3. Implement key rotation background job in a consuming service.

## Resolved Decisions

- AES-256-GCM + HKDF-SHA256 confirmed as final algorithms (per brief §3).
- Single-package layout at repo root (not monorepo) confirmed.
- Key rotation via `version` field on `EncryptedValue`, with external re-encryption job.
- No `process.env` reads inside the library — all config via `CryptoConfig`.
- Testing subpath uses fixed deterministic keys; safe to publish, not for production.

## Reference

- [brief.md](brief.md) — authoritative scope and requirements.
- `.agent/todos/20260707/20260707-todo-2.md` — task list for Phase 2.
