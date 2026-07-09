# @cobranza-apps/crypto

> Shared encryption & deterministic hashing library for the Cobranza App platform.
> Single source of truth for protecting PII, financial, bank, and notification data
> across all NestJS microservices.

[![Node](https://img.shields.io/badge/node-22.14.0-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Unlicense-blue)](./LICENSE)

## Overview / Purpose

**@cobranza-apps/crypto** is a framework-agnostic TypeScript library for Node.js (22.14.0+) providing authenticated encryption and deterministic hashing. It uses the built-in `crypto` module with zero runtime dependencies and enforces consistent security, best practices, and key-rotation readiness across all Cobranza App microservices.

**What it does:**
- **AES-256-GCM** authenticated encryption with per-category **HKDF-SHA256** key derivation. Output format is `IV(12 bytes) + ciphertext + authTag(16 bytes)`, Base64-encoded.
- **Deterministic HMAC-SHA256** hashing for indexed PII lookups with constant-time `verifyHash`.
- Combined `encryptAndHash` for fields needing both ciphertext storage and a hash index.
- Version-aware decryption for seamless key rotation.

**What it does NOT do (non-goals):**
- No password hashing — Argon2id/bcrypt belong in the Auth microservice.
- No `process.env` reads; pass all config via `CryptoConfig`.
- No business logic, database access, or hard NestJS dependency; an optional `./nestjs` subpath provides `CryptoModule` and `CryptoService` when `@nestjs/common` is installed.
- No browser or non-Node.js environments.

## Status / Stability

All API methods are implemented; algorithms may evolve before v1.0.

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Real-World Scenarios](./docs/real-world-scenarios.md)
- [API Summary](#api-summary)
- [NestJS Integration Guide](#nestjs-integration-guide)
- [NestJS Configuration Guide (full)](./docs/how-to-configure-in-nestjs.md)
- [Security Best Practices](#security-best-practices)
- [Security Guide](./docs/security-guide.md)
- [Security Checklist](#security-checklist)
- [Observability & Auditing](#observability--auditing)
- [Key Rotation Guide](#key-rotation-guide)
- [Performance Considerations](#performance-considerations)
- [Testing](#testing)
- [Development](#development)
- [License](#license)

## Requirements

- **Node.js** 22.14.0 (see `.nvmrc`)
- **`@cobranza-apps/entities`** — provides `EncryptedValue` type and `@IsEncryptedField()` decorator
- **`@nestjs/common`** / **`@nestjs/config`** — optional peer dependencies (required only for the `./nestjs` subpath)

## Installation

```bash
npm install @cobranza-apps/crypto @cobranza-apps/entities
```

## Getting Started

A minimal configuration and roundtrip in under one minute:

```typescript
import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';

const crypto = new SecureCrypto({
  masterKey: process.env.COBRANZA_CRYPTO_MASTER_KEY!, // base64 32-byte key
  hashSalt: process.env.COBRANZA_CRYPTO_HASH_SALT!,   // base64 >= 32 bytes
  currentVersion: 1,
  defaultKeyName: EncryptionKey.PII,
});

const encrypted = crypto.encrypt('hello world', EncryptionKey.PII);
const plaintext = crypto.decrypt(encrypted);
console.assert(plaintext === 'hello world');
```

> For the full walkthrough (key generation, hash, dual-column pattern) see [Getting Started](./docs/getting-started.md).

## Configuration

The library accepts all configuration at instantiation time via `CryptoConfig`.

```typescript
import { SecureCrypto, CryptoConfig, EncryptionKey } from '@cobranza-apps/crypto';

const cryptoConfig: CryptoConfig = {
  masterKey: process.env.COBRANZA_CRYPTO_MASTER_KEY!, // base64 32-byte key
  hashSalt:  process.env.COBRANZA_CRYPTO_HASH_SALT!,   // base64 >= 32 bytes
  currentVersion: 1,
  defaultKeyName: EncryptionKey.PII,
};

const crypto = new SecureCrypto(cryptoConfig);
```

## Usage Examples

All examples assume a configured `SecureCrypto` instance (see [Configuration](#configuration)).

### Encrypt

```typescript
const encrypted = crypto.encrypt('user@example.com', EncryptionKey.PII);
// encrypted: {
//   encryptedData: 'base64-encoded IV(12) + ciphertext + authTag(16)',
//   keyName: 'pii',
//   algorithm: 'aes-256-gcm',
//   version: 1,
// }
```

### Decrypt

```typescript
const original = crypto.decrypt(encrypted);
// 'user@example.com'

// Roundtrip assertion
console.assert(original === 'user@example.com', 'decrypt must restore plaintext');
```

### Hash

```typescript
const emailHash = crypto.hash('user@example.com');
// base64 HMAC-SHA256; deterministic, safe for indexed lookups

// Same input always produces the same hash
console.assert(crypto.hash('user@example.com') === emailHash);
```

### verifyHash

```typescript
const emailHash = crypto.hash('user@example.com');
const isValid = crypto.verifyHash('user@example.com', emailHash);
// true — constant-time comparison prevents timing attacks

const tampered = crypto.verifyHash('other@example.com', emailHash);
// false
```

### encryptAndHash (recommended for PII columns)

Dual-column storage pattern — encrypted value for confidentiality, hash for indexed lookups:

```typescript
const { encrypted, hash } = crypto.encryptAndHash('user@example.com', EncryptionKey.PII);

// Store `encrypted` (EncryptedValue) in the encrypted column
// Store `hash` (string) in the `*Hash` index column
// Later:
const decrypted = crypto.decrypt(encrypted);                        // 'user@example.com'
const match = crypto.verifyHash('user@example.com', hash);          // true
```

### reEncrypt (key rotation)

Decrypt and re-encrypt at the current key version, optionally under a different key name:

```typescript
// Re-encrypt under the current version (same key name)
const refreshed = crypto.reEncrypt(encrypted);
// refreshed.version === crypto's currentVersion

// Re-encrypt under a different key
const moved = crypto.reEncrypt(encrypted, EncryptionKey.BANK_DATA);
// moved.keyName === 'bank_data'
```

See [Key Rotation Guide](#key-rotation-guide) for the full rotation workflow.

### Bulk Operations

Encrypt or decrypt multiple fields of an object in a single call. Only the
fields listed in the `fieldMap` are transformed; all other fields pass through
unchanged. The input object is never mutated.

```typescript
import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';
import type { BulkFieldMap } from '@cobranza-apps/crypto';

interface Customer {
  email: string;
  fullName: string;
  id: number;
}

const fieldMap: BulkFieldMap<Customer> = {
  email:    EncryptionKey.PII,
  fullName: EncryptionKey.PII,
};

// Encrypt every mapped string field — returns a shallow clone
const customer = { email: 'a@b.com', fullName: 'Ana', id: 42 };
const encrypted = crypto.encryptObject(customer, fieldMap);
// encrypted.email    is an EncryptedValue
// encrypted.fullName is an EncryptedValue
// encrypted.id       === 42

// Decrypt every mapped EncryptedValue field — returns a shallow clone
const plaintext = crypto.decryptObject(encrypted, fieldMap);
// plaintext.email    === 'a@b.com'
// plaintext.fullName === 'Ana'
```

> **Tip:** `encryptObject` / `decryptObject` are ideal for DTO-to-entity
> mapping in NestJS services. Pair with `@IsEncryptedField()` from
> `@cobranza-apps/entities` for end-to-end type safety.

### Cached Decryptor

Wrap this `SecureCrypto` instance with a TTL-bounded in-memory cache to avoid
repeated AES-256-GCM decryption of hot records. Cache hits return the stored
plaintext; misses delegate to `decrypt`.

```typescript
// Build a cached decryptor with a 30-second TTL (default: 60 s)
const cached = crypto.withCache({ ttlMs: 30_000 });

const a = cached.decrypt(encrypted); // cache miss — delegates to SecureCrypto
const b = cached.decrypt(encrypted); // cache hit  — returns cached plaintext

cached.size();   // number of cached entries
cached.clear();  // invalidate all entries (call after key rotation)
```

> **Security note:** Caching plaintext is an explicit, opt-in decision. Never
> share a `CachedDecryptor` across users or tenants. Invalidate on key
> rotation. See [Security Best Practices](#security-best-practices).

### Decryption cache (opt-in)

Cache decrypted plaintext in-memory with a TTL to avoid repeated decryption of hot records:

```typescript
import { createDecryptionCache } from '@cobranza-apps/crypto';
import type { EncryptedValue } from '@cobranza-apps/entities';

const cache = createDecryptionCache(60_000); // 60 s TTL

function getCachedDecrypt(encrypted: EncryptedValue): string {
  const cached = cache.get(encrypted.encryptedData);
  if (cached !== undefined) return cached;
  const plaintext = crypto.decrypt(encrypted);
  cache.set(encrypted.encryptedData, plaintext);
  return plaintext;
}
```

> **Security note:** The cache is opt-in and bounded by TTL, not by a hard size limit. Callers should size TTLs to their memory budget. Never share a cache across users or tenants. Invalidate on key rotation.

### Key introspection

```typescript
crypto.hasKey('pii');             // true
crypto.getAvailableKeys();        // ['pii','company_pii','bank_data','notification','general']
```

> **Note:** Ciphertext is non-deterministic (random 12-byte IV); the `hash` output is deterministic. See [Testing Utilities](./docs/testing-utilities.md#why-no-exact-ciphertext) for why exact ciphertext assertions are not part of test vectors.

### Real-World Scenarios

- **Email (PII)** — `encryptAndHash('user@example.com', EncryptionKey.PII)` for dual-column storage + lookup-by-hash.
- **Tax ID (Company PII)** — `encryptAndHash('RFC-ABCD123456', EncryptionKey.COMPANY_PII)` with dedup via `hash` + `verifyHash`.
- **Bank description (Bank Data)** — `encrypt('Payment for invoice...', EncryptionKey.BANK_DATA)` encrypt-only, decrypt on read.

See [Real-World Scenarios](./docs/real-world-scenarios.md) for full code examples with the dual-column pattern and lookup-by-hash.

## API Summary

| Method | Parameters | Returns | Description | Status |
|--------|-----------|---------|-------------|--------|
| `constructor` | `config: CryptoConfig` | `SecureCrypto` | Validates and stores config | functional |
| `encrypt` | `plaintext: string, keyName: EncryptionKey` | `EncryptedValue` | Encrypts a string using AES-256-GCM with HKDF-derived key | functional |
| `decrypt` | `data: EncryptedValue` | `string` | Decrypts an `EncryptedValue`, supporting any version with an available key | functional |
| `hash` | `plaintext: string` | `string` | Produces a deterministic HMAC-SHA256 hash | functional |
| `verifyHash` | `plaintext: string, hash: string` | `boolean` | Constant-time hash verification | functional |
| `encryptAndHash` | `plaintext: string, keyName: EncryptionKey` | `{ encrypted: EncryptedValue, hash: string }` | Combined encryption + hashing for indexed PII fields | functional |
| `reEncrypt` | `encrypted: EncryptedValue, targetKeyName?: EncryptionKey \| string` | `EncryptedValue` | Decrypts and re-encrypts at the current version, optionally under a new key | functional |
| `encryptObject` | `obj: T, fieldMap: BulkFieldMap<T>` | `T` | Encrypts every string field listed in `fieldMap`; returns a shallow clone | functional |
| `decryptObject` | `obj: T, fieldMap: BulkFieldMap<T>` | `T` | Decrypts every `EncryptedValue` field listed in `fieldMap`; returns a shallow clone | functional |
| `withCache` | `options?: { ttlMs?: number }` | `CachedDecryptor` | Returns a TTL-cached decryptor bound to this instance | functional |
| `hasKey` | `name: string` | `boolean` | Checks whether a key derivation config exists for the given `name` | functional |
| `getAvailableKeys` | — | `string[]` | Returns all configured key names | functional |

### Cache Utilities

| Export | Kind | Description |
| --- | --- | --- |
| `TtlCache` | class | Generic in-memory TTL cache with lazy eviction |
| `createDecryptionCache` | function | Factory for a `TtlCache<string, string>` keyed by encrypted payload |
| `DecryptionCache` | type | Alias for `TtlCache<string, string>` |
| `createDecryptionCacheWrapper` | function | SecureCrypto-aware cache-through decrypt wrapper |
| `CachedDecryptor` | interface | Cache-through decryptor returned by `withCache` |
| `DecryptionCacheOptions` | interface | Options for `createDecryptionCacheWrapper` |
| `SecureCryptoDecryptor` | interface | Minimal decryptor contract accepted by the wrapper |
| `BulkFieldMap` | type | Per-field key mapping for `encryptObject` / `decryptObject` |
| `AuditLogger` | interface | Optional observability hooks (`onEncrypt`, `onDecrypt`) invoked after successful crypto operations |

For the full interface contract, see [`brief.md`](./.agent/project-info/brief.md) §4.

## NestJS Integration Guide

The library ships a built-in `CryptoModule` and `CryptoService` at the `@cobranza-apps/crypto/nestjs` subpath. Both synchronous (`forRoot`) and asynchronous (`forRootAsync` with `ConfigService`) registration are available:

```typescript
import { CryptoModule } from '@cobranza-apps/crypto/nestjs';
import { EncryptionKey } from '@cobranza-apps/crypto';

// Sync:
CryptoModule.forRoot({ masterKey: '...', hashSalt: '...', currentVersion: 1, defaultKeyName: EncryptionKey.PII });

// Async with ConfigService:
CryptoModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({ /* ... */ }),
});
```

See the full [How to Configure in NestJS](./docs/how-to-configure-in-nestjs.md) guide for `CryptoModule` registration, interceptor pattern, DTO integration, rotation, testing, and deployment.

`EncryptionKey` is from this library; `@IsEncryptedField()` and `EncryptedValue` are from `@cobranza-apps/entities`.

For a complete end-to-end example (module + DTO + service + subscriber + test) see [Full NestJS Integration Example](./docs/nestjs-integration-example.md), including [Bulk Multi-Field Encryption](./docs/nestjs-integration-example.md#11-bulk-multi-field-encryption-encryptobject--decryptobject) with `encryptObject` / `decryptObject`.

## Security Best Practices

The following practices are critical when handling sensitive data. Follow them to avoid data leaks, key compromise, and compliance violations.

### Key Storage

- Load `masterKey` and `hashSalt` from a secrets manager / vault / KMS at boot via `ConfigService`; never hardcode or commit them.
- Keep `masterKey` and `hashSalt` as distinct secrets with independent rotation lifecycles.
- Restrict secret access to the service identity; never expose via logs, traces, error responses, or client payloads.
- Use separate secrets per environment (dev/staging/prod). The testing subpath uses fixed zero keys and MUST NOT be used in production.

### Logging Rules

- Never log plaintext, decrypted values, the master key, derived keys, the hash salt, IVs, or the full `EncryptedValue.encryptedData` payload.
- Log only non-sensitive error messages — the library throws closed errors without secret material.
- When logging request/response bodies that may contain `EncryptedValue` fields, redact or omit those fields.
- `keyName` and `version` are acceptable in internal operational telemetry but should not appear in user-facing logs.

### General Rules

- **Fail closed**: errors are thrown; never returned as partial results.
- **IV** is 12 random bytes per encryption; never reused.
- **Hash verification** uses constant-time comparison (`crypto.timingSafeEqual`).
- Use **`encryptAndHash`** (not `hash` alone) when the field also needs confidentiality.
- Follow the full [Key Rotation Guide](#key-rotation-guide) and the NestJS [deployment guidance](./docs/how-to-configure-in-nestjs.md#deployment--secret-management).

## Security Checklist

Quick production-readiness checklist:

- [ ] Never hardcode or commit secrets — load `masterKey` and `hashSalt` from a vault / KMS.
- [ ] Never expose keys, plaintext, IVs, or `encryptedData` in logs or error responses.
- [ ] Use `encryptAndHash` (not `hash` alone) when the field needs confidentiality.
- [ ] Use constant-time `verifyHash` for hash comparisons, never `===`.
- [ ] Run a background `reEncrypt` job after incrementing `currentVersion`.
- [ ] Isolate the decryption cache per request/process; never share across users.

Full checklist: [Security Checklist](./docs/security-checklist.md).

## Observability & Auditing

Pass an optional `AuditLogger` via `CryptoConfig.auditLogger` to receive
non-sensitive metadata after every successful `encrypt` or `decrypt` call.
Hooks receive **only** `keyName` and `version` — **never** plaintext,
ciphertext, keys, IVs, or any other sensitive material. This is enforced at
the type level: the `AuditLogger` interface signatures have no parameter
capable of carrying sensitive payload data.

A logger that throws is silently swallowed so a misbehaving implementation
can never break a crypto operation.

```typescript
import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';
import type { AuditLogger, CryptoConfig } from '@cobranza-apps/crypto';

const auditLogger: AuditLogger = {
  onEncrypt(keyName, version) {
    metrics.increment('crypto.encrypt', { keyName, version });
  },
  onDecrypt(keyName, version) {
    metrics.increment('crypto.decrypt', { keyName, version });
  },
};

const config: CryptoConfig = {
  masterKey: process.env.COBRANZA_CRYPTO_MASTER_KEY!,
  hashSalt: process.env.COBRANZA_CRYPTO_HASH_SALT!,
  currentVersion: 1,
  defaultKeyName: EncryptionKey.PII,
  auditLogger, // <-- optional observability hooks
};

const crypto = new SecureCrypto(config);
```

> **Security note:** Audit hooks are the only extension point that crosses the
> `SecureCrypto` boundary. The contract guarantees that no sensitive data
> (plaintext, ciphertext, derived keys, IVs, auth tags) is ever passed to
> consumer code. Log `keyName` and `version` freely in internal telemetry,
> but avoid emitting them in user-facing responses.

## Key Rotation Guide

This library rotates derived keys by **incrementing `currentVersion`** (single `masterKey`; the version is part of the HKDF info, so a new version yields a new derived key from the same master key). Historical records stay decryptable because each `EncryptedValue` carries its `version`.

1. **Increment** `COBRANZA_CRYPTO_KEY_VERSION` (e.g. `1` -> `2`). No new master key.
2. **Deploy** — new encryptions carry `version: 2`; existing records keep their original `version`.
3. **Run an external background job** to migrate old records: `crypto.reEncrypt(oldEncrypted)` decrypts at the payload's version and re-encrypts at `currentVersion` in one call. See the [reEncrypt example](#reencrypt-key-rotation).
4. **Verify** all records migrated (no records left on the old `version`).
5. **Hash columns need no migration** — hashes are keyed by `hashSalt`, not version.
6. **Clear the decryption cache** if in use (`cache.clear()`).

> Rotating the actual master-key material is a larger, out-of-library migration (decrypt-all with the old key, re-encrypt-all with the new key). See the full [Key Rotation Guide](./docs/key-rotation-guide.md).

## Performance Considerations

- **Internal HKDF cache**: caches derived per-category keys in memory keyed by `${keyName}:v${version}`. Repeated `encrypt`/`decrypt` calls with the same key name and version do not re-derive.
- **Plaintext caching**: may cache decrypted values in-memory with a short TTL using `createDecryptionCache` (see [Decryption cache](#decryption-cache-opt-in)). The cache is opt-in and bounded by TTL, not by a hard size limit. Callers should size TTLs to their memory budget. Isolate per request or process — never shared across users or tenants. Invalidate on key rotation.
- **Hashing performance**: `hash` / `verifyHash` are deterministic and idempotent — safe to call repeatedly without caching.
- **Bulk re-encryption**: during key rotation, run re-encryption as an external background job with batching / rate-limiting.
- **Ciphertext overhead**: each value adds `IV(12) + authTag(16) = 28 bytes` before Base64 (~33% inflation). Size columns accordingly.
- **Synchronous cost**: crypto calls block the event loop; negligible for PII-size fields (<1 KB), offload large payloads to a worker thread if latency-sensitive.

Full guide: [Performance Considerations](./docs/performance-considerations.md).

## Testing

### Consumer testing

Jest consumers can use the testing subpath:

```typescript
import { getTestCrypto, SecureCryptoTestModule } from '@cobranza-apps/crypto/testing';
import { EncryptionKey } from '@cobranza-apps/crypto';

const crypto = getTestCrypto();
const { encrypted, hash } = crypto.encryptAndHash('test@example.com', EncryptionKey.PII);
```

> **Note:** Ciphertext is non-deterministic (AES-256-GCM uses a random 12-byte IV).
> The `expectedEncryptedShape` field on each vector provides a deterministic structural
> assertion (`algorithm`, `keyName`, `version`, `encryptedDataByteLength`). Exact
> ciphertext correctness is verified via encrypt-decrypt roundtrip. See
> [Testing Utilities](./docs/testing-utilities.md#why-no-exact-ciphertext) for details.

- `getTestCrypto()` returns a `SecureCrypto` with fixed, deterministic keys -- safe to publish; never usable in production.
- `test-vectors.ts` provides 11 deterministic vectors with real `expectedHash` literals and `expectedEncryptedShape` for structural assertions.
- `SecureCryptoTestModule` is a NestJS-friendly provider config (spreadable into `Test.createTestingModule`); it does not require `@nestjs/testing` as a dependency of this library.

### Library test suite

```bash
npm test
npm run test:watch
```

The library's own test suite uses Jest + ts-jest.

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm run lint    # eslint --ext .ts
npm test        # jest
```

### Package layout

```text
src/
  index.ts
  config.ts
  audit.ts
  crypto.service.ts
  crypto.service.audit.ts
  crypto.service.bulk-guards.ts
  crypto.service.encryption.ts
  crypto.service.facade-guards.ts
  crypto.service.guards.ts
  crypto.service.hashing.ts
  crypto.service.keys.ts
  crypto.service.validation.ts
  hkdf.ts
  hkdf.types.ts
  utils.ts
  testing/
    index.ts
    test-vectors.ts
    encrypted-shape.ts
  nestjs/
    crypto-config.interface.ts
    crypto.module.ts
    crypto.service.ts
    index.ts
tests/
dist/
docs/
```

### Guides

- [Getting Started](./docs/getting-started.md) — Install, generate keys, and run your first encrypt/decrypt/hash.
- [Full NestJS Integration Example](./docs/nestjs-integration-example.md) — End-to-end module + DTO + service + subscriber + test.
- [Security Checklist](./docs/security-checklist.md) — Production security checklist (key management, logging, caching, rotation).
- [Security Guide](./docs/security-guide.md) — Consolidated guide: key storage, rotation summary, common pitfalls, buffer hygiene, runtime validation.
- [Key Rotation Guide](./docs/key-rotation-guide.md) — Version-based rotation and reEncrypt migration.
- [Performance Considerations](./docs/performance-considerations.md) — HKDF cache, ciphertext overhead, sync cost, GCM limits.
- [Real-World Scenarios](./docs/real-world-scenarios.md) — taxId, email, and bank description patterns.
- [How to Set Up Git](./docs/how-to-set-up-git.md) — Configure Git credentials for GitHub.
- [How to Write TODO Files](./docs/how-to-write-todo-files.md) — Task assignment formats for AI agents.
- [Testing Utilities](./docs/testing-utilities.md) — Importing and using the testing subpath (Jest + NestJS).
- [How to Configure in NestJS](./docs/how-to-configure-in-nestjs.md) — Built-in `CryptoModule` (`forRoot`/`forRootAsync`), `CryptoService`, interceptor pattern, DTO integration, testing, and deployment.
- [Documentation Index](./docs/README.md) — Full list of available documentation.
- [DTO / Decorator Integration](./docs/dto-decorator-integration.md) — Pipes, interceptors, and TypeORM subscribers for automatic plain-string → EncryptedValue + hash conversion.

## License

Released to the public domain under **The Unlicense**. See [`LICENSE`](./LICENSE) for details.

---

> AI agents: read [`AGENTS.md`](./AGENTS.md) and follow the Critical Workflow before contributing. Project info lives in [`.agent/project-info/`](./.agent/project-info/).
