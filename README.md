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
- No business logic, database access, or NestJS modules.
- No browser or non-Node.js environments.

## Status / Stability

All API methods are implemented; algorithms may evolve before v1.0.

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [API Summary](#api-summary)
- [NestJS Integration Guide](#nestjs-integration-guide)
- [NestJS Configuration Guide (full)](./docs/how-to-configure-in-nestjs.md)
- [Security Best Practices](#security-best-practices)
- [Key Rotation Procedure](#key-rotation-procedure)
- [Performance Notes](#performance-notes)
- [Testing](#testing)
- [Development](#development)
- [License](#license)

## Requirements

- **Node.js** 22.14.0 (see `.nvmrc`)
- **`@cobranza-apps/entities`** — provides `EncryptedValue` type and `@IsEncryptedField()` decorator

## Installation

```bash
npm install @cobranza-apps/crypto @cobranza-apps/entities
```

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

### Key introspection

```typescript
crypto.hasKey('pii');             // true
crypto.getAvailableKeys();        // ['pii','company_pii','bank_data','notification','general']
```

> **Note:** Ciphertext is non-deterministic (random 12-byte IV); the `hash` output is deterministic. See [Testing Utilities](./docs/testing-utilities.md#why-no-exact-ciphertext) for why exact ciphertext assertions are not part of test vectors.

## API Summary

| Method | Parameters | Returns | Description | Status |
|--------|-----------|---------|-------------|--------|
| `constructor` | `config: CryptoConfig` | `SecureCrypto` | Validates and stores config | functional |
| `encrypt` | `plaintext: string, keyName: EncryptionKey` | `EncryptedValue` | Encrypts a string using AES-256-GCM with HKDF-derived key | functional |
| `decrypt` | `data: EncryptedValue` | `string` | Decrypts an `EncryptedValue`, supporting any version with an available key | functional |
| `hash` | `plaintext: string` | `string` | Produces a deterministic HMAC-SHA256 hash | functional |
| `verifyHash` | `plaintext: string, hash: string` | `boolean` | Constant-time hash verification | functional |
| `encryptAndHash` | `plaintext: string, keyName: EncryptionKey` | `{ encrypted: EncryptedValue, hash: string }` | Combined encryption + hashing for indexed PII fields | functional |
| `hasKey` | `name: string` | `boolean` | Checks whether a key derivation config exists for the given `name` | functional |
| `getAvailableKeys` | — | `string[]` | Returns all configured key names | functional |

For the full interface contract, see [`brief.md`](./.agent/project-info/brief.md) §4.

## NestJS Integration Guide

The library is framework-agnostic. See the [How to Configure in NestJS](./docs/how-to-configure-in-nestjs.md) guide for a reusable `CryptoModule`, interceptor pattern, DTO integration, rotation, testing, and deployment.

`EncryptionKey` is from this library; `@IsEncryptedField()` and `EncryptedValue` are from `@cobranza-apps/entities`.

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
- Follow the full [Key Rotation Procedure](#key-rotation-procedure) and the NestJS [deployment guidance](./docs/how-to-configure-in-nestjs.md#deployment--secret-management).

## Key Rotation Procedure

1. **Generate** a new 32-byte master key (base64).
2. **Increment** `currentVersion` and deploy with both the new key and the previous key(s) available for decryption (consumers configure a key-to-version map).
3. **New encryptions** use the new version; existing `EncryptedValue` records keep their original `version`.
4. **Run an external background job** (outside this library) to re-encrypt old records: `decrypt(oldVersion) -> encrypt(newVersion)`.
5. **Verify** all records migrated; retire the old key only after no references remain.

## Performance Notes

- **Internal HKDF cache**: caches derived per-category keys in memory keyed by `${keyName}:v${version}`. Repeated `encrypt`/`decrypt` calls with the same key name and version do not re-derive.
- **Plaintext caching**: may cache decrypted values in-memory with a short TTL, isolated per request or process — never shared across users or tenants. Invalidate on key rotation.
- **Hashing performance**: `hash` / `verifyHash` are deterministic and idempotent — safe to call repeatedly without caching.
- **Bulk re-encryption**: during key rotation, run re-encryption as an external background job with batching / rate-limiting.

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
  crypto.service.ts
  crypto.service.encryption.ts
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
tests/
dist/
docs/
```

### Guides

- [How to Set Up Git](./docs/how-to-set-up-git.md) — Configure Git credentials for GitHub.
- [How to Write TODO Files](./docs/how-to-write-todo-files.md) — Task assignment formats for AI agents.
- [Testing Utilities](./docs/testing-utilities.md) — Importing and using the testing subpath (Jest + NestJS).
- [How to Configure in NestJS](./docs/how-to-configure-in-nestjs.md) — Wire `SecureCrypto` into a NestJS service with `ConfigService`.
- [Documentation Index](./docs/README.md) — Full list of available documentation.

## License

Released to the public domain under **The Unlicense**. See [`LICENSE`](./LICENSE) for details.

---

> AI agents: read [`AGENTS.md`](./AGENTS.md) and follow the Critical Workflow before contributing. Project info lives in [`.agent/project-info/`](./.agent/project-info/).
