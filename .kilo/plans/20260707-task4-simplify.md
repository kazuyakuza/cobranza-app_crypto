# Plan — Task 4: Set Up `package.json` & Dependencies — Step 4.3 Code Simplification

> Critical Workflow sub-step 4.3 (Code Simplification) for TODO `.agent/todos/20260707/20260707-todo-0.md`, task line 4.
> Owner: code-simplifier sub-agent (review + plan only — no code files modified by this step).
> Implementation plan reviewed: `.kilo/plans/20260707-task4-package.md`.

---

## 1. Files Reviewed

| File | Purpose | Source of content |
|---|---|---|
| `package.json` | Manifest, scripts, deps, inline Jest config | Created by Task 4 implementer (matches plan §5.1). |
| `tsconfig.json` | TS compiler config (Node 22, strict) | Created by Task 4 implementer (matches plan §5.2). |
| `.gitignore` | VCS ignore rules | Pre-existing template + Task 4 appended `node_modules/`. |

All three files match the implementation plan §5.1 / §5.2 / §5.5 exactly. No deviations to correct.

---

## 2. Simplification Principles Applied (per project rules)

- **Preserve Existing Code / Functionality**: Only flag changes that preserve behavior and align with the plan's explicit rationale. Pre-existing `.gitignore` template entries (from base-project) are OUT OF SCOPE for this task; only the `node_modules/` addition (Task 4's work) and Task-4-authored configs are eligible.
- **Self-Documenting**: prefer clarity over terse tricks; do not collapse explicit flags that document intent.
- **Security-First**: do not weaken `strict` or `no*` family flags, do not drop `lib` (suppresses DOM), do not relax peer-dep policy.
- **No Magic / DRY**: eliminate duplicated flags that must be kept in sync across multiple scripts.

---

## 3. Analysis & Findings

### 3.1 `package.json`

| Item | Status | Note |
|---|---|---|
| `main` + `types` + `exports["."]` duplication | **Keep** | Plan §3.3 explicitly retains `main`/`types` for legacy/tooling (Jest, older resolvers) fallback. Removing would regress compatibility. Not redundant in practice. |
| `peerDependencies` + `devDependencies` both list `@cobranza-apps/entities` | **Keep** | Standard documented pattern (peer = consumer obligation; dev = local build resolves types). Not duplication — different semantics. |
| `scripts.clean` inline `node -e "require('fs').rmSync(...)"` | **Keep** | Plan §3.6 deliberately chose this to avoid adding `rimraf` dep (brief §2.1 minimal-dep spirit). Quoting is awkward but functional; no safer/cleaner zero-dep alternative exists. |
| `scripts.test` + `scripts.test:watch` BOTH hardcode `--passWithNoTests` | **Simplify** (proposed change S1) | DRY violation: the flag is duplicated and must be edited in two places when Phase 2 removes it. Delegate `test:watch` to `test` so the flag lives in one place. |
| Jest `roots` listing `src` + `tests` | **Keep** | Restricts file discovery to relevant dirs (perf + intent). Defaults to whole `<rootDir>`; explicit list is clearer, not redundant. |
| Jest `moduleFileExtensions` `["ts","js","json"]` | **Keep** | `ts` first is the ts-jest recommendation (default puts `js` first). `json` harmless. Minor; not worth churn. |
| Jest `preset: "ts-jest"` | **Keep** | Minimal; handles TS transform. Spelling out `transform` block would add lines for no gain. |
| `"files": ["dist", "README.md"]` | **Keep** | Correct publish surface (though `private:true` blocks publish; documents intent for monorepo consumers). |

### 3.2 `tsconfig.json`

| Item | Status | Note |
|---|---|---|
| `lib: ["ES2022"]` | **Keep — DO NOT REMOVE** | **Not** redundant with `target`: omitting `lib` causes TS to inject `DOM` + `DOM.Iterable` into the program, violating the no-browser non-goal (brief §10, plan §3.2). Required explicit declaration. |
| `moduleResolution: "Node"` with `module: "CommonJS"` | **Keep** | Technically `module: CommonJS` defaults `moduleResolution` to `Node10` (= `"Node"`), so this is implicit. However, being explicit documents the resolution strategy and protects against future TS default changes. Marginal — prefer keeping for self-documentation. |
| `exclude: ["node_modules", "dist", "tests", "**/*.spec.ts"]` | **Simplify** (proposed change S2) | `node_modules` and `dist` are excluded by `tsc` by default (implicit). Only `tests` and `**/*.spec.ts` are real defensive guards (against accidental src→test imports in Phase 2). Removing the two implicit entries reduces noise without changing behavior. |
| `include: ["src/**/*.ts"]` | **Keep** | Correct; gates the program to `src/`. Combined with project-structure (`tests/` outside `src/`), tests are already excluded from the build — the `exclude` is purely defensive. |
| `strict` + `no*` family flags | **Keep** | Security-first (code-guidelines). Not up for simplification. |
| `types: ["node", "jest"]` | **Keep** (note S3) | Build-only tsconfig technically needs only `node`; `jest` is for IDE/test typings. Single-tsconfig strategy (plan §5.2 note) keeps both intentionally; splitting into `tsconfig.build.json` is a Phase 2 decision, not a Phase 1 simplification. Note only — no change now. |
| `declarationMap: true` on a `private:true` package | **Keep** | Useful for monorepo consumers' IDE source navigation in `.d.ts`. Plan-intentional. |

