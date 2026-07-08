/**
 * Public entrypoint for `@cobranza-apps/crypto` (`.` export).
 *
 * ## Exported API
 *
 * | Export | Kind | Description |
 * | --- | --- | --- |
 * | {@link SecureCrypto} | class | Core encryption/hashing service (Phase 1 skeleton) |
 * | {@link EncryptionKey} | enum | Logical key category constants |
 * | {@link CryptoConfig} | interface | Constructor configuration shape |
 *
 * ## Quick start
 *
 * ```ts
 * import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';
 * import type { CryptoConfig } from '@cobranza-apps/crypto';
 *
 * const config: CryptoConfig = {
 *   masterKey: process.env.MASTER_KEY!,   // base64, 32 bytes decoded
 *   hashSalt: process.env.HASH_SALT!,     // base64, non-empty
 *   currentVersion: 1,
 *   defaultKeyName: EncryptionKey.PII,
 * };
 *
 * const crypto = new SecureCrypto(config);
 * crypto.hasKey(EncryptionKey.PII); // => true
 * ```
 *
 * @remarks
 * **Phase 1**: crypto methods (`encrypt`, `decrypt`, `hash`, `verifyHash`,
 * `encryptAndHash`) throw until Phase 2. `hasKey` / `getAvailableKeys` are functional.
 *
 * The dedicated testing subpath is available as `@cobranza-apps/crypto/testing`
 * (see `src/testing/index.ts`, populated in Task 4).
 *
 * @packageDocumentation
 * @see {@link module:crypto.service} for the SecureCrypto implementation
 * @see {@link module:crypto.service.validation} for config resolution internals
 */

export { EncryptionKey } from './config.js';
export type { CryptoConfig } from './config.js';
export { SecureCrypto } from './crypto.service.js';
