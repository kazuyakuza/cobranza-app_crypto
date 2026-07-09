# Plan — Task 5: Final Quality & Build (4.1 Analysis & Planning)

> TODO: `.agent/todos/20260707/20260707-todo-2.md` (Task 5)
> Branch: `feat/phase2-crypto-implementation`
> Date: 2026-07-08

## 1. Task Statement

From TODO Task 5 (lines 77–80):

- `[ ] Ensure the package builds cleanly (tsc).`
- `[ ] Run linting and fix any issues.`

Acceptance: clean `tsc` build, clean `eslint` run, no leftover artifacts, working tree committable. No new features.

## 2. Pre-Analysis (Current State Verification)

Read-only findings gathered during planning (no bash execution was permitted in this step — actual command execution is delegated to step 4.2):

### 2.1 Tooling configuration (verified by reading files)

- `package.json` scripts:
  - `build`: `tsc`
  - `lint`: `eslint . --ext .ts`
  - `test`: `jest --coverage`
  - `clean`: removes `dist/`
- `tsconfig.json`:
  - `rootDir: ./src`, `outDir: ./dist`
  - `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`
  - `include: ["src/**/*.ts"]`, `exclude: ["tests", "**/*.spec.ts"]` — **tests are NOT compiled by `tsc`** (lint covers tests via `tsconfig.eslint.json`).
- `.eslintrc.json` (ESLint 8 + `@typescript-eslint` v7 + `eslint-plugin-jest` v28):
  - `parserOptions.project: ./tsconfig.eslint.json` (type-aware linting across `src` + `tests`)
  - rules: `no-unused-vars` (error, `_`-prefixed exempt), `consistent-type-imports` (warn), `no-console` (warn)
  - `ignorePatterns: ["dist/", "node_modules/", "coverage/", "*.js"]`
- `.gitignore` includes: `dist/`, `coverage/`, `node_modules/`, `.env*`, `.kilo/agent-manager.json`.

### 2.2 Source inventory (verified)

- `src/`: `index.ts`, `config.ts`, `crypto.service.ts`, `crypto.service.validation.ts`, `crypto.service.keys.ts`, `crypto.service.encryption.ts`, `crypto.service.hashing.ts`, `crypto.service.guards.ts`, `hkdf.ts`, `hkdf.types.ts`, `utils.ts`, plus `src/testing/` (`index.ts`, `test-vectors.ts`, `encrypted-shape.ts`).
- `tests/`: 5 spec files (`crypto.service.spec.ts`, `crypto.internals.spec.ts`, `crypto.encrypt-decrypt.spec.ts`, `crypto.hashing.spec.ts`, `payload-mutators.ts`).
- `docs/`: `README.md`, `how-to-configure-in-nestjs.md`, `testing-utilities.md`, plus legacy Phase-1 docs (`how-to-write-todo-files.md`, `how-to-set-up-git.md`).

### 2.3 Hygiene checks performed (read-only)

- `grep` for `TODO|FIXME|XXX|HACK|@ts-ignore|@ts-expect-error|console.(log|debug)` in `src/` → **no matches**.
- `grep` for `console.|debugger|@ts-ignore|@ts-expect-error` in `tests/` → **no matches**.
- `grep` for `process.env` in `src/` → **11 matches, all inside JSDoc comments / example blocks** (no runtime reads). Compliant with brief §7 ("No `process.env` loading inside the library").
- `glob` for `dist/**` and `coverage/**` → **none present** (clean working tree, no stale build artifacts).
- `.git/HEAD` → branch `feat/phase2-crypto-implementation` checked out (expected feature branch from Critical Workflow step 2).

### 2.4 Risk Assessment

- Prior steps report `npm run build`, `npm test` (124 tests, 100% coverage), `npm run lint` all green. Planning-time evidence corroborates a clean codebase.
- Residual risks to actively verify in 4.2:
  1. **Stale `tsc` errors** only surface at compile time (not via lint). Must run `npm run build` directly — do NOT assume lint success implies build success.
  2. **Lint warnings**: `consistent-type-imports` and `no-console` are `warn`, not `error`. ESLint exits 0 on warnings. The plan must surface warnings for decision (fix vs. accept) even when exit code is 0.
  3. **`.js` extension in relative imports** is required under `module: NodeNext`; an import missing `.js` is a `tsc` error (TS2834/TS2791). Verify build catches any latent regression.
  4. **`dist/` regeneration**: if a previous step left `dist/` staged, the Gitignore Compliance Rule requires it be unstaged. (Planning-time check found no `dist/`, so likely none — but verify before commit.)

