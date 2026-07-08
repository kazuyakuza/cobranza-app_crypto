# Plan: Task 1 — Project Structure & Package Configuration

- **TODO file**: `.agent/todos/20260707/20260707-todo-1.md` (Task 1 only)
- **Branch**: `feat/crypto-phase1`
- **Plan date**: 2026-07-08
- **Scope**: Fix `tsconfig.json` deprecation, add `lint` script, add `@cobranza-apps/entities` to `dependencies`, create `.eslintrc.json`. NO workspace inclusion (no root monorepo). NO structural file creation (src skeleton handled by other Tasks). Plan + analysis only; implementation is step 4.2.

## 0. Pre-Analysis & Findings (current state)

Executed reads of: `package.json`, `tsconfig.json`, `.gitignore`, `.agent/project-info/*`, `.agent/project-structure.md`, brief/architecture/tech. Glob confirmed NO `.eslintrc*` / `eslint.config.*` exists. `package-lock.json` exists => `npm install` already ran.

Findings:
- `package.json`: name `@cobranza-apps/crypto`, version `0.1.0`, `main/types/exports` already correct (supports `./testing` subpath). Scripts present: `build`, `test`, `test:watch`, `clean`. **Missing**: `lint`.
- `@cobranza-apps/entities` is in `peerDependencies` (`"*"`) AND `devDependencies` (`"*"`) but **NOT in `dependencies`**. Brief §2.1 + TODO require it as BOTH peer + regular dependency.
- `tsconfig.json` currently: `module: "CommonJS"`, `moduleResolution: "Node"`. The `"Node"` alias resolves to `node10`, which TypeScript 5.5+ flags with: `Option 'moduleResolution=node10' is deprecated and will stop functioning in TypeScript 7.0`.
- `.eslintrc*` missing => lint toolchain not configured.

Constraints from brief/tech:
- Node.js 22.14.0 (`.nvmrc`), TypeScript `^5.5.4`, CommonJS output required for NestJS ecosystem compatibility.
- No runtime deps (Node built-in `crypto` only).
- Must stay framework-agnostic; no `process.env` reads in library (not relevant to config task).
- Kilo rules: `max-lines-per-file <=200`, `max-lines-per-method <=50`, `max-arguments <=2`, `max-depth <=2`, single-section boolean conditions, private members by default, no commented code, self-documenting code. The ESLint config below should NOT re-lint these structural rules (Kilo enforces them); ESLint config stays minimal + `@typescript-eslint` recommended.

## 1. Key Technical Decisions

### 1.1 `moduleResolution` migration (deprecation fix)

**Decision**: Set BOTH `module` AND `moduleResolution` to `"NodeNext"` (they MUST be paired — TypeScript enforces TS5110/5046: `moduleResolution: "NodeNext"` requires `module: "NodeNext"`, and you cannot mix `module: "CommonJS"` with `moduleResolution: "NodeNext"`).

**Rationale**:
- `"Node"` = `node10` = the deprecated classic resolver.
- `"Bundler"` requires `module: "esnext"/"preserve"` (not applicable — we emit CJS via `tsc`).
- `"Node16"`/`"NodeNext"` are the modern Node resolvers supporting `package.json` `"exports"`, conditional exports, subpath imports — needed because this package (and the `./testing` subpath) rely on `exports`, and `@cobranza-apps/entities` may use `exports` too.
- CommonJS output is PRESERVED: with `module: "NodeNext"`, emission is determined by the nearest `package.json` `"type"` field. This package has NO `"type"` field => defaults to `"commonjs"` => `.ts` -> `.js` compiled to CommonJS (`require` / `module.exports`). `dist/index.js` stays CommonJS => NestJS compatible. Relative imports do NOT need explicit `.js` extensions under CommonJS output.
- `esModuleInterop: true` remains valid and is independent of the module setting.

