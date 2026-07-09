# Testing Utilities -- `@cobranza-apps/crypto/testing`

## Table of Contents

- [Overview](#overview)
- [Imports](#imports)
- [Plain Jest Usage](#plain-jest-usage)
- [NestJS TestingModule Usage](#nestjs-testingmodule-usage)
- [Test Vectors](#test-vectors)
- [Why No Exact Ciphertext](#why-no-exact-ciphertext)
- [Exported API Reference](#exported-api-reference)
- [Recipes](#recipes)

## Overview

Any microservice can `import { getTestCrypto } from '@cobranza-apps/crypto/testing'`
and obtain a `SecureCrypto` pre-configured with fixed, deterministic, TEST-ONLY
keys (zero-filled buffers). No manual key configuration is required. Safe to
publish; never usable in production (brief 7).

## Imports

Two subpaths are relevant:

- `@cobranza-apps/crypto` -- production `SecureCrypto`, `EncryptionKey`, `CryptoConfig`.
- `@cobranza-apps/crypto/testing` -- all testing utilities listed below.

## Plain Jest Usage

### Basic Crypto Instance

```typescript
import { getTestCrypto } from '@cobranza-apps/crypto/testing';
import { EncryptionKey } from '@cobranza-apps/crypto';

const crypto = getTestCrypto();

const encrypted = crypto.encrypt('test@example.com', EncryptionKey.PII);
const decrypted = crypto.decrypt(encrypted);
// decrypted === 'test@example.com'
```

### With Version Override

```typescript
import { buildTestCrypto } from '@cobranza-apps/crypto/testing';

const cryptoV2 = buildTestCrypto(2);
// Uses key version 2 for encryption, still decrypts any version
```

## NestJS TestingModule Usage

### Basic Module Import

Spread `SecureCryptoTestModule` (or its alias `SecureCryptoTestProvider`) into
`Test.createTestingModule`:

```typescript
import { Test } from '@nestjs/testing';
import { SecureCryptoTestModule } from '@cobranza-apps/crypto/testing';
import { SecureCrypto } from '@cobranza-apps/crypto';

const moduleRef = await Test.createTestingModule({
  ...SecureCryptoTestModule,
  providers: [...SecureCryptoTestModule.providers, YourService], // service under test
}).compile();

const crypto = moduleRef.get(SecureCrypto);
```

### Version-Specific Module

Use `createSecureCryptoTestProvider(version)` to scope a module to a specific
key version:

```typescript
import { Test } from '@nestjs/testing';
import { createSecureCryptoTestProvider } from '@cobranza-apps/crypto/testing';

const testProvider = createSecureCryptoTestProvider(2);
const moduleRef = await Test.createTestingModule({
  ...testProvider,
  providers: [...testProvider.providers, YourService],
}).compile();
```

## Test Vectors

The constant `TEST_VECTORS` is an array of 11 `TestVector` objects covering
every `EncryptionKey` category plus edge cases:

| # | Category | Version | Edge Case |
|---|----------|---------|-----------|
| 1 | PII | 1 | Typical email |
| 2 | COMPANY_PII | 1 | Internal identifier |
| 3 | BANK_DATA | 2 | Rotation scenario |
| 4 | NOTIFICATION | 1 | Notification text |
| 5 | GENERAL | 1 | Generic value |
| 6 | PII | 1 | Latin-accent + emoji unicode |
| 7 | PII | 1 | Empty string (minimum payload) |
| 8 | GENERAL | 2 | Short numeric |
| 9 | COMPANY_PII | 2 | CJK multi-byte UTF-8 |
| 10 | NOTIFICATION | 1 | Embedded newline |
| 11 | BANK_DATA | 1 | Long text (10,000 chars) |

Each vector contains:

- `plaintext` -- the input string.
- `keyName` -- the `EncryptionKey` value.
- `version` -- the key version to use.
- `expectedEncryptedShape` -- deterministic **structural** properties of the
  encrypted output (`algorithm`, `keyName`, `version`, `encryptedDataByteLength`).
  The ciphertext itself is non-deterministic (see below).
- `expectedHash` -- the exact HMAC-SHA256 hash (base64 literal). This assertion
  **is** deterministic and must match exactly.

## Why No Exact Ciphertext

AES-256-GCM uses a random 12-byte IV per encryption (`crypto.randomBytes(12)`),
making the ciphertext **non-deterministic** and impossible to assert as a
literal. Cryptographic correctness is verified via encrypt->decrypt roundtrip
tests. The `expectedEncryptedShape` field provides a deterministic regression
signal for `algorithm`, `keyName`, `version`, and payload byte length. See
`src/testing/test-vectors.ts` for the full rationale.

## Exported API Reference

| Export | Type | Description |
|--------|------|-------------|
| `getTestCrypto()` | `() => SecureCrypto` | Convenience alias for `buildTestCrypto()` |
| `buildTestCrypto(version?)` | `(number?) => SecureCrypto` | Fresh instance, optional version override |
| `SecureCryptoTestModule` | `SecureCryptoProviderConfig` | NestJS provider config (spreadable) |
| `SecureCryptoTestProvider` | `SecureCryptoProviderConfig` | Alias for `SecureCryptoTestModule` |
| `createSecureCryptoTestProvider(version?)` | `(number?) => SecureCryptoProviderConfig` | Version-scoped NestJS provider config |
| `TEST_VECTORS` | `readonly TestVector[]` | 11 deterministic test vectors |
| `TestVector` | interface | Vector shape: plaintext, keyName, version, expectedEncryptedShape, expectedHash |
| `ExpectedEncryptedShape` | interface | Structural shape: algorithm, keyName, version, encryptedDataByteLength |
| `encryptedDataByteLengthFor(plaintext)` | `(string) => number` | Computes expected payload byte length |
| `encryptedMatchesShape(params)` | `(EncryptedMatchParams) => boolean` | Jest-agnostic shape predicate |
| `EncryptedMatchInput` | interface | Minimal EncryptedValue-like input for the predicate |
| `EncryptedMatchParams` | interface | Parameters object for `encryptedMatchesShape` |
| `SecureCryptoProviderConfig` | interface | Provider-config shape spreadable into NestJS `Test.createTestingModule` |
| `TEST_CRYPTO_CONFIG` | `CryptoConfig` | Fixed test config (zero keys) |
| `TEST_MASTER_KEY` | `string` | All-zero 32-byte master key, base64 |
| `TEST_HASH_SALT` | `string` | All-zero 64-byte hash salt, base64 |

## Recipes

### Encrypt + Assert Shape

```typescript
import { buildTestCrypto, TEST_VECTORS, encryptedMatchesShape } from '@cobranza-apps/crypto/testing';

const vector = TEST_VECTORS[0]; // PII email
const crypto = buildTestCrypto(vector.version);
const encrypted = crypto.encrypt(vector.plaintext, vector.keyName);

expect(encryptedMatchesShape({ encrypted, vector })).toBe(true);
expect(crypto.decrypt(encrypted)).toBe(vector.plaintext);
```

### Hash Exact Match

```typescript
import { getTestCrypto, TEST_VECTORS } from '@cobranza-apps/crypto/testing';

const vector = TEST_VECTORS[0];
const crypto = getTestCrypto();

expect(crypto.hash(vector.plaintext)).toBe(vector.expectedHash);
expect(crypto.verifyHash(vector.plaintext, vector.expectedHash)).toBe(true);
```

### encryptAndHash Dual-Column Pattern

```typescript
import { buildTestCrypto, TEST_VECTORS } from '@cobranza-apps/crypto/testing';

const vector = TEST_VECTORS[0];
const crypto = buildTestCrypto(vector.version);
const result = crypto.encryptAndHash(vector.plaintext, vector.keyName);

// Store result.encrypted in encrypted column, result.hash in hash index column
expect(crypto.decrypt(result.encrypted)).toBe(vector.plaintext);
expect(result.hash).toBe(vector.expectedHash);
```

### Version Rotation Test

```typescript
import { buildTestCrypto, TEST_VECTORS } from '@cobranza-apps/crypto/testing';

// Encrypt with v2, decrypt with v2
const v2 = buildTestCrypto(2);
const v2Encrypted = v2.encrypt('rotated-value', 'bank_data');

// A v1-configured instance can still decrypt it (payload carries version)
const v1 = buildTestCrypto(1);
expect(v1.decrypt(v2Encrypted)).toBe('rotated-value');
```

---

See also:

- [Architecture Document](../.agent/project-info/architecture.md) -- Security
  boundaries and design rationale for non-deterministic ciphertext.
- [Project Brief](../.agent/project-info/brief.md) -- Scope, requirements,
  and cryptographic strategy.
- [README](../README.md) -- General library documentation and usage.
