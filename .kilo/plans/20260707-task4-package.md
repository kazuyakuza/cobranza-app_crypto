# Plan — Task 4: Set Up `package.json` & Install Dependencies

> Critical Workflow sub-step 4.1 (Analysis & Planning) for TODO `.agent/todos/20260707/20260707-todo-0.md`, task line 4:
> "set up and configure package json. add and install dependencies".
>
> Owner: Architect sub-agent (plan only — no code files written by this step).

---

## 1. Task Scope & Boundaries

**In scope (this plan):**
- Author `package.json` (config + dependency declarations + lifecycle scripts).
- Author `tsconfig.json` (compiler configuration for Node 22).
- Run `npm install` to materialize `node_modules/` and `package-lock.json`.
- Verify `node_modules/` is gitignored-compliant (it is — `dist/`, logs, etc. covered; confirm `node_modules/` entry — see §6).
- Smoke-check: `npm run build` (must succeed even with empty `src/` — verify safe), `npm test` (must report "no tests found" cleanly, not a hard error).

**Out of scope (defer to later sub-steps / tasks):**
- Implementing `src/` library source (Phase 2).
- Writing unit tests (Phase 2).
- README / docs updates (handled in docs step).
- Builder library selection beyond `tsc` (brief §2.1 mandates no extra runtime deps; `tsc` is sufficient).
- ESLint/Prettier (brief/tech.md Phase 2 — `lint` script is placeholder/stubbed here, not configured).

---

## 2. Inputs Reviewed

| Source | Used for |
|---|---|
| `.agent/project-info/brief.md` §2.1 | Dependencies policy (peer `@cobranza-apps/entities`, runtime Node `crypto` only, dev TS+Jest+types). |
| `brief.md` §6 | `testing` subpath export requirement (`@cobranza-apps/crypto/testing`). |
| `brief.md` §8 | Conceptual package layout (adapted to root-level single package). |
| `brief.md` §2.2, §4, §5 | Confirms `EncryptedValue` lives in `@cobranza-apps/entities` (no local interface duplication this step). |
| `.agent/project-info/tech.md` | Runtime Node 22.14.0; `@types/node`; scripts `build`/`test`/`test:watch`/`lint`; build output `dist/` (gitignored); package manager npm. |
| `.agent/project-info/architecture.md` | Component map → `src/`, `src/testing/`, `tests/`, `dist/`, `docs/`. Confirms testing subpath source at `src/testing/index.ts` → output `dist/testing/index.js`. |
| `.agent/project-structure.md` | `src/`, `src/testing/`, `tests/`, `docs/` confirmed present. |
| `.nvmrc` | `22.14.0` → governs ESLint/lib targets. |

---

## 3. Technical & Architecture Decisions

### 3.1 Module system: CommonJS (not ESM)

- **Decision**: Omit `"type": "module"`; `tsconfig` `module: CommonJS`, `moduleResolution: Node`.
- **Rationale**:
  1. `ts-jest` runs seamlessly on CommonJS without ESM transforms (`transform`/`extensionsToTreatAsEsm`) — avoids Jest 29 ESM friction.
  2. NestJS consumers (primary downstream, per brief) are CommonJS-native.
  3. Node 22 fully supports CommonJS; no functional loss for this library.
- **Trade-off**: ESM dual-publish is deferred. If later required, revisit in a new TODO (Phase 2+). This is a safe, conservative baseline.

### 3.2 Target & lib: `ES2022`

- `target: ES2022` aligns with Node 22 stable feature surface (top-level await not needed; `crypto.webcrypto` available via globalThis without polyfill).
- `lib: ["ES2022"]` (no DOM libs — Node-only, confirms brief §10 non-goal "no browser support").
- `@types/node ^22` provides `crypto` module typings.

### 3.3 Dual `exports` subpaths

- `.` → `dist/index.js` (+ `.d.ts`) — main library.
- `./testing` → `dist/testing/index.js` (+ `.d.ts`) — test utilities (brief §6).
- Use `exports` (Node resolution) **and** keep `main`/`types` for legacy/tooling fallback (TypeScript IDE resin, Jest, etc.).
- Order inside each condition object: `"types"` before `"default"` per modern convention.

### 3.4 Dependency placement