**Rejected alternatives (documented as fallback)**:
- `moduleResolution:"Bundler"` — needs `module:"esnext"/"preserve"`; incompatible with emitting CJS via `tsc`.
- Keeping `moduleResolution:"node"` (=node10) + adding `"ignoreDeprecations": "6.0"` — silences the warning until TS 7.0 but is a band-aid; defers real migration. Acceptable as a quick fallback IF `NodeNext` causes friction with `ts-jest` during step 4.2, but NOT the primary plan.

**New `tsconfig.json` `compilerOptions` deltas** (only these two lines change):

```jsonc
{
  "compilerOptions": {
    // target / lib / strict / etc. UNCHANGED
    "module": "NodeNext",          // was "CommonJS"
    "moduleResolution": "NodeNext", // was "Node"
    // ... rest unchanged
  }
}
```

Verification (step 4.2): `npm run build` must succeed and `dist/index.js` must be CommonJS (contain `require(` / `Object.defineProperty(exports, ...)`). Jest: `npm test` must pass with no module resolution errors.

### 1.2 ESLint version + config

**Decision**: ESLint `^8.57.1` (LTS line that still supports `.eslintrc.*` — ESLint 9 removed `.eslintrc` in favor of flat config). Paired with `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` `^7.x` (v7 fully supports ESLint 8.57 and TypeScript 5.5). Minimal, project-local, legacy config format as explicitly requested.

Why NOT ESLint 9 / flat config: the task and TODO explicitly require a `.eslintrc` file. ESLint 9 has removed `.eslintrc*` support (it only reads `eslint.config.js`). ESLint 8.57 is the last line supporting `.eslintrc.json` natively.

**New file `.eslintrc.json`** (exact content):

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json",
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint", "jest"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:jest/recommended"
  ],
  "env": {
    "node": true,
    "es2022": true,
    "jest": true
  },
  "rules": {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }
    ],
    "@typescript-eslint/consistent-type-imports": "warn",
    "no-console": "warn"
  },
  "ignorePatterns": ["dist/", "node_modules/", "coverage/", "*.js"]
}
```

Notes:
- `parserOptions.project` enables type-aware rules; points at `tsconfig.json` (lint source matches compile source).
- `plugin:jest/recommended` + `eslint-plugin-jest` included because Jest is the test runner (TODO Task 4/5). Aligns with the `jest` env.
- Kilo structural rules (file/method line caps, depth, args count, private members) are NOT duplicated here — they are enforced by `.kilo/rules/`. ESLint config stays minimal and concerns only common TS+Jest correctness.
- `ignorePatterns` keeps lint off `dist/`, `node_modules/`, generated JS.

### 1.3 `package.json` changes

Add a `lint` script, add a `dependencies` section with `@cobranza-apps/entities`, and add ESLint dev dependencies. No other field changes (`main`, `types`, `exports`, `files`, `engines`, `jest`, `peerDependencies` already correct).

**Exact edit — `scripts` block becomes**:

```json
  "scripts": {
    "build": "tsc",
    "test": "jest --passWithNoTests",
    "test:watch": "npm run test -- --watch",
    "lint": "eslint \"src/**/*.ts\" \"tests/**/*.ts\"",
    "clean": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\""
  },
```

**Exact edit — add a NEW `dependencies` block** (placed after `peerDependencies`, before `devDependencies`):

```json
  "dependencies": {
    "@cobranza-apps/entities": "*"
  },
```

**Exact edit — `devDependencies` block becomes** (add ESLint packages; keep existing ones):

```json
  "devDependencies": {
    "@cobranza-apps/entities": "*",
    "@types/jest": "^29.5.12",
    "@types/node": "^22.0.0",
    "@typescript-eslint/eslint-plugin": "^7.18.0",
    "@typescript-eslint/parser": "^7.18.0",
    "eslint": "^8.57.1",
    "eslint-plugin-jest": "^28.9.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.4",
    "typescript": "^5.5.4"
  },
