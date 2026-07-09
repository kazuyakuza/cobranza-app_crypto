# Plan: NestJS Integration Helpers (Task 1)

- **Date:** 2026-07-09
- **TODO:** `.agent/todos/20260707/20260707-todo-3.md` → Task 1
- **Plan path:** `.kilo/plans/20260709-task1-nestjs-integration.md`
- **Phase:** 3 — real-world integration
- **Branch (already created in Critical Workflow step 2):** `feat/<descriptive-name>` (implementer confirms)

---

## 1. Task Reference (verbatim requirements)

From `20260707-todo-3.md`, Task 1:

- Create `src/nestjs/` folder with integration helpers:
  - `crypto.module.ts` – A configurable NestJS module (`CryptoModule.forRoot(config)` or `forRootAsync` using `ConfigService`).
  - `crypto.service.ts` – Injectable wrapper around `SecureCrypto`.
  - Provide both synchronous and async registration options.
- Define clear examples in `/docs` (and link them to README.md) showing how to register the module in a NestJS app using `ConfigService` for `masterKey` and `hashSalt`.

Caller-supplied scope for this plan (sub-task prompt):

- Create `src/nestjs/`: `crypto.module.ts`, `crypto.service.ts`, `crypto-config.interface.ts`, `index.ts`.
- Update `package.json`: add `./nestjs` export; add `@nestjs/common` and `@nestjs/config` as optional peer dependencies.
- Add tests under `tests/nestjs/`.
- Update docs.
- Update `.agent/project-structure.md`.
- Constraints: max 200 lines/file, 50 lines/method, 2 nesting levels, 2 params max, no runtime deps (NestJS = optional peer only), 100% coverage of new code.

---

## 2. Pre-Analysis & Architecture Decisions

### 2.1 Current State (verified)

