# Real-World Scenarios

## Table of Contents

- [Overview](#overview)
- [Scenario 1 — Email (PII, dual-column)](#scenario-1--email-pii-dual-column)
- [Scenario 2 — Tax ID (Company PII, dual-column + lookup)](#scenario-2--tax-id-company-pii-dual-column--lookup)
- [Scenario 3 — Bank Description (Bank Data, encrypt-only)](#scenario-3--bank-description-bank-data-encrypt-only)
- [Scenario 4 — Customer Object (Bulk encrypt / decrypt)](#scenario-4--customer-object-bulk-encrypt--decrypt)
- [Cross-cutting: Decrypt on Read](#cross-cutting-decrypt-on-read)
- [Choosing an EncryptionKey Category](#choosing-an-encryptionkey-category)
- [Reference](#reference)

## Overview

These scenarios show how to apply the library to common sensitive fields in a Cobranza App microservice. Each example uses the correct `EncryptionKey` category and follows the recommended dual-column or encrypt-only pattern.

## Scenario 1 — Email (PII, dual-column)

Email is personally identifiable information (PII). Store it as encrypted ciphertext for confidentiality plus a deterministic hash for indexed lookups.

- **On write**: store encrypted email + deterministic hash (`users.encrypted_email = encrypted; users.email_hash = hash`).
- **On search**: look up by hash without touching the ciphertext (`SELECT * FROM users WHERE email_hash = :candidateHash`).
- **On read**: decrypt only the rows you return.

```typescript
import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';

const crypto = new SecureCrypto(cryptoConfig);

// Write: encrypt for confidentiality + hash for indexed lookup
const { encrypted, hash } = crypto.encryptAndHash('user@example.com', EncryptionKey.PII);

// Search: hash the candidate to compare against the stored hash index
const candidateHash = crypto.hash('user@example.com');

// Read: decrypt only the rows you return
const plaintext = crypto.decrypt(encrypted);
```

## Scenario 2 — Tax ID (Company PII, dual-column + lookup)

Tax IDs are company-level PII. They need confidentiality and a uniqueness index for dedup checks.

- **Write**: store encrypted tax ID + hash (`companies.encrypted_tax_id = encrypted; companies.tax_id_hash = hash`).
- **Dedup**: before insert, hash the input to check for existing records (`companyRepo.findOne({ where: { taxIdHash } })`).
- **Verify**: confirm a submitted tax ID matches the stored record using constant-time comparison (`crypto.verifyHash`).

```typescript
// Write: dual-column pattern for company-level PII
const { encrypted, hash } = crypto.encryptAndHash('RFC-ABCD123456', EncryptionKey.COMPANY_PII);

// Dedup: hash the input and check for existing records before insert
const taxIdHash = crypto.hash('RFC-ABCD123456');
const existing = await companyRepo.findOne({ where: { taxIdHash } });
if (existing) {
  throw new Error('A company with this tax ID already exists.');
}

// Verify: constant-time comparison to confirm submitted tax ID matches stored record
const matches = crypto.verifyHash('RFC-ABCD123456', storedRecord.taxIdHash);
```

## Scenario 3 — Bank Description (Bank Data, encrypt-only)

Transaction descriptions are sensitive bank data. They are free-text and rarely need a hash index, so encrypt-only is the common pattern.

- **Write**: store encrypted description (`transactions.encrypted_description = encrypted`).
- **Read**: decrypt on statement generation or audit.
- **Dedup**: if needed later, add a hash column via `encryptAndHash`.

```typescript
// Write: encrypt-only pattern (no hash index needed for free-text bank data)
const encrypted = crypto.encrypt('Payment for invoice INV-2026-0042', EncryptionKey.BANK_DATA);

// Read: decrypt on statement generation or audit
const description = crypto.decrypt(encrypted);
```

## Scenario 4 — Customer Object (Bulk encrypt / decrypt)

When a DTO or entity carries multiple PII fields, encrypt them all in a single
call with `encryptObject`. Only the fields listed in the `fieldMap` are
transformed; unmapped fields pass through unchanged. The input object is never
mutated.

```typescript
import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';
import type { BulkFieldMap } from '@cobranza-apps/crypto';

interface Customer {
  email: string;
  fullName: string;
  taxId: string;
  id: number;
}

const customerFieldMap: BulkFieldMap<Customer> = {
  email:    EncryptionKey.PII,
  fullName: EncryptionKey.PII,
  taxId:    EncryptionKey.COMPANY_PII,
};

// Write: encrypt every mapped PII field in one call
const customer = { email: 'a@b.com', fullName: 'Ana', taxId: 'RFC-ABCD123456', id: 42 };
const encrypted = crypto.encryptObject(customer, customerFieldMap);
// encrypted.email    is an EncryptedValue (keyName: 'pii')
// encrypted.fullName is an EncryptedValue (keyName: 'pii')
// encrypted.taxId    is an EncryptedValue (keyName: 'company_pii')
// encrypted.id       === 42 (untouched)

// Read: decrypt every mapped EncryptedValue field in one call
const plaintext = crypto.decryptObject(encrypted, customerFieldMap);
// plaintext.email    === 'a@b.com'
// plaintext.fullName === 'Ana'
// plaintext.taxId    === 'RFC-ABCD123456'
```

> **Tip:** Pair `encryptObject` / `decryptObject` with `@IsEncryptedField()`
> from `@cobranza-apps/entities` for end-to-end type safety in NestJS DTOs.

## Cross-cutting: Decrypt on Read

Decrypt only the rows and columns you render. Avoid bulk-decrypting entire tables.

```typescript
// Decrypt only the rows and columns you render — never bulk-decrypt entire tables
const rows = await repo.find();
const view = rows.map((r) => ({ ...r, email: crypto.decrypt(r.encryptedEmail) }));
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
