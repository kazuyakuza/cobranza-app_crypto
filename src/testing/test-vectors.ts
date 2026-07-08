/**
 * Deterministic test vectors for SecureCrypto operations.
 *
 * Fixed input/output pairs for encrypt/decrypt/hash/verifyHash. In Phase 1 the
 * `expectedEncrypted` and `expectedHash` fields are placeholders because the crypto
 * methods are not implemented yet. Phase 2 will populate:
 * - `expectedHash` with real HMAC-SHA256 values (deterministic).
 * - `expectedEncrypted` requires a fixed-IV test mode: AES-256-GCM uses a random
 *   12-byte IV, so ciphertext is otherwise non-deterministic (see plan D5).
 *
 * @packageDocumentation
 */

import { EncryptionKey } from '../config.js';

/** Sentinel marking a value deferred to Phase 2. */
const PHASE2_PLACEHOLDER = 'PLACEHOLDER_PHASE2';

/** Deterministic input/output pair for a single SecureCrypto operation. */
export interface TestVector {
  /** Plaintext input to encrypt/hash. */
  readonly plaintext: string;

  /** Logical key category used for encryption. */
  readonly keyName: EncryptionKey;

  /** Key version (increment on rotation). */
  readonly version: number;

  /** Expected base64 `IV(12) + ciphertext + authTag(16)`. Placeholder until Phase 2. */
  readonly expectedEncrypted: string;

  /** Expected deterministic HMAC-SHA256 hash. Placeholder until Phase 2. */
  readonly expectedHash: string;
}

/**
 * Curated set of deterministic test vectors covering every {@link EncryptionKey}
 * category plus a unicode/emoji edge case.
 */
export const TEST_VECTORS: readonly TestVector[] = [
  {
    plaintext: 'john.doe@example.com',
    keyName: EncryptionKey.PII,
    version: 1,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: PHASE2_PLACEHOLDER,
  },
  {
    plaintext: '12-34567890-1',
    keyName: EncryptionKey.COMPANY_PII,
    version: 1,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: PHASE2_PLACEHOLDER,
  },
  {
    plaintext: 'PAYMENT-REF-2026-000001',
    keyName: EncryptionKey.BANK_DATA,
    version: 2,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: PHASE2_PLACEHOLDER,
  },
  {
    plaintext: 'Your invoice #12345 is ready',
    keyName: EncryptionKey.NOTIFICATION,
    version: 1,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: PHASE2_PLACEHOLDER,
  },
  {
    plaintext: 'generic-sensitive-value',
    keyName: EncryptionKey.GENERAL,
    version: 1,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: PHASE2_PLACEHOLDER,
  },
  {
    plaintext: 'José María — Cañón ünïcode😀',
    keyName: EncryptionKey.PII,
    version: 1,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: PHASE2_PLACEHOLDER,
  },
];
