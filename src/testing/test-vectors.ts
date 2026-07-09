/**
 * Deterministic test vectors for SecureCrypto operations.
 *
 * Fields:
 * - `expectedHash` — real base64 HMAC-SHA256 literal, fully deterministic
 *   (HMAC is salt-keyed and plaintext-deterministic). Asserted exactly.
 * - `expectedEncryptedShape` — deterministic STRUCTURAL shape of the
 *   `EncryptedValue`, NOT an exact ciphertext. AES-256-GCM uses a random
 *   12-byte IV per encryption, so the ciphertext itself is non-deterministic
 *   (brief §7 / architecture.md: "Non-random IVs are prohibited"). The shape
 *   asserts `algorithm`, `keyName`, `version`, and `encryptedDataByteLength`
 *   (= 12 IV + utf8(plaintext) ciphertext + 16 authTag). Ciphertext correctness
 *   is verified separately via encrypt->decrypt roundtrip tests.
 *
 * @packageDocumentation
 */

import { EncryptionKey } from '../config.js';
import type { ExpectedEncryptedShape } from './encrypted-shape.js';

/** AES-256-GCM payload = 12-byte IV + 16-byte auth tag, both fixed by the algorithm. */
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const FIXED_OVERHEAD_BYTES = IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES;

/** Deterministic byte length of the base64-decoded `IV + ciphertext + authTag` payload. */
export function encryptedDataByteLengthFor(plaintext: string): number {
  return FIXED_OVERHEAD_BYTES + Buffer.byteLength(plaintext, 'utf8');
}

/** Deterministic input/output pair for a single SecureCrypto operation. */
export interface TestVector {
  /** Plaintext input to encrypt/hash. */
  readonly plaintext: string;

  /** Logical key category used for encryption. */
  readonly keyName: EncryptionKey;

  /** Key version (increment on rotation). */
  readonly version: number;

  /** Deterministic structural shape; ciphertext itself is non-deterministic (random IV). */
  readonly expectedEncryptedShape: ExpectedEncryptedShape;

  /** Expected deterministic HMAC-SHA256 hash (real literal). */
  readonly expectedHash: string;
}

// --- Factory to reduce per-vector boilerplate ---

function createVector(
  plaintext: string,
  keyName: EncryptionKey,
  version: number,
  expectedHash: string,
): TestVector {
  return {
    plaintext,
    keyName,
    version,
    expectedEncryptedShape: {
      algorithm: 'aes-256-gcm',
      keyName,
      version,
      encryptedDataByteLength: encryptedDataByteLengthFor(plaintext),
    },
    expectedHash,
  };
}

/**
 * Curated set of deterministic test vectors covering every {@link EncryptionKey}
 * category plus edge cases: empty string, long text, special characters, CJK
 * unicode, numeric values, and version isolation.
 */
export const TEST_VECTORS: readonly TestVector[] = [
  // 1 — Typical PII email (v1)
  createVector('john.doe@example.com', EncryptionKey.PII, 1, 'oM9H5AO39AGxLZwhbmlmpwNP2rsmSJ/gLKh9ARt4UEA='),
  // 2 — Company-internal identifier (COMPANY_PII, v1)
  createVector('12-34567890-1', EncryptionKey.COMPANY_PII, 1, 'CvWIUqRMpiRRcBB5oqhpgODE60NWl43rZ/Kl0cW71GA='),
  // 3 — Banking reference under BANK_DATA with version 2 (rotation scenario)
  createVector('PAYMENT-REF-2026-000001', EncryptionKey.BANK_DATA, 2, 'hMdAYYo6XAE8qrYRilageUi315p2yQ5Pqd/4Cigre9s='),
  // 4 — Notification text under NOTIFICATION key (v1)
  createVector('Your invoice #12345 is ready', EncryptionKey.NOTIFICATION, 1, 'n/9f3Gnoihly+amJmlwpZxwjtNYEf+9lt5uYSgt+7nA='),
  // 5 — Generic catch-all key category (GENERAL, v1)
  createVector('generic-sensitive-value', EncryptionKey.GENERAL, 1, 'YkYg+IiodgnoFPXo879KL0dGlGA7UIT3pllwILpcShk='),
  // 6 — Latin-accent + emoji unicode under PII (v1)
  createVector('José María — Cañón ünïcode😀', EncryptionKey.PII, 1, 'v0UTkJQ2gygMyP/qALoCHo1fpP/QdT1RUemryxbkWGY='),
  // Edge-case vectors below
  // 7 — Empty string under PII (v1); smallest possible payload
  createVector('', EncryptionKey.PII, 1, 'thNnmggU2ex3L5XXeMNfxf8Wl8STcVZTxscSFEKSxa0='),
  // 8 — Short numeric string under GENERAL with version 2
  createVector('42', EncryptionKey.GENERAL, 2, 'ls4KWoIINwq0q9Y1RgxMmvyUxujyo9cXFHpDSl4/TJs='),
  // 9 — CJK characters under COMPANY_PII (v2); multi-byte UTF-8 coverage
  createVector('你好世界', EncryptionKey.COMPANY_PII, 2, 'YrOb1cRfw6DRG/z9X4XTZoQIBoVJ6ywpSxqVOJjnU9A='),
  // 10 — Embedded newline under NOTIFICATION (v1); whitespace edge case
  createVector('line1\nline2', EncryptionKey.NOTIFICATION, 1, 'yL8Nw0zykZiWPqGmSxR2oFTKw3fpMEkdhTK4L7V0fxk='),
  // 11 — Long text (10 000 chars) under BANK_DATA (v1); stress / perf boundary
  createVector('A'.repeat(10000), EncryptionKey.BANK_DATA, 1, 'TrYDH69By8Vn8DPbvZS8B6KiCU9iPSc9m7eIsvOrb9A='),
];