- `SecureCrypto` class in `src/crypto.service.ts` (199 lines); mixins in `crypto.service.{encryption,hashing,keys,guards,validation}.ts`.
- `src/config.ts` exports `EncryptionKey` (enum) and `CryptoConfig` (interface).
- `package.json` v0.3.0 exports `.` and `./testing`; peer dep `@cobranza-apps/entities`; **no** NestJS deps installed (confirmed: `node_modules/@nestjs/*` absent).
- `tsconfig.json`: `target ES2022`, `module/moduleResolution NodeNext`, `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, **no** `experimentalDecorators`/`emitDecoratorMetadata`.
- `tsconfig.eslint.json` includes `src/**/*.ts` + `tests/**/*.ts` (inherits tsconfig).
- `.eslintrc.json`: `plugin:@typescript-eslint/recommended` + `jest/recommended`; **no** `no-explicit-any` rule (so `any[]` is lint-clean); `consistent-type-imports: warn` (use `import type`).
- Jest `collectCoverageFrom`: `src/**/*.ts`, excludes `!src/testing/**`, `!src/index.ts`, `!src/**/*.types.ts`. Global coverage threshold 85%.
- `docs/how-to-configure-in-nestjs.md` already documents a hand-rolled `CryptoModule` + `ConfigService` provider pattern; README "NestJS Integration Guide" links to it. README "non-goals" currently states "No NestJS modules."

### 2.2 Architecture Decisions

**Decision A — `CryptoService` extends `SecureCrypto` (inheritance wrapper), decorated `@Injectable()`.**
Rationale: minimal "injectable wrapper" surface; full `SecureCrypto` API inherited with zero delegation boilerplate; trivially hits 100% coverage (constructor calls `super(config)`). Composition (HAS-A) would require re-declaring and testing 8 delegation methods, increasing file/method size and test surface for no behavioral gain. `CryptoService` IS-A `SecureCrypto`, so `instanceof SecureCrypto` holds for consumers.

**Decision B — DI token `CRYPTO_CONFIG` (`unique symbol`) + class provider for `CryptoService`.**
Rationale: idiomatic NestJS pattern (mirrors `@nestjs/config`'s `CONFIG_OPTIONS`). `forRoot` provides `CRYPTO_CONFIG` as `useValue`; `forRootAsync` provides `CRYPTO_CONFIG` via the consumer's `useFactory` (forwarded directly — no wrapper factory, avoiding variadic-typing issues). `CryptoService` constructor uses `@Inject(CRYPTO_CONFIG)` to receive the resolved `CryptoConfig`, then calls `super(config)`. NestJS instantiates `CryptoService` via standard class-provider reflection.

**Decision C — Enable `experimentalDecorators: true` and `emitDecoratorMetadata: true` in `tsconfig.json`.**
Rationale: NestJS decorators (`@Module`, `@Injectable`, `@Inject`) require `experimentalDecorators` to compile. `emitDecoratorMetadata` is NestJS-standard and harmless. These flags do **not** alter emitted output for existing decorator-free source files (verified: no existing file uses decorators), so the current 124-test suite and `tsc` build remain unchanged. Emitted `dist/nestjs/*.js` references `Reflect.metadata`, which is always present in NestJS consumers (NestJS core depends on `reflect-metadata`). For this library's own tests, `reflect-metadata` is imported at the top of each `tests/nestjs/*.spec.ts`.

**Decision D — NestJS as optional peer dependencies; devDependencies for testing only.**
`@nestjs/common` and `@nestjs/config` are optional peer deps (`peerDependenciesMeta.optional: true`). `@nestjs/common`, `@nestjs/testing`, `@nestjs/config`, and `reflect-metadata` are added as devDependencies so the library can type-check, build, and test the `./nestjs` subpath locally. **No runtime `dependencies` are added** — the library stays zero-runtime-dep for the `.` and `./testing` subpaths. Consumers using `./nestjs` must have `@nestjs/common` installed (NestJS itself).

**Decision E — `CryptoConfigAsyncFactory` typed with `any[]` rest params.**
Rationale: matches NestJS `FactoryProvider.useFactory: (...args: any[]) => any`. A strict `unknown[]` typing would reject consumer factories with typed params (e.g. `(config: ConfigService) => CryptoConfig`) under strict function types. ESLint `recommended` does not enable `no-explicit-any`, so this is lint-clean. This is the same compromise used by upstream NestJS integration packages.

**Decision F — NestJS version range `^10 || ^11` (peer), `^11` (dev).**
Node 22.14 is compatible with both. Latest stable is NestJS 11. The implementer runs `npm install` and verifies resolution; if `^11` is unavailable, fall back to `^10` for dev deps (peer range already covers both).

### 2.3 Constraints Compliance Matrix

| Rule | How satisfied |
|---|---|
| Max 200 lines/file | Largest new file (`crypto.module.ts`) ~70 lines; all others <60. |
| Max 50 lines/method | Largest method (`forRootAsync`) ~12 lines. |
| Max 2 params/method | `forRoot(config)` 1 param; `forRootAsync(options)` 1 param; `CryptoService` ctor 1 param; `buildModule(parts)` 1 param object. Factory `...args` is a single rest param. |
| Max 2 nesting levels | Deepest nesting: returned object literal (1) → factory arrow body (2). No level-3. |
| No runtime deps | Only optional peer + dev deps added; `dependencies` unchanged. |
| Private members by default | `buildModule` is `private static`. `CryptoService` adds no public members beyond inherited API. |
| No commented code / self-documenting | Descriptive names; JSDoc on public exports only. |
| 100% coverage new code | Tests cover all branches incl. `?? []` defaults; barrel excluded from coverage. |

---

## 3. High-Level Approach

1. Enable NestJS decorator compilation in `tsconfig.json`.
2. Declare `./nestjs` export + optional NestJS peer deps + NestJS dev deps in `package.json`.
3. Tweak Jest `collectCoverageFrom` to exclude the new barrel `src/nestjs/index.ts`.
4. Create 4 source files under `src/nestjs/` (interface/token, service, module, barrel).
5. `npm install` new dev deps; `npm run build` to confirm clean compile.
6. Create 2 test files under `tests/nestjs/` covering 100% of new source.
7. `npm test` → confirm 100% on nestjs files and existing 124 tests still pass.
8. `npm run lint` → resolve any new findings.
9. Update `.agent/project-structure.md`, `docs/how-to-configure-in-nestjs.md`, `README.md`, `docs/README.md`.
10. Commit with a meaningful message on the feature branch.

---

## 4. Detailed Implementation Steps

> Tool preference: use `vscode-mcp-server_create_file_code` / `vscode-mcp-server_replace_lines_code` for file edits; `bash` only for `npm`/`git` commands. Follow `.kilo/rules/gitignore-compliance.md` before any commit.

### Step 1 — `tsconfig.json`: enable decorators

In `compilerOptions`, add the two flags after the strict-safety block (after `"exactOptionalPropertyTypes": true,`):

```jsonc
    // NestJS decorators (./nestjs subpath). Harmless for decorator-free files.
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
```

No other tsconfig changes. `tsconfig.eslint.json` inherits via `extends`.

### Step 2 — `package.json`: exports, peers, devDeps

**2a. Add `./nestjs` to `exports` (after `./testing`):**

```json
    "./nestjs": {
      "types": "./dist/nestjs/index.d.ts",
      "default": "./dist/nestjs/index.js"
    }
```

**2b. Replace `peerDependencies` block and add `peerDependenciesMeta`:**

```json
  "peerDependencies": {
    "@cobranza-apps/entities": "*",
    "@nestjs/common": "^10 || ^11",
    "@nestjs/config": "^10 || ^11"
  },
  "peerDependenciesMeta": {
    "@nestjs/common": { "optional": true },
    "@nestjs/config": { "optional": true }
  },
```

**2c. Add devDependencies (alphabetical order within the block):**

```json
    "@nestjs/common": "^11.0.0",
    "@nestjs/config": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "reflect-metadata": "^0.2.2",
```

No change to `dependencies`, `files` (`dist` already ships `nestjs/`), `main`/`types`, or scripts.

### Step 3 — Jest `collectCoverageFrom`: exclude new barrel

In the `jest` config, add `"!src/nestjs/index.ts"` to `collectCoverageFrom`:

```json
    "collectCoverageFrom": [
      "src/**/*.ts",
      "!src/testing/**",
      "!src/index.ts",
      "!src/nestjs/index.ts",
      "!src/**/*.types.ts"
    ],
