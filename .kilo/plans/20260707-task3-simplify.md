# Plan: Task 3 — Step 4.3 Code Simplification (NO-OP)

> Code-simplifier sub-agent output for Critical Workflow Task 3.
> TODO: `.agent/todos/20260707/20260707-todo-0.md` line 3 — "define project structure".
> Source commit under review: `ac308f0 feat: scaffold src/ project structure with placeholder modules` on branch `feat/crypto-library-setup`.

## 1. Scope Reviewed

- `.agent/project-structure.md`
- Placeholder source modules created in Step 4.2:
  - `src/index.ts`
  - `src/config.ts`
  - `src/crypto.service.ts`
  - `src/hkdf.ts`
  - `src/utils.ts`
  - `src/testing/index.ts`
  - `src/testing/test-vectors.ts`
- `tests/.gitkeep`
- Removal of `src/.gitkeep`

## 2. Simplification Analysis

### 2.1 Placeholder file content

Every new `src/**/*.ts` file contains exactly `export {};` — a valid empty ES module. There is no logic, no duplication, no dead code, no commented-out code, and no nested structure. Nothing can be reduced further without removing a required module.

### 2.2 Folder / file set vs. brief

`brief.md` §8 enumerates the exact module set this task scaffolds:

- `index.ts`, `config.ts`, `crypto.service.ts`, `hkdf.ts`, `utils.ts`, `testing/index.ts`, `testing/test-vectors.ts`.

The implemented set matches one-to-one. Per `code-guidelines.md` rule 5 (Preserve Existing Code) and brief adherence, no files may be merged, renamed, or removed without contradicting the brief.

### 2.3 Naming

Names are self-documenting and align with brief §8 / `architecture.md` Component Map:

- `crypto.service.ts` → `SecureCrypto` class (NestJS-style `.service` suffix is conventional and matches the brief's NestJS usage).
- `hkdf.ts` → HKDF-SHA256 derivation (single responsibility).
- `utils.ts` → shared helpers (brief §8 explicitly lists this file).
- `testing/` subpath → maps to `@cobranza-apps/crypto/testing` subpath import (brief §6).

No rename improves clarity.

### 2.4 `project-structure.md`

Document follows `.kilo/commands/project-structure.md` format:

- `# Folders in src/` section lists `src/testing/` (the only `src` subfolder).
- `# Other folders` section lists `.kilo/modes/`, `docs/`, `tests/`.
- Only folders are documented (not files), per the command spec.

No consolidation opportunity. Adding file-level entries would violate the documented format.

### 2.5 Git layout

- Single root-level package (NOT the `packages/crypto/` monorepo diagram in brief §8). This was the chosen structure recorded in `context.md` ("Open Questions / Decisions Pending"). No simplification action here — flagging only.
- `tests/.gitkeep` is the minimal tracker for the empty unit-tests folder; removed once Phase 2 adds real tests. Keeping it is the minimal correct approach.
- `src/.gitkeep` correctly removed (superseded by real `.ts` files).

### 2.6 Rule compliance check (placeholders)

| Rule                                  | Status |
|---------------------------------------|--------|
| max-lines-per-file (≤200)             | Pass (1 line each) |
| max-lines-per-method (≤50)            | N/A (no methods) |
| max-depth (≤2)                        | Pass (depth 0) |
| max-arguments-per-method (≤2)         | N/A (no methods) |
| single-section-boolean-conditions     | N/A (no conditions) |
| prefer-private-members                | N/A (no members) |
| no-commented-code                      | Pass (no comments) |
| self-documenting-code                 | Pass (file/module names are descriptive) |
| newline-prevention                    | Pass (single-line files, real newline) |

All rules pass for the placeholder state. Real logic lands in Phase 2 and will be re-reviewed then.

## 3. Conclusion — NO CHANGES NEEDED

No simplification changes are warranted for Task 3 Step 4.2 output. The placeholders are already minimal, the module set and naming are mandated by `brief.md` §8, and `.agent/project-structure.md` follows the documented format. Additional scrutiny (depth, args, private members, conditions) is deferred to Phase 2 when real cryptographic logic is introduced.

## 4. Recommended Action for Plan Agent

- **4.3-fix step**: skip (no fix plan to apply).
- Proceed directly to Step 4.4 (Documentation) for Task 3.

## 5. Out of Scope

- Cryptographic logic, JSDoc, real test vectors (Phase 2).
- `package.json` / `tsconfig.json` / Jest config (Task 4).
- `.gitignore` hardening (Task 4 flag, not this task).
- `architecture.md` Component Map sync (handled by Step 4.4 docs-specialist if mismatch found — pre-check showed it already mirrors the layout).