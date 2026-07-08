# @cobranza-apps/crypto

> Shared encryption & deterministic hashing library for the Cobranza App platform.
> Single source of truth for protecting PII, financial, bank, and notification data
> across all NestJS microservices.

[![Status](https://img.shields.io/badge/status-WIP%20%28API%20stabilizing%29-yellow)](#status)
[![Node](https://img.shields.io/badge/node-22.14.0-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Unlicense-blue)](./LICENSE)

## Overview / Purpose

**@cobranza-apps/crypto** is a framework-agnostic TypeScript library for Node.js (22.14.0+) that provides authenticated encryption and deterministic hashing. It uses the built-in `crypto` module and has zero runtime dependencies. The library enforces consistency, security best practices, and key-rotation readiness across all Cobranza App microservices.

**What it does:**
- **AES-256-GCM** authenticated encryption with per-category **HKDF-SHA256** key derivation.
- **Deterministic HMAC-SHA256** hashing for indexed PII lookups with constant-time `verifyHash`.
- Combined `encryptAndHash` for fields needing both ciphertext storage and a hash index.
- Version-aware decryption for seamless key rotation.

**What it does NOT do (non-goals):**
- No password hashing (Argon2id/bcrypt belong in the Auth microservice).
- No `process.env` reads; all configuration is passed explicitly via `CryptoConfig`.
- No business logic, database access, or direct NestJS module (except an optional testing module).
- No browser or non-Node.js environments.

## Status / Stability

Phase 1 — the library API is stabilizing. Algorithms (AES-256-GCM, HKDF-SHA256, HMAC-SHA256) are the current design choice and may evolve before the 1.0 release. The package is consumed as a workspace package (`@cobranza-apps/crypto`) in a single root-level package layout.

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [API Summary](#api-summary)
- [NestJS Integration Guide](#nestjs-integration-guide)
- [Security Best Practices](#security-best-practices)
- [Key Rotation Procedure](#key-rotation-procedure)
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

`@cobranza-apps/entities` is a peer dependency required for the `EncryptedValue` contract and the `@IsEncryptedField()` decorator.

## Configuration

The library accepts all configuration at instantiation time via `CryptoConfig`. It never reads `process.env` internally.

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

### Encrypt / Decrypt

```typescript
const encrypted = crypto.encrypt('user@example.com', EncryptionKey.PII);
// encrypted: { encryptedData, keyName: 'pii', algorithm: 'aes-256-gcm', version: 1 }

const plaintext = crypto.decrypt(encrypted);
// 'user@example.com'
```

### Hash / verifyHash

```typescript
const emailHash = crypto.hash('user@example.com');
const isValid = crypto.verifyHash('user@example.com', emailHash); // true
```

### encryptAndHash (recommended for PII columns)

```typescript
const { encrypted, hash } = crypto.encryptAndHash('user@example.com', EncryptionKey.PII);
// store `encrypted` in the encrypted column, `hash` in the `*Hash` index column
```

### Key introspection

```typescript
crypto.hasKey('pii');             // true
crypto.getAvailableKeys();        // ['pii','company_pii','bank_data','notification','general']
```

## API Summary

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `constructor` | `config: CryptoConfig` | `SecureCrypto` | Creates a new instance with the given configuration |
| `encrypt` | `plaintext: string, keyName: EncryptionKey` | `EncryptedValue` | Encrypts a string using AES-256-GCM with HKDF-derived key |
| `decrypt` | `data: EncryptedValue` | `string` | Decrypts an `EncryptedValue`, supporting any version with an available key |
| `hash` | `plaintext: string` | `string` | Produces a deterministic HMAC-SHA256 hash |
| `verifyHash` | `plaintext: string, hash: string` | `boolean` | Constant-time hash verification |
| `encryptAndHash` | `plaintext: string, keyName: EncryptionKey` | `{ encrypted: EncryptedValue, hash: string }` | Combined encryption + hashing for indexed PII fields |
| `hasKey` | `name: string` | `boolean` | Checks whether a key derivation config exists for the given `name` |
| `getAvailableKeys` | — | `string[]` | Returns all configured key names |

## NestJS Integration Guide

The library remains framework-agnostic; this section shows how a **consuming** NestJS service wires it up. No `CryptoModule` is shipped in the library.

### ConfigModule setup

Define environment variables:

```text
COBRANZA_CRYPTO_MASTER_KEY=<base64 32-byte key>
COBRANZA_CRYPTO_HASH_SALT=<base64 >=32 bytes salt>
COBRANZA_CRYPTO_KEY_VERSION=1
```

### Provider

```typescript
// app.config.ts (consumed service)
import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';

export const cryptoProvider = {
  provide: SecureCrypto,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => new SecureCrypto({
    masterKey: config.get<string>('COBRANZA_CRYPTO_MASTER_KEY', { infer: true })!,
    hashSalt:  config.get<string>('COBRANZA_CRYPTO_HASH_SALT',  { infer: true })!,
    currentVersion: config.get<number>('COBRANZA_CRYPTO_KEY_VERSION', { infer: true }),
    defaultKeyName: EncryptionKey.PII,
  }),
};
```

### Interceptor pattern

```typescript
@Injectable()
export class CryptoInterceptor implements NestInterceptor {
  constructor(private readonly crypto: SecureCrypto) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    // Encrypt declared sensitive fields on inbound
    if (req.body?.email) {
      req.body.email = this.crypto.encryptAndHash(req.body.email, EncryptionKey.PII).encrypted;
    }
    return next.handle().pipe(
      map((data) => this.decryptOutbound(data)),
    );
  }

  private decryptOutbound(data: any) {
    // decrypt EncryptedValue fields for outbound response
    return data;
  }
}
```

### DTO + decorator integration

```typescript
import { EncryptedValue, IsEncryptedField } from '@cobranza-apps/entities';

export class CreateUserDto {
  @IsEncryptedField(EncryptionKey.PII)
  email!: EncryptedValue | string;
}
```

The `@IsEncryptedField()` decorator and `EncryptedValue` type live in `@cobranza-apps/entities`, not in this library.

## Security Best Practices

- **Fail closed**: errors are thrown; never returned as partial results.
- **Never log** plaintext, full keys, IVs, or salts. Errors are non-sensitive and contain no secret material.
- **Master key** and **hash salt** must be provided at runtime via `ConfigService` (vault or secret manager recommended). Never hardcode.
- **IV** is 12 random bytes per encryption; never reused.
- **Hash verification** uses constant-time comparison (`crypto.timingSafeEqual`).
- Use **`encryptAndHash`** (not `hash` alone) when the field also needs confidentiality.
- **Rotate keys** periodically; keep historical keys decryptable (see [Key Rotation Procedure](#key-rotation-procedure)).
- Consider caching decrypted values in-memory with a short TTL only when the consumer can guarantee cache isolation; the library does not cache.

## Key Rotation Procedure

1. **Generate** a new 32-byte master key (base64).
2. **Increment** `currentVersion` and deploy with both the new key and the previous key(s) available for decryption (consumers configure a key-to-version map).
3. **New encryptions** use the new version; existing `EncryptedValue` records keep their original `version`.
4. **Run an external background job** (outside this library) to re-encrypt old records: `decrypt(oldVersion) -> encrypt(newVersion)`.
5. **Verify** all records migrated; retire the old key only after no references remain.

The library decrypts any `version` for which a key is available; re-encryption itself is not performed by this library.

## Testing

### Consumer testing

Vitest/Jest consumers can use the testing subpath:

```typescript
import { getTestCrypto, SecureCryptoTestModule } from '@cobranza-apps/crypto/testing';
import { EncryptionKey } from '@cobranza-apps/crypto';

const crypto = getTestCrypto();
const { encrypted, hash } = crypto.encryptAndHash('test@example.com', EncryptionKey.PII);
```

- `getTestCrypto()` returns a `SecureCrypto` with fixed, deterministic keys — safe to publish; never usable in production.
- `test-vectors.ts` provides deterministic input/output pairs for reliable assertions across versions.
- `SecureCryptoTestModule` is a NestJS dynamic module for use in `Test.createTestingModule`.

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
npm test        # jest
```

### Package layout

```text
src/
  index.ts
  config.ts
  crypto.service.ts
  hkdf.ts
  utils.ts
  testing/
    index.ts
    test-vectors.ts
tests/
dist/
docs/
```

## License

Released to the public domain under **The Unlicense**. See [`LICENSE`](./LICENSE) for details.

[http://unlicense.org/](http://unlicense.org/)

---

> AI agents: read [`AGENTS.md`](./AGENTS.md) and follow the Critical Workflow before contributing. Project info lives in [`.agent/project-info/`](./.agent/project-info/).
