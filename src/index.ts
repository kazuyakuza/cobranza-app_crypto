/**
 * Public entrypoint for `@cobranza-apps/crypto` (`.` export).
 *
 * Barrel re-exports of the public API:
 * - {@link SecureCrypto} — core encryption/hashing service.
 * - {@link EncryptionKey} — logical key category enum.
 * - {@link CryptoConfig} — constructor configuration interface.
 *
 * The dedicated testing subpath is available as `@cobranza-apps/crypto/testing`
 * (see `src/testing/index.ts`, populated in Task 4).
 *
 * @packageDocumentation
 */

export { EncryptionKey } from './config.js';
export type { CryptoConfig } from './config.js';
export { SecureCrypto } from './crypto.service.js';
