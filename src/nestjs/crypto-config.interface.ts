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
/* eslint-disable @typescript-eslint/no-explicit-any -- mirrors NestJS FactoryProvider.useFactory */
export type CryptoConfigAsyncFactory = (
  ...dependencies: any[]
) => CryptoConfig | Promise<CryptoConfig>;
/* eslint-enable @typescript-eslint/no-explicit-any */

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
