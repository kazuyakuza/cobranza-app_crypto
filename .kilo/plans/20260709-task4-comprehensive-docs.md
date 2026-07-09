# Plan: Task 4 — Comprehensive Documentation & Examples

- **TODO file:** `.agent/todos/20260707/20260707-todo-3.md` (Task 4)
- **Critical Workflow step:** 4.1 Analysis & Planning
- **Sub-agent:** architect
- **Date:** 2026-07-09
- **Scope:** Documentation only. NO new source code in `src/`.

---

## 1. Task Reference (verbatim from TODO)

```
## Task 4: Comprehensive Documentation & Examples
- [ ] Review all documentation, and update to include:
  - Complete "Getting Started" section.
  - Full NestJS integration example.
  - Security checklist.
  - Key rotation guide (how to increment version and re-encrypt data).
  - Performance considerations.
- [ ] Expand examples with real-world scenarios (e.g. encrypting taxId, email, bank description).
```

### Constraints (from caller)
- No new source code in `src/` — documentation only.
- Keep docs concise and professional.
- All example code must be copy-pasteable and correct.
- Cross-reference related docs.

---

## 2. Context Summary

`@cobranza-apps/crypto` v0.3.0 (`package.json`). Library is feature-complete:

- `SecureCrypto` (`src/crypto.service.ts`): `encrypt`, `decrypt`, `hash`, `verifyHash`, `encryptAndHash`, `reEncrypt`, `hasKey`, `getAvailableKeys`, `destroy`.
- `CryptoConfig` (`src/config.ts`): `masterKey` (base64 32-byte), `hashSalt` (base64 >=32-byte), `currentVersion?` (default 1), `defaultKeyName?`.
- `EncryptionKey` enum: `PII='pii'`, `COMPANY_PII='company_pii'`, `BANK_DATA='bank_data'`, `NOTIFICATION='notification'`, `GENERAL='general'`.
- Cache utilities (`src/utils/cache.ts`): `TtlCache<K,V>`, `createDecryptionCache(defaultTtlMs)`, `DecryptionCache` type. Methods: `set`, `setWithTtl`, `get`, `has`, `delete`, `clear`, `size`, `purgeExpired`.
- NestJS subpath (`src/nestjs/`): `CryptoModule.forRoot(config)`, `CryptoModule.forRootAsync(options)`, `CryptoService extends SecureCrypto` (`@Injectable()`), `CRYPTO_CONFIG` DI token.
- Testing subpath (`src/testing/`): `getTestCrypto`, `buildTestCrypto`, `SecureCryptoTestModule`, `TEST_VECTORS`, shape predicates.

### Existing documentation (current state)
- `README.md` (354 lines): TOC, Requirements, Installation, Configuration, Usage Examples, API Summary, brief NestJS section (links out), Security Best Practices (prose), Key Rotation Procedure (5 steps), Performance Notes (4 bullets), Testing, Development, License.
- `docs/README.md`: documentation index.
- `docs/how-to-configure-in-nestjs.md` (364 lines): ConfigModule, CryptoModule forRoot/forRootAsync, provider, interceptor, DTO+decorator, key versioning (brief), testing, deployment, pitfalls.
- `docs/dto-decorator-integration.md` (367 lines): pipe, interceptor, TypeORM subscriber, ms-db-gateway recommendations.
- `docs/testing-utilities.md` (211 lines): imports, plain Jest, NestJS TestingModule, test vectors, recipes.
- `docs/how-to-set-up-git.md`, `docs/how-to-write-todo-files.md`: agent guides (out of scope for this task).

---

## 3. Findings & Gap Analysis

### 3.1 Gap map vs TODO requirements

| TODO requirement | Current state | Gap |
|---|---|---|
| Complete "Getting Started" section | Absent (README jumps Install -> Config -> Usage) | Need consolidated zero-to-first-roundtrip walkthrough |
| Full NestJS integration example | Pieces scattered across `how-to-configure-in-nestjs.md` + `dto-decorator-integration.md`; no single end-to-end walkthrough | Need one copy-pasteable end-to-end example tying module + service + DTO + subscriber + test |
| Security checklist | Prose ("Security Best Practices"), not a checklist | Need checklist (checkbox) format |
| Key rotation guide (increment version + re-encrypt) | Present but **INACCURATE** (see 3.2) | Correct + expand with `reEncrypt` batch job, hash handling, cache invalidation |
| Performance considerations | 4 bullets ("Performance Notes") | Expand: HKDF cost/cache, ciphertext overhead, sync CPU cost, GCM limits, bulk re-encryption |
| Real-world scenarios (taxId, email, bank description) | Only `user@example.com` used | Need explicit scenarios with dual-column pattern + lookup-by-hash |

### 3.2 CRITICAL FINDING — Key Rotation Procedure is inaccurate vs implementation

**README current text (lines 254-259):**
> 1. Generate a new 32-byte master key (base64).
> 2. Increment `currentVersion` and deploy with both the new key and the previous key(s) available for decryption (consumers configure a key-to-version map).
> ...

