# Plan: Task 1 — Initialize Project Info

- **TODO file**: `.agent/todos/20260707/20260707-todo-0.md` (line 1: "initialize project info")
- **Global plan**: `.kilo/plans/20260707-crypto-library-setup.md` (Task 1 section)
- **Critical Workflow step**: 4.1 Analysis & Planning
- **Owner sub-agent**: architect
- **Downstream consumer**: implementer (step 4.2)
- **Date**: 2026-07-07

## 1. Objective

Create the four missing core project-info files (`product.md`, `context.md`, `architecture.md`, `tech.md`) inside `.agent/project-info/`, derived from the already-defined `brief.md`. Then remove the `.agent/project-info/.initialized` marker file. After this task, the project-info folder fully satisfies the structure mandated by `.agent/project-info/instructions.md` (5 core files: `brief.md`, `product.md`, `context.md`, `architecture.md`, `tech.md`) and the initialization is no longer flagged as partial.

Scope is **documentation only** — Markdown files under `.agent/project-info/` plus deletion of `.initialized`. No source code, no `package.json`, no `src/` changes (those belong to Tasks 2–4).

## 2. Current State (Verified)

- `.agent/project-info/brief.md` — exists, comprehensive (215 lines), defines crypto library spec.
- `.agent/project-info/.initialized` — exists, content: `THIS MARKS THE FILE AS DEFAULT VERSION`.
- `.agent/project-info/instructions.md` — exists, defines required core files and update rules.
- `.agent/project-info/product.md` — **missing**.
- `.agent/project-info/context.md` — **missing**.
- `.agent/project-info/architecture.md` — **missing**.
- `.agent/project-info/tech.md` — **missing**.
- `AGENTS.md` — links `brief.md`, `WORKFLOWS.md`, `RULES.md`, and the project-info instructions; it does **not** yet link the individual core info files (will be addressed in step 4.4/docs or via a cross-link note here).
- `.agent/project-structure.md` — `src/` has `(no folders yet)`; `docs/` exists.
- `package.json` — does not exist (out of scope for this task).
- `src/` — contains only `.gitkeep`.

## 3. Pre-Analysis — Content Decisions Per File

Source of truth is `brief.md`. Per `instructions.md`, if inconsistencies arise, `brief.md` wins. Each new file is derived from, and must stay consistent with, `brief.md`. No speculative content beyond the brief.

### 3.1 `product.md` — product goals, UX, problem definition
Sections:
1. **Overview / Vision** — single source of truth for encryption, decryption, and deterministic hashing across all Cobranza App microservices.
2. **Problem Statement** — today each service risks implementing crypto differently (inconsistent algorithms, manual key handling, hard rotation). PII/financial/bank/notification fields need a shared, audited path.
3. **Target Users** — backend engineers building NestJS microservices in the Cobranza App platform.
4. **User (Developer) Experience Goals** — simple `SecureCrypto` class; framework-agnostic but NestJS-friendly; explicit config injection (no `process.env` inside lib); combined `encryptAndHash` convenience for PII fields.
5. **Product Goals / Success Criteria** — consistency, security best practices, key-rotation readiness, lightweight (no runtime deps beyond Node `crypto`), high test coverage.
6. **Non-Goals** — password hashing, business/DB logic, browser support, direct NestJS module integration (except optional testing module), automatic `.env` loading.
7. **Reference** — backlink to `brief.md` as authoritative scope.

### 3.2 `context.md` — factual log of current work focus, recent changes, next steps
Sections (factual, dated):
1. **Current Work Focus** — Phase 1 project initialization: project info, README, project structure, package setup. No cryptography logic implemented yet (deferred to Phase 2 per TODO `20260707-todo-1.md`).
2. **Recent Changes** — base template (`base-project-ai-agent-driven`) cloned; `brief.md` authored for `@cobranza-apps/crypto`; `.initialized` marker present (partial init).
3. **Current State** — `src/` contains only `.gitkeep`; no `package.json`, no `tsconfig.json`; `README.md` is still the base template; four core project-info files missing.
4. **Immediate Next Steps** — (mirrors TODO `20260707-todo-0.md`):
   - Task 1: initialize project info (this task).
   - Task 2: update README file.
   - Task 3: define project structure.
   - Task 4: set up & configure `package.json`, install dependencies.
5. **Open Questions / Decisions Pending** — confirm AES-256-GCM + HKDF-SHA256 and HMAC-SHA256 are final (brief marks them as proposals); confirm library lives at repo root (single package) vs monorepo `packages/crypto/` layout.
6. **Reference** — backlink to `brief.md` and TODO files.

> Note for downstream step 4.6/closing: `context.md` is the canonical living log and MUST be re-updated after each task per `instructions.md` "Critical Closing Step".

