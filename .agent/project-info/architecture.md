# Architecture: `@cobranza-apps/crypto`

<!-- AI AGENT: This file defines the technical architecture, API surface, crypto design, and security boundaries.
     For product vision see product.md. For stack and tooling see tech.md.
     Always resolve inconsistencies in favor of brief.md. -->

> Source of truth: [brief.md](brief.md). Resolve inconsistencies in favor of brief.md.

## Table of Contents

- [System Overview](#system-overview)
- [Public API Surface](#public-api-surface)
- [EncryptionKey Categories](#encryptionkey-categories)
- [Cryptographic Architecture](#cryptographic-architecture)
- [Component Map / Package Structure](#component-map--package-structure)
- [Design Patterns](#design-patterns)
- [Critical Paths](#critical-paths)
- [Security Boundaries](#security-boundaries)
- [Reference](#reference)

## System Overview

A shared TypeScript library consumed by multiple NestJS microservices within the Cobranza App platform. The library depends on `@cobranza-apps/entities` for the `EncryptedValue` contract. All cryptographic operations use only Node.js built-in `crypto` module — no runtime dependencies. See [Tech Stack →](tech.md#tech-stack) for full runtime details.

The library is a single package at the repo root (not a monorepo `packages/crypto/` subdirectory). The monorepo diagram in `brief.md` §8 serves as a conceptual reference only.

## Public API Surface

### SecureCrypto Class

```ts
export class SecureCrypto {
  constructor(config: CryptoConfig);

  encrypt(plaintext: string, keyName: EncryptionKey | string): EncryptedValue;
  decrypt(encryptedValue: EncryptedValue): string;
  hash(plaintext: string): string;
  verifyHash(plaintext: string, expectedHash: string): boolean;
  encryptAndHash(plaintext: string, keyName: EncryptionKey | string): { encrypted: EncryptedValue; hash: string };
  hasKey(keyName: string): boolean;
  getAvailableKeys(): string[];
}
```

### CryptoConfig Interface

```ts
export interface CryptoConfig {
  masterKey: string;          // Base64-encoded 32-byte master key
  hashSalt: string;           // Base64-encoded salt for hashing (>= 32 bytes)
  currentVersion?: number;    // Key version (increment on rotation)
  defaultKeyName?: EncryptionKey;
}
```

Full details and `EncryptedValue` interface: [brief.md §2.2 and §4](brief.md).

## EncryptionKey Categories

| Enum Value     | String Value     | Purpose                                                   |
|----------------|------------------|-----------------------------------------------------------|
| `PII`          | `pii`            | Personal Identifiable Information (names, emails, phones) |
| `COMPANY_PII`  | `company_pii`    | Company-level data (businessName, taxId)                  |
| `BANK_DATA`    | `bank_data`      | Bank-related data (transaction reference, notes)          |
| `NOTIFICATION` | `notification`   | Notification content (subject, body)                      |
| `GENERAL`      | `general`        | Fallback for other sensitive fields                       |

## Cryptographic Architecture

### Reversible Encryption (AES-256-GCM)

- **Algorithm**: AES-256-GCM (authenticated encryption with associated data). Proposed — may use alternatives.
- **Key Derivation**: HKDF-SHA256 derives per-category keys from a single 32-byte `masterKey`.
  - HKDF `info` string: `"cobranza-encryption-v1:${keyName}"`.
  - Derived key length: 32 bytes.
  - HKDF `salt`: optional fixed salt or empty.
- **IV**: 12 random bytes per encryption.
- **Output format**: `IV (12 bytes) + ciphertext + authTag (16 bytes)` → Base64-encoded string.

### Deterministic Hashing (HMAC-SHA256)

- **Algorithm**: HMAC-SHA256. Proposed — may use alternatives.
- **Salt**: Dedicated `hashSalt` (>= 32 bytes, Base64-encoded).
- **Purpose**: Indexed lookups on PII fields (`emailHash`, `taxIdHash`, `referenceHash`).
- **Verification**: Constant-time comparison via `crypto.timingSafeEqual`.

### Key Rotation

- Each `EncryptedValue` carries a `version` field.
- Library can decrypt any historical `version` as long as the corresponding key is available.
- Re-encryption is handled by external background jobs, outside the library scope.

## Component Map / Package Structure

```
<repo-root>/
├── src/
│   ├── index.ts              # Main exports
│   ├── config.ts             # Interfaces + EncryptionKey enum
│   ├── crypto.service.ts     # SecureCrypto implementation
│   ├── hkdf.ts               # Internal HKDF derivation
│   ├── testing/
│   │   ├── index.ts
│   │   └── test-vectors.ts
│   └── utils.ts              # Helpers
├── tests/                    # Unit tests
├── dist/                     # Build output (gitignored)
└── docs/                     # Documentation
```

Ref: `brief.md` §8 (conceptual monorepo diagram adapted to root-level single package).

## Design Patterns

- **Factory**: `getTestCrypto()` returns a pre-configured instance with fixed test keys.
- **Strategy**: Per-category HKDF derivation using `keyName` as the discriminator.
- **Module Pattern**: `SecureCryptoTestModule` for NestJS test integration.
- **Integration (consumer-side)**: DTO `EncryptedValue` and `@IsEncryptedField()` decorator from `@cobranza-apps/entities`.

## Critical Paths

1. **Encrypt path**: `plaintext` + `keyName` → HKDF derive key → generate 12-byte IV → AES-256-GCM encrypt → concatenate `IV(12)+ciphertext+authTag(16)` → Base64 encode → `EncryptedValue`.
2. **Decrypt path**: Validate `EncryptedValue` → split `IV(12)/ciphertext/authTag(16)` → look up key by `version` → HKDF derive → AES-256-GCM decrypt → plaintext.
3. **Hash path**: `plaintext` → HMAC-SHA256 with `hashSalt` → hex or Base64 output.
4. **encryptAndHash path**: Runs encrypt and hash sequentially; returns both results. Recommended for PII columns that need both encrypted storage and indexable hash.

## Security Boundaries

See also [Product Non-Goals →](product.md#non-goals) and [Technical Constraints →](tech.md#technical-constraints).

- Fail closed: throw clear, non-sensitive errors on any failure.
- Never log plaintext, full keys, or sensitive data.
- No hardcoded keys or salts.
- No `process.env` reads inside the library (all config explicit).
- Constant-time verification for hash comparisons.
- Non-random IVs are prohibited.

## Reference

Full authoritative spec: [brief.md](brief.md).
