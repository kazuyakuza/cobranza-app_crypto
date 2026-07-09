# Per-Task Plan: Task 4 — Developer Experience Improvements

- **Date:** 2026-07-09
- **TODO:** `.agent/todos/20260707/20260707-todo-4.md`
- **Global plan:** `.kilo/plans/20260709-phase4-advanced-features.md`
- **Branch:** `feat/phase4-advanced-features`
- **Scope:** Task 4 only (Developer Experience Improvements)
- **Plan owner:** Architect sub-agent (Critical Workflow step 4.1)

---

## 1. Pre-Analysis: Current State vs. Required

| Item | Required | Current state | Action |
|---|---|---|---|
| NestJS module registration example | yes | exists — `docs/nestjs-integration-example.md` §3 | none |
| DTO interceptor example | yes | exists — `docs/dto-decorator-integration.md` Option B | none |
| TypeORM entity subscriber example | yes | exists — `docs/dto-decorator-integration.md` Option C + `docs/nestjs-integration-example.md` §6 | none |
| Bulk encrypt/decrypt (generic) example | yes | exists — README + `docs/real-world-scenarios.md` Scenario 4 | none |
| **Bulk encrypt/decrypt in NestJS/TypeORM context** | yes | **MISSING** — no NestJS service/subscriber shows `encryptObject`/`decryptObject` | **NEW doc section** |
| Test vector — object encryption fixture | yes | exists — `BULK_OBJECT_FIXTURE` in `src/testing/test-vectors.ts` | expand comment only; verified by existing `tests/crypto.bulk.spec.ts` |
| Test vector — re-encryption scenario | yes | exists — `RE_ENCRYPT_SCENARIOS` (2 scenarios) | expand to 3 (add v2 → v3) |
| Test vector — cache fixture | yes | **MISSING** | **NEW `CACHE_FIXTURE`** |

### Key finding

Bulk and re-encrypt fixtures already exist (added during Tasks 1–3). The genuine gaps are:

1. A NestJS-context bulk example (subscriber + read service using `encryptObject`/`decryptObject`).
2. A cache structural-shape fixture for `withCache` hit/miss/eviction tests.

---

## 2. Target Files

| Path | Change type | Notes |
|---|---|---|
| `src/testing/test-vectors.ts` | modify | add `CACHE_FIXTURE` + `CacheFixtureShape`; expand `RE_ENCRYPT_SCENARIOS` (3rd scenario). ≤200 lines (src rule). |
| `src/testing/index.ts` | modify | export `CACHE_FIXTURE` + `CacheFixtureShape` from the testing subpath. |
| `tests/crypto.cache-wrapper.spec.ts` | modify | add `CACHE_FIXTURE` consumption test (new `describe`). |
| `docs/nestjs-integration-example.md` | modify | new §11 NestJS bulk example + TOC entry. |
| `docs/dto-decorator-integration.md` | modify | cross-reference note to the new §11 bulk section. |
| `README.md` | modify (optional) | single anchor link in NestJS Integration Guide bullet. |
| `.agent/todos/20260707/20260707-todo-4.md` | modify (step 4.6 only) | mark Task 4 `[DONE]` + sub-checkboxes. |

> Steps 4.4 (Documentation), 4.5 (Verification), 4.6 (Completion) are separate Critical-Workflow sub-steps dispatched as their own `task` invocations. This plan defines the full work scope; it does NOT execute those steps.

---

## 3. Implementation Steps (Assign to Implementer — step 4.2)

### Step 4.2.1 — Add `CACHE_FIXTURE` and expand `RE_ENCRYPT_SCENARIOS`

**File:** `src/testing/test-vectors.ts` (currently 115 lines → ~140 after edits; stays under 200-line src limit).

Insert after the existing `RE_ENCRYPT_SCENARIOS` declaration:

