/**
 * Public entrypoint for the `@cobranza-apps/crypto/testing` subpath.
 *
 * Exports test-only utilities for deterministic SecureCrypto testing:
 * - {@link getTestCrypto} — factory returning a pre-configured instance with fixed keys.
 * - {@link SecureCryptoTestModule} — NestJS-friendly provider config (spreadable into
 *   `Test.createTestingModule`; requires `@nestjs/testing` at the consumer side).
 * - {@link TEST_CRYPTO_CONFIG}, {@link TEST_MASTER_KEY}, {@link TEST_HASH_SALT} — fixed
 *   test fixtures.
 * - Re-exports {@link TEST_VECTORS} (+ {@link TestVector} type) from `./test-vectors.js`.
 *
 * @remarks
 * All keys/salts here are TEST-ONLY, derived from zero-filled buffers, and MUST NEVER
 * be used in production (brief §7). They are safe to publish.
 *
 * @packageDocumentation
 */

import { EncryptionKey } from '../config.js';
import type { CryptoConfig } from '../config.js';
import { SecureCrypto } from '../crypto.service.js';

export type { TestVector } from './test-vectors.js';
export { TEST_VECTORS } from './test-vectors.js';

/** Test master-key byte length; MUST match the validated length (AES-256 = 32 bytes). */
const TEST_MASTER_KEY_BYTES = 32;

/** Test hash-salt byte length (>=32 per brief §4.2); chosen generously as 64. */
const TEST_HASH_SALT_BYTES = 64;

/** Fixed all-zero master key, base64-encoded. TEST-ONLY. */
export const TEST_MASTER_KEY: string = Buffer.alloc(TEST_MASTER_KEY_BYTES).toString('base64');

/** Fixed all-zero hash salt, base64-encoded. TEST-ONLY. */
export const TEST_HASH_SALT: string = Buffer.alloc(TEST_HASH_SALT_BYTES).toString('base64');

/** Fixed test configuration assembled from the known test keys. */
export const TEST_CRYPTO_CONFIG: CryptoConfig = {
  masterKey: TEST_MASTER_KEY,
  hashSalt: TEST_HASH_SALT,
  currentVersion: 1,
  defaultKeyName: EncryptionKey.PII,
};

/**
 * Build a fresh {@link SecureCrypto} instance pre-configured with fixed test keys.
 *
 * Each call returns a new instance so tests never share mutable state.
 *
 * @returns A {@link SecureCrypto} configured with {@link TEST_CRYPTO_CONFIG}.
 *
 * @example
 * ```ts
 * import { getTestCrypto } from '@cobranza-apps/crypto/testing';
 * const crypto = getTestCrypto();
 * crypto.hasKey('pii'); // => true
 * ```
 */
export function getTestCrypto(): SecureCrypto {
  return new SecureCrypto(TEST_CRYPTO_CONFIG);
}

/** Provider-config shape spreadable into NestJS `Test.createTestingModule`. */
export interface SecureCryptoProviderConfig {
  readonly providers: Array<{
    readonly provide: typeof SecureCrypto;
    readonly useFactory: () => SecureCrypto;
  }>;
  readonly exports: Array<typeof SecureCrypto>;
}

/**
 * NestJS-friendly provider config for {@link SecureCrypto} using fixed test keys.
 *
 * Not a NestJS module class (this library does not depend on `@nestjs/testing`).
 * Spread it into a `Test.createTestingModule` call at the consumer side:
 *
 * ```ts
 * import { Test } from '@nestjs/testing';
 * import { SecureCryptoTestModule } from '@cobranza-apps/crypto/testing';
 *
 * const moduleRef = await Test.createTestingModule({
 *   ...SecureCryptoTestModule,
 * }).compile();
 * const crypto = moduleRef.get(SecureCrypto);
 * ```
 */
export const SecureCryptoTestModule: SecureCryptoProviderConfig = {
  providers: [{ provide: SecureCrypto, useFactory: getTestCrypto }],
  exports: [SecureCrypto],
};