```

`src/nestjs/crypto-config.interface.ts` is **kept** in coverage (it has a runtime `const CRYPTO_CONFIG = Symbol(...)` that executes when imported by the module). `src/nestjs/crypto.module.ts` and `src/nestjs/crypto.service.ts` are kept and must reach 100%.

### Step 4 — Create `src/nestjs/crypto-config.interface.ts`

```ts
/**
 * Async configuration types + DI token for the NestJS `CryptoModule`
 * (`@cobranza-apps/crypto/nestjs` subpath).
 *
 * Exports:
 * - {@link CRYPTO_CONFIG} — injection token carrying a resolved {@link CryptoConfig}.
 * - {@link CryptoConfigAsyncFactory} — factory signature for `forRootAsync`.
 * - {@link CryptoModuleAsyncOptions} — options shape for `forRootAsync`.
 *
 * @packageDocumentation
 */

import type { DynamicModule, Type } from '@nestjs/common';

import type { CryptoConfig } from '../config.js';

/**
 * NestJS injection token that carries a resolved {@link CryptoConfig}.
 *
 * Registered by `CryptoModule.forRoot` / `forRootAsync` and injected into
 * {@link CryptoService} via `@Inject(CRYPTO_CONFIG)`.
 */
export const CRYPTO_CONFIG: unique symbol = Symbol('CRYPTO_CONFIG');

/**
 * Factory invoked by `CryptoModule.forRootAsync` to produce a {@link CryptoConfig}
 * from injected dependencies (typically a NestJS `ConfigService`).
 *
 * May return synchronously or as a `Promise`; NestJS awaits the result. The
 * `any[]` rest signature mirrors NestJS `FactoryProvider.useFactory` so consumers
 * can type the dependencies per their `inject` array.
 */
export type CryptoConfigAsyncFactory = (
  ...dependencies: any[]
) => CryptoConfig | Promise<CryptoConfig>;

/**
 * Options for `CryptoModule.forRootAsync(...)`.
 *
 * Mirrors the standard NestJS async-module pattern: `imports` pulls in modules
 * that expose the injected dependencies, `inject` lists dependencies forwarded
 * to {@link CryptoConfigAsyncFactory} in order, and `useFactory` builds the
 * {@link CryptoConfig}.
 */