```typescript
/** Structural shape for a cache fixture — no exact ciphertext (random IV per encryption). */
export interface CacheFixtureShape {
  /** Plaintext used to build the cache probe (diagnostics only; never asserted as ciphertext). */
  readonly plaintext: string;
  /** Key name used to encrypt the probe. */
  readonly keyName: EncryptionKey;
  /** TTL applied to the cached decryptor under test (ms). */
  readonly ttlMs: number;
  /** Expected cache size after exactly one decrypt of the probe (miss populates). */
  readonly expectedSizeAfterMiss: number;
  /** Expected cache size after a second decrypt of the same probe (hit — no growth). */
  readonly expectedSizeAfterHit: number;
}

/**
 * Cache fixture: structural shapes for withCache hit/miss tests.
 * No exact ciphertext is asserted — only cache size and roundtrip equality.
 */
export const CACHE_FIXTURE: readonly CacheFixtureShape[] = [
  { plaintext: 'cache-probe-pii', keyName: EncryptionKey.PII, ttlMs: 1000, expectedSizeAfterMiss: 1, expectedSizeAfterHit: 1 },
  { plaintext: 'cache-probe-bank', keyName: EncryptionKey.BANK_DATA, ttlMs: 1, expectedSizeAfterMiss: 1, expectedSizeAfterHit: 1 },
];
```

Expand `RE_ENCRYPT_SCENARIOS` to three scenarios (append third entry):

```typescript
{ plaintext: 'escalate-tier', fromVersion: 2, toVersion: 3, keyName: EncryptionKey.GENERAL },
```

Resulting array:

```typescript
export const RE_ENCRYPT_SCENARIOS = [
  { plaintext: 'rotate-me', fromVersion: 1, toVersion: 2, keyName: EncryptionKey.PII },
  { plaintext: 'switch-category', fromVersion: 1, toVersion: 1, keyName: EncryptionKey.NOTIFICATION },
  { plaintext: 'escalate-tier', fromVersion: 2, toVersion: 3, keyName: EncryptionKey.GENERAL },
] as const;
```

### Step 4.2.2 — Export `CACHE_FIXTURE` from the testing subpath

**File:** `src/testing/index.ts`.

In the `export { ... } from './test-vectors.js'` block (around lines 40–45), add `CACHE_FIXTURE`:

```typescript
export {
  TEST_VECTORS,
  encryptedDataByteLengthFor,
  BULK_OBJECT_FIXTURE,
  RE_ENCRYPT_SCENARIOS,
  CACHE_FIXTURE,
} from './test-vectors.js';
```

In the `export type { ... } from './test-vectors.js'` block (around lines 34–36), add `CacheFixtureShape`:

```typescript
export type {
  TestVector,
  CacheFixtureShape,
} from './test-vectors.js';
```

### Step 4.2.3 — Add cache fixture coverage test

**File:** `tests/crypto.cache-wrapper.spec.ts`.

Append a new `describe` block at the end of the file (after the existing `createDecryptionCacheWrapper` describe):

```typescript
import { CACHE_FIXTURE } from '../src/testing/index.js';

describe('CACHE_FIXTURE — structural shapes', () => {
  it('every scenario populates the cache on miss and stays same on hit', () => {
    for (const shape of CACHE_FIXTURE) {
      const crypto = buildTestCrypto(1);
      const cached = crypto.withCache({ ttlMs: shape.ttlMs });
      const encrypted = crypto.encrypt(shape.plaintext, shape.keyName);

      expect(cached.decrypt(encrypted)).toBe(shape.plaintext);
      expect(cached.size()).toBe(shape.expectedSizeAfterMiss);
      cached.decrypt(encrypted);
      expect(cached.size()).toBe(shape.expectedSizeAfterHit);
    }
  });
});
```

> `src/testing/**` is excluded from coverage collection (`package.json` jest config `collectCoverageFrom`), so fixture code requires no direct coverage; the test guarantees the fixture stays valid and in sync with `withCache` behavior.

### Step 4.2.4 — Verify `RE_ENCRYPT_SCENARIOS` expansion

