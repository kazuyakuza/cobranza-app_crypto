# Getting Started with @cobranza-apps/crypto

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [1. Install](#1-install)
- [2. Generate Your Keys](#2-generate-your-keys)
- [3. Configure SecureCrypto](#3-configure-securecrypto)
- [4. Your First Encrypt / Decrypt](#4-your-first-encrypt--decrypt)
- [5. Hash for Indexed Lookups](#5-hash-for-indexed-lookups)
- [6. Combined encryptAndHash (PII dual-column pattern)](#6-combined-encryptandhash-pii-dual-column-pattern)
- [Next Steps](#next-steps)
- [Reference](#reference)

## Overview

This guide walks you from zero to a working encrypt / decrypt / hash roundtrip in under 5 minutes. After completing it you will have everything you need to protect sensitive fields in any Node.js application.

## Prerequisites

- **Node.js** 22.14.0+
- An existing npm project with a `package.json`

## 1. Install

```bash
npm install @cobranza-apps/crypto @cobranza-apps/entities
```

The `entities` package provides the `EncryptedValue` type and the `@IsEncryptedField()` decorator used in NestJS DTOs.

## 2. Generate Your Keys

The library needs two secrets:

- **Master key** — 32 random bytes, base64-encoded. Used for AES-256-GCM encryption.
- **Hash salt** — at least 32 random bytes (48 recommended), base64-encoded. Used for deterministic HMAC-SHA256 hashing.

Generate them with `openssl`:

```bash
# Master key: 32 bytes -> 44 base64 chars
openssl rand -base64 32

# Hash salt: 48 bytes -> 64 base64 chars
openssl rand -base64 48
```

Store the output values securely (see [Security Checklist](./security-checklist.md)).

## 3. Configure SecureCrypto

Create a `CryptoConfig` object and instantiate `SecureCrypto`:

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
```

> The constructor validates key sizes and throws immediately on invalid input — fail fast at startup.

## 4. Your First Encrypt / Decrypt

```typescript
const encrypted = crypto.encrypt('user@example.com', EncryptionKey.PII);
// {
//   encryptedData: 'base64-encoded IV(12) + ciphertext + authTag(16)',
//   keyName: 'pii',
//   algorithm: 'aes-256-gcm',
//   version: 1,
// }

const plaintext = crypto.decrypt(encrypted);
console.assert(plaintext === 'user@example.com');
```

Ciphertext is non-deterministic (each call generates a random 12-byte IV). Decryption reads the `version` from the payload, so historical records remain decryptable after key rotation.

## 5. Hash for Indexed Lookups

Deterministic hashing enables indexed lookups of sensitive fields without decrypting every row:

```typescript
const emailHash = crypto.hash('user@example.com');      // deterministic base64 HMAC-SHA256
console.assert(crypto.verifyHash('user@example.com', emailHash)); // true (constant-time)

const tampered = crypto.verifyHash('other@example.com', emailHash);
console.assert(tampered === false);
```

## 6. Combined encryptAndHash (PII dual-column pattern)

For fields that need both confidentiality (encrypt) and searchability (hash), use the dual-column pattern:

```typescript
const { encrypted, hash } = crypto.encryptAndHash('user@example.com', EncryptionKey.PII);

// DB column 1: store `encrypted` (EncryptedValue) as the encrypted payload
// DB column 2: store `hash` (string) as the deterministic hash index
```

On read, decrypt only the rows you return and look up by hash for searches.

## Next Steps

- [How to Configure in NestJS](./how-to-configure-in-nestjs.md) — Register `CryptoModule` with `ConfigService`.
- [NestJS Integration Example](./nestjs-integration-example.md) — End-to-end module + DTO + service + subscriber + test.
- [Real-World Scenarios](./real-world-scenarios.md) — taxId, email, and bank description patterns.
- [Security Checklist](./security-checklist.md) — Production hardening checklist.
- [Key Rotation Guide](./key-rotation-guide.md) — Version-based rotation and `reEncrypt` migration.
- [Performance Considerations](./performance-considerations.md) — HKDF cache, ciphertext overhead, sync cost.
- [Testing Utilities](./testing-utilities.md) — Using the testing subpath in Jest and NestJS.

## Reference

- [README](../README.md) — Full library documentation.
- [`brief.md`](../.agent/project-info/brief.md) — Project scope and cryptographic strategy.
- [`architecture.md`](../.agent/project-info/architecture.md) — Technical architecture and API surface.
