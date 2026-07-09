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
      providers: [
        {
          provide: CRYPTO_CONFIG,
          inject: options.inject ?? [],
          useFactory: options.useFactory,
        },
        CryptoService,
      ],
      ...(options.imports !== undefined && { imports: options.imports }),
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
