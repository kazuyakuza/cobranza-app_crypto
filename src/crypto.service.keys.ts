/**
 * Per-category key derivation (HKDF-based) for {@link module:crypto.service}.
 *
 * Extracts {@link deriveKeyForCategory} from `crypto.service.ts` to keep that
 * file under the 200-line source file limit. This module manages the in-memory
 * derivation cache and delegates the actual HKDF call to {@link module:hkdf}.
 *
 * @module crypto.service.keys
 */

import { deriveKey } from './hkdf.js';
import type { ResolvedConfig } from './crypto.service.validation.js';

/** Input params for {@link deriveKeyForCategory}. */
export interface DeriveKeyForCategoryParams {
  readonly keyName: string;
  readonly version: number;
  readonly resolvedConfig: ResolvedConfig;
  readonly derivedKeysCache: Map<string, Buffer>;
}

/**
 * Derive (or return cached) 32-byte AES-256 key for a key category + version.
 *
 * @param params - Key name, version, resolved config, and the shared cache map.
 * @returns 32-byte derived key buffer.
 * @throws {Error} when `keyName` is empty.
 */
export function deriveKeyForCategory(params: DeriveKeyForCategoryParams): Buffer {
  const { keyName, version, resolvedConfig, derivedKeysCache } = params;
  if (!keyName) {
    throw new Error('Invalid keyName: must be a non-empty string.');
  }
  const cacheKey = `${keyName}:v${version}`;
  const cachedKey = derivedKeysCache.get(cacheKey);
  if (cachedKey) {
    return cachedKey;
  }
  const derivedKeyBuffer = deriveKey({
    masterKey: resolvedConfig.masterKey,
    keyName,
    version,
  });
  derivedKeysCache.set(cacheKey, derivedKeyBuffer);
  return derivedKeyBuffer;
}