```

Note: `@cobranza-apps/entities` is now dual-listed in `peerDependencies` + `dependencies` (as peer + regular dependency, per TODO requirement) and also in `devDependencies` (so it resolves locally in this dev install). Keeping it in both peer + regular `dependencies` is the explicit requirement of this task even though it is unconventional; the implementer MUST NOT remove it from `dependencies`.

## 2. Implementation Steps (for step 4.2 — Implementer)

Each step is atomic, verifiable.

### Step 2.1 — Edit `tsconfig.json`
- Replace line `"module": "CommonJS",` -> `"module": "NodeNext",`.
- Replace line `"moduleResolution": "Node",` -> `"moduleResolution": "NodeNext",`.
- Change NOTHING else. Preserve comments/structure (max-lines rule does not apply to config files; preserve existing comments).
- Verify: read back `tsconfig.json`, confirm only those two values changed.

### Step 2.2 — Edit `package.json`
- Add `"lint"` entry to `scripts` (place after `test:watch`, before `clean`) exactly as in §1.3.
- Add new top-level `"dependencies": { "@cobranza-apps/entities": "*" }` block (after `peerDependencies`, before `devDependencies`).
- Add the four ESLint packages to `devDependencies` (alphabetical) as in §1.3. Do NOT touch other devDeps or version ranges (TODO "upgrade dependencies to last compatible version" is a separate concern — not in this task's explicit requirements; defer to avoid scope creep).
- Verify: `node -e "const p=require('./package.json'); console.log(p.scripts.lint, p.dependencies, p.devDependencies)"`.

### Step 2.3 — Create `.eslintrc.json`
- Create new file `.eslintrc.json` at package root with the exact content in §1.2.
- Verify: file exists at repo root; valid JSON (`node -e "require('./.eslintrc.json')"`).

### Step 2.4 — Install ESLint dev dependencies
Terminal command (run from package root `C:\projects\cobranza-app\crypto`):

```
npm install --save-dev eslint@^8.57.1 @typescript-eslint/parser@^7.18.0 @typescript-eslint/eslint-plugin@^7.18.0 eslint-plugin-jest@^28.9.0
```

- The `dependencies` entry for `@cobranza-apps/entities` is a workspace/private package; if npm fails to resolve it from a registry, that is a PRE-EXISTING concern already handled by the current `devDependencies` install (package-lock present). Do NOT install `@cobranza-apps/entities` from a public registry — leave the `dependencies` field as-is; npm links the existing dev installation.
- Gitignore compliance: after install, run `git status` and confirm `node_modules/` is NOT staged (`node_modules/` is gitignored). Nothing new should be staged except config edits.

### Step 2.5 — Verify
Run in order; all must pass:
1. `npm run build` => exits 0; `dist/index.js` exists; `dist/index.js` is a CommonJS module (contains `require(`). Check: `head -n 5 dist/index.js`.
2. `npm run lint` => exits 0 (the only source right now is `src/**/*.ts` skeleton files; if they emit lint errors, fix trivial ones here only if they block the CLI, otherwise defer to the relevant task; document).
3. `npm test` => exits 0 (`--passWithNoTests`).
4. `git status` => only `tsconfig.json`, `package.json`, `package-lock.json`, `.eslintrc.json` changed/untracked. No `node_modules/`, no `dist/`.

If `NodeNext` causes a `ts-jest` resolution error in step 4 (e.g., extension-required complaints), apply fallback: revert both to `module:"CommonJS"` + `moduleResolution:"node"` and add `"ignoreDeprecations": "6.0"`; re-verify. Document which path was taken.

## 3. Git Actions (Step 4.2 — Implementer)

Branch already `feat/crypto-phase1` (set by step 2 of Critical Workflow). No new branch.

Commit message:

```
chore(crypto): add ESLint + lint script, list entities as dependency, migrate tsconfig to NodeNext

- tsconfig.json: module/moduleResolution node10->NodeNext (fix TS5.5 deprecation warning; CommonJS output preserved via package.json no type:module).
- package.json: add lint script, add @cobranza-apps/entities to dependencies (peer + regular, per brief ID 2.1), add eslint + @typescript-eslint + eslint-plugin-jest devDeps.
- .eslintrc.json: minimal type-aware @typescript-eslint + jest config on ESLint 8.57 (eslintrc format per task requirement).
```

Gitignore compliance before commit:
- Read `.gitignore`, run `git status`.
- Stage ONLY: `tsconfig.json`, `package.json`, `package-lock.json`, `.eslintrc.json`.
- Confirm `node_modules/`, `dist/`, `.env*` not staged. Unstage if found.

## 4. Test/Build Steps Summary

| Command | Expected |
|---|---|
| `npm run build` | exit 0; `dist/index.js` CommonJS |
| `npm run lint` | exit 0 (config loads; no config errors) |
| `npm test` | exit 0 (`--passWithNoTests`) |
| `git status` | only intended files staged |

## 5. Code Review / Verification Hooks (Steps 4.3 / 4.5)

For reviewer/architect verification:
- Confirm `tsconfig.json` has exactly two changed values (`module`, `moduleResolution`) and nothing else.
- Confirm `package.json` has: `scripts.lint`, `dependencies.@cobranza-apps/entities`, four ESLint devDeps, and `@cobranza-apps/entities` still also in `peerDependencies` + `devDependencies` (NOT removed).
- Confirm `.eslintrc.json` exists at root, is valid JSON, sets `root:true`, references `@typescript-eslint/parser`, extends `eslint:recommended` + `plugin:@typescript-eslint/recommended` + `plugin:jest/recommended`.
- Confirm no workspace/engine field was added (no root monorepo).
- Confirm no `node_modules/` or `dist/` staged.
- Confirm CommonJS output preserved (`dist/index.js` uses `require`).

## 6. Documentation Updates (Step 4.4 — Docs Specialist)

- Update `.agent/project-info/tech.md` "Scripts (planned)" -> mark `lint` as configured (Phase 1, not Phase 2) and note ESLint 8.57 + `@typescript-eslint` v7 + `.eslintrc.json`.
- Update `.agent/project-info/context.md` (closing step per instructions.md): record Task 1 config changes (tsconfig NodeNext migration, lint script, entities in dependencies, eslintrc added) under "Recent Changes".
- No README change required by this task (README handled in Task 5). Avoid scope creep.

## 7. What Is NOT In Scope (explicitly)

- Creating directory structure / src skeleton files (Task 1 directory item — already present per glob of `src/*`).
- Implementing config.ts / hkdf.ts / crypto.service.ts / utils.ts / testing (Task 2/3/4).
- README / .gitignore content edits (Task 5) — only `git status`/gitignore compliance checks here.
- Upgrading all dependency versions (TODO mentions "upgrade to last compatible version" generically; this task only adds ESLint deps at compatible versions and migrates the resolver; bulk version bumps are NOT required by the explicit sub-task requirements and are deferred to avoid scope creep).
- No monorepo workspace inclusion (confirmed by caller: not applicable).

## 8. Risks / Edge Cases

- `module:NodeNext` may surface extension-required errors IF any source file uses ESM-style relative imports — not the case for CJS output (package.json has no `type:"module"`). Mitigation: fallback to `ignoreDeprecations:"6.0"` per §1.1.
- `ts-jest` v29 with `module:"NodeNext"`: supported; if any isolatedModules/extension complaint arises, fallback above applies.
- `@cobranza-apps/entities` is private/unpublished; `npm install` must NOT pull it from npm registry — it resolves via existing dev install / package-lock. Implementer must not run `npm install @cobranza-apps/entities` (no registry install); only edit the `dependencies` field.
- `.eslintrc.json` on ESLint 8.57: `plugin:jest/recommended` requires `eslint-plugin-jest` installed (Step 2.4 installs it). If it were absent, lint would fail to load config — covered by install step.