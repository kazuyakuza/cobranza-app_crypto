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

/** AES-256-GCM payload = 12-byte IV + 16-byte auth tag, both fixed by the algorithm. */
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const FIXED_OVERHEAD_BYTES = IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES;

/** Deterministic structural shape of an `EncryptedValue` (no exact ciphertext). */
export interface ExpectedEncryptedShape {
  readonly algorithm: 'aes-256-gcm';
  readonly keyName: string;
  readonly version: number;
  readonly encryptedDataByteLength: number;
}

/** Deterministic byte length of the base64-decoded `IV + ciphertext + authTag` payload. */
export function encryptedDataByteLengthFor(plaintext: string): number {
  return FIXED_OVERHEAD_BYTES + Buffer.byteLength(plaintext, 'utf8');
}

/** Minimal `EncryptedValue`-like input for {@link encryptedMatchesShape}. */
export interface EncryptedMatchInput {
  readonly algorithm?: string;
  readonly keyName: string;
  readonly version?: number;
  readonly encryptedData: string;
}

/** Inputs to {@link encryptedMatchesShape}. */
export interface EncryptedMatchParams {
  readonly encrypted: EncryptedMatchInput;
  readonly vector: TestVector;
}

/** Whether an `EncryptedValue` matches the vector's deterministic structural shape. */
export function encryptedMatchesShape(params: EncryptedMatchParams): boolean {
  const { encrypted, vector } = params;
  const shape = vector.expectedEncryptedShape;
  const decodedLength = Buffer.from(encrypted.encryptedData, 'base64').length;
  return encrypted.algorithm === shape.algorithm
    && encrypted.keyName === shape.keyName
    && (encrypted.version ?? vector.version) === shape.version
    && decodedLength === shape.encryptedDataByteLength;
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

/**
 * Curated set of deterministic test vectors covering every {@link EncryptionKey}
 * category plus edge cases: empty string, long text, special characters, CJK
 * unicode, numeric values, and version isolation.
 */
export const TEST_VECTORS: readonly TestVector[] = [
  /* 1 — Typical PII email (v1). */
  {
    plaintext: 'john.doe@example.com',
    keyName: EncryptionKey.PII,
    version: 1,
    expectedEncryptedShape: {
      algorithm: 'aes-256-gcm',
      keyName: EncryptionKey.PII,
      version: 1,
      encryptedDataByteLength: encryptedDataByteLengthFor('john.doe@example.com'),
    },
    expectedHash: 'oM9H5AO39AGxLZwhbmlmpwNP2rsmSJ/gLKh9ARt4UEA=',
  },
  /* 2 — Company-internal identifier (COMPANY_PII, v1). */
  {
    plaintext: '12-34567890-1',
    keyName: EncryptionKey.COMPANY_PII,
    version: 1,
    expectedEncryptedShape: {
      algorithm: 'aes-256-gcm',
      keyName: EncryptionKey.COMPANY_PII,
      version: 1,
      encryptedDataByteLength: encryptedDataByteLengthFor('12-34567890-1'),
    },
    expectedHash: 'CvWIUqRMpiRRcBB5oqhpgODE60NWl43rZ/Kl0cW71GA=',
  },
  /* 3 — Banking reference under BANK_DATA with version 2 (rotation scenario). */
  {
    plaintext: 'PAYMENT-REF-2026-000001',
    keyName: EncryptionKey.BANK_DATA,
    version: 2,
    expectedEncryptedShape: {
      algorithm: 'aes-256-gcm',
      keyName: EncryptionKey.BANK_DATA,
      version: 2,
      encryptedDataByteLength: encryptedDataByteLengthFor('PAYMENT-REF-2026-000001'),
    },
    expectedHash: 'hMdAYYo6XAE8qrYRilageUi315p2yQ5Pqd/4Cigre9s=',
  },
  /* 4 — Notification text under NOTIFICATION key (v1). */
  {
    plaintext: 'Your invoice #12345 is ready',
    keyName: EncryptionKey.NOTIFICATION,
    version: 1,
    expectedEncryptedShape: {
      algorithm: 'aes-256-gcm',
      keyName: EncryptionKey.NOTIFICATION,
      version: 1,
      encryptedDataByteLength: encryptedDataByteLengthFor('Your invoice #12345 is ready'),
    },
    expectedHash: 'n/9f3Gnoihly+amJmlwpZxwjtNYEf+9lt5uYSgt+7nA=',
  },
  /* 5 — Generic catch-all key category (GENERAL, v1). */
  {
    plaintext: 'generic-sensitive-value',
    keyName: EncryptionKey.GENERAL,
    version: 1,
    expectedEncryptedShape: {
      algorithm: 'aes-256-gcm',
      keyName: EncryptionKey.GENERAL,
      version: 1,
      encryptedDataByteLength: encryptedDataByteLengthFor('generic-sensitive-value'),
    },
    expectedHash: 'YkYg+IiodgnoFPXo879KL0dGlGA7UIT3pllwILpcShk=',
  },
  /* 6 — Latin-accent + emoji unicode under PII (v1). */
  {
    plaintext: 'José María — Cañón ünïcode😀',
    keyName: EncryptionKey.PII,
    version: 1,
    expectedEncryptedShape: {
      algorithm: 'aes-256-gcm',
      keyName: EncryptionKey.PII,
      version: 1,
      encryptedDataByteLength: encryptedDataByteLengthFor('José María — Cañón ünïcode😀'),
    },
    expectedHash: 'v0UTkJQ2gygMyP/qALoCHo1fpP/QdT1RUemryxbkWGY=',
  },
  /* --- Edge-case vectors below --- */
  /* 7 — Empty string under PII (v1); smallest possible payload. */
  {
    plaintext: '',
    keyName: EncryptionKey.PII,
    version: 1,
    expectedEncryptedShape: {
      algorithm: 'aes-256-gcm',
      keyName: EncryptionKey.PII,
      version: 1,
      encryptedDataByteLength: encryptedDataByteLengthFor(''),
    },
    expectedHash: 'thNnmggU2ex3L5XXeMNfxf8Wl8STcVZTxscSFEKSxa0=',
  },
  /* 8 — Short numeric string under GENERAL with version 2. */
  {
    plaintext: '42',
    keyName: EncryptionKey.GENERAL,
    version: 2,
    expectedEncryptedShape: {
      algorithm: 'aes-256-gcm',
      keyName: EncryptionKey.GENERAL,
      version: 2,
      encryptedDataByteLength: encryptedDataByteLengthFor('42'),
    },
    expectedHash: 'ls4KWoIINwq0q9Y1RgxMmvyUxujyo9cXFHpDSl4/TJs=',
  },
  /* 9 — CJK characters under COMPANY_PII (v2); multi-byte UTF-8 coverage. */
  {
    plaintext: '你好世界',
    keyName: EncryptionKey.COMPANY_PII,
    version: 2,
    expectedEncryptedShape: {
      algorithm: 'aes-256-gcm',
      keyName: EncryptionKey.COMPANY_PII,
      version: 2,
      encryptedDataByteLength: encryptedDataByteLengthFor('你好世界'),
    },
    expectedHash: 'YrOb1cRfw6DRG/z9X4XTZoQIBoVJ6ywpSxqVOJjnU9A=',
  },
  /* 10 — Embedded newline under NOTIFICATION (v1); whitespace edge case. */
  {
    plaintext: 'line1\nline2',
    keyName: EncryptionKey.NOTIFICATION,
    version: 1,
    expectedEncryptedShape: {
      algorithm: 'aes-256-gcm',
      keyName: EncryptionKey.NOTIFICATION,
      version: 1,
      encryptedDataByteLength: encryptedDataByteLengthFor('line1\nline2'),
    },
    expectedHash: 'yL8Nw0zykZiWPqGmSxR2oFTKw3fpMEkdhTK4L7V0fxk=',
  },
  /* 11 — Long text (10 000 chars) under BANK_DATA (v1); stress / perf boundary. */
  {
    plaintext: 'A'.repeat(10000),
    keyName: EncryptionKey.BANK_DATA,
    version: 1,
    expectedEncryptedShape: {
      algorithm: 'aes-256-gcm',
      keyName: EncryptionKey.BANK_DATA,
      version: 1,
      encryptedDataByteLength: encryptedDataByteLengthFor('A'.repeat(10000)),
    },
    expectedHash: 'TrYDH69By8Vn8DPbvZS8B6KiCU9iPSc9m7eIsvOrb9A=',
  },
];
