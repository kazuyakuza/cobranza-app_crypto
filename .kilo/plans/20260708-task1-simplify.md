# Simplification Plan — Task 1: Project Structure & Package Configuration

- **Task**: Task 1 — 4.3 Code Simplification
- **Scope**: `tsconfig.json`, `package.json`, `.eslintrc.json`
- **Date**: 2026-07-08
- **Goal**: Reduce redundancy and verbosity while preserving identical functionality.

## Review Findings — Simplification Opportunities

### 1. `tsconfig.json` — Redundant `compilerOptions`

| Current Option | Reason Redundant | Action |
|---|---|---|
| `"lib": ["ES2022"]` | When omitted, `lib` defaults to the lib matching `target` (`ES2022`). Setting it explicitly to the same value adds no behavior. | Remove line. |
| `"esModuleInterop": true` | For `module: "NodeNext"` / `"Node16"`, `esModuleInterop` defaults to `true`. Redundant in this config. | Remove line. |
| `"forceConsistentCasingInFileNames": true` | Defaults to `true` since TypeScript 5.0. Redundant when using TS ≥ 5. | Remove line. |

> No behavioral change after removing the three lines above — verified against TS 5.x defaults for `module: NodeNext` and `target: ES2022`.

### 2. `package.json` — Duplicate dependency & verbose script

| Current Entry | Reason Redundant | Action |
|---|---|---|
| `devDependencies["@cobranza-apps/entities"]` | Same package is already declared in `dependencies` (and `peerDependencies`) with version `"*"`. With npm workspaces, the dependency in `dependencies` is symlinked locally; re-listing in `devDependencies` duplicates resolution and risks drift. | Remove `@cobranza-apps/entities` from `devDependencies`. |
| `lint` script globbing `"src/**/*.ts" "tests/**/*.ts"` | `eslint` can lint the whole package via `.` and the `ignorePatterns` already declared in `.eslintrc.json` (`dist/`, `node_modules/`, `coverage/`, `*.js`) prevent scanning build artifacts. The explicit globs duplicate the ignore-list logic. | Simplify to `eslint . --ext .ts`. |

> `peerDependencies` + `dependencies` for `@cobranza-apps/entities` MUST be preserved — TODO Task 1 explicitly requires "peer + regular dependency".

### 3. `.eslintrc.json` — Redundant parserOptions

| Current Entry | Reason Redundant | Action |
|---|---|---|
| `parserOptions.sourceType: "module"` | `parser` is `@typescript-eslint/parser`. With `module: NodeNext` in the linked `tsconfig.json`, the parser's default `sourceType` resolves to `module`. Explicitly setting it is redundant. | Remove `sourceType` key (keep `project`). |
| `parserOptions.project: "./tsconfig.json"` | Required ONLY by type-aware rules (`recommended-type-checked`). The current `extends` uses `plugin:@typescript-eslint/recommended` (non-type-aware), so `project` adds lint-time TS program build cost with no rule consuming it. | **Optional** removal to speed up lint. Keep if a near-future plan will enable `recommended-type-checked`. |

> `env.jest: true` and `plugin:jest/recommended` are NOT redundant — the plugin adds rules; `env.jest` declares globals (`describe`, `test`, `it`). Keep both.

## Verified Non-Redundant (no action)

- `tsconfig.json`: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` — none are implied by `strict: true`; all additive and intentional.
- `tsconfig.json`: `skipLibCheck`, `resolveJsonModule`, `esModuleInterop`-removed-but-`isolatedModules`-not-set — fine.
- `package.json`: inline `jest` config — keeping internal avoids extra `jest.config.js` file; acceptable.
- `package.json`: `clean` script — single-line, dependency-free utility; keep as-is.
- `.eslintrc.json`: `consistent-type-imports: warn`, `no-console: warn` — intentional lint policy.
- `.eslintrc.json`: `root: true` — standard for package-level config; keep.

## Recommended Changes (Apply in 4.3-fix)

### File: `tsconfig.json`
```diff
   "compilerOptions": {
     // Target modern Node.js 22+ runtime
     "target": "ES2022",
-    "lib": ["ES2022"],
     // CommonJS for NestJS ecosystem compatibility
     "module": "NodeNext",
     "moduleResolution": "NodeNext",
     // Source in src/, compiled output to dist/
     "rootDir": "./src",
     "outDir": "./dist",
     // Generate .d.ts type declarations for library consumers
     "declaration": true,
     "declarationMap": true,
     "sourceMap": true,
     // Strict type checking for safety
     "strict": true,
     "noImplicitOverride": true,
     "noUnusedLocals": true,
     "noUnusedParameters": true,
     "noFallthroughCasesInSwitch": true,
     // Enhanced safety: catch undefined array/object access
     "noUncheckedIndexedAccess": true,
     "exactOptionalPropertyTypes": true,
     // Interop and module resolution
-    "esModuleInterop": true,
     "skipLibCheck": true,
-    "forceConsistentCasingInFileNames": true,
     "resolveJsonModule": true,
     // Type definitions for Node.js and Jest testing
     "types": ["node", "jest"]
   },
```

### File: `package.json`
```diff
   "scripts": {
     "build": "tsc",
     "test": "jest --passWithNoTests",
     "test:watch": "npm run test -- --watch",
-    "lint": "eslint --no-error-on-unmatched-pattern \"src/**/*.ts\" \"tests/**/*.ts\"",
+    "lint": "eslint . --ext .ts",
     "clean": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\""
   },
   "peerDependencies": {
     "@cobranza-apps/entities": "*"
   },
   "dependencies": {
     "@cobranza-apps/entities": "*"
   },
   "devDependencies": {
-    "@cobranza-apps/entities": "*",
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

### File: `.eslintrc.json`
```diff
   "parserOptions": {
-    "project": "./tsconfig.json",
-    "sourceType": "module"
+    "project": "./tsconfig.json"
   },
```
> `project` kept to preserve the option for future type-aware rules; only `sourceType` removed (redundant under `NodeNext`).

## Verification Steps (for 4.3-fix implementer)

1. Apply diffs above.
2. Run `npm run lint` — must exit 0 (or only known warnings).
3. Run `npm run build` — must compile cleanly with no new errors.
4. Run `npm test` — must complete with no new failures.
5. Confirm `lib` removal did not change emitted `target` features (Node 22 supports ES2022 natively).

## Risk Assessment

- **tsconfig**: LOW — defaults are well-documented and match the explicit values.
- **package.json devDep removal**: LOW — package is resolvable from `dependencies` via workspaces.
- **package.json lint script**: LOW — `ignorePatterns` already covers artifacts; `--ext .ts` filters to TS files.
- **eslintrc sourceType removal**: LOW — default for `NodeNext` module is `module`.

## Out of Scope

- No changes to directory structure, source files, README, or any other Task.
- No change to dependency versions (version upgrade handled in 4.2).
- No new files created other than this plan file.