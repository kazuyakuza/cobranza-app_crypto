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
  /**
   * Register {@link CryptoService} with a static {@link CryptoConfig}.
   *
   * Use when the full config object is available synchronously at bootstrap.
   *
   * @param config - The complete {@link CryptoConfig} object.
   * @returns A dynamic module exporting {@link CryptoService}.
   *
   * @example
   * ```typescript
   * import { CryptoModule } from '@cobranza-apps/crypto/nestjs';
   * import { EncryptionKey } from '@cobranza-apps/crypto';
   *
   * @Module({
   *   imports: [
   *     CryptoModule.forRoot({
   *       masterKey: process.env.COBRANZA_CRYPTO_MASTER_KEY!,
   *       hashSalt: process.env.COBRANZA_CRYPTO_HASH_SALT!,
   *       currentVersion: 1,
   *       defaultKeyName: EncryptionKey.PII,
   *     }),
   *   ],
   * })
   * export class AppModule {}
   * ```
   *
   * @see {@link CryptoModule.forRootAsync} for async config resolution.
   */
  static forRoot(config: CryptoConfig): DynamicModule {
    return this.buildModule({
      providers: [{ provide: CRYPTO_CONFIG, useValue: config }, CryptoService],
    });
  }

  /**
   * Register {@link CryptoService} with a config resolved from injected dependencies.
   *
   * Use when the config must be built from injected services (e.g., `ConfigService`).
   *
   * @param options - Async module options including `imports`, `inject`, and `useFactory`.
   * @returns A dynamic module exporting {@link CryptoService}.
   *
   * @example
   * ```typescript
   * import { ConfigModule, ConfigService } from '@nestjs/config';
   * import { CryptoModule } from '@cobranza-apps/crypto/nestjs';
   * import { EncryptionKey } from '@cobranza-apps/crypto';
   *
   * @Module({
   *   imports: [
   *     ConfigModule.forRoot({ isGlobal: true }),
   *     CryptoModule.forRootAsync({
   *       inject: [ConfigService],
   *       useFactory: (config: ConfigService) => ({
   *         masterKey: config.get<string>('COBRANZA_CRYPTO_MASTER_KEY', { infer: true })!,
   *         hashSalt: config.get<string>('COBRANZA_CRYPTO_HASH_SALT', { infer: true })!,
   *         currentVersion: parseInt(
   *           config.get<string>('COBRANZA_CRYPTO_KEY_VERSION', { infer: true }) ?? '1',
   *           10,
   *         ),
   *         defaultKeyName: EncryptionKey.PII,
   *       }),
   *     }),
   *   ],
   * })
   * export class AppModule {}
   * ```
   *
   * @see {@link CryptoModuleAsyncOptions} for the full options interface.
   * @see {@link CryptoModule.forRoot} for synchronous registration.
   */
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
    readonly imports?: Array<Type<unknown> | DynamicModule> | undefined;
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