### 3.3 `.gitignore`

| Item | Status | Note |
|---|---|---|
| Pre-existing OS/log/env/IDE/build/tokens/kilo sections | **OUT OF SCOPE** | From base-project template; preserve-existing-code rule + this task only added `node_modules/`. Not reviewing/altering. |
| `.DS_Store?` unusual pattern (literal `?` wildcard) | **OUT OF SCOPE** (note S4) | Pre-existing, from template. Worth a future cleanup in a dedicated `.gitignore` tidy task, but not part of Task 4's work. Flagged for awareness only — no action here. |
| Appended `# Dependencies` / `node_modules/` block | **Keep** | Task 4's correct addition. Well-placed, single line, conventional. |

---

## 4. Proposed Changes

Two targeted simplifications, both behavior-preserving and aligned with plan rationale.

### S1 — DRY `test:watch` script (`package.json`)

**File:** `package.json`
**Field:** `scripts.test:watch`

**From:**
```json
"test:watch": "jest --watch --passWithNoTests"
```

**To:**
```json
"test:watch": "npm run test -- --watch"
```

**Rationale:**
- `--passWithNoTests` currently appears in both `test` and `test:watch`; when Phase 2 removes it (real tests exist), it must be edited in two places — error-prone.
- Delegating to `npm run test -- --watch` makes `test` the single source of truth; the watch flag is purely additive.
- Behavior is identical: `npm run test` resolves to `jest --passWithNoTests`; `-- --watch` appends `--watch` to that command.
- No new dependency, no new script, no functional change.

**Risk:** Negligible. `npm run <script> -- <args>` is standard npm forwarding.

### S2 — Trim implicit `exclude` entries (`tsconfig.json`)

**File:** `tsconfig.json`
**Field:** `exclude`

**From:**
```json
"exclude": ["node_modules", "dist", "tests", "**/*.spec.ts"]
```

**To:**
```json
"exclude": ["tests", "**/*.spec.ts"]
```

**Rationale:**
- `node_modules` is excluded by `tsc` by default (it is never part of the program unless explicitly referenced).
- `dist` is the `outDir`; `tsc` excludes its own output directory implicitly.
- Only `tests` and `**/*.spec.ts` carry information beyond defaults — they are defensive guards against accidental `src/` → `tests/` imports pulling spec files into the build program once Phase 2 adds real source.
- Removing the two implicit entries reduces noise without changing compiled output.

**Risk:** None. Verified against TS 5.5 defaults: omitting `node_modules`/`dist` from `exclude` does not change program membership when `include: ["src/**/*.ts"]` is restrictive.

### Deferred / No-Action Notes

These are recorded for traceability but intentionally NOT proposed as changes:

- **S3** (note only): `tsconfig.json` `types: ["node", "jest"]` could be split into a build-only `tsconfig.build.json` (`types: ["node"]`) and a test `tsconfig.spec.json` (`types: ["node", "jest"]`) for stricter build isolation. This is a Phase 2 architectural refinement, not a Phase 1 simplification — defer.
- **S4** (note only): `.gitignore` `.DS_Store?` line uses the `?` wildcard oddly; a future `.gitignore` tidy task could standardize macOS patterns to `.DS_Store` + `**/.DS_Store`. Out of scope here (pre-existing template content).
- **Keep decisions** (§3.1/§3.2): all items marked "Keep" are retained because they are either plan-intentional, standard documented patterns, security-required, or self-documentation improvements — removing them would regress clarity or compatibility, violating the preserve-existing / security-first / self-documenting rules.

---

## 5. Verification After Apply (for the implementer)

1. `npm run test --help` shows `test:watch` script resolves correctly (or skip — direct smoke).
2. `npm run test:watch` launches Jest in watch mode and exits cleanly with Crtl+C (no Jest config error, no preset resolution failure).
3. `npm run build` still exits 0 and emits the same `dist/` artifacts (`dist/index.{js,d.ts,...}`, `dist/testing/index.{js,d.ts,...}`).
4. `npm test` still exits 0 ("No tests found", `--passWithNoTests` lives only in `test` now).
5. `git status` confirms only `package.json`, `tsconfig.json` (and any committed `package-lock.json`) are staged — no `dist/`, no `node_modules/`.

---

## 6. Summary

- **Net change count:** 2 targeted simplifications (S1, S2).
- **Lines removed:** ~2 redundant/implicit tokens across two files.
- **Functionality impact:** None — verified behavior-preserving.
- **Plan adherence:** All "Keep" decisions align with `.kilo/plans/20260707-task4-package.md` §3.3, §3.6, §5.2 rationale and the security-first / minimal-dep / no-browser constraints in `brief.md`.
- **No deviations corrected** — the implementer's output already matches the plan exactly.

End of simplification plan.