**Actual implementation behavior:**
- `CryptoConfig` has a **single** `masterKey` field. There is **no** key-to-version map and **no** multi-master-key support.
- `deriveKey` (`src/hkdf.ts`) builds HKDF `info` as `cobranza-encryption-v1:${keyName}:v${version}`. The **version is part of the HKDF info suffix**, so incrementing `currentVersion` produces a **new derived key from the same masterKey**.
- `encrypt` always uses `resolvedConfig.currentVersion`. `decrypt` uses `encryptedValue.version ?? currentVersion`. `reEncrypt` decrypts at the payload's version then re-encrypts at `currentVersion`.
- Therefore: changing the **masterKey material** would break decryption of all historical records (no old-key retention). The supported in-library rotation mechanism is **version increment only** (same masterKey).

**Conclusion:** The README's "generate a new master key" + "configure a key-to-version map" steps describe a model the library does not implement. The corrected guide must describe **version-based rotation** (increment `currentVersion`, same masterKey, `reEncrypt` migration). Full master-key-material rotation is a larger out-of-library operation (decrypt-all-with-old-master -> re-encrypt-with-new-master) and must be documented as such, not conflated with version rotation.

This is within Task 4 scope (correcting documentation to match implementation). No `src/` changes required.

### 3.3 Implementation facts to encode accurately in docs
- Input guards (`src/crypto.service.guards.ts`): max plaintext 1,000,000 UTF-8 bytes; max `encryptedData` 2,000,000 chars; base64 format validated; empty plaintext IS allowed.
- Ciphertext overhead: `IV(12) + authTag(16) = 28 bytes` per value, plus ~33% Base64 inflation.
- HKDF derivation is cached per `${keyName}:v${version}` in an in-memory `Map` (append-only after first derivation). First call per combo runs `hkdfSync`; subsequent calls are O(1) map lookup.
- Hashing uses HMAC-SHA256 keyed by `hashSalt`; **NOT** version-dependent. Rotating the encryption version does **not** change hash values — hash index columns need **no** migration during version rotation.
- `createDecryptionCache(ttlMs)` returns `TtlCache<string, string>`; TTL-bounded, no hard size cap; lazy eviction + `purgeExpired()`.
- Crypto operations are synchronous (`createCipheriv`/`update`/`final`) and CPU-bound; block the event loop. Fine for typical PII field sizes (<1 KB).

---

## 4. High-Level Approach

Treat README.md as the **hub** (concise sections + links to detailed docs) and add **focused, cross-referenced docs** in `docs/` for depth. This matches the existing pattern (README condensed -> `docs/*` detailed) and satisfies "keep docs concise and professional" + "cross-reference related docs".

### Files to create (NEW docs)
1. `docs/getting-started.md` — zero-to-first-roundtrip Getting Started.
2. `docs/nestjs-integration-example.md` — full end-to-end NestJS integration example.
3. `docs/security-checklist.md` — security checklist (checkbox format).
4. `docs/key-rotation-guide.md` — accurate version-based rotation + `reEncrypt` migration.
5. `docs/performance-considerations.md` — expanded performance guide.
6. `docs/real-world-scenarios.md` — taxId / email / bank description scenarios.

### Files to update (existing)
7. `README.md` — add Getting Started (condensed + link), Security Checklist (condensed + link), correct + condense Key Rotation (link to full guide), expand Performance (condensed + link), add Real-World Scenarios (condensed + link), update NestJS section to link to full example, update TOC. Fix the inaccurate key-rotation steps.
8. `docs/README.md` — add the 6 new docs to the index under a "Guides" subsection.

### Rule compliance notes for implementer
- Per `markdown-generation-rule.md`: documentation files (`docs/*.md`) may be created/modified by **Plan Agent** and **Docs Specialist**. The Plan Agent (caller) will assign doc creation to the docs-specialist sub-agent (Critical Workflow 4.4) or otherwise as it decides. This plan only specifies content.
- `newline-prevention-rule`: all multi-line content must use real newline characters, never literal `\n`.
- `self-documenting-code` / `military-mode-communication`: docs must be concise, professional, no filler.
- No `src/` files touched; no build/test impact (docs-only). Verification = render check + cross-link check + snippet correctness review.

---

## 5. Detailed Implementation Steps

> Each step lists the target file, exact section structure, and copy-pasteable code snippets. The implementer/docs-specialist MUST keep all code snippets identical to the verified API surface in Section 2 and 3.3.

### Step 0 — Pre-flight
1. Confirm current branch is the feature branch (per Critical Workflow step 2). No git actions in this plan beyond committing doc changes.
2. Re-read `.agent/project-structure.md` — confirms `docs/` is the documentation folder (no new folders needed).
3. No `src/` changes. No `npm install`/`build`/`test` required (docs-only). `npm run build`/`npm test` may be run at the end only as a sanity check that no `src/` was accidentally touched.

---

### Step 1 — Create `docs/getting-started.md`

**Purpose:** Complete "Getting Started" — from zero to a successful encrypt/decrypt/hash roundtrip in under 5 minutes.