export interface CryptoModuleAsyncOptions {
  /** Modules imported into the dynamic module (e.g. `ConfigModule`). */
  readonly imports?: Array<Type<unknown> | DynamicModule>;

  /** Dependencies injected into {@link CryptoConfigAsyncFactory}, in order. */
  readonly inject?: Array<Type<unknown> | string | symbol>;

  /** Factory that resolves the {@link CryptoConfig} from the injected deps. */
  readonly useFactory: CryptoConfigAsyncFactory;
}
```

(~55 lines.)

### Step 5 — Create `src/nestjs/crypto.service.ts`

```ts
/**
 * Injectable NestJS wrapper around {@link SecureCrypto}
 * (`@cobranza-apps/crypto/nestjs` subpath).
 *
 * `CryptoService` extends {@link SecureCrypto} so the full encryption/hashing
 * API is available through dependency injection. `CryptoModule` registers a
 * {@link CryptoConfig} under the {@link CRYPTO_CONFIG} token; NestJS then
 * instantiates this class via constructor injection.
 *
 * @packageDocumentation
 */

import { Inject, Injectable } from '@nestjs/common';

import type { CryptoConfig } from '../config.js';
import { SecureCrypto } from '../crypto.service.js';
import { CRYPTO_CONFIG } from './crypto-config.interface.js';

/**
 * Dependency-injectable {@link SecureCrypto}.
 *
 * Inject it into any provider and call any {@link SecureCrypto} method:
 *
 * @example
 * ```ts
 * constructor(private readonly crypto: CryptoService) {}
 *
 * createUser(email: string) {
 *   const { encrypted, hash } = this.crypto.encryptAndHash(email, EncryptionKey.PII);
 * }
 * ```
 */
@Injectable()
export class CryptoService extends SecureCrypto {
  constructor(@Inject(CRYPTO_CONFIG) config: CryptoConfig) {
    super(config);
  }
}
```

(~40 lines.)

### Step 6 — Create `src/nestjs/crypto.module.ts`

```ts
/**
 * NestJS `CryptoModule` providing {@link CryptoService}
 * (`@cobranza-apps/crypto/nestjs` subpath).
 *
 * Offers synchronous (`forRoot`) and asynchronous (`forRootAsync`) registration,
 * following the standard NestJS dynamic-module pattern.
 *
 * @packageDocumentation
 */

import { Module } from '@nestjs/common';
import type { DynamicModule, Provider, Type } from '@nestjs/common';

import type { CryptoConfig } from '../config.js';
import { CRYPTO_CONFIG, type CryptoModuleAsyncOptions } from './crypto-config.interface.js';
import { CryptoService } from './crypto.service.js';

/**
 * Dynamic NestJS module exporting {@link CryptoService}.
 *
 * Register once in your root module:
 * - `CryptoModule.forRoot(config)` when the {@link CryptoConfig} is available
 *   synchronously at bootstrap.
 * - `CryptoModule.forRootAsync({ imports, inject, useFactory })` when the config
 *   must be resolved from injected dependencies (e.g. `ConfigService`).
 */
@Module({})
export class CryptoModule {
  /** Register {@link CryptoService} with a static {@link CryptoConfig}. */
  static forRoot(config: CryptoConfig): DynamicModule {
    return this.buildModule({
      providers: [{ provide: CRYPTO_CONFIG, useValue: config }, CryptoService],
    });
  }

  /** Register {@link CryptoService} with a config resolved from injected deps. */
  static forRootAsync(options: CryptoModuleAsyncOptions): DynamicModule {
    return this.buildModule({
      imports: options.imports,
      providers: [
        {
          provide: CRYPTO_CONFIG,
          inject: options.inject ?? [],
          useFactory: options.useFactory,
        },
        CryptoService,
      ],
    });
  }

