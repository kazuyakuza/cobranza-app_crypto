# Plan — Task 2: Update README File (Critical Workflow Step 4.1)

- **TODO file:** `.agent/todos/20260707/20260707-todo-0.md` (line item: "update readme file")
- **Workflow step:** 4.1 Analysis & Planning (architect sub-agent)
- **Plan author:** architect sub-agent
- **Date:** 2026-07-07
- **Target file to modify:** `README.md` (repo root)
- **Source of truth:** `.agent/project-info/brief.md` (inconsistencies resolved in favor of brief.md)

## 1. Pre-Analysis

### 1.1 Scope
Replace the base-template `README.md` (111 lines, starter repo content) with a
library-specific README for the `@cobranza-apps/crypto` shared TypeScript library.

The README is **user-facing documentation** describing the public API, installation,
usage, NestJS integration, security, key rotation, testing, and license. The library
source is not yet implemented (Phase 2); the README documents the intended/stabilizing
API per the brief.

### 1.2 Authoritative Sources (read before writing)
- `brief.md` §1–§10 — authoritative scope, API, crypto strategy, security, non-goals.
- `architecture.md` — Public API Surface, EncryptionKey table, crypto architecture,
  component map, critical paths, security boundaries.
- `tech.md` — stack (TS, Node 22.14.0, built-in `crypto`), peer dep
  `@cobranza-apps/entities`, Jest/ts-jest, code standards.
- `product.md` — vision, UX goals, non-goals.
- `context.md` — current state (README is still base template; lib not implemented).
- `LICENSE` — The Unlicense / public domain (used for License section).

### 1.3 Constraints & Facts (must be reflected accurately)
- Package name: `@cobranza-apps/crypto`.
- Repo layout: **single root-level package**, NOT `packages/crypto/` monorepo
  (brief §8 diagram is conceptual only — per context.md "Open Questions").
- Runtime: Node.js 22.14.0 (per `.nvmrc`), built-in `crypto` only, **zero runtime deps**.
- Peer/regular dependency: `@cobranza-apps/entities` (provides `EncryptedValue`,
  `@IsEncryptedField()` decorator).
- Algorithms: AES-256-GCM + HKDF-SHA256 (encryption), HMAC-SHA256 (hashing).
  Brief notes these are "proposed, may use any better" — README states them as the
  chosen design and notes the library API is stabilizing.
- IV: 12 random bytes per encryption. Output: `IV(12) + ciphertext + authTag(16)` -> Base64.
- HKDF `info`: `"cobranza-encryption-v1:${keyName}"`, key length 32 bytes.
- No `process.env` reads inside the library — all config via `CryptoConfig`.
- Fail closed: clear, non-sensitive errors.
- Key rotation: version-aware decryption; re-encryption handled by external jobs.
- Testing subpath: `@cobranza-apps/crypto/testing` exports `SecureCryptoTestModule`,
  `getTestCrypto()`, `test-vectors.ts`.
- License file present: The Unlicense (public domain).

### 1.4 Ambiguities / Decisions (flagged, NOT invented)
1. **Who writes the README (4.2)?** `markdown-generation-rule.md` states documentation
   files may only be created/modified by Plan Agent and Docs Specialist. Critical
   Workflow maps 4.2 -> implementer. Resolution (recommended to orchestrator): since
   Task 2 is a **docs-only** task with no source code, route step 4.2 to the
   **docs-specialist** sub-agent (rule-compliant). Step 4.4 then becomes a
   review/polish pass. Orchestrator makes final call. Plan content is identical
   either way.
2. **Algorithms final?** Listed as proposed in brief. README presents them as the
   current design choice with a "Status / Stability" note that the API is stabilizing.
   Not changed — just documented.
3. **License choice:** `LICENSE` file already declares The Unlicense (public domain).
   README License section mirrors this — no invention.

### 1.5 High-Level Approach
Produce ~9 top-level sections matching the assignment, each with exact content and
representative code snippets authored in this plan. The implementer (or docs-specialist)
performs a single full-file replacement of `README.md` via `vscode-mcp-server_create_file_code`
(overwrite=true), then commits with a meaningful message. No other files change.

The README references future package exports/paths that align with the planned
`src/` layout (architecture.md "Component Map"). Snippets use TypeScript and the
public API signatures exactly as in brief §4 / architecture.md "Public API Surface".

## 2. Detailed Implementation Steps (atomic & verifiable)

### Step 0 — Pre-write checks (implementer/docs-specialist)
- Read `.gitignore` and run `git status` (gitignore-compliance rule). Confirm no
  gitignored files staged; README.md must not be gitignored.
- Confirm current branch is the feature branch created in Critical Workflow step 2
  (expected `feat/<name>` or `feat/update-readme`). Do NOT switch branches.
- Read current `README.md` once (required before overwrite by tooling).