- `peerDependencies`: `@cobranza-apps/entities` (consumer supplies it; brief §2.1 "Required peer/regular dependency" → peer is the safer choice to avoid duplicate copies/instance issues with interfaces).
- `dependencies`: **empty / omitted** — runtime is Node built-in `crypto` only (brief §2.1). Omitting the key intentionally signals zero runtime deps.
- `devDependencies`: `typescript`, `@types/node`, `jest`, `ts-jest`, `@types/jest`.

> Task prompt lists devDependencies: typescript, jest, `@types/jest`, ts-jest. `tech.md` additionally requires `@types/node` (needed for `node:crypto` typings under Node 22 + `types: ["node"]`). I include `@types/node` — required for a buildable target ES2022 + strict config. Confirm.

### 3.5 Version ranges (caret, conservative stable as of plan date)

| Package | Range | Rationale |
|---|---|---|
| typescript | `^5.5.4` | Stable 5.5 line; supports `moduleResolution: Node`, declaration maps, project references. |
| @types/node | `^22.0.0` | Matches `.nvmrc` 22.x. |
| jest | `^29.7.0` | Most stable + best `ts-jest` interop; Jest 30/ts-jest 30 not yet mainstream-stable at plan time. |
| ts-jest | `^29.1.4` | Paired with Jest 29.x. |
| @types/jest | `^29.5.12` | Jest 29 type defs. |
| @cobranza-apps/entities | `*` (peer) | Version coordination internal to Cobranza monorepo; lock to specific range once entities package publishes its contract (Phase 2). Use `*` peer range to avoid resolution failures during install when the package is not yet published. |

### 3.6 Scripts

- `build`: `tsc` (compiles `src/` → `dist/` per tsconfig).
- `test`: `jest` (uses ts-jest transform; root pattern `tests/**/*.spec.ts`).
- `test:watch`: `jest --watch` (matches tech.md planned script).
- `clean`: `node -e "require('fs').rmSync('dist',{recursive:true,force:true})"` — cross-platform, **no extra dependency** (keeps devDependencies minimal per brief §2.1 spirit).
- `lint`: stub `echo \"lint: not configured (Phase 2)\" ` **omitted for now** — to avoid implying a working lint. Decision: do NOT add `lint` script yet (tech.md marks it Phase 2). Plan option: leave it out; Implementer may add the placeholder only if reviewer agrees. Default: skip.

### 3.7 Jest config location

- Inline minimal `jest` block inside `package.json` (no separate `jest.config.ts`) — fewer files, satisfies brief §8 minimal skeleton. Keeps plan atomic.
- `preset: "ts-jest"` handles TS transform.
- `testEnvironment: "node"` (no jsdom; Node-only per brief §10).
- `testMatch`: `["**/tests/**/*.spec.ts"]` (matches `tests/` folder from structure doc).
- `roots`: `["<rootDir>/src", "<rootDir>/tests"]` (allows importing `src` source).
- `collectCoverageFrom` deliberately omitted (Phase 2 with coverage thresholds).

### 3.8 Build-smoke with empty `src/`

- `src/` currently holds only `.gitkeep`. `tsc` with no `.ts` files in `src/` produces empty `dist/` and exits 0 (treats nothing-to-do as success). However, to keep the build meaningful and the `exports` paths resolvable, this plan adds **two tiny placeholder entry files** (`src/index.ts` and `src/testing/index.ts`) with just `export {};`.
- **Wait**: that is source creation. This task is "set up and configure package json. add and install dependencies." Adding 2 stub entry files is borderline scope creep but is **required**:
  1. So `npm run build` actually emits `dist/index.js` and `dist/testing/index.js`, validating the `exports` map end-to-end at install time.
  2. So `npm test` can import resolvable paths in Phase 2 without re-touching manifest config.
- **Decision**: Include the two stub entry files as part of this task — they are the minimal viable dependency-configuration validation surface. They contain only `export {};` and a 1-line JSDoc placeholder; real exports come in Phase 2. This is consistent with "configure package json" (exports must point at real artifacts).
- **Alternative (lower-scope)**: Do NOT add stubs; instead smoke build by temporarily creating then deleting. Not preferred — leaves nothing for `exports` to resolve, making the configuration unverifiable in this step.