**File:** `tests/crypto.reencrypt.spec.ts` — the existing loop test `roundtrips each RE_ENCRYPT_SCENARIO from fromVersion to toVersion` (line 81) already iterates the array. The new v2→v3 scenario is automatically covered. `buildTestCrypto(3)` is accepted because the existing guards accept any positive integer version (verified in `crypto.encrypt-decrypt.spec.ts` version-isolation tests). **No code change** in this step — the implementer must confirm the test still passes after the array grows.

---

## 4. Documentation Steps (Assign to Docs Specialist — step 4.4)

### Step 4.4.1 — Add NestJS bulk section

**File:** `docs/nestjs-integration-example.md`.

**TOC update** — add a new entry between the "10. Test the Integration" and "Reference" entries:

```markdown
- [11. Bulk Multi-Field Encryption (encryptObject / decryptObject)](#11-bulk-multi-field-encryption-encryptobject--decryptobject)
```

**New section §11** — insert before `## Reference`:

```markdown
## 11. Bulk Multi-Field Encryption (encryptObject / decryptObject)

When an entity carries several PII fields, use `encryptObject` / `decryptObject`
to transform all mapped fields in a single call. Only the fields listed in the
`BulkFieldMap<T>` are transformed; unmapped fields pass through unchanged. The
input object is never mutated (the methods return a shallow clone).

### Entity

```typescript
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { EncryptedValue } from '@cobranza-apps/entities';

@Entity()
export class CustomerEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  // Plaintext scratch fields (transient — cleared by the subscriber before insert/update)
  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  fullName?: string;

  @Column({ nullable: true })
  taxId?: string;

  // Encrypted columns (persisted)
  @Column({ type: 'json', nullable: true })
  encryptedEmail?: EncryptedValue;

  @Column({ type: 'json', nullable: true })
  encryptedFullName?: EncryptedValue;

  @Column({ type: 'json', nullable: true })
  encryptedTaxId?: EncryptedValue;

  @Column({ nullable: true })
  emailHash?: string;
}
```

> The scratch plaintext fields (`email`, `fullName`, `taxId`) are declared so the
> service can receive them, but the subscriber clears them before persistence so
> plaintext never reaches the database.

### Subscriber — encryption

```typescript
import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { CryptoService } from '@cobranza-apps/crypto/nestjs';
import { EncryptionKey } from '@cobranza-apps/crypto';
import type { BulkFieldMap } from '@cobranza-apps/crypto';
import { CustomerEntity } from './customer.entity';

@Injectable()
@EventSubscriber()
export class CustomerBulkSubscriber implements EntitySubscriberInterface<CustomerEntity> {
  constructor(private readonly crypto: CryptoService) {}

  listenTo(): typeof CustomerEntity {
    return CustomerEntity;
  }

  async beforeInsert(event: InsertEvent<CustomerEntity>): Promise<void> {
    this.applyBulkEncryption(event.entity);
  }

  async beforeUpdate(event: UpdateEvent<CustomerEntity>): Promise<void> {
    if (event.entity) {
      this.applyBulkEncryption(event.entity as CustomerEntity);
    }
  }

  private applyBulkEncryption(customer: CustomerEntity): void {
    if (this.hasNoPlaintext(customer)) return;

    const fieldMap: BulkFieldMap<CustomerEntity> = {
      email: EncryptionKey.PII,
      fullName: EncryptionKey.PII,
      taxId: EncryptionKey.COMPANY_PII,
    };

    const encrypted = this.crypto.encryptObject(customer, fieldMap);
    customer.encryptedEmail = encrypted.encryptedEmail;
    customer.encryptedFullName = encrypted.encryptedFullName;
    customer.encryptedTaxId = encrypted.encryptedTaxId;
    customer.emailHash = this.crypto.hash(customer.email!);

    // Clear plaintext scratch fields so they never persist to the database
    customer.email = undefined;
    customer.fullName = undefined;
    customer.taxId = undefined;
  }