### 3.3 `architecture.md` — system architecture, paths, design patterns, critical paths
Sections:
1. **System Overview** — shared TypeScript library consumed by multiple NestJS microservices; depends on `@cobranza-apps/entities` for the `EncryptedValue` contract; runtime uses only Node.js built-in `crypto`.
2. **Public API Surface** — `SecureCrypto` class methods (`encrypt`, `decrypt`, `hash`, `verifyHash`, `encryptAndHash`, `hasKey`, `getAvailableKeys`) and `CryptoConfig` interface (copy/summary from brief §4, with link to brief).
3. **EncryptionKey Categories** — enum values `PII`, `COMPANY_PII`, `BANK_DATA`, `NOTIFICATION`, `GENERAL` (table with purpose per value).
4. **Cryptographic Architecture** —
   - Reversible encryption: AES-256-GCM, HKDF-SHA256 key derivation (`masterKey` → per-category 32-byte keys, `info = cobranza-encryption-v1:${keyName}`), 12-byte random IV, output `IV(12)+ciphertext+authTag(16)` base64.
   - Deterministic hashing: HMAC-SHA256 with dedicated `hashSalt` (≥32 bytes) for indexed PII lookups; constant-time verification via `crypto.timingSafeEqual`.
   - Key rotation: `version` field supports decrypting historical keys; re-encryption out of lib scope.
5. **Component Map / Package Structure** — the proposed `src/` layout from brief §8 (`index.ts`, `config.ts`, `crypto.service.ts`, `hkdf.ts`, `utils.ts`, `testing/index.ts`, `testing/test-vectors.ts`, `tests/`, `docs/`).
6. **Design Patterns** — Factory (`getTestCrypto()`), Strategy (per-keyName HKDF derivation), Module pattern (`SecureCryptoTestModule` for NestJS tests), Repository/interceptor integration on consumer side (DTO `EncryptedValue`, `@IsEncryptedField()`).
7. **Critical Paths** — encrypt path (plaintext + keyName → derive → IV → cipher → base64 → `EncryptedValue`), decrypt path (validate → split IV/ciphertext/authTag → derive key by `version` → decipher → plaintext), hash path (HMAC → hex/base64), `encryptAndHash` combined path for PII columns.
8. **Security Boundaries** — fail closed; never log plaintext/full keys; no hardcoded keys; no `process.env` reads; constant-time hash verify; non-random IV prohibition.
9. **Reference** — backlink to `brief.md`.

### 3.4 `tech.md` — stack, dev setup, constraints, tooling
Sections:
1. **Tech Stack** — TypeScript; Node.js 22 (per `.nvmrc` = 22.14.0); Node built-in `crypto` module (no runtime deps); `@cobranza-apps/entities` as peer + regular dependency.
2. **Package Manager** — npm (standard, no lock file present yet at init time).
3. **Build & Tooling** — `tsc` → `dist/` (already gitignored); Jest + ts-jest for unit tests; scripts `build`, `test`, `test:watch` (and `lint` per TODO `20260707-todo-1.md`).
4. **Dev Dependencies** — `typescript`, `@types/node`, `jest`, `ts-jest`, `@types/jest`.
5. **Dev Setup** — (steps referenced for later tasks, not to execute here): `npm install`, `npm run build`, `npm test`.
6. **Technical Constraints** — derived from brief §7 & §10: no env loading inside lib; framework-agnostic; Node-only (no browser); fail closed; no password hashing; no business/DB logic; design for future post-quantum swap.
7. **Code Standards** — summarize enforced `.kilo/rules/` constraints applicable to `src/`: ≤200 lines/file (ideally ≤125), ≤50 lines/method, ≤2 params/method (else object/type), max nesting depth 2, single-section boolean conditions, private members by default, no commented code, self-documenting code, explicit variable names, no magic numbers.
8. **AI Agent Workflow Tooling** — Kilo sub-agents (architect/implementer/code-reviewer/code-simplifier/docs-specialist), Critical Workflow (`.kilo/commands/critical-workflow.md`), rules under `.kilo/rules/`, plans under `.kilo/plans/`, TODOs under `.agent/todos/`.
9. **Reference** — backlink to `brief.md` and `.agent/project-structure.md`.

### 3.5 `.initialized` removal
- Delete `.agent/project-info/.initialized` once the four files exist. Per `instructions.md` and `project-info-init.md`, presence of `.initialized` marks partial/default init; removal signals complete initialization.

## 4. Implementation Steps (for step 4.2 — implementer)

All paths are absolute under the repo root `C:\projects\cobranza-app\crypto`. Use `vscode-mcp-server_create_file_code` (per tool-selection-priority rule) for new files; use real newlines (newline-prevention rule). Do not use any source-code (`src/`) tools. Each file gets a top-level heading and a backlink to `brief.md`.