**Structure:**
```
# Getting Started with @cobranza-apps/crypto
## Table of Contents
## Overview
## Prerequisites
## 1. Install
## 2. Generate Your Keys
## 3. Configure SecureCrypto
## 4. Your First Encrypt / Decrypt
## 5. Hash for Indexed Lookups
## 6. Combined encryptAndHash (PII dual-column pattern)
## Next Steps
## Reference
```

**Content snippets (copy-pasteable):**

Install:
```bash
npm install @cobranza-apps/crypto @cobranza-apps/entities
```

Generate keys:
```bash
# Master key: 32 bytes -> 44 base64 chars
openssl rand -base64 32

# Hash salt: >= 32 bytes (48 bytes -> 64 base64 chars recommended)
openssl rand -base64 48
```

Configure + first roundtrip:
```typescript
import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';
import type { CryptoConfig } from '@cobranza-apps/crypto';

const cryptoConfig: CryptoConfig = {
  masterKey: process.env.COBRANZA_CRYPTO_MASTER_KEY!, // base64, 32 bytes decoded
  hashSalt: process.env.COBRANZA_CRYPTO_HASH_SALT!,   // base64, >= 32 bytes decoded
  currentVersion: 1,
  defaultKeyName: EncryptionKey.PII,
};

const crypto = new SecureCrypto(cryptoConfig);

const encrypted = crypto.encrypt('user@example.com', EncryptionKey.PII);
// { encryptedData: '...', keyName: 'pii', algorithm: 'aes-256-gcm', version: 1 }

const plaintext = crypto.decrypt(encrypted);
console.assert(plaintext === 'user@example.com');
```

Hash + verify:
```typescript
const emailHash = crypto.hash('user@example.com');      // deterministic base64 HMAC-SHA256
console.assert(crypto.verifyHash('user@example.com', emailHash)); // true (constant-time)
```

Combined dual-column:
```typescript
const { encrypted, hash } = crypto.encryptAndHash('user@example.com', EncryptionKey.PII);
// store `encrypted` in the encrypted column; store `hash` in the `*Hash` index column
```

**Next Steps** section must link to:
- [How to Configure in NestJS](./how-to-configure-in-nestjs.md)
- [NestJS Integration Example](./nestjs-integration-example.md)
- [Real-World Scenarios](./real-world-scenarios.md)
- [Security Checklist](./security-checklist.md)
- [Key Rotation Guide](./key-rotation-guide.md)
- [Performance Considerations](./performance-considerations.md)
- [Testing Utilities](./testing-utilities.md)

**Reference** links: README, architecture.md, brief.md.

---

### Step 2 — Create `docs/nestjs-integration-example.md`

**Purpose:** ONE full end-to-end NestJS integration example tying every layer together, copy-pasteable. This is the "Full NestJS integration example" deliverable. It consolidates (not duplicates) the granular guides via cross-references.

**Structure:**
```
# Full NestJS Integration Example
## Table of Contents
## Overview
## Prerequisites
## 1. Install Dependencies
## 2. Environment & Key Generation
## 3. Register CryptoModule (forRootAsync + ConfigService)
## 4. Define a DTO with @IsEncryptedField()
## 5. Encrypt in a Service via CryptoService
## 6. Persist with a TypeORM @EventSubscriber()
## 7. Controller Wiring
## 8. Lookup by Hash
## 9. Decrypt on Read
## 10. Test the Integration
## Where to Go Deeper
## Reference
```

**Key snippets (verified against `src/nestjs/*`):**

Step 3 — Register module (matches `CryptoModule.forRootAsync` signature):
```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EncryptionKey } from '@cobranza-apps/crypto';
import { CryptoModule } from '@cobranza-apps/crypto/nestjs';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CryptoModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        masterKey: config.get<string>('COBRANZA_CRYPTO_MASTER_KEY', { infer: true })!,
        hashSalt: config.get<string>('COBRANZA_CRYPTO_HASH_SALT', { infer: true })!,
        currentVersion: parseInt(
          config.get<string>('COBRANZA_CRYPTO_KEY_VERSION', { infer: true }) ?? '1',
          10,
        ),
        defaultKeyName: EncryptionKey.PII,
      }),
    }),
  ],
})
export class AppModule {}
```

Step 4 — DTO (consistent with `dto-decorator-integration.md`):
```typescript
import { IsEmail } from 'class-validator';
import { EncryptionKey } from '@cobranza-apps/crypto';
import { EncryptedValue, IsEncryptedField } from '@cobranza-apps/entities';

export class CreateCustomerDto {
  @IsEmail()
  email!: string;                        // inbound plaintext

  @IsEncryptedField(EncryptionKey.PII)
  encryptedEmail!: EncryptedValue;       // stored encrypted column

  emailHash!: string;                    // deterministic hash index column
}
```

Step 5 — Service using injected `CryptoService`:
```typescript
import { Injectable } from '@nestjs/common';
import { CryptoService } from '@cobranza-apps/crypto/nestjs';
import { EncryptionKey } from '@cobranza-apps/crypto';
import type { EncryptedValue } from '@cobranza-apps/entities';

@Injectable()
export class CustomerService {
  constructor(private readonly crypto: CryptoService) {}

  encryptEmail(plaintext: string) {
    return this.crypto.encryptAndHash(plaintext, EncryptionKey.PII);
  }

  decryptEmail(encrypted: EncryptedValue): string {
    return this.crypto.decrypt(encrypted);
  }
}
```

