# Project Brief: `@cobranza-apps/crypto` – Shared Encryption & Hashing Library

## 1. Overview

**Project Name**: `@cobranza-apps/crypto`  
**Type**: Shared TypeScript library (monorepo package)  
**Purpose**: Provide a single source of truth for all encryption, decryption, and deterministic hashing operations involving sensitive data (PII, financial, bank, and notification data) across all microservices in the Cobranza App platform.

This library enforces **consistency**, **security best practices**, and **key rotation readiness** while remaining lightweight and framework-agnostic (though primarily used in NestJS services).

## 2. Core Requirements

### 2.1. Dependencies

- **Required peer/regular dependency**: `@cobranza-apps/entities` (to import `EncryptedValue` interface, and any other util definition).
- **Runtime dependencies**: None (use Node.js built-in `crypto` module only).
- **Dev dependencies**: TypeScript, Jest, type definitions.

### 2.2. EncryptedValue Compatibility

Must fully support the existing interface from the entities library:

```ts
export interface EncryptedValue {
  /** Base64-encoded (IV + ciphertext + authTag) */
  encryptedData: string;
  
  /** Logical key identifier (e.g. "pii", "bank_data") */
  keyName: string;
  
  /** Algorithm identifier. Default: "aes-256-gcm" */
  algorithm?: string;
  
  /** Key version (supports rotation) */
  version?: number;
}
```

Microservices may pass plain `string` values into DTOs; the library (or interceptors) will convert them to `EncryptedValue`.

## 3. Cryptographic Strategy

### 3.1. Reversible Encryption

- **Algorithm**: AES-256-GCM (authenticated encryption with associated data support). Note: this is a proposal, may use any better.
- **Key Derivation Strategy**: Master Key + HKDF.
  - Single `masterKey` (32 bytes, provided at runtime).
  - Derive per-category keys using **HKDF-SHA256**.
  - HKDF parameters:
    - `salt`: optional fixed salt or empty.
    - `info`: `"cobranza-encryption-v1:${keyName}"`.
    - `keyLength`: 32 bytes.
- **IV**: 12 bytes (random per encryption).
- **Output**: `IV (12) + ciphertext + authTag (16)` → Base64.

### 3.2. Deterministic Hashing (for `*Hash` columns)

- Algorithm: **HMAC-SHA256**. Note: this is a proposal, may use any better.
- Uses a dedicated `hashSalt` (≥32 bytes, base64).
- Purpose: Enable indexed lookups on PII fields (`emailHash`, `taxIdHash`, `referenceHash`, etc.).
- Include constant-time verification (`crypto.timingSafeEqual`).

### 3.3. Password Hashing

- **Explicitly out of scope** for this library.
- Password hashing (Argon2id or bcrypt) belongs in the Auth Microservice.

## 4. Public API (proposal)

### 4.1. Main Class

```ts
export class SecureCrypto {
  constructor(config: CryptoConfig);

  // Encryption
  encrypt(plaintext: string, keyName: EncryptionKey | string): EncryptedValue;
  decrypt(encryptedValue: EncryptedValue): string;

  // Hashing
  hash(plaintext: string): string;
  verifyHash(plaintext: string, expectedHash: string): boolean;

  // Combined operation (recommended for PII fields)
  encryptAndHash(
    plaintext: string, 
    keyName: EncryptionKey | string
  ): { encrypted: EncryptedValue; hash: string };

  // Utilities
  hasKey(keyName: string): boolean;
  getAvailableKeys(): string[];
}
```

### 4.2. Configuration Interface

```ts
export interface CryptoConfig {
  /** Base64-encoded 32-byte master key (from ConfigService) */
  masterKey: string;
  
  /** Base64-encoded salt for deterministic hashing (≥32 bytes) */
  hashSalt: string;
  
  /** Current key version (increment on rotation) */
  currentVersion?: number;
  
  /** Default key category */
  defaultKeyName?: EncryptionKey;
}
```

## 5. EncryptionKey Enum

```ts
export enum EncryptionKey {
  /** Personal Identifiable Information (names, emails, phones, fullName, contact, etc.) */
  PII = 'pii',
  
  /** Company-level PII (businessName, taxId, etc.) */
  COMPANY_PII = 'company_pii',
  
  /** Bank-related data (transaction description, reference, notes) */
  BANK_DATA = 'bank_data',
  
  /** Notification content (subject, body) */
  NOTIFICATION = 'notification',
  
  /** General / fallback for other sensitive fields */
  GENERAL = 'general',
}
```

The `keyName` stored in `EncryptedValue` will be the **string value** of the enum (e.g., `"pii"`).

## 6. Testing Support

Provide a dedicated testing subpath/module:

- `SecureCryptoTestModule` (NestJS-friendly).
- Factory function `getTestCrypto()` that returns a pre-configured instance with **known, fixed test keys**.
- Include `test-vectors.ts` with deterministic input/output pairs for reliable tests.
- Easy import in Jest:

```ts
import { SecureCryptoTestModule, getTestCrypto } from '@cobranza-apps/crypto/testing';
```

## 7. Security & Operational Considerations

- **Key Rotation**: Library must decrypt any historical `version`. Re-encryption is handled via background jobs outside this lib.
- **Error Handling**: Fail closed. Throw clear, non-sensitive errors.
- **No Environment Loading**: Do **not** read `process.env` inside the library. All configuration must be passed explicitly (NestJS `ConfigService` will provide values).
- **Performance**: Document recommendations for in-memory caching of decrypted values (with TTL) where appropriate.
- **Never**:
  - Log plaintext, full keys, or sensitive data.
  - Hardcode keys or salts.
  - Use weak algorithms or non-random IVs.
- **Future-proofing**: Design for easy swap to post-quantum algorithms later.

## 8. Package Structure (proposal)

```bash
packages/crypto/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                    # Main exports
│   ├── config.ts                   # Interfaces + EncryptionKey enum
│   ├── crypto.service.ts           # SecureCrypto implementation
│   ├── hkdf.ts                     # Internal HKDF derivation
│   ├── testing/
│   │   ├── index.ts
│   │   └── test-vectors.ts
│   └── utils.ts                    # Helpers
├── tests/                          # Unit tests
├── dist/
└── docs/
```

## 9. Documentation & Deliverables

- Comprehensive **README.md** with:
  - Installation & usage examples.
  - NestJS integration guide (ConfigModule + interceptor pattern).
  - Security best practices.
  - Key rotation procedure.
- Full unit test suite with high coverage.
- JSDoc on all public methods.
- Example of how to use with the existing `@IsEncryptedField()` decorator.
- Full documentation in docs folder.
- Step by step library introduction and how-to-use documentation for AI Agents, specially when import in NestJS projects.

## 10. Non-Goals

- Automatic `.env` loading inside the library.
- Password hashing logic.
- Business logic or database interaction.
- Direct integration with NestJS modules (except optional testing module).
- Support for browser / non-Node environments.

<!-- DO NOT DELETE NEXT SECTION -->

## Important Note for AI Agents

All agents working on this project MUST adhere to the workflows and rules outlined in [AI Agent Onboarding document](../../AGENTS.md).

Before starting any task:

1. **Review `AGENTS.md`**: is the primary source of instructions for agents.
2. **Follow Workflows**: follow the procedures defined in `.agent/WORKFLOWS.md`, especially the `.kilo/commands/critical-workflow.md`.

<!-- END DO NOT DELETE -->
