# Real-World Scenarios

## Table of Contents

- [Overview](#overview)
- [Scenario 1 — Email (PII, dual-column)](#scenario-1--email-pii-dual-column)
- [Scenario 2 — Tax ID (Company PII, dual-column + lookup)](#scenario-2--tax-id-company-pii-dual-column--lookup)
- [Scenario 3 — Bank Description (Bank Data, encrypt-only)](#scenario-3--bank-description-bank-data-encrypt-only)
- [Cross-cutting: Decrypt on Read](#cross-cutting-decrypt-on-read)
- [Choosing an EncryptionKey Category](#choosing-an-encryptionkey-category)
- [Reference](#reference)

## Overview

These scenarios show how to apply the library to common sensitive fields in a Cobranza App microservice. Each example uses the correct `EncryptionKey` category and follows the recommended dual-column or encrypt-only pattern.

## Scenario 1 — Email (PII, dual-column)

Email is personally identifiable information (PII). Store it as encrypted ciphertext for confidentiality plus a deterministic hash for indexed lookups.

```typescript
import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';

const crypto = new SecureCrypto(cryptoConfig);

// On write: store encrypted email + deterministic hash for indexed lookup
const { encrypted, hash } = crypto.encryptAndHash('user@example.com', EncryptionKey.PII);
// DB: users.encrypted_email = encrypted; users.email_hash = hash

// On search: look up by hash without touching the ciphertext
const candidateHash = crypto.hash('user@example.com');
// SELECT * FROM users WHERE email_hash = :candidateHash

// On read: decrypt only the rows you return
const plaintext = crypto.decrypt(encrypted); // 'user@example.com'
```

## Scenario 2 — Tax ID (Company PII, dual-column + lookup)

Tax IDs are company-level PII. They need confidentiality and a uniqueness index for dedup checks.

```typescript
// taxId is company-level PII; needs confidentiality + an index for uniqueness/dedup checks
const { encrypted, hash } = crypto.encryptAndHash('RFC-ABCD123456', EncryptionKey.COMPANY_PII);
// DB: companies.encrypted_tax_id = encrypted; companies.tax_id_hash = hash

// Dedup check before insert: does this taxId already exist?
const taxIdHash = crypto.hash('RFC-ABCD123456');
const existing = await companyRepo.findOne({ where: { taxIdHash } });
if (existing) {
  throw new Error('A company with this tax ID already exists.');
}

// Verify a submitted taxId matches a stored record (constant-time)
const matches = crypto.verifyHash('RFC-ABCD123456', storedRecord.taxIdHash);
```

## Scenario 3 — Bank Description (Bank Data, encrypt-only)

Transaction descriptions are sensitive bank data. They are free-text and rarely need a hash index, so encrypt-only is the common pattern.

```typescript
// Transaction descriptions are sensitive bank data. They are free-text and rarely need
// a hash index, so encrypt-only is the common pattern.
const encrypted = crypto.encrypt('Payment for invoice INV-2026-0042', EncryptionKey.BANK_DATA);
// DB: transactions.encrypted_description = encrypted

// On read (statement generation / audit):
const description = crypto.decrypt(encrypted);
// 'Payment for invoice INV-2026-0042'

// If dedup across descriptions is needed later, add a hash column via encryptAndHash.
```

## Cross-cutting: Decrypt on Read

Avoid bulk-decrypting entire tables:

```typescript
// GOOD: decrypt only the rows/columns you render
const rows = await repo.find(); // fetch only needed rows
const view = rows.map((r) => ({ ...r, email: crypto.decrypt(r.encryptedEmail) }));

// AVOID: decrypting every row in a large table in a single pass
```

## Choosing an EncryptionKey Category

| Field example | Category | Hash column? |
|---|---|---|
| email, phone, fullName | `PII` | Yes (`emailHash`, lookup/dedup) |
| taxId, businessName | `COMPANY_PII` | Yes (`taxIdHash`, uniqueness) |
| transaction description, reference, notes | `BANK_DATA` | Usually no (free-text); add if dedup needed |
| notification subject/body | `NOTIFICATION` | Usually no |
| other sensitive fields | `GENERAL` | As needed |

## Reference

- [Getting Started](./getting-started.md) — Zero-to-first-roundtrip guide.
- [NestJS Integration Example](./nestjs-integration-example.md) — End-to-end module + DTO + service + subscriber + test.
- [README Usage Examples](../README.md#usage-examples) — Encrypt, decrypt, hash.
- [`architecture.md`](../.agent/project-info/architecture.md) — EncryptionKey categories.
- [`brief.md`](../.agent/project-info/brief.md) — Project scope §5.