## 3. High-Level Approach

Three discrete, ordered activities; each must be executed, observed, and the result recorded before proceeding:

1. **Clean build** — remove any `dist/`, run `npm run build`, confirm zero TS diagnostics and `dist/` emitted.
2. **Lint sweep** — run `npm run lint`, treat exit code 0 as pass but explicitly extract any `warn`-level findings and either fix them or document acceptance.
3. **Regression confirmation** — run `npm test` to guarantee the build/lint actions did not introduce regressions; then run `npm run build` again after any fix to ensure the source-tree and built output stay consistent.
4. **Commit + context update** — commit any fixes (or skip the commit if zero source changes), update `.agent/project-info/context.md`, and mark Task 5 `[DONE]`.

No code changes are pre-planned. Fixes (if any) are reactive to what 4.2 uncovers and must remain strictly scoped to removing the reported diagnostic — no feature work, no refactors.

## 4. Detailed Step Plan

### Step 4.2-A — Environment sanity & build

**Owner**: implementer (4.2 step).

4.2-A.1. Confirm working tree state without mutating:

```
git status --short --branch
git diff --stat
```

- Expected output: clean tree (no `M`/`??` beyond this step's own plan-less scope) on branch `feat/phase2-crypto-implementation`. If something is unexpectedly dirty, **stop and return question to caller** — do NOT commit unrelated changes.

4.2-A.2. Remove any stale build artifacts (idempotent):

```
npm run clean
```

- Then confirm `dist/` absent: `Test-Path dist` (PowerShell) → should be `False`.

4.2-A.3. Run the production build:

```
npm run build
```

- **PASS criterion**: exit code `0` AND zero diagnostic lines printed by `tsc` (no TS errors, no warnings — `tsc` reports both as diagnostics under `strict`).
- **FAIL handling**: capture the FULL diagnostic output; do not edit blindly. Diagnose each TS error:
  - `TS2834` / `TS2791` (missing `.js` in relative import) → add the `.js` suffix to the offending import in the source file under `src/`.
  - `TS2554` / `TS2345` / type mismatch → read the referenced file, fix at the source per self-documenting-code and max-lines-per-method rules. Do NOT silence with `as any` or `@ts-ignore`.
  - `TS6133` unused → remove the unused symbol (do not prefix with `_` unless it is a genuine intentional callback parameter).
  - Each fix must keep the modified file ≤200 lines (max-lines-per-file rule) and the modified method ≤50 lines (max-lines-per-method rule). If a fix would exceed, extract.
- After each fix, re-run `npm run build`. Repeat until exit code `0` with no output.
- Confirm `dist/` exists and contains `index.js`, `index.d.ts`, `testing/index.js`, `testing/index.d.ts` (the package `exports` map targets). Use `npm run clean` only if a rebuild is needed mid-fix.

### Step 4.2-B — Lint sweep with warning extraction

4.2-B.1. Run lint capturing all output:

```
npm run lint
```

- Use a form that preserves the full report (do not truncate). **PASS criterion**: exit code `0`.
- Even when exit code is `0`, **manually inspect the output for `warn` lines**.

4.2-B.2. Decision policy for warnings (apply in order):

  - **`consistent-type-imports`** warnings (`import type` should be used for type-only imports) → **fix** by splitting the import into a value `import` + a type-only `import type`. Risk-free, improves tree-shaking clarity. Example:
    ```ts
    // before
    import { EncryptionKey, type CryptoConfig } from './config.js';      // already correct — but mixed-only-type should be split
    // after (when only the type is used)
    import type { CryptoConfig } from './config.js';
    ```
    Re-run lint after the fix.
  - **`no-console`** warnings → **fix** by removing the `console.*` call. In a cryptography library there is no valid runtime `console` usage. If the call is inside `src/testing/` and is genuinely required for a test helper, escalate to the caller instead of suppressing.
  - If a warning cannot be removed without changing behavior, **stop and return question to caller** — do NOT add `// eslint-disable` comments as a first resort.

4.2-B.3. Re-run lint after every fix; converge to **zero warnings** or escalate. Record the final lint output as the verification artifact.

### Step 4.2-C — Regression gate

4.2-C.1. Run the test suite (ensures build/lint changes did not regress behavior):

```
npm test
```

- **PASS criterion**: exit code `0`, all tests green, coverage thresholds met (global ≥85% statements/branches/functions/lines; prior baseline 124 tests / 100% coverage).
- **FAIL handling**: the only reason for a regression here would be a reactive fix from 4.2-A/4.2-B. Re-read the failing test and the changed source; correct the source (NOT the test) unless the test itself violates a project rule. Escalate to caller if unclear.

4.2-C.2. Re-run the build once more to guarantee the final tree compiles after any fixes:

```
npm run clean
npm run build
```

- Confirm exit code `0` and `dist/` re-emitted.

### Step 4.2-D — Gitignore compliance & commit

4.2-D.1. Read `.gitignore` (content listed in plan) and run:

```
git status --short
```

- Verify NO tracked-staged file matches a `.gitignore` pattern: specifically `dist/`, `coverage/`, `node_modules/`, `.env*`, `.kilo/agent-manager.json`. If any appear staged, **unstage** with `git restore --staged <path>` and do not commit them. (Expected: none, since `dist/`/`coverage/` are gitignored and 4.2 re-creates `dist/` only locally.)

4.2-D.2. If any source fix was applied in 4.2-A/4.2-B, stage ONLY the changed files (not `dist/`, not `coverage/`):

```
git add <list of changed src/ and/or tests/ files only>
git status --short        # verify staged set
```

- Commit with a concise message following repo style. Suggested: `chore: fix lint/build issues for phase 2 final quality` — or, if zero changes were needed, skip the commit (do NOT create an empty commit).

### Step 4.4 relevant (docs step) — context.md update

- Per `.agent/project-info/instructions.md` "Critical Closing Step": update `.agent/project-info/context.md` to record Phase 2 Task 5 completion (clean build/lint/test verified), current state (release-ready `@cobranza-apps/crypto`), and next steps (Critical Workflow step 5: TODO file completion + branch merge to `main`). This belongs to the 4.4 docs step — flag it here so it is not missed.

### Step 4.6 relevant — mark Task 5 done

- In `.agent/todos/20260707/20260707-todo-2.md`, change line 79 (`- [ ] Ensure the package builds cleanly (`tsc`).`) → `- [x] ...` and line 80 (`- [ ] Run linting and fix any issues.`) → `- [x] ...`.
- Preserve all other file content unchanged. Commit the TODO edit (e.g. `chore: mark phase 2 task 5 done`).

## 5. Verification Criteria (Definition of Done for Task 5)

- [ ] `npm run build` exits `0` with no diagnostic output; `dist/index.js`, `dist/index.d.ts`, `dist/testing/index.js`, `dist/testing/index.d.ts` exist.
- [ ] `npm run lint` exits `0` AND output contains zero `warn`/`error` lines (or each unfixed warning is explicitly escalated to the user with rationale).
- [ ] `npm test` exits `0`; test count and coverage ≥ prior baseline (124 tests, ≥85% thresholds).
- [ ] Working tree contains no staged `dist/`, `coverage/`, `node_modules/`, `.env*`, or `.kilo/agent-manager.json`.
- [ ] Any source fixes committed with meaningful messages; `dist/` left untracked/gitignored (not committed).
- [ ] `.agent/project-info/context.md` updated to reflect Phase 2 completion.
- [ ] TODO file Task 5 sub-items marked `[x]` and committed.

## 6. Out of Scope (Explicit)

- No new tests, no new source features, no refactors beyond fixing reported diagnostics.
- No change to `package.json` version (no bump in Task 5; version was handled in Critical Workflow step 3).
- No `README`/`docs` content edits — those were completed in Task 4.
- No git push (push happens in Critical Workflow step 5).
- The 4.3 (code review/simplifier), 4.4 (docs), 4.5 (verification), and 4.6 (completion) sub-steps are separate `task` invocations — this plan covers 4.1 only and hands off.

## 7. Ambiguities / Questions

None. `bash` execution was blocked during this planning step by permission rules (deny `*` catch-all); execution of the commands listed in §4 is delegated to the implementer sub-agent in step 4.2, where build/lint/test command patterns are explicitly permitted.