### Step 1 — Replace README.md
- Tool: `vscode-mcp-server_create_file_code` with `path: "README.md"`, `overwrite: true`.
- Content: the **exact** structure defined in Section 3 below.
- Use real newline characters (newline-prevention rule). No literal `\n` escapes.
- Target length: ~220–280 lines. README is documentation; `max-lines-per-file`
  rule applies only to `src/` — no line limit here, but keep concise.

### Step 2 — Verify
- Re-read `README.md` to confirm content matches the plan (no truncation, correct
  newlines, code fences intact).
- Run `Get-Content README.md | Measure-Object -Line` to confirm line count is
  reasonable (sanity check, not a hard gate).
- Optionally preview markdown rendering mentally: TOC links resolve to section anchors.

### Step 3 — Diagnostics
- Run `vscode-mcp-server_get_diagnostics_code` on `README.md` (severities [0,1]).
  Markdown linters (if any extension is active) may flag heading order or link issues;
  fix only true errors, not stylistic hints.

### Step 4 — Git commit
- `git add README.md`
- `git status` (confirm only README.md staged; no `.gitignore`-matching files).
- Commit message (single line, imperative, conventional commits style):
  `docs: replace base template README with @cobranza-apps/crypto library README`
- Do NOT push. Push happens only in Critical Workflow step 5 to `origin` only.

### Step 5 — Update project info context (closing step, per instructions.md)
- Append/refresh `.agent/project-info/context.md` "Recent Changes" with:
  "README.md replaced with library-specific documentation (Task 2)."
- Update "Current State" line for README accordingly.
- Commit context.md separately: `chore: update project context after README task`.

## 3. Exact README Content Outline (Section by Section)

The file to write (`README.md`) must contain the following sections in this order.
Code blocks below are representative snippets to embed verbatim (or near-verbatim)
in the README.

### 3.0 Header
```markdown
# @cobranza-apps/crypto

> Shared encryption & deterministic hashing library for the Cobranza App platform.
> Single source of truth for protecting PII, financial, bank, and notification data
> across all NestJS microservices.

[![Status](https://img.shields.io/badge/status-WIP%20%28API%20stabilizing%29-yellow)](#status)
[![Node](https://img.shields.io/badge/node-22.14.0-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Unlicense-blue)](./LICENSE)
```

### 3.1 Overview / Purpose
- One paragraph: framework-agnostic TypeScript library, Node.js only, uses built-in
  `crypto`, zero runtime deps. Enforces consistency, security best practices, and
  key-rotation readiness.
- Bullet list of what it does:
  - AES-256-GCM authenticated encryption with per-category HKDF-SHA256 key derivation.
  - Deterministic HMAC-SHA256 hashing for indexed PII lookups with constant-time verify.
  - Combined `encryptAndHash` for fields needing both ciphertext storage and a hash index.
  - Version-aware decryption for key rotation.
- Bullet list of what it does NOT do (non-goals):
  - No password hashing (Argon2id/bcrypt belong in the Auth microservice).
  - No `process.env` reads; all config passed explicitly.
  - No business logic, DB, or direct NestJS module (except optional testing module).
  - No browser/non-Node environments.

### 3.2 Status / Stability
- Short note: Phase 1 — library API is stabilizing; algorithms (AES-256-GCM,
  HKDF-SHA256, HMAC-SHA256) are the current design choice and may evolve before 1.0.
- Note that package is consumed as a monorepo workspace package
  (`@cobranza-apps/crypto`), single root-level package layout.

### 3.3 Table of Contents
- Linked TOC (anchors). Required because README will exceed ~100 lines (per project
  doc convention — TOC when doc > 100 lines).
- Entries: Installation, Usage, API, NestJS Integration, Security Best Practices,
  Key Rotation, Testing, License.

### 3.4 Requirements
- Node.js 22.14.0 (per `.nvmrc`).
- Peer/regular dependency: `@cobranza-apps/entities` (provides `EncryptedValue` and
  `@IsEncryptedField()`).

### 3.5 Installation
```markdown
## Installation

```bash
npm install @cobranza-apps/crypto @cobranza-apps/entities
```
```
- Note: `@cobranza-apps/entities` is required for the `EncryptedValue` contract and
  the `@IsEncryptedField()` decorator.

### 3.6 Configuration
- Show `CryptoConfig` interface and `EncryptionKey` enum (verbatim from brief §4.2 / §5).
- Show `EncryptedValue` interface (from brief §2.2).
- State: do NOT read env vars inside the library; consumers supply config explicitly.
```typescript
import { SecureCrypto, CryptoConfig, EncryptionKey } from '@cobranza-apps/crypto';

const cryptoConfig: CryptoConfig = {
  masterKey: process.env.COBRANZA_CRYPTO_MASTER_KEY!, // base64 32-byte key
  hashSalt:  process.env.COBRANZA_CRYPTO_HASH_SALT!,   // base64 >= 32 bytes
  currentVersion: 1,
  defaultKeyName: EncryptionKey.PII,
};

const crypto = new SecureCrypto(cryptoConfig);
```

