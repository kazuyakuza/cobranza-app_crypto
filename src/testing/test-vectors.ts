/**
 * Deterministic test vectors for SecureCrypto operations.
 *
 * Fixed input/output pairs for encrypt/decrypt/hash/verifyHash. In this Phase 2
 * the `expectedHash` fields are real HMAC-SHA256 literals; `expectedEncrypted`
 * remains a placeholder because AES-256-GCM uses a random 12-byte IV, making
 * ciphertext non-deterministic. Task 3 will revisit `expectedEncrypted`.
 *
 * @packageDocumentation
 */

import { EncryptionKey } from '../config.js';

/** Sentinel marking a value deferred to Task 3. */
const PHASE2_PLACEHOLDER = 'PLACEHOLDER_PHASE2';

/** Deterministic input/output pair for a single SecureCrypto operation. */
export interface TestVector {
  /** Plaintext input to encrypt/hash. */
  readonly plaintext: string;

  /** Logical key category used for encryption. */
  readonly keyName: EncryptionKey;

  /** Key version (increment on rotation). */
  readonly version: number;

  /** Expected base64 `IV(12) + ciphertext + authTag(16)`. Placeholder until Task 3. */
  readonly expectedEncrypted: string;

  /** Expected deterministic HMAC-SHA256 hash (real literal in Phase 2). */
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
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: 'oM9H5AO39AGxLZwhbmlmpwNP2rsmSJ/gLKh9ARt4UEA=',
  },
  /* 2 — Company-internal identifier (COMPANY_PII, v1). */
  {
    plaintext: '12-34567890-1',
    keyName: EncryptionKey.COMPANY_PII,
    version: 1,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: 'CvWIUqRMpiRRcBB5oqhpgODE60NWl43rZ/Kl0cW71GA=',
  },
  /* 3 — Banking reference under BANK_DATA with version 2 (rotation scenario). */
  {
    plaintext: 'PAYMENT-REF-2026-000001',
    keyName: EncryptionKey.BANK_DATA,
    version: 2,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: 'hMdAYYo6XAE8qrYRilageUi315p2yQ5Pqd/4Cigre9s=',
  },
  /* 4 — Notification text under NOTIFICATION key (v1). */
  {
    plaintext: 'Your invoice #12345 is ready',
    keyName: EncryptionKey.NOTIFICATION,
    version: 1,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: 'n/9f3Gnoihly+amJmlwpZxwjtNYEf+9lt5uYSgt+7nA=',
  },
  /* 5 — Generic catch-all key category (GENERAL, v1). */
  {
    plaintext: 'generic-sensitive-value',
    keyName: EncryptionKey.GENERAL,
    version: 1,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: 'YkYg+IiodgnoFPXo879KL0dGlGA7UIT3pllwILpcShk=',
  },
  /* 6 — Latin-accent + emoji unicode under PII (v1). */
  {
    plaintext: 'José María — Cañón ünïcode😀',
    keyName: EncryptionKey.PII,
    version: 1,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: 'v0UTkJQ2gygMyP/qALoCHo1fpP/QdT1RUemryxbkWGY=',
  },
  /* --- Edge-case vectors below --- */
  /* 7 — Empty string under PII (v1); smallest possible payload. */
  {
    plaintext: '',
    keyName: EncryptionKey.PII,
    version: 1,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: 'thNnmggU2ex3L5XXeMNfxf8Wl8STcVZTxscSFEKSxa0=',
  },
  /* 8 — Short numeric string under GENERAL with version 2. */
  {
    plaintext: '42',
    keyName: EncryptionKey.GENERAL,
    version: 2,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: 'ls4KWoIINwq0q9Y1RgxMmvyUxujyo9cXFHpDSl4/TJs=',
  },
  /* 9 — CJK characters under COMPANY_PII (v2); multi-byte UTF-8 coverage. */
  {
    plaintext: '你好世界',
    keyName: EncryptionKey.COMPANY_PII,
    version: 2,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: 'YrOb1cRfw6DRG/z9X4XTZoQIBoVJ6ywpSxqVOJjnU9A=',
  },
  /* 10 — Embedded newline under NOTIFICATION (v1); whitespace edge case. */
  {
    plaintext: 'line1\nline2',
    keyName: EncryptionKey.NOTIFICATION,
    version: 1,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: 'yL8Nw0zykZiWPqGmSxR2oFTKw3fpMEkdhTK4L7V0fxk=',
  },
  /* 11 — Long text (10 000 chars) under BANK_DATA (v1); stress / perf boundary. */
  {
    plaintext: 'A'.repeat(10000),
    keyName: EncryptionKey.BANK_DATA,
    version: 1,
    expectedEncrypted: PHASE2_PLACEHOLDER,
    expectedHash: 'TrYDH69By8Vn8DPbvZS8B6KiCU9iPSc9m7eIsvOrb9A=',
  },
];