> If the Implementer disagrees with stub files, escalate to caller (do not unilaterally drop them; they're load-bearing for `exports` validation).

### 3.9 `.gitignore` additions

- Current `.gitignore` covers `dist/`, `.env*`, logs, OS files. It **does NOT** ignore `node_modules/` or `package-lock.json`.
- **Decision**: Add `node_modules/` (must — never commit deps). Keep `package-lock.json` **tracked** (commit it) — npm recommended practice for libraries; ensures reproducible installs.
- Also add `.npm/` and `.npmrc` (local) defensively? No — not needed; avoid bloat.
- This `.gitignore` edit is part of "configure package json" pipeline (gitignore compliance rule requires verifying before commit). Plan includes the one-line addition.

---

## 4. High-Level Approach

1. Verify working tree clean / on feature branch `feat/task4-package-config` (per Critical Workflow §2 — handled by Implementer, noted here for context).
2. Add `node_modules/` to `.gitignore`.
3. Create two stub entry files (`src/index.ts`, `src/testing/index.ts`) so `exports`/build path is verifiable.
4. Create `package.json` with the exact content in §5.
5. Create `tsconfig.json` with the exact content in §5.
6. Run `npm install` (installs devDependencies; peer install handled in §6).
7. Smoke verify:
   - `npm run build` → `dist/index.js` + `dist/testing/index.js` exist.
   - `npm test` → clean "No tests found" (exit 1 by Jest default — acceptable informational state; OR add a trivial passing test? No — tests are Phase 2). Plan accepts Jest non-zero exit for "no tests" as expected at this stage; Implementer should not treat it as a failure **but** should still run it to surface config errors (e.g. ts-jest preset resolution). To make smoke pass cleanly, optionally add `--passWithNoTests` to the `test` script? **Decision**: include `--passWithNoTests` so CI/verification returns 0. Document this.
8. Update `.agent/project-info/context.md` "Current State" to reflect `package.json`/`tsconfig.json` now exist (docs step typically does this; but minimal context refresh recommended here — see §8).
9. Commit with conventional message.

---

## 5. Exact File Contents

### 5.1 `package.json`

```json
{
  "name": "@cobranza-apps/crypto",
  "version": "0.1.0",
  "description": "Shared encryption (AES-256-GCM + HKDF) and deterministic hashing (HMAC-SHA256) library for Cobranza App microservices.",
  "license": "UNLICENSED",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./testing": {
      "types": "./dist/testing/index.d.ts",
      "default": "./dist/testing/index.js"
    }
  },
  "files": [
    "dist",
    "README.md"
  ],
  "engines": {
    "node": ">=22.14.0"
  },
  "scripts": {
    "build": "tsc",
    "test": "jest --passWithNoTests",
    "test:watch": "jest --watch --passWithNoTests",
    "clean": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\""
  },
  "peerDependencies": {
    "@cobranza-apps/entities": "*"
  },
  "devDependencies": {
    "@cobranza-apps/entities": "*",
    "@types/jest": "^29.5.12",
    "@types/node": "^22.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.4",
    "typescript": "^5.5.4"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "roots": [
      "<rootDir>/src",
      "<rootDir>/tests"
    ],
    "testMatch": [
      "**/tests/**/*.spec.ts"
    ],
    "moduleFileExtensions": [
      "ts",
      "js",
      "json"
    ]
  }
}
```

Notes:
- `"private": true` prevents accidental `npm publish` of an internal monorepo package (security-first; brief §7).
- `@cobranza-apps/entities` is declared in **both** `peerDependencies` (consumer obligation) **and** `devDependencies` (so local `tsc` + tests can resolve types). This is the standard pattern for peer deps that must also be available for dev/build. Range `*` until entities publishes a real version; tightening to a real range is a Phase 2 TODO.
- `--passWithNoTests` keeps `npm test` green during Phase 1 (no tests yet). Remove in Phase 2 once `tests/*.spec.ts` exist.

### 5.2 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "CommonJS",
    "moduleResolution": "Node",
    "rootDir": "./src",
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["node", "jest"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests", "**/*.spec.ts"]
}
```

Notes:
- `strict` + the `no*` family flags align with security-first code guidelines (`.kilo/rules/code-guidelines.md`).
- `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` harden crypto decisions (optional fields, buffer indexing). May surface stricter TS errors in Phase 2 — acceptable; design for it now.
- `types: ["node","jest"]` limits global types to Node + Jest (no DOM leakage; supports the no-browser non-goal).
- `tests/` excluded from the **build** `tsconfig` (it's compiled/run by ts-jest, not by `tsc` build). A future `tsconfig.build.json`/`tsconfig.spec.json` split can be added in Phase 2 if needed; one-file config is sufficient here.

### 5.3 `src/index.ts` (stub, Phase 1)

```ts
/**
 * Public entrypoint for `@cobranza-apps/crypto`.
 * Real exports (SecureCrypto, CryptoConfig, EncryptionKey) land in Phase 2.
 */
export {};
```

### 5.4 `src/testing/index.ts` (stub, Phase 1)

```ts
/**
 * Public entrypoint for the `@cobranza-apps/crypto/testing` subpath.
 * Real exports (getTestCrypto, SecureCryptoTestModule, test-vectors) land in Phase 2.
 */
export {};
```

### 5.5 `.gitignore` (addition — append these lines)

Append at end of file:

```
# Dependencies
node_modules/
```

Do **not** add `package-lock.json` (keep it tracked). Do **not** remove any existing entries (gitignore-compliance + preserve-existing-code rules).

---

## 6. Install & Run Steps (exact console commands)

> All commands run from repo root `C:\projects\cobranza-app\crypto`. Use the `bash` tool with `npm install`/`npm run` (allowed patterns). One command per invocation (no `&&` chaining per tool-selection-priority rule).

1. **Verify clean tree** (handled by §2 setup): `git status` (allowed).

2. **Install all declared deps** in one pass (peer + dev resolved together):
   ```bash
   npm install
   ```
   - Expected: creates `node_modules/`, `package-lock.json`.
   - If `@cobranza-apps/entities` is **not resolvable from the public npm registry** (likely, internal scope): the install will fail with `ERESOLVE`/`E404`. **Fallback sequence**:
     1. Retry with: `npm install --legacy-peer-deps` (relaxes peer resolution).
     2. If still 404 for `@cobranza-apps/entities`: temporarily **remove** `@cobranza-apps/entities` from `devDependencies`, keep it only in `peerDependencies`, and re-run `npm install --legacy-peer-deps --no-optional`. The library builds without it in Phase 1 (stub entry files have no imports). Implementer MUST then raise a follow-up TODO: "wire `@cobranza-apps/entities` once package is published/linked" — flag to caller, do not silently proceed.
     3. **Do NOT** use `--force` (security-first / explicit). Escalate to user if steps 1–2 fail.

3. **Build smoke**:
   ```bash
   npm run build
   ```
   - Expected: exit 0; `dist\index.js`, `dist\index.d.ts`, `dist\index.js.map`, `dist\index.d.ts.map`, `dist\testing\index.js`, `dist\testing\index.d.ts`, `dist\testing\index.js.map`, `dist\testing\index.d.ts.map` created.
   - If `tsc` reports errors from stub `export {};` — none expected; if any, fix per error text.

4. **Test smoke**:
   ```bash
   npm test
   ```
   - Expected: exit 0 with message "No tests found" (because `--passWithNoTests`).
   - This validates the `ts-jest` preset loads and `jest` config block parses.

5. **Clean smoke** (optional sanity):
   ```bash
   npm run clean
   ```
   - Expected: removes `dist/`. Then re-run `npm run build` to restore (so committed state has nothing in `dist/` anyway since it's gitignored — rebuild not required for commit, but keeps working dir internally consistent for any later ad-hoc inspection).

6. **Gitignore compliance pre-commit** (gitignore-compliance rule):
   ```bash
   git status
   ```
   - Confirm `node_modules/` is NOT staged (it should be ignored now).
   - Confirm `package-lock.json` IS staged (new untracked) — commit it.
   - Confirm `dist/` is NOT staged.
   - Confirm `.git-credentials` is NOT staged (already gitignored, double-check).

---

## 7. Verification Checklist (Definition of Done for this task)

- [ ] `package.json` exists at root with exact content in §5.1.
- [ ] `tsconfig.json` exists at root with exact content in §5.2.
- [ ] `src/index.ts` and `src/testing/index.ts` stub files exist (§5.3, §5.4).
- [ ] `.gitignore` contains `node_modules/` entry (§5.5).
- [ ] `package-lock.json` generated and will be committed.
- [ ] `npm run build` returns exit 0 and emits `dist/index.{js,d.ts}` + `dist/testing/index.{js,d.ts}`.
- [ ] `npm test` returns exit 0 (no-tests-pass) and does **not** error on ts-jest preset resolution.
- [ ] `git status` shows no `node_modules/`, no `dist/`, no `.git-credentials` staged.
- [ ] Change committed with a conventional message (see §9).
- [ ] TODO file line 4 appended with `[DONE]` (this is step 4.6 — NOT performed in this 4.1 step; noted for downstream sub-steps).
- [ ] `.agent/project-info/context.md` "Current State" note refreshed (docs step — NOT this step; flagged for downstream).

---

## 8. Documentation / Context Updates (out of this step, flagged for downstream)

- `.agent/project-info/context.md`:
  - Move `No package.json, no tsconfig.json` line from "Current State" to "Recent Changes" (now configured).
  - Add "Immediate Next Steps" entry: "Task 4 [DONE]: package.json + tsconfig.json configured; dependencies installed."
- (Optional) `docs/` developer-setup note referencing `npm install` / `npm run build` — defer to docs-specialist step.

---

## 9. Commit Strategy

- Files to stage for this task's commit (per gitignore-compliance: verify with `git status` before commit):
  - `package.json`
  - `tsconfig.json`
  - `package-lock.json`
  - `src/index.ts`
  - `src/testing/index.ts`
  - `.gitignore`
- Commit message (conventional, matches repo style — repo has no prior conventional commits to mirror, so use standard Conventional Commits):
  ```
  chore: configure package.json, tsconfig, and dependencies

  - Add package.json with @cobranza-apps/crypto manifest, exports
    (incl. ./testing subpath), Jest config, scripts (build/test/clean).
  - Add tsconfig.json targeting ES2022 / Node 22 with strict mode.
  - Add src/index.ts and src/testing/index.ts stub entrypoints so
    the exports map resolves at build time.
  - Install devDependencies: typescript, @types/node, jest, ts-jest,
    @types/jest; peer: @cobranza-apps/entities.
  - Gitignore node_modules/.
  ```
- Do **not** push (push handled at TODO-completion merge per Critical Workflow §5; push only to `origin` per git-remote-safety rule).

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `@cobranza-apps/entities` not on npm registry → install fails | Fallback sequence in §6.2; escalate to user, never `--force`. |
| `ts-jest` preset resolution error under Jest 29 | Versions pinned (ts-jest 29.1.4 + jest 29.7.0) are a known-good pair; if it fails, drop `preset` and spell out `transform` block. |
| `exactOptionalPropertyTypes`/`noUncheckedIndexedAccess` cause Phase 2 churn | Intentional — security-first; Phase 2 code must satisfy it (not relaxed here). |
| Stub files seen as scope creep | Justified in §3.8 — load-bearing for `exports` validation. Escalate if disputed; do not silently drop. |
| `package-lock.json` large / noisy | Required for reproducible builds; commit anyway. |

---

## 11. Plan-vs-Task Cross-Check

| Task requirement (from prompt) | Covered where |
|---|---|
| Read brief §2, §8, §9 + tech.md | §2 Inputs Reviewed |
| Read `.nvmrc` (22.14.0) | §2, §3.2 |
| package.json name/version | §5.1 (`@cobranza-apps/crypto`, `0.1.0`) |
| main, types, exports (incl `testing` subpath) | §5.1 |
| scripts build/test/clean | §3.6, §5.1 |
| devDeps typescript/jest/@types/jest/ts-jest (+ @types/node per tech.md) | §3.4, §5.1 |
| peerDeps @cobranza-apps/entities | §3.4, §5.1 |
| tsconfig target ES2022 / strict / outDir dist / include src | §5.2 |
| Detailed plan with exact JSON + install steps | §5 + §6 |
| Save to `.kilo/plans/20260707-task4-package.md` | this file |

No gaps. No invented scope beyond the load-bearing stub files (justified in §3.8) and `@types/node` (justified in §3.4).

---

End of plan.