### 3.7 Usage Examples
Provide one subsection per operation with a short code block:

- **Encrypt / Decrypt**
```typescript
const encrypted = crypto.encrypt('user@example.com', EncryptionKey.PII);
// encrypted: { encryptedData, keyName: 'pii', algorithm: 'aes-256-gcm', version: 1 }

const plaintext = crypto.decrypt(encrypted);
// 'user@example.com'
```

- **Hash / verifyHash**
```typescript
const emailHash = crypto.hash('user@example.com');
const isValid = crypto.verifyHash('user@example.com', emailHash); // true
```

- **encryptAndHash (recommended for PII columns)**
```typescript
const { encrypted, hash } = crypto.encryptAndHash('user@example.com', EncryptionKey.PII);
// store `encrypted` in the encrypted column, `hash` in the `*Hash` index column
```

- **Key introspection**
```typescript
crypto.hasKey('pii');             // true
crypto.getAvailableKeys();        // ['pii','company_pii','bank_data','notification','general']
```

### 3.8 API Summary
- Table summarizing each public method: signature, returns, purpose.
- Columns: Method | Parameters | Returns | Description.
- Rows: constructor, encrypt, decrypt, hash, verifyHash, encryptAndHash, hasKey,
  getAvailableKeys.
- Reference the full interface contract: link to `brief.md` §4 (note: internal doc
  reference; README readers see public API table).

### 3.9 NestJS Integration Guide (ConfigModule + interceptor pattern)
- State the lib stays framework-agnostic; this section shows how a **consuming**
  NestJS service wires it up. No `CryptoModule` is shipped in the library.
- **ConfigModule setup** — env keys: `COBRANZA_CRYPTO_MASTER_KEY`,
  `COBRANZA_CRYPTO_HASH_SALT`, `COBRANZA_CRYPTO_KEY_VERSION`.
- **Provider** that instantiates `SecureCrypto` from `ConfigService`:
```typescript
// app.config.ts (consumed service)
import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';

export const cryptoProvider = {
  provide: SecureCrypto,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => new SecureCrypto({
    masterKey: config.get<string>('COBRANZA_CRYPTO_MASTER_KEY', { infer: true })!,
    hashSalt:  config.get<string>('COBRANZA_CRYPTO_HASH_SALT',  { infer: true })!,
    currentVersion: config.get<number>('COBRANZA_CRYPTO_KEY_VERSION', { infer: true }),
    defaultKeyName: EncryptionKey.PII,
  }),
};
```
- **Interceptor pattern** — converting plain strings to `EncryptedValue` inbound and
  decrypting outbound. Provide a compact `CryptoInterceptor` sketch:
```typescript
@Injectable()
export class CryptoInterceptor implements NestInterceptor {
  constructor(private readonly crypto: SecureCrypto) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    // Encrypt declared sensitive fields on inbound
    if (req.body?.email) {
      req.body.email = this.crypto.encryptAndHash(req.body.email, EncryptionKey.PII).encrypted;
    }
    return next.handle().pipe(
      map((data) => this.decryptOutbound(data)),
    );
  }

  private decryptOutbound(data: any) {
    // decrypt EncryptedValue fields for outbound response
    return data;
  }
}
```
- **DTO + decorator** integration referencing `@cobranza-apps/entities`:
```typescript
import { EncryptedValue, IsEncryptedField } from '@cobranza-apps/entities';

export class CreateUserDto {
  @IsEncryptedField(EncryptionKey.PII)
  email!: EncryptedValue | string;
}
```
- Note: the `@IsEncryptedField()` decorator and `EncryptedValue` interface live in
  `@cobranza-apps/entities`, not in this library.

### 3.10 Security Best Practices
- Fail closed: errors are thrown; never returned as partial results.
- Never log plaintext, full keys, IVs, or salts. Errors are non-sensitive.
- Master key and hash salt must be provided at runtime via `ConfigService` (vault /
  secret manager recommended). Never hardcode.
- IV is 12 random bytes per encryption; never reused.
- Hash verification uses constant-time comparison (`crypto.timingSafeEqual`).
- Use `encryptAndHash` (not hash alone) when the field also needs confidentiality.
- Rotate keys periodically; keep historical keys decryptable (see next section).
- Consider caching decrypted values in-memory with a short TTL only when the
  consumer can guarantee cache isolation; the library does not cache.

