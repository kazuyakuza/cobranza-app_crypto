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
  /**
   * Creates a new `CryptoService` instance.
   *
   * @param config - The resolved {@link CryptoConfig} injected via {@link CRYPTO_CONFIG}.
   *
   * @remarks
   * NestJS instantiates this class automatically when `CryptoModule` is registered.
   * Consumers should inject `CryptoService` rather than instantiating it directly.
   */
  constructor(@Inject(CRYPTO_CONFIG) config: CryptoConfig) {
    super(config);
  }
}
