# Key Rotation Guide

## Table of Contents

- [Overview](#overview)
- [How Rotation Works in This Library](#how-rotation-works-in-this-library)
- [Step 1 — Increment the Version](#step-1--increment-the-version)
- [Step 2 — Deploy](#step-2--deploy)
- [Step 3 — Run the Re-encryption Background Job](#step-3--run-the-re-encryption-background-job)
- [Step 4 — Verify Migration](#step-4--verify-migration)
- [Step 5 — Retire the Old Version](#step-5--retire-the-old-version)
- [Hash Columns During Rotation](#hash-columns-during-rotation)
- [Cache Invalidation](#cache-invalidation)
- [Rotating the Master Key Material (out of library scope)](#rotating-the-master-key-material-out-of-library-scope)
- [Reference](#reference)

## Overview

Key rotation limits the exposure window if a derived key is compromised. This guide describes the correct rotation procedure for this library — version increment (same master key) with `reEncrypt` migration.

## How Rotation Works in This Library

- `CryptoConfig` holds a **single** `masterKey`. There is no key-to-version map.
- Per-category keys are derived via HKDF-SHA256 with `info = cobranza-encryption-v1:${keyName}:v${version}`. The **version is embedded in the HKDF info**, so incrementing `currentVersion` yields a **new derived key from the same master key**.
- `encrypt` always uses `currentVersion`; `decrypt` reads the `version` from each `EncryptedValue` payload (falling back to `currentVersion`). Historical records remain decryptable as long as the master key is unchanged.
- `reEncrypt(encrypted, newKeyName?)` decrypts at the payload's version and re-encrypts at `currentVersion` in one call.

## Step 1 — Increment the Version

Change the config value. No new master key is needed:

```text
# Before
COBRANZA_CRYPTO_KEY_VERSION=1

# After
COBRANZA_CRYPTO_KEY_VERSION=2
```

The same `masterKey` now derives a fresh key for `pii:v2`, `company_pii:v2`, etc.

## Step 2 — Deploy

Deploy the updated configuration. All new encryptions will carry `version: 2`. Existing records keep their original `version` and remain decryptable.

## Step 3 — Run the Re-encryption Background Job

Run an external job (in your consuming service, not inside this library) to migrate stale records:

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

> `reEncrypt` is idempotent in target version but produces non-deterministic ciphertext (random IV). Guard against double-processing — e.g. mark rows as migrated or re-check `version`.

## Step 4 — Verify Migration

Query the count of records where `version != currentVersion`. Migrate in batches until the count reaches zero.

## Step 5 — Retire the Old Version

Once no `version: 1` records remain, version 1's derived key is no longer exercised. The master key stays the same. "Retirement" means no new v1 records are produced (guaranteed by Step 2) and the migration job can be disabled.

## Hash Columns During Rotation

- Hashes are HMAC-SHA256 keyed by `hashSalt` and are **not** version-dependent.
- Rotating the encryption version does **not** change hash values.
- `*Hash` index columns require **no** migration during version rotation.

## Cache Invalidation

- If using `createDecryptionCache`, call `cache.clear()` after migration to drop stale entries and free memory.
- The cache is keyed by `encryptedData` string. Re-encrypted records get new cache keys automatically, but clearing avoids serving stale plaintext for any record whose encrypted payload was overwritten.

## Rotating the Master Key Material (out of library scope)

- Changing the actual `masterKey` bytes breaks decryption of all historical records (the library retains only one master key).
- A full master-key-material rotation requires:
  1. Keep the OLD master key available to decrypt all records.
  2. Decrypt every record.
  3. Re-encrypt with the NEW master key.
  4. Deploy the new master key.
- This is a larger migration performed in the consuming service(s) and is **outside** this library's scope. The in-library rotation mechanism is **version increment**.

## Reference

- [README Key Rotation Guide](../README.md#key-rotation-guide) — Condensed procedure.
- [README reEncrypt example](../README.md#reencrypt-key-rotation) — `reEncrypt` API reference.
- [`architecture.md`](../.agent/project-info/architecture.md) — Key derivation architecture.
- [`brief.md`](../.agent/project-info/brief.md) — Project scope §7.