Step 6 — TypeORM subscriber (consistent with `dto-decorator-integration.md` Option C):
```typescript
import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { CryptoService } from '@cobranza-apps/crypto/nestjs';
import { EncryptionKey } from '@cobranza-apps/crypto';
import { CustomerEntity } from './customer.entity';

@Injectable()
@EventSubscriber()
export class CustomerSubscriber implements EntitySubscriberInterface<CustomerEntity> {
  constructor(private readonly crypto: CryptoService) {}

  listenTo(): typeof CustomerEntity {
    return CustomerEntity;
  }

  async beforeInsert(event: InsertEvent<CustomerEntity>): Promise<void> {
    this.encryptCustomer(event.entity);
  }

  async beforeUpdate(event: UpdateEvent<CustomerEntity>): Promise<void> {
    if (event.entity) {
      this.encryptCustomer(event.entity as CustomerEntity);
    }
  }

  private encryptCustomer(customer: CustomerEntity): void {
    if (!customer.email) return;
    const { encrypted, hash } = this.crypto.encryptAndHash(customer.email, EncryptionKey.PII);
    customer.encryptedEmail = encrypted;
    customer.emailHash = hash;
  }
}
```

Step 7 — Controller wiring:
```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { CreateCustomerDto } from './create-customer.dto';
import { CustomerService } from './customer.service';

@Controller('customers')
export class CustomerController {
  constructor(private readonly customers: CustomerService) {}

  @Post()
  async create(@Body() dto: CreateCustomerDto) {
    // The subscriber encrypts `email` before insert; the service can also
    // call encryptEmail() directly for non-HTTP write paths.
    return this.customers.create(dto);
  }
}
```

Step 8 — Lookup by hash (no decryption needed for search):
```typescript
// Find a customer by email without decrypting the column
const emailHash = this.crypto.hash(searchEmail);
const customer = await this.customerRepo.findOne({ where: { emailHash } });
```

Step 10 — Test using the testing subpath:
```typescript
import { Test } from '@nestjs/testing';
import { CryptoModule, CryptoService } from '@cobranza-apps/crypto/nestjs';
import { TEST_CRYPTO_CONFIG } from '@cobranza-apps/crypto/testing';
import { EncryptionKey } from '@cobranza-apps/crypto';

describe('CustomerService', () => {
  let crypto: CryptoService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CryptoModule.forRoot(TEST_CRYPTO_CONFIG)],
      providers: [CustomerService],
    }).compile();

    crypto = moduleRef.get(CryptoService);
  });

  it('roundtrips email', () => {
    const { encrypted } = crypto.encryptAndHash('test@example.com', EncryptionKey.PII);
    expect(crypto.decrypt(encrypted)).toBe('test@example.com');
  });
});
```

**Where to Go Deeper** must cross-link:
- [How to Configure in NestJS](./how-to-configure-in-nestjs.md) — full module/provider/interceptor reference.
- [DTO / Decorator Integration](./dto-decorator-integration.md) — pipe vs interceptor vs subscriber trade-offs.
- [Testing Utilities](./testing-utilities.md) — `getTestCrypto`, `TEST_VECTORS`, shape predicates.
- [Real-World Scenarios](./real-world-scenarios.md) — taxId / bank description patterns.

**Reference:** README, architecture.md, brief.md.

---

### Step 3 — Create `docs/security-checklist.md`

**Purpose:** Security checklist in checkbox format. Concise, scannable.

**Structure:**
```
# Security Checklist
## Overview
## Key Management
## Logging & Telemetry
## Encryption & Hashing Usage
## Caching
## Key Rotation
## Testing & Deployment
## Reference
```

**Content (checkbox items — each `- [ ]`):**

Key Management:
- [ ] Load `masterKey` and `hashSalt` from a secrets manager / vault / KMS at boot via `ConfigService`; never hardcode or commit.
- [ ] Keep `masterKey` and `hashSalt` as distinct secrets with independent rotation lifecycles.
- [ ] Use separate secrets per environment (dev/staging/prod).
- [ ] Restrict secret access to the service identity (IAM role / Kubernetes service account).
- [ ] Never expose keys via logs, traces, error responses, or client payloads.
- [ ] Never use the `@cobranza-apps/crypto/testing` keys in production (fixed zero keys).

Logging & Telemetry:
- [ ] Never log plaintext, decrypted values, master key, derived keys, hash salt, IVs, or full `encryptedData`.
- [ ] Log only non-sensitive error messages (library throws closed errors without secret material).
- [ ] Redact or omit `EncryptedValue` fields when logging request/response bodies.
- [ ] `keyName` and `version` are acceptable in internal telemetry only, not user-facing logs.

