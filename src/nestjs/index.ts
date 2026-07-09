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