  private static buildModule(parts: {
    readonly imports?: Array<Type<unknown> | DynamicModule>;
    readonly providers: Provider[];
  }): DynamicModule {
    return {
      module: CryptoModule,
      imports: parts.imports ?? [],
      providers: parts.providers,
      exports: [CryptoService],
    };
  }
}
```

(~70 lines.)

### Step 7 — Create `src/nestjs/index.ts`

```ts
/**
 * Public entrypoint for the `@cobranza-apps/crypto/nestjs` subpath.
 *
 * Exports the NestJS integration helpers:
 * - {@link CryptoModule} — dynamic module (`forRoot` / `forRootAsync`).
 * - {@link CryptoService} — injectable {@link SecureCrypto} wrapper.
 * - {@link CRYPTO_CONFIG} — DI token for a resolved {@link CryptoConfig}.
 *
 * @remarks
 * Requires `@nestjs/common` (and, for `forRootAsync` with `ConfigService`,
 * `@nestjs/config`) to be installed by the consumer. Both are declared as
 * optional peer dependencies of `@cobranza-apps/crypto`.
 *
 * @packageDocumentation
 */

export { CryptoModule } from './crypto.module.js';
export { CryptoService } from './crypto.service.js';
export { CRYPTO_CONFIG } from './crypto-config.interface.js';
export type {
  CryptoModuleAsyncOptions,
  CryptoConfigAsyncFactory,
} from './crypto-config.interface.js';
```

(~28 lines.)

### Step 8 — Install dev dependencies

```bash
npm install
```

Verify `node_modules/@nestjs/common`, `@nestjs/testing`, `@nestjs/config`, `reflect-metadata` are now present. If `^11.0.0` fails to resolve, switch the three `@nestjs/*` dev deps to `^10.0.0` and re-run.

### Step 9 — Build verification

```bash
npm run build
```

Confirm `dist/nestjs/{crypto.module,crypto.service,crypto-config.interface,index}.{js,d.ts}` are emitted and `tsc` reports no errors. Confirm existing `dist/` files are unchanged in behavior (decorator flags don't affect decorator-free files).

### Step 10 — Create `tests/nestjs/crypto.service.spec.ts`

```ts
import 'reflect-metadata';

import { EncryptionKey } from '../../src/index.js';
import { SecureCrypto } from '../../src/crypto.service.js';
import { CryptoService } from '../../src/nestjs/crypto.service.js';
import { TEST_CRYPTO_CONFIG } from '../../src/testing/index.js';

describe('CryptoService', () => {
  it('is a SecureCrypto subclass', () => {
    const service = new CryptoService(TEST_CRYPTO_CONFIG);

    expect(service).toBeInstanceOf(SecureCrypto);
    expect(service).toBeInstanceOf(CryptoService);
  });

  it('encrypts and decrypts via inherited SecureCrypto methods', () => {
    const service = new CryptoService(TEST_CRYPTO_CONFIG);
    const encrypted = service.encrypt('user@example.com', EncryptionKey.PII);

    expect(service.decrypt(encrypted)).toBe('user@example.com');
  });

  it('hashes and verifies via inherited methods', () => {
    const service = new CryptoService(TEST_CRYPTO_CONFIG);
    const hash = service.hash('user@example.com');

    expect(service.verifyHash('user@example.com', hash)).toBe(true);
  });

  it('encryptAndHash returns both encrypted payload and hash', () => {
    const service = new CryptoService(TEST_CRYPTO_CONFIG);
    const { encrypted, hash } = service.encryptAndHash('user@example.com', EncryptionKey.PII);

    expect(service.decrypt(encrypted)).toBe('user@example.com');
    expect(service.verifyHash('user@example.com', hash)).toBe(true);
  });

  it('destroy clears internal state without throwing', () => {
    const service = new CryptoService(TEST_CRYPTO_CONFIG);
    service.encrypt('warm-up', EncryptionKey.PII);

    expect(() => service.destroy()).not.toThrow();
  });
});
```

### Step 11 — Create `tests/nestjs/crypto.module.spec.ts`

```ts
import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { EncryptionKey } from '../../src/index.js';
import { CryptoModule } from '../../src/nestjs/crypto.module.js';
import { CryptoService } from '../../src/nestjs/crypto.service.js';
import { TEST_CRYPTO_CONFIG } from '../../src/testing/index.js';

/** Stand-in for a consumer-provided injectable dependency (e.g. ConfigService). */
class FakeConfigSource {}

/** Minimal module exporting {@link FakeConfigSource} to exercise `imports`. */
@Module({
  providers: [FakeConfigSource],
  exports: [FakeConfigSource],
})
class FakeConfigModule {}