Encryption & Hashing Usage:
- [ ] Use `encryptAndHash` (not `hash` alone) when the field also needs confidentiality.
- [ ] Use the `EncryptionKey` enum consistently; avoid misspelled string literals.
- [ ] Rely on constant-time `verifyHash` for hash comparisons (never `===` on hashes in security-sensitive paths).
- [ ] Fail closed: handle thrown errors; never return partial results.
- [ ] Each environment uses its own `hashSalt` to prevent cross-environment hash matching.

Caching:
- [ ] Decryption cache is opt-in; isolate per request or process — never shared across users/tenants.
- [ ] Size TTL to the memory budget (cache is TTL-bounded, no hard size cap).
- [ ] Invalidate / clear the decryption cache on key rotation.

Key Rotation:
- [ ] Increment `currentVersion` to rotate derived keys (single `masterKey`; version is part of HKDF info). See [Key Rotation Guide](./key-rotation-guide.md).
- [ ] Run an external background `reEncrypt` job to migrate historical records.
- [ ] Verify all records migrated before retiring an old version.
- [ ] Do NOT change `masterKey` material and `currentVersion` simultaneously without a full decrypt-all/re-encrypt-all migration (the library retains a single master key).

Testing & Deployment:
- [ ] Fail fast at startup — the `SecureCrypto` constructor validates key sizes.
- [ ] Use `getTestCrypto()` / `TEST_CRYPTO_CONFIG` only in tests.
- [ ] Run the library's own suite (`npm test`) when modifying integration points.