### Step 4.2.1 — Create `.agent/project-info/product.md`
- Use `vscode-mcp-server_create_file_code` with `path: ".agent/project-info/product.md"`, `overwrite: false`, `ignoreIfExists: true`.
- Content: the 7 sections from §3.1 above, in Markdown. Include a top note: `> Source of truth: brief.md. Resolve inconsistencies in favor of brief.md.`
- Expected length: ~60–90 lines.

### Step 4.2.2 — Create `.agent/project-info/context.md`
- Same creation tool, `path: ".agent/project-info/context.md"`.
- Content: the 6 dated factual sections from §3.2. Keep it factual; no speculation. Include the next-steps list mirroring `20260707-todo-0.md`.
- Expected length: ~50–80 lines.

### Step 4.2.3 — Create `.agent/project-info/architecture.md`
- Same creation tool, `path: ".agent/project-info/architecture.md"`.
- Content: the 9 sections from §3.3. Include the `EncryptionKey` table and the package-structure block (code fence) copied/summarized from brief §8. Add a TOC if the file exceeds 100 lines (markdown-generation/docs rule of thumb; definitive TOC handled in step 4.4).
- Expected length: ~110–150 lines (TOC to be finalized in 4.4 docs step if needed).

### Step 4.2.4 — Create `.agent/project-info/tech.md`
- Same creation tool, `path: ".agent/project-info/tech.md"`.
- Content: the 9 sections from §3.4. Explicitly list Node 22.14.0; enumerate dev deps; summarize code-standard rules by name with one-line meaning each.
- Expected length: ~70–100 lines.

### Step 4.2.5 — Remove `.agent/project-info/.initialized`
- Use `bash`: `git rm ".agent/project-info/.initialized"` (allowed pattern `git rm *`).
- Verify deletion via `Test-Path -LiteralPath ".agent/project-info/.initialized"` (allowed) — expect `False`.

### Step 4.2.6 — Verify completeness (read-only, pre-commit)
- List `.agent/project-info/` contents: `Get-ChildItem ".agent/project-info"` (allowed) — expect exactly: `brief.md`, `product.md`, `context.md`, `architecture.md`, `tech.md`, `instructions.md` (no `.initialized`).
- Read each new file once to confirm real newlines and brief consistency.

### Step 4.2.7 — Gitignore compliance check & commit
- Read `.gitignore`; run `git status -s` (allowed: `git status *`).
- Confirm no `.gitignore`-matching files staged (`.agent/project-info/` is not gitignored).
- Stage: `git add .agent/project-info/product.md .agent/project-info/context.md .agent/project-info/architecture.md .agent/project-info/tech.md` plus the `.initialized` removal (already staged by `git rm`).
- Commit message: `chore: initialize project info files`.
- Do NOT push (push handled at step 5 of the global workflow).

## 5. Verification Criteria (for step 4.5 — architect)

- All 5 core files exist in `.agent/project-info/`: `brief.md`, `product.md`, `context.md`, `architecture.md`, `tech.md`.
- `.initialized` is removed.
- No new file contradicts `brief.md` (cross-check algorithms, API, enum, non-goals).
- `context.md` accurately reflects current state (no `package.json`, `src/.gitkeep` only, Phase 1).
- `architecture.md` package-structure block is consistent with `.agent/project-structure.md` and brief §8.
- `tech.md` Node version matches `.nvmrc` (22.14.0), dev deps match TODO `20260707-todo-1.md`.
- No file exceeds sensible length; no commented-out code (n/a, Markdown); real newlines throughout.

## 6. Out of Scope (explicit)

- Editing `brief.md` (authoritative; unchanged).
- Creating/updating `package.json`, `tsconfig.json`, `src/*`, `README.md`, `.agent/project-structure.md` (Tasks 2–4).
- Adding per-file link entries into `AGENTS.md` for the new core files — optional; if desired, flagged for step 4.4 (docs-specialist) under markdown-generation rules. Not required by `instructions.md` (AGENTS.md already links the instructions file that enumerates the core files).
- Pushing to any remote.

## 7. Risks & Notes

- **`.nvmrc` value**: the global plan states Node `22.14.0`. The implementer should read `.nvmrc` before writing `tech.md` to confirm the exact version string; do not hardcode beyond what the file states. If `.nvmrc` is absent at implementation time, write "Node.js 22 (per `.nvmrc`)" without a patch version and flag it.
- **AES/HMAC "proposal" wording**: brief marks AES-256-GCM, HKDF-SHA256, and HMAC-SHA256 as proposals ("may use any better"). `architecture.md` and `tech.md` must present these as the current intended approach, not finalized, and note the open decision in `context.md`.
- **Monorepo vs root layout**: brief §8 shows `packages/crypto/`; actual repo is a single package at root. `architecture.md` should document the repo-root single-package layout as the chosen structure, noting the brief's monorepo diagram as the conceptual reference. `context.md` records this as an open decision.