describe('CryptoModule', () => {
  describe('forRoot', () => {
    it('returns a DynamicModule pointing at CryptoModule and exporting CryptoService', () => {
      const dynamic = CryptoModule.forRoot(TEST_CRYPTO_CONFIG);

      expect(dynamic.module).toBe(CryptoModule);
      expect(dynamic.exports).toContain(CryptoService);
    });

    it('provides a working CryptoService via DI', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [CryptoModule.forRoot(TEST_CRYPTO_CONFIG)],
      }).compile();

      const service = moduleRef.get(CryptoService);
      expect(service).toBeInstanceOf(CryptoService);
      const encrypted = service.encrypt('x@x.com', EncryptionKey.PII);
      expect(service.decrypt(encrypted)).toBe('x@x.com');
    });
  });

  describe('forRootAsync', () => {
    it('returns a DynamicModule pointing at CryptoModule and exporting CryptoService', () => {
      const dynamic = CryptoModule.forRootAsync({ useFactory: () => TEST_CRYPTO_CONFIG });

      expect(dynamic.module).toBe(CryptoModule);
      expect(dynamic.exports).toContain(CryptoService);
    });

    it('provides a CryptoService from a sync factory with no inject/imports', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [CryptoModule.forRootAsync({ useFactory: () => TEST_CRYPTO_CONFIG })],
      }).compile();

      const service = moduleRef.get(CryptoService);
      expect(service.decrypt(service.encrypt('a@a.com', EncryptionKey.PII))).toBe('a@a.com');
    });

    it('provides a CryptoService from an async factory', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          CryptoModule.forRootAsync({ useFactory: async () => TEST_CRYPTO_CONFIG }),
        ],
      }).compile();

      expect(moduleRef.get(CryptoService)).toBeInstanceOf(CryptoService);
    });

    it('injects dependencies declared via inject (no imports)', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          CryptoModule.forRootAsync({
            inject: [FakeConfigSource],
            useFactory: (_src: FakeConfigSource) => TEST_CRYPTO_CONFIG,
          }),
        ],
        providers: [{ provide: FakeConfigSource, useValue: new FakeConfigSource() }],
      }).compile();

      expect(moduleRef.get(CryptoService)).toBeInstanceOf(CryptoService);
    });

    it('honors the imports option by pulling a dependency from an imported module', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          CryptoModule.forRootAsync({
            imports: [FakeConfigModule],
            inject: [FakeConfigSource],
            useFactory: (_src: FakeConfigSource) => TEST_CRYPTO_CONFIG,
          }),
        ],
      }).compile();

      const service = moduleRef.get(CryptoService);
      const encrypted = service.encrypt('b@b.com', EncryptionKey.PII);
      expect(service.decrypt(encrypted)).toBe('b@b.com');
    });
  });
});
```

### Step 12 — Run tests + coverage

```bash
npm test
```

**Coverage targets for new files (must be 100%):**

- `src/nestjs/crypto.module.ts` — `forRoot`, `forRootAsync`, `buildModule` all executed; both `?? []` branches (nullish + non-nullish) for `imports` and `inject` exercised by the 5 module tests above.
- `src/nestjs/crypto.service.ts` — constructor executed (direct `new` + DI instantiation).
- `src/nestjs/crypto-config.interface.ts` — `const CRYPTO_CONFIG = Symbol(...)` executed on first import (via `crypto.module.ts`).

Confirm the existing 124 tests still pass and global coverage stays >=85%. If any nestjs file is below 100%, add/adjust a test to cover the missing branch.

### Step 13 — Lint

```bash
npm run lint
```

Resolve any new findings in `src/nestjs/**` or `tests/nestjs/**` (e.g., ensure `import type` is used for `DynamicModule`, `Provider`, `Type`, `CryptoConfig`, `CryptoModuleAsyncOptions`). `any[]` in `CryptoConfigAsyncFactory` is lint-clean under `recommended`.

### Step 14 — Update `.agent/project-structure.md`

Add a bullet under `# Folders in src/` (after the `src/testing/` line):

```text
- src/nestjs/ - NestJS integration helpers: CryptoModule (forRoot/forRootAsync), CryptoService injectable SecureCrypto wrapper, CRYPTO_CONFIG DI token, async config interfaces
```

### Step 15 — Documentation updates

**15a. `docs/how-to-configure-in-nestjs.md`:**

- Replace the "Reusable CryptoModule" section's hand-rolled module with the built-in `CryptoModule` from `@cobranza-apps/crypto/nestjs`. Show:
  - Sync: `CryptoModule.forRoot(cryptoConfig)`.
  - Async with `ConfigService` (the explicit Task-1 requirement):

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EncryptionKey } from '@cobranza-apps/crypto';
import { CryptoModule } from '@cobranza-apps/crypto/nestjs';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CryptoModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        masterKey: config.get<string>('COBRANZA_CRYPTO_MASTER_KEY', { infer: true })!,
        hashSalt: config.get<string>('COBRANZA_CRYPTO_HASH_SALT', { infer: true })!,
        currentVersion: parseInt(
          config.get<string>('COBRANZA_CRYPTO_KEY_VERSION', { infer: true }) ?? '1',
          10,
        ),
        defaultKeyName: EncryptionKey.PII,
      }),
    }),
  ],
})
export class AppModule {}
```

  - Update the injection example to use `CryptoService` instead of `SecureCrypto`:

```ts
import { Injectable } from '@nestjs/common';
import { CryptoService } from '@cobranza-apps/crypto/nestjs';
import { EncryptionKey } from '@cobranza-apps/crypto';

@Injectable()
export class UserService {
  constructor(private readonly crypto: CryptoService) {}

  async createUser(email: string) {
    const { encrypted, hash } = this.crypto.encryptAndHash(email, EncryptionKey.PII);
  }
}
```

  - Keep the "Provider with ConfigService" (inline provider) section as an alternative, but add a note that the built-in `CryptoModule` is preferred.
  - Update the "Testing in NestJS" section to mention that `CryptoModule.forRoot(...)` with the test config can also be used, alongside the existing `SecureCryptoTestModule` approach.

**15b. `README.md`:**

- Update "What it does NOT do (non-goals)" bullet "No NestJS modules" to: "No hard NestJS dependency; an optional `./nestjs` subpath provides `CryptoModule` and `CryptoService` when `@nestjs/common` is installed."
- Update "NestJS Integration Guide" section: add a short snippet showing `CryptoModule.forRoot` / `forRootAsync` from `@cobranza-apps/crypto/nestjs`, and link to the updated `docs/how-to-configure-in-nestjs.md`.
- Update "Package layout" tree to include `nestjs/` with its 4 files.
- Update "Guides" list entry for the NestJS doc to mention the built-in module.
- Add `@nestjs/common` / `@nestjs/config` to the "Requirements" note as optional peers for the `./nestjs` subpath.

**15c. `docs/README.md`:**

- Update the "How to Configure in NestJS" entry description to mention the built-in `CryptoModule` (`forRoot`/`forRootAsync`) and `CryptoService`.

### Step 16 — Commit

Before committing, follow `.kilo/rules/gitignore-compliance.md`: read `.gitignore`, run `git status`, ensure no `node_modules/`, `dist/`, or `coverage/` are staged.

```bash
git add src/nestjs tests/nestjs package.json tsconfig.json .agent/project-structure.md docs/how-to-configure-in-nestjs.md README.md docs/README.md
git status
git commit -m "feat(nestjs): add CryptoModule/CryptoService integration helpers (./nestjs subpath)"
```

(Commit message style matches repo: `type(scope): subject`.)

---

## 5. Test Strategy

- **Unit (direct construction):** `crypto.service.spec.ts` verifies `CryptoService` is a `SecureCrypto` subclass and inherits all behavior (encrypt/decrypt/hash/verifyHash/encryptAndHash/destroy).
- **Integration (NestJS DI):** `crypto.module.spec.ts` uses `@nestjs/testing`'s `Test.createTestingModule` to compile `CryptoModule.forRoot` and `CryptoModule.forRootAsync` variants, asserting `CryptoService` is resolvable and functional.
- **Branch coverage:** the 5 module tests exercise both `?? []` fallbacks (nullish and non-nullish) for `imports` and `inject`, plus sync/async factory paths, plus `inject`-only and `imports+inject` combinations.
- **reflect-metadata:** imported as the first line of each nestjs spec to enable NestJS DI metadata.
- **No `@nestjs/config` dependency in tests:** the `ConfigService` flow is documented in docs and validated by the generic `inject` test using `FakeConfigSource` (proves injection works for any dependency).

---

## 6. Documentation Updates (summary)

| File | Change |
|---|---|
| `docs/how-to-configure-in-nestjs.md` | Feature built-in `CryptoModule.forRoot`/`forRootAsync` with `ConfigService` example; switch injection examples to `CryptoService`. |
| `README.md` | Update non-goals, NestJS Integration Guide, package layout, guides list, requirements. |
| `docs/README.md` | Update NestJS guide entry description. |
| `.agent/project-structure.md` | Add `src/nestjs/` folder line. |

---

## 7. Acceptance Criteria / Definition of Done

- [ ] `src/nestjs/` contains `crypto.module.ts`, `crypto.service.ts`, `crypto-config.interface.ts`, `index.ts` (all under 200 lines, methods under 50 lines, <=2 nesting levels, <=2 params).
- [ ] `CryptoModule.forRoot(config)` and `CryptoModule.forRootAsync({ useFactory, inject, imports })` both work via NestJS DI.
- [ ] `CryptoService` is `@Injectable()` and injectable; full `SecureCrypto` API available.
- [ ] `package.json` exports `./nestjs`; `@nestjs/common` and `@nestjs/config` are optional peer deps; no runtime deps added.
- [ ] `npm run build` is clean; `dist/nestjs/*` emitted.
- [ ] `npm test` passes: existing 124 tests + new nestjs tests; 100% coverage on `src/nestjs/crypto.module.ts`, `src/nestjs/crypto.service.ts`, `src/nestjs/crypto-config.interface.ts`; global >=85%.
- [ ] `npm run lint` clean.
- [ ] `docs/how-to-configure-in-nestjs.md` shows `ConfigService`-based `forRootAsync` registration; linked from `README.md`.
- [ ] `.agent/project-structure.md` lists `src/nestjs/`.
- [ ] Changes committed on the feature branch with a meaningful message; no gitignored files staged.

---

## 8. Risks & Mitigations

- **Decorator flags change existing build output:** mitigated — no existing source uses decorators; `tsc` output for decorator-free files is identical. Verified by running `npm run build` + existing tests after the change (Step 9/12).
- **NestJS version resolution:** `^11` may be unavailable in restricted registries; fallback to `^10` for dev deps (peer range already `^10 || ^11`).
- **`any[]` in factory type:** deliberate (NestJS convention); lint-clean under `@typescript-eslint/recommended`. Documented in JSDoc.
- **`exactOptionalPropertyTypes` interactions:** all optional returns use `?? []` to produce concrete arrays, never explicit `undefined`. No conflict.
- **Coverage gate on interface file:** kept in coverage; the runtime `Symbol()` const is covered on import. If Istanbul reports 0% due to type-only exports, add `"!src/**/*.interface.ts"` to `collectCoverageFrom` as a fallback (not expected to be needed).

---

## 9. Out of Scope (handled by other TODO-3 tasks)

- Task 2: DTO/decorator + interceptor/subscriber examples.
- Task 3: in-memory cache, `reEncrypt`, input validation hardening.
- Task 4: comprehensive docs overhaul, security checklist, key-rotation guide expansion.
- Updating `.agent/project-info/context.md` (done at task completion, step 4.6, by the implementer — not by this planning step).

---

## 10. Notes for Subsequent Critical-Workflow Steps

- **4.2 (Implementation):** follow Steps 1-16 above in order; commit per Step 16.
- **4.3 (Review & Simplify):** reviewers should verify the constraints matrix (section 2.3) and 100% coverage; check that decorator-flag enabling did not alter existing `dist/` behavior.
- **4.4 (Documentation):** ensure the `ConfigService` example in `docs/how-to-configure-in-nestjs.md` is the canonical registration example and that README links it.
- **4.5 (Verification):** confirm plan adherence (file list, exports, peer-dep optionality, coverage 100%).
- **4.6 (Completion):** mark Task 1 checkboxes `[x]` in the TODO file; update `.agent/project-info/context.md` with the new `./nestjs` subpath, optional peer deps, and tsconfig decorator flags.