**Reference:** [README Security Best Practices](../README.md#security-best-practices), architecture.md (Security Boundaries), brief.md Section 7.

---

### Step 4 — Create `docs/key-rotation-guide.md`  (CORRECTS README inaccuracy)

**Purpose:** Accurate version-based key rotation guide matching the implementation, including `reEncrypt` migration, hash handling, and cache invalidation.

**Structure:**
```
# Key Rotation Guide
## Table of Contents
## Overview
## How Rotation Works in This Library
## Step 1 — Increment the Version
## Step 2 — Deploy
## Step 3 — Run the Re-encryption Background Job
## Step 4 — Verify Migration
## Step 5 — Retire the Old Version
## Hash Columns During Rotation
## Cache Invalidation
## Rotating the Master Key Material (out of library scope)
## Reference
```

**Content — "How Rotation Works in This Library" (the correction):**

State explicitly:
- `CryptoConfig` holds a **single** `masterKey`. There is no key-to-version map.
- Per-category keys are derived via HKDF-SHA256 with `info = cobranza-encryption-v1:${keyName}:v${version}`. The **version is embedded in the HKDF info**, so incrementing `currentVersion` yields a **new derived key from the same master key**.
- `encrypt` uses `currentVersion`; `decrypt` reads `version` from each `EncryptedValue` (falling back to `currentVersion`), so **historical records remain decryptable** as long as the master key is unchanged.
- `reEncrypt(encrypted, newKeyName?)` decrypts at the payload's version and re-encrypts at `currentVersion` in one call.

Step 1 — Increment version (config change only):
```text
# Before
COBRANZA_CRYPTO_KEY_VERSION=1

# After
COBRANZA_CRYPTO_KEY_VERSION=2
```
No new master key. The same `masterKey` derives a fresh `pii:v2` key.

Step 2 — Deploy: new encryptions now carry `version: 2`; existing records keep their original `version`.

Step 3 — Re-encryption background job (illustrative, runs outside the library):
```typescript
// Runs in a consuming service (e.g. ms-db-gateway), NOT inside @cobranza-apps/crypto
import { CryptoService } from '@cobranza-apps/crypto/nestjs';
import type { EncryptedValue } from '@cobranza-apps/entities';

interface CustomerRow {
  id: string;
  encryptedEmail: EncryptedValue;
}

async function migrateCustomersToCurrentVersion(
  crypto: CryptoService,
  repo: {
    findWithVersion(v: number): Promise<CustomerRow[]>;
    updateEmail(id: string, encrypted: EncryptedValue): Promise<void>;
  },
): Promise<void> {
  const stale = await repo.findWithVersion(1); // records still on version 1
  for (const record of stale) {
    // decrypt v1 -> re-encrypt at currentVersion in one call
    const reEncrypted = crypto.reEncrypt(record.encryptedEmail);
    await repo.updateEmail(record.id, reEncrypted);
  }
}
```
Note: `reEncrypt` is idempotent in target version but produces non-deterministic ciphertext (random IV). Guard against double-processing (e.g. mark rows as migrated or re-check `version`).

Step 4 — Verify: query count of records where `version != currentVersion` reaches 0.

Step 5 — Retire: once no `version: 1` records remain, version 1's derived key is no longer exercised. The master key stays the same; "retirement" here means no new v1 records are produced (already guaranteed by deploy) and the migration job can be disabled.

**Hash Columns During Rotation:**
- Hashes are HMAC-SHA256 keyed by `hashSalt` and are **not** version-dependent.
- Rotating the encryption version does **not** change hash values.
- `*Hash` index columns require **no** migration during version rotation.

**Cache Invalidation:**
- If using `createDecryptionCache`, call `cache.clear()` after migration to drop stale entries and free memory.
- The cache is keyed by `encryptedData` string; re-encrypted records get new cache keys automatically, but clearing avoids serving stale plaintext for any record whose encrypted payload was overwritten.

**Rotating the Master Key Material (out of library scope):**
- Changing the actual `masterKey` bytes breaks decryption of all historical records (the library retains only one master key).
- A full master-key-material rotation requires: (a) keep the OLD master key available to decrypt all records, (b) decrypt every record, (c) re-encrypt with the NEW master key, (d) deploy the new master key. This is a larger migration performed in the consuming service(s) and is **outside** this library's scope. The in-library rotation mechanism is **version increment**.

**Reference:** [README Key Rotation Guide](../README.md#key-rotation-guide), [reEncrypt example](../README.md#reencrypt-key-rotation), architecture.md (Key Rotation), brief.md Section 7.

---

### Step 5 — Create `docs/performance-considerations.md`

**Purpose:** Expanded, accurate performance guide.

**Structure:**
```
# Performance Considerations
## Table of Contents
## Overview
## Key Derivation (HKDF) and the Internal Cache
## Synchronous Crypto Cost
## Ciphertext Size Overhead
## Decryption Cache (opt-in)
## Hashing
## Bulk Re-encryption
## AES-256-GCM Limits
## Concurrency & Sharing
## Reference
```

**Content (verified facts):**

Key Derivation / internal cache:
- `hkdfSync` runs **once per `${keyName}:v${version}`** combination; results are cached in an in-memory `Map` keyed by `${keyName}:v${version}`.
- First `encrypt`/`decrypt` per (key, version) pays the HKDF cost (microseconds on modern CPUs); subsequent calls are an O(1) map lookup.
- No configuration needed — the cache is internal and automatic.

Synchronous Crypto cost:
- `createCipheriv`/`update`/`final` are synchronous and CPU-bound; they block the Node.js event loop.
- For typical PII fields (< 1 KB) each encrypt/decrypt is sub-millisecond and negligible in request paths.
- For large payloads (e.g. long notification bodies), offload to a worker thread or batch outside the hot path if latency-sensitive.
- Input guards cap plaintext at 1,000,000 UTF-8 bytes and `encryptedData` at 2,000,000 chars to mitigate oversized-input DoS.

Ciphertext Size Overhead:
- Every encrypted value adds `IV(12) + authTag(16) = 28 bytes` of overhead before Base64.
- Base64 inflates by ~33%. Plan column/storage sizes accordingly (e.g. a 20-byte plaintext -> ~48 bytes raw -> ~64 base64 chars).

Decryption cache (opt-in):
- `createDecryptionCache(defaultTtlMs)` returns a `TtlCache<string, string>` keyed by the encrypted-payload string.
- TTL-bounded with lazy eviction + `purgeExpired()`; **no hard size cap** — size TTL to your memory budget.
- Isolate per request or process; never share across users/tenants.
- Clear on key rotation (see [Key Rotation Guide](./key-rotation-guide.md#cache-invalidation)).

Hashing:
- `hash` / `verifyHash` are deterministic and idempotent — safe to call repeatedly with no caching benefit.
- `verifyHash` uses constant-time comparison; negligible cost.

Bulk Re-encryption:
- Run as an external background job with batching and rate-limiting.
- Process in pages; re-encrypt via `reEncrypt` (one call = decrypt + re-encrypt).
- Guard against double-processing (records produce new ciphertext each run due to random IV).

AES-256-GCM Limits:
- 96-bit (12-byte) IV with random generation gives a negligible IV-collision probability until ~2^48 encryptions per key.
- Each `(keyName, version)` combination has its own IV space and derived key.
- Version rotation well before any practical limit; in practice this limit is never approached.

Concurrency & Sharing:
- A single `SecureCrypto` (or injected `CryptoService`) instance is safe to share across requests in Node's single-threaded model.
- The only mutable internal state is the derived-keys `Map`, which is append-only after first derivation; concurrent sync access is safe.

**Reference:** [README Performance Considerations](../README.md#performance-considerations), architecture.md (Critical Paths), brief.md Section 7 (Performance).

---

### Step 6 — Create `docs/real-world-scenarios.md`

**Purpose:** Real-world scenarios for `taxId`, `email`, and `bank description` with full copy-pasteable code, dual-column pattern, and lookup-by-hash.

**Structure:**
```
# Real-World Scenarios
## Table of Contents
## Overview
## Scenario 1 — Email (PII, dual-column)
## Scenario 2 — Tax ID (Company PII, dual-column + lookup)
## Scenario 3 — Bank Description (Bank Data, encrypt-only)
## Cross-cutting: Decrypt on Read
## Choosing an EncryptionKey Category
## Reference
```

**Content snippets:**

Scenario 1 — Email (`EncryptionKey.PII`):
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

Scenario 2 — Tax ID (`EncryptionKey.COMPANY_PII`):
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

Scenario 3 — Bank Description (`EncryptionKey.BANK_DATA`):
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

Cross-cutting — Decrypt on read (avoid bulk-decrypting entire tables):
```typescript
// GOOD: decrypt only the rows/columns you render
const rows = await repo.find(); // fetch only needed rows
const view = rows.map((r) => ({ ...r, email: crypto.decrypt(r.encryptedEmail) }));

// AVOID: decrypting every row in a large table in a single pass
```

Choosing an `EncryptionKey` Category (mini table):

| Field example | Category | Hash column? |
|---|---|---|
| email, phone, fullName | `PII` | Yes (`emailHash`, lookup/dedup) |
| taxId, businessName | `COMPANY_PII` | Yes (`taxIdHash`, uniqueness) |
| transaction description, reference, notes | `BANK_DATA` | Usually no (free-text); add if dedup needed |
| notification subject/body | `NOTIFICATION` | Usually no |
| other sensitive fields | `GENERAL` | As needed |

**Reference:** [Getting Started](./getting-started.md), [NestJS Integration Example](./nestjs-integration-example.md), README Usage Examples, architecture.md (EncryptionKey Categories), brief.md Section 5.

---

### Step 7 — Update `README.md`

Apply targeted edits (preserve all existing content unless noted). Update the TOC and the sections below.

**7a. Update Table of Contents** — add entries (keep existing order, insert new ones logically):
- Insert `Getting Started` after `Installation`.
- Add `Full NestJS Integration Example` (link to `./docs/nestjs-integration-example.md`) near the NestJS section.
- Add `Security Checklist` (link to `./docs/security-checklist.md`) near Security Best Practices.
- Add `Real-World Scenarios` (link to `./docs/real-world-scenarios.md`) near Usage Examples.
- Rename `Key Rotation Procedure` to `Key Rotation Guide` (link to `./docs/key-rotation-guide.md`).
- Rename `Performance Notes` to `Performance Considerations` (link to `./docs/performance-considerations.md`).
- Add `Getting Started Guide` (link to `./docs/getting-started.md`).

**7b. Add "Getting Started" section** (condensed, after Installation) — a short paragraph + the minimal configure/roundtrip snippet, then:
> For the full walkthrough see [Getting Started](./docs/getting-started.md).

**7c. Add "Real-World Scenarios" subsection** (condensed, within/after Usage Examples) — one-line per scenario (email/PII, taxId/COMPANY_PII, bank description/BANK_DATA) + link:
> See [Real-World Scenarios](./docs/real-world-scenarios.md) for full taxId, email, and bank description examples with the dual-column pattern and lookup-by-hash.

**7d. Expand NestJS Integration Guide section** — keep existing condensed snippet; add a prominent link:
> For a complete end-to-end example (module + DTO + service + subscriber + test), see [Full NestJS Integration Example](./docs/nestjs-integration-example.md).

**7e. Add condensed "Security Checklist"** — after Security Best Practices, add a short checklist (5-6 key items) + link:
> Full checklist: [Security Checklist](./docs/security-checklist.md).

**7f. CORRECT + condense "Key Rotation Procedure"** — replace the inaccurate 5 steps with the accurate condensed procedure and link to the full guide.

Replace existing steps (README lines ~254-259) with:
```markdown
## Key Rotation Guide

This library rotates derived keys by **incrementing `currentVersion`** (single `masterKey`; the version is part of the HKDF info, so a new version yields a new derived key from the same master key). Historical records stay decryptable because each `EncryptedValue` carries its `version`.

1. **Increment** `COBRANZA_CRYPTO_KEY_VERSION` (e.g. `1` -> `2`). No new master key.
2. **Deploy** — new encryptions carry `version: 2`; existing records keep their original `version`.
3. **Run an external background job** to migrate old records: `crypto.reEncrypt(oldEncrypted)` decrypts at the payload's version and re-encrypts at `currentVersion` in one call. See the [reEncrypt example](#reencrypt-key-rotation).
4. **Verify** all records migrated (no records left on the old `version`).
5. **Hash columns need no migration** — hashes are keyed by `hashSalt`, not version.
6. **Clear the decryption cache** if in use (`cache.clear()`).

> Rotating the actual master-key material is a larger, out-of-library migration (decrypt-all with the old key, re-encrypt-all with the new key). See the full [Key Rotation Guide](./docs/key-rotation-guide.md).
```

**7g. Rename + expand "Performance Notes" -> "Performance Considerations"** — keep existing 4 bullets, add 2 (ciphertext overhead; sync CPU cost / event-loop), then link:
> Full guide: [Performance Considerations](./docs/performance-considerations.md).

Add bullets:
- **Ciphertext overhead**: each value adds `IV(12) + authTag(16) = 28 bytes` before Base64 (~33% inflation). Size columns accordingly.
- **Synchronous cost**: crypto calls block the event loop; negligible for PII-size fields (<1 KB), offload large payloads to a worker thread if latency-sensitive.

**7h. Update "Guides" list** (bottom of README, lines ~341-346) — add the 6 new docs:
- [Getting Started](./docs/getting-started.md)
- [Full NestJS Integration Example](./docs/nestjs-integration-example.md)
- [Security Checklist](./docs/security-checklist.md)
- [Key Rotation Guide](./docs/key-rotation-guide.md)
- [Performance Considerations](./docs/performance-considerations.md)
- [Real-World Scenarios](./docs/real-world-scenarios.md)

---

### Step 8 — Update `docs/README.md`

Add a new "Guides" subsection under "For Library Consumers" listing the 6 new docs (with one-line descriptions), preserving existing entries:

```
## Guides

- [Getting Started](./getting-started.md) — Install, generate keys, and run your first encrypt/decrypt/hash.
- [NestJS Integration Example](./nestjs-integration-example.md) — End-to-end module + DTO + service + subscriber + test.
- [Security Checklist](./security-checklist.md) — Production security checklist (key management, logging, caching, rotation).
- [Key Rotation Guide](./key-rotation-guide.md) — Version-based rotation and reEncrypt migration.
- [Performance Considerations](./performance-considerations.md) — HKDF cache, ciphertext overhead, sync cost, GCM limits.
- [Real-World Scenarios](./real-world-scenarios.md) — taxId, email, and bank description patterns.
```

---

## 6. Cross-Reference Map

| Doc | Links to |
|---|---|
| `docs/getting-started.md` | nestjs-integration-example, real-world-scenarios, security-checklist, key-rotation-guide, performance-considerations, testing-utilities, how-to-configure-in-nestjs |
| `docs/nestjs-integration-example.md` | how-to-configure-in-nestjs, dto-decorator-integration, testing-utilities, real-world-scenarios |
| `docs/security-checklist.md` | README#security-best-practices, key-rotation-guide, architecture, brief |
| `docs/key-rotation-guide.md` | README#key-rotation-guide, README#reencrypt-key-rotation, architecture, brief |
| `docs/performance-considerations.md` | README#performance-considerations, key-rotation-guide (cache invalidation), architecture, brief |
| `docs/real-world-scenarios.md` | getting-started, nestjs-integration-example, README usage, architecture, brief |
| `README.md` | all 6 new docs + existing docs |
| `docs/README.md` | all 6 new docs |

Every new doc must end with a **Reference** section linking back to README, `architecture.md`, and `brief.md` (matching existing docs' convention).

---

## 7. Verification Steps (for 4.5 Verification)

1. **No `src/` changes**: `git diff --stat` shows only `README.md`, `docs/*.md` (6 new + 2 updated). Confirm zero files under `src/` modified.
2. **Snippet correctness**: review every code snippet against the verified API in Section 2 / 3.3:
   - Imports resolve (`@cobranza-apps/crypto`, `@cobranza-apps/crypto/nestjs`, `@cobranza-apps/crypto/testing`, `@cobranza-apps/entities`).
   - Method signatures match: `encrypt(plaintext, keyName)`, `decrypt(encryptedValue)`, `hash(plaintext)`, `verifyHash(plaintext, expectedHash)`, `encryptAndHash(plaintext, keyName)`, `reEncrypt(encrypted, newKeyName?)`, `createDecryptionCache(defaultTtlMs)`.
   - `EncryptionKey` values: `pii`, `company_pii`, `bank_data`, `notification`, `general`.
   - `CryptoModule.forRoot` / `forRootAsync` + `CryptoService` injection match `src/nestjs/*`.
3. **Key rotation accuracy**: confirm README + `key-rotation-guide.md` describe version-based rotation (single masterKey, HKDF info suffix), NOT multi-master-key. The inaccurate "generate a new master key" + "key-to-version map" text must be gone.
4. **Cross-links**: every internal link target exists (manual grep for broken anchors).
5. **TOC integrity**: README TOC anchors match section headings.
6. **Newline compliance**: no literal `\n` escape sequences in any written file.
7. **Conciseness**: each new doc stays focused; no duplicated content from existing docs (use cross-references instead).
8. **Sanity build** (optional, confirms no accidental src edits): `npm run build` succeeds; `npm test` still passes (124 tests, no behavior change).

---

## 8. Out of Scope

- Any change to `src/` source files.
- New unit tests (docs-only task; existing 124 tests unchanged).
- Version bump (`package.json`) — handled by Critical Workflow step 3, not this task.
- Changes to `docs/how-to-set-up-git.md` or `docs/how-to-write-todo-files.md` (agent guides, unrelated).
- Changes to `.agent/project-info/*` (context.md may be updated by the Plan Agent's closing step, not by this task's implementer).
- Implementing multi-master-key support (the corrected docs describe the current single-masterKey design; full master-key-material rotation is documented as out-of-library).

---

## 9. Summary

- **6 new docs** in `docs/` (getting-started, nestjs-integration-example, security-checklist, key-rotation-guide, performance-considerations, real-world-scenarios).
- **2 updated docs** (README.md hub + TOC + corrected key rotation; docs/README.md index).
- **Critical correction**: README key rotation procedure rewritten to match the implementation (version-based, single masterKey, `reEncrypt` migration).
- **All snippets verified** against the actual API surface; copy-pasteable and correct.
- **No `src/` changes**; docs-only, no build/test impact.
- Plan file: `.kilo/plans/20260709-task4-comprehensive-docs.md`