### 3.11 Key Rotation Procedure
- Step-by-step:
  1. Generate a new 32-byte master key (base64).
  2. Increment `currentVersion` and deploy with both the new key and the previous
     key(s) available for decryption (consumers configure key->version map).
  3. New encryptions use the new version; existing `EncryptedValue` records keep
     their original `version`.
  4. Run an external background job (outside this library) to re-encrypt old
     records: `decrypt(oldVersion) -> encrypt(newVersion, newVersion)`.
  5. Verify all records migrated; retire the old key only after no references remain.
- Note: the library decrypts any `version` for which a key is available; re-encryption
  itself is not performed by this library.

### 3.12 Testing
- Vitest/Jest consumers can use the testing subpath:
```typescript
import { getTestCrypto, SecureCryptoTestModule } from '@cobranza-apps/crypto/testing';
import { EncryptionKey } from '@cobranza-apps/crypto';

const crypto = getTestCrypto();
const { encrypted, hash } = crypto.encryptAndHash('test@example.com', EncryptionKey.PII);
```
- Explain `getTestCrypto()` returns a `SecureCrypto` with fixed, deterministic keys —
  safe to publish; never usable in production.
- Mention `test-vectors.ts` provides deterministic input/output pairs for reliable
  assertions across versions.
- `SecureCryptoTestModule` is a NestJS dynamic module for use in `Test.createTestingModule`.
- Library's own test suite uses Jest + ts-jest:
```bash
npm test
npm run test:watch
```

### 3.13 Development
```bash
npm install
npm run build   # tsc -> dist/
npm test        # jest
```
- Repo layout (single root package) summary; reference `.agent/project-structure.md`
  is internal — README shows the public consumer-facing layout:
```text
src/
  index.ts
  config.ts
  crypto.service.ts
  hkdf.ts
  utils.ts
  testing/
    index.ts
    test-vectors.ts
tests/
dist/
docs/
```

### 3.14 License
- State: Released to the public domain under The Unlicense. See `./LICENSE`.
- Include reference URL `http://unlicense.org/`.

### 3.15 AI Agent Footer (preserve link to AGENTS.md)
- Closing note for AI agents working on this repo:
```markdown
> AI agents: read [`AGENTS.md`](./AGENTS.md) and follow the Critical Workflow before
> contributing. Project info lives in [`.agent/project-info/`](./.agent/project-info/).
```

## 4. Verification Checklist (Step 4.5 will enforce)
- [ ] `README.md` no longer contains base-template content (no "Base Project for AI
      Agent Driven Development", no Critical Workflow mermaid diagram).
- [ ] All 9 assigned sections present: Overview, Installation, Usage (encrypt,
      decrypt, hash, verifyHash, encryptAndHash), API summary, NestJS integration,
      Security best practices, Key rotation, Testing, License.
- [ ] TOC present and anchors resolve.
- [ ] Public API signatures match brief §4 / architecture.md exactly
      (`SecureCrypto`, `CryptoConfig`, `EncryptionKey`, `EncryptedValue`).
- [ ] Algorithms stated: AES-256-GCM, HKDF-SHA256, HMAC-SHA256; IV 12 bytes;
      output `IV+ciphertext+authTag` Base64.
- [ ] Peer dependency `@cobranza-apps/entities` referenced (EncryptedValue,
      `@IsEncryptedField()`).
- [ ] "No `process.env` inside the library" stated; consumers supply config.
- [ ] NestJS section is consumer-side wiring (no CryptoModule shipped in lib).
- [ ] License section reflects `LICENSE` file (The Unlicense / public domain).
- [ ] Node.js 22.14.0 mentioned; built-in `crypto` only; zero runtime deps.
- [ ] Real newlines only (no `\n` escapes).
- [ ] Single commit; only `README.md` (and context.md for the follow-up) staged.

## 5. Notes for the Plan Agent (orchestrator)
- **Routing decision (4.2):** Recommend assigning the README write to
  **docs-specialist** (not implementer) to comply with
  `markdown-generation-rule.md` (documentation files: Plan Agent / Docs Specialist).
  The implementer's role here is limited to git staging/commit of the produced file
  (or the docs-specialist commits directly if permitted). If the orchestrator chooses
  implementer for 4.2, that is acceptable but it is a minor rule tension — flag it.
- **Step 4.4 (Documentation sub-step):** For this docs-only task, 4.4 becomes a
  light review/polish pass (TOC accuracy, anchor links, snippet correctness).
- **No code changes:** This task touches only `README.md` (and the context.md
  closing update). No `src/` files, no `package.json` (that is Task 4).
- **No `plan_exit`:** Per Critical Workflow, the architect does NOT call `plan_exit`.
  This plan is returned to the orchestrator for user approval.

## 6. Acceptance Summary
Task 2 is complete when `README.md` is a comprehensive, accurate, library-specific
document covering all assigned sections, committed on the feature branch, with
project context (`context.md`) updated. No source code or `package.json` touched.