  private hasNoPlaintext(customer: CustomerEntity): boolean {
    return !customer.email && !customer.fullName && !customer.taxId;
  }
}
```

Register in the module alongside the existing subscriber (see §3 of this doc for module wiring).

### Read service — decryption

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CryptoService } from '@cobranza-apps/crypto/nestjs';
import { EncryptionKey } from '@cobranza-apps/crypto';
import type { BulkFieldMap } from '@cobranza-apps/crypto';
import { CustomerEntity } from './customer.entity';

interface CustomerView {
  id: number;
  email: string;
  fullName: string;
  taxId: string;
}

@Injectable()
export class CustomerReadService {
  constructor(
    @InjectRepository(CustomerEntity)
    private readonly repo: Repository<CustomerEntity>,
    private readonly crypto: CryptoService,
  ) {}

  // decryptObject uses each EncryptedValue.keyName — the fieldMap values
  // here are placeholders for the type mapping (values are ignored at runtime).
  private readonly decryptMap: BulkFieldMap<CustomerEntity> = {
    email: EncryptionKey.PII,
    fullName: EncryptionKey.PII,
    taxId: EncryptionKey.COMPANY_PII,
  };

  async getCustomer(id: number): Promise<CustomerView> {
    const row = await this.repo.findOneByOrFail({ id });
    const decrypted = this.crypto.decryptObject(row, this.decryptMap);
    return {
      id: decrypted.id,
      email: decrypted.encryptedEmail as unknown as string,
      fullName: decrypted.encryptedFullName as unknown as string,
      taxId: decrypted.encryptedTaxId as unknown as string,
    };
  }
}
```

> `decryptObject` decrypts each `EncryptedValue` field using that field's own
> `keyName` (the fieldMap value is a type placeholder only — see
> [`crypto.bulk.spec.ts` "ignores the fieldMap key-name values"](../tests/crypto.bulk.spec.ts)).

### Registration

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([CustomerEntity]),
    CryptoModule.forRootAsync({ /* inject ConfigService — see §3 */ }),
  ],
  providers: [CustomerBulkSubscriber, CustomerReadService],
})
export class CustomerModule {}
```

### Reference

- [Real-World Scenarios — Scenario 4](./real-world-scenarios.md#scenario-4--customer-object-bulk-encrypt--decrypt) — framework-agnostic bulk roundtrip.
- [DTO / Decorator Integration — Option C](./dto-decorator-integration.md#option-c--typeorm-entity-listeners--subscriber) — single-field subscriber pattern.
- [README — Bulk Operations](../README.md#usage-examples) — `encryptObject` / `decryptObject` quick examples.
```

### Step 4.4.2 — Cross-reference note in DTO/decorator doc

**File:** `docs/dto-decorator-integration.md`.

In the "Recommended patterns for `ms-db-gateway`" section, append after the "Recommendation" paragraph:

```markdown
> **Bulk variant:** If your entity carries several PII fields, use
> `encryptObject` / `decryptObject` in the subscriber instead of repeated
> `encryptAndHash` calls. See
> [Bulk Multi-Field Encryption](./nestjs-integration-example.md#11-bulk-multi-field-encryption-encryptobject--decryptobject).
```

### Step 4.4.3 — Optional README anchor link

**File:** `README.md`.

In the "NestJS Integration Guide" section, add a bullet:

```markdown
- [Bulk Multi-Field Encryption (encryptObject / decryptObject)](./docs/nestjs-integration-example.md#11-bulk-multi-field-encryption-encryptobject--decryptobject) — multi-field subscriber + read service.
```

> Apply only if the section uses a bullet list; otherwise skip to avoid restructuring.

---

## 5. Verification (Assign to Architect — step 4.5)

Run from the project root (`C:\projects\cobranza-app\crypto`):

| Command | Expected result |
|---|---|
| `npm run build` | 0 TypeScript errors |
| `npm run lint` | clean (no errors) |
| `npm test` | all suites pass; coverage thresholds (>=85% global) met |
| `git diff --stat src/testing/test-vectors.ts` | file <= 200 lines (src rule) |

Manual checks:

- `src/testing/test-vectors.ts` exists, <=200 lines, `CACHE_FIXTURE` + expanded `RE_ENCRYPT_SCENARIOS` present.
- `src/testing/index.ts` exports `CACHE_FIXTURE` and `CacheFixtureShape`.
- `tests/crypto.cache-wrapper.spec.ts` new `describe` block passes (3 scenarios implicitly via 2 fixture entries; the third re-encrypt scenario covered by existing loop).
- `docs/nestjs-integration-example.md` TOC anchor `#11-bulk-multi-field-encryption-encryptobject--decryptobject` resolves.
- `docs/dto-decorator-integration.md` cross-reference link resolves.
- No `.gitignore`-matching files staged (per Gitignore Compliance Rule).

---

## 6. Task Completion (Assign to Implementer — step 4.6)

**File:** `.agent/todos/20260707/20260707-todo-4.md`.

Edit the Task 4 title line:

```markdown
### Task 4: Developer Experience Improvements [DONE]
```

Mark both sub-checkboxes:

```markdown
- [x] Review then create/update examples with ready-to-use code samples:
  - [x] NestJS module registration.
  - [x] DTO interceptor example.
  - [x] TypeORM entity subscriber example.
  - [x] Bulk encrypt/decrypt usage.
- [x] Expand test vectors in `src/testing/test-vectors.ts` to cover new advanced features (object operations, re-encryption, cache).
```

Preserve the rest of the file unchanged.

**Commit message:**

```text
docs(examples): add NestJS bulk example and cache test vectors (Task 4)
```

---

## 7. Constraints Adherence

| Constraint | Verification |
|---|---|
| Max 200 lines per src file | `src/testing/test-vectors.ts` ~140 lines after edits |
| Max 50 lines per method body | no new methods; only small fixtures and one test loop |
| Max 2 params per method | fixtures use single objects; `applyBulkEncryption(customer)` is 1 param |
| No runtime dependencies | only types/fixtures/docs; no imports added |
| Max depth 2 (single-section boolean) | `hasNoPlaintext(customer)` helper enforces single-section boolean in doc code |
| No commented-out code | only runnable code in code fences |
| Self-documenting code | explicit names: `CacheFixtureShape`, `CACHE_FIXTURE`, `BulkFieldMap` |
| Prefer private members | `applyBulkEncryption`, `hasNoPlaintext`, `decryptMap` are private in doc examples |
| 100% coverage on new source files | `src/testing/**` excluded from `collectCoverageFrom`; cache test consumes the fixture |

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `BulkFieldMap<T>` type signature mismatch with `CustomerEntity` scratch fields | The fieldMap maps scratch field names; `encryptObject` reads the scratch plaintext and writes the encrypted clone fields. Implementer must verify the type import path (`@cobranza-apps/crypto`) matches `src/index.ts`. |
| `decryptObject` ignores fieldMap keyName value | Documented explicitly in the new §11 and verified by existing `crypto.bulk.spec.ts` test "ignores the fieldMap key-name values". |
| README anchor target uses a long slug | Markdown auto-slug; implementer must verify the anchor resolves after edit. |
| `buildTestCrypto(3)` rejected by version guards | Existing tests confirm any positive integer version is accepted; risk is low. If rejected, escalate to a fallback scenario using existing v1/v2. |

---

## 9. Acceptance Criteria (Task 4)

- [ ] `CACHE_FIXTURE` + `CacheFixtureShape` added to `src/testing/test-vectors.ts`.
- [ ] `CACHE_FIXTURE` exported from `src/testing/index.ts`.
- [ ] New `CACHE_FIXTURE` coverage test passes in `tests/crypto.cache-wrapper.spec.ts`.
- [ ] `RE_ENCRYPT_SCENARIOS` has 3 entries; `crypto.reencrypt.spec.ts` loop still passes.
- [ ] `docs/nestjs-integration-example.md` §11 added with TOC entry.
- [ ] `docs/dto-decorator-integration.md` cross-reference note added.
- [ ] `npm run build`, `npm run lint`, `npm test` all clean.
- [ ] `.agent/todos/20260707/20260707-todo-4.md` Task 4 marked `[DONE]` with both sub-checkboxes `[x]`.
- [ ] No `.gitignore`-matching files staged in the commit.