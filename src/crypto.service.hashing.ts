/**
 * HMAC-SHA256 deterministic hashing primitives for {@link module:crypto.service}.
 *
 * Encapsulates the keyed-hash operations used for indexed PII lookups (brief §3.2)
 * so the orchestrator stays under the 200-line source file limit. Verification
 * uses constant-time comparison via {@link module:utils.constantTimeCompare}.
 *
 * @remarks Uses Node.js built-in `crypto` only.
 * @module crypto.service.hashing
 */

import { createHmac } from 'node:crypto';

import { constantTimeCompare } from './utils.js';
import { assertValidHash, assertValidPlaintext } from './crypto.service.guards.js';

const HMAC_ALGORITHM = 'sha256';

/** Inputs required to compute a deterministic HMAC-SHA256 hash. */
export interface HashParams {
  readonly plaintext: string;
  readonly salt: Buffer;
}

/** Inputs required to verify a plaintext against an expected HMAC-SHA256 hash. */
export interface VerifyHashParams {
  readonly plaintext: string;
  readonly salt: Buffer;
  readonly expectedHash: string;
}

/**
 * Compute a deterministic base64 HMAC-SHA256 hash of `plaintext` keyed by `salt`.
 *
 * @param params - Plaintext and the decoded hash salt (>= 32 bytes).
 * @returns Base64-encoded HMAC-SHA256 digest.
 */
export function computeHmacSha256(params: HashParams): string {
  const { plaintext, salt } = params;
  assertValidPlaintext(plaintext);
  const hmac = createHmac(HMAC_ALGORITHM, salt);
  hmac.update(plaintext, 'utf8');
  return hmac.digest('base64');
}

/**
 * Verify `plaintext` against an expected hash using constant-time comparison.
 *
 * @param params - Plaintext, decoded hash salt, and the expected base64 hash.
 * @returns `true` when the recomputed hash matches `expectedHash`.
 */
export function verifyHmacSha256(params: VerifyHashParams): boolean {
  const { plaintext, salt, expectedHash } = params;
  assertValidHash(expectedHash);
  const recomputedHash = computeHmacSha256({ plaintext, salt });
  return constantTimeCompare(recomputedHash, expectedHash);
}
