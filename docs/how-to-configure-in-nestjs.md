# How to Configure `@cobranza-apps/crypto` in NestJS

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [ConfigModule Setup](#configmodule-setup)
- [Reusable CryptoModule (built-in)](#reusable-cryptomodule-built-in)
- [Provider with ConfigService](#provider-with-configservice)
- [Interceptor Pattern](#interceptor-pattern)
- [DTO + Decorator Integration](#dto--decorator-integration)
- [Key Versioning & Rotation](#key-versioning--rotation)
- [Testing in NestJS](#testing-in-nestjs)
- [Deployment & Secret Management](#deployment--secret-management)
- [Common Pitfalls](#common-pitfalls)
- [Reference](#reference)

## Overview

Inject `CryptoConfig` explicitly; the library does not read `process.env`.

## Prerequisites

- **Node.js** 22.14.0 (see `.nvmrc`)
- Installed `@cobranza-apps/crypto` + `@cobranza-apps/entities`
- `@nestjs/config` set up in the consuming app
- A secrets source (vault / KMS / env injected at runtime)

## Environment Variables

Define these variables in your NestJS app's `.env` or environment:

```text
COBRANZA_CRYPTO_MASTER_KEY=<base64 32-byte key>
COBRANZA_CRYPTO_HASH_SALT=<base64 >=32 bytes salt>
COBRANZA_CRYPTO_KEY_VERSION=1
```

Generate safe values:

```bash
# Master key (32 bytes → 44 base64 chars)
openssl rand -base64 32

# Hash salt (48 bytes → 64 base64 chars)
openssl rand -base64 48
```

> **Never commit these values.** See [Deployment & Secret Management](#deployment--secret-management).

## ConfigModule Setup

Register `@nestjs/config` in your root module so `ConfigService.get(...)` is available:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
})
export class AppModule {}
```

Setting `isGlobal: true` makes `ConfigService` injectable everywhere without re-importing `ConfigModule` in every feature module.

## Reusable CryptoModule (built-in)

The library ships a built-in `CryptoModule` at `@cobranza-apps/crypto/nestjs` that provides
`CryptoService` (an `@Injectable()` wrapper around `SecureCrypto`). Both synchronous
(`forRoot`) and asynchronous (`forRootAsync`) registration are supported.

### Sync registration (`forRoot`)

Use when the full `CryptoConfig` object is available at bootstrap:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { EncryptionKey } from '@cobranza-apps/crypto';
import { CryptoModule } from '@cobranza-apps/crypto/nestjs';

@Module({
  imports: [
    CryptoModule.forRoot({
      masterKey: process.env.COBRANZA_CRYPTO_MASTER_KEY!, // base64 32-byte key
      hashSalt: process.env.COBRANZA_CRYPTO_HASH_SALT!,   // base64 >= 32 bytes
      currentVersion: 1,
      defaultKeyName: EncryptionKey.PII,
    }),
  ],
})
export class AppModule {}
```

### Async registration with `ConfigService` (recommended)

Use when the config must be resolved from injected dependencies (e.g. `ConfigService`):

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

Then inject `CryptoService` into any service:

```typescript
import { Injectable } from '@nestjs/common';
import { CryptoService } from '@cobranza-apps/crypto/nestjs';
import { EncryptionKey } from '@cobranza-apps/crypto';

@Injectable()
export class UserService {
  constructor(private readonly crypto: CryptoService) {}

  async createUser(email: string) {
    const { encrypted, hash } = this.crypto.encryptAndHash(email, EncryptionKey.PII);
    // store `encrypted` and `hash` in database
  }
}
```

## Provider with ConfigService

Use the provider object directly in any module without a dedicated `CryptoModule`:

```typescript
{
  provide: SecureCrypto,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    new SecureCrypto({
      masterKey: config.get<string>('COBRANZA_CRYPTO_MASTER_KEY', { infer: true })!,
      hashSalt: config.get<string>('COBRANZA_CRYPTO_HASH_SALT', { infer: true })!,
      currentVersion: parseInt(
        config.get<string>('COBRANZA_CRYPTO_KEY_VERSION', { infer: true }) ?? '1',
        10,
      ),
      defaultKeyName: EncryptionKey.PII,
    }),
}
```

The [built-in CryptoModule](#reusable-cryptomodule-built-in) is preferred. The inline provider shown here remains a valid alternative for projects that cannot use the built-in module.

## Interceptor Pattern

Use an interceptor to encrypt sensitive inbound fields and decrypt outbound responses:

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';
import { EncryptedValue } from '@cobranza-apps/entities';

@Injectable()
export class CryptoInterceptor implements NestInterceptor {
  private readonly sensitiveFields = ['email', 'phone', 'ssn'];

  constructor(private readonly crypto: SecureCrypto) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Illustrative only — production code should use a dedicated pipe
    // or decorator instead of mutating request.body directly.
    if (request.body) {
      for (const field of this.sensitiveFields) {
        if (typeof request.body[field] === 'string') {
          request.body[field] = this.crypto.encryptAndHash(
            request.body[field],
            EncryptionKey.PII,
          ).encrypted;
        }
      }
    }

    return next.handle().pipe(
      map((data) => this.decryptOutbound(data)),
    );
  }

  private decryptOutbound(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;

    for (const [key, value] of Object.entries(data)) {
      if (this.isEncryptedValue(value)) {
        (data as Record<string, unknown>)[key] = this.crypto.decrypt(value);
      }
    }
    return data;
  }

  private isEncryptedValue(value: unknown): value is EncryptedValue {
    return (
      typeof value === 'object' &&
      value !== null &&
      'encryptedData' in value &&
      'keyName' in value
    );
  }
}
```

Apply the interceptor to controllers or routes:

```typescript
@Controller('users')
@UseInterceptors(CryptoInterceptor)
export class UserController {}
```

## DTO + Decorator Integration

The `@cobranza-apps/entities` package provides `EncryptedValue` and the `@IsEncryptedField()` validation decorator. Use them in DTOs to mark fields that carry encrypted payloads:

```typescript
import { IsString, IsEmail } from 'class-validator';
import { EncryptionKey } from '@cobranza-apps/crypto';
import { EncryptedValue, IsEncryptedField } from '@cobranza-apps/entities';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsEncryptedField(EncryptionKey.PII)
  encryptedEmail!: EncryptedValue;
}
```

> `EncryptionKey` is from `@cobranza-apps/crypto`; `@IsEncryptedField()` and `EncryptedValue` are from `@cobranza-apps/entities`.

> For full transformation examples (pipes, interceptors, TypeORM subscribers) and ms-db-gateway recommendations, see [DTO / Decorator Integration](./dto-decorator-integration.md).

## Key Versioning & Rotation

See the full [Key Rotation Procedure](../README.md#key-rotation-procedure) in the main README.

NestJS-specific points:

- Update `COBRANZA_CRYPTO_KEY_VERSION` env var and add the new key to your secrets store. Deploy; new encryptions use the new version.
- Run a background job (outside this library) to re-encrypt records with the old `version`. Use `reEncrypt` for a one-call decrypt + re-encrypt:

```typescript
// Background re-encryption job (illustrative)
const records = await db.findRecordsWithVersion(1);
for (const record of records) {
  const reEncrypted = crypto.reEncrypt(record.encryptedField);
  await db.updateRecord(record.id, { encryptedField: reEncrypted });
}
```

## Testing in NestJS

Use the testing subpath to get a pre-configured `CryptoConfig` for tests. The built-in
`CryptoModule.forRoot(...)` can be used directly with the test config:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CryptoModule, CryptoService } from '@cobranza-apps/crypto/nestjs';
import { TEST_CRYPTO_CONFIG } from '@cobranza-apps/crypto/testing';

describe('UserService', () => {
  let crypto: CryptoService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CryptoModule.forRoot(TEST_CRYPTO_CONFIG)],
      providers: [UserService],
    }).compile();

    crypto = module.get(CryptoService);
  });

  it('should encrypt and decrypt using CryptoService', () => {
    const encrypted = crypto.encrypt('test@example.com', EncryptionKey.PII);
    const decrypted = crypto.decrypt(encrypted);
    expect(decrypted).toBe('test@example.com');
  });
});
```

Alternatively, the testing subpath provides a pre-configured `SecureCrypto` instance for tests:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { SecureCryptoTestModule } from '@cobranza-apps/crypto/testing';
import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';

describe('UserService', () => {
  let crypto: SecureCrypto;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        ...SecureCryptoTestModule.providers,
      ],
    }).compile();

    crypto = module.get(SecureCrypto);
  });

  it('should encrypt and decrypt', () => {
    const encrypted = crypto.encrypt('test@example.com', EncryptionKey.PII);
    const decrypted = crypto.decrypt(encrypted);
    expect(decrypted).toBe('test@example.com');
  });
});
```

For plain Jest testing (without NestJS module), see [Testing Utilities](./testing-utilities.md).

## Deployment & Secret Management

See the [Security Best Practices](../README.md#security-best-practices) guide for the full list of rules. NestJS-specific points:

- Load `masterKey` and `hashSalt` from a vault / KMS / secret store at boot.
- Restrict secret access via IAM role or Kubernetes service account.
- Fail fast at startup — the library constructor validates key sizes.

## Common Pitfalls

- **Forgetting `ConfigModule`**: `ConfigService` only works in modules that import `ConfigModule` (or use `isGlobal: true`).
- **`{ infer: true }` does not cast at runtime**: Use `parseInt(config.get<string>('COBRANZA_CRYPTO_KEY_VERSION') ?? '1', 10)` for numeric values.
- **Logging encrypted payloads**: Never log `EncryptedValue` objects — `encryptedData` reveals the field exists.
- **Shared `hashSalt` across environments**: Each environment needs its own salt to prevent cross-environment hash matching.
- **Mixing `keyName` values**: Use `EncryptionKey` enum consistently; misspelled string literals cause runtime key-not-found errors.

## Reference

- [README](../README.md) — Full library documentation
- [Testing Utilities](./testing-utilities.md) — Consumer test helpers
- [Architecture](../.agent/project-info/architecture.md) — Technical architecture
- [Brief](../.agent/project-info/brief.md) — Project scope and cryptographic strategy
