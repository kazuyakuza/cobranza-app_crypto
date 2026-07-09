# How to Configure `@cobranza-apps/crypto` in NestJS

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [ConfigModule Setup](#configmodule-setup)
- [Reusable CryptoModule](#reusable-cryptomodule)
- [Provider with ConfigService](#provider-with-configservice)
- [Interceptor Pattern](#interceptor-pattern)
- [DTO + Decorator Integration](#dto--decorator-integration)
- [Key Versioning & Rotation](#key-versioning--rotation)
- [Testing in NestJS](#testing-in-nestjs)
- [Deployment & Secret Management](#deployment--secret-management)
- [Common Pitfalls](#common-pitfalls)
- [Reference](#reference)

## Overview

This guide shows how to wire `SecureCrypto` into a NestJS microservice using `@nestjs/config`'s `ConfigService`. The library never reads `process.env` itself — all configuration is injected explicitly.

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

## Reusable CryptoModule

The recommended approach is a dedicated `CryptoModule` that exports `SecureCrypto` as a provider:

```typescript
// crypto.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SecureCrypto,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new SecureCrypto({
          masterKey: config.get<string>('COBRANZA_CRYPTO_MASTER_KEY', { infer: true })!,
          hashSalt: config.get<string>('COBRANZA_CRYPTO_HASH_SALT', { infer: true })!,
          currentVersion: config.get<number>('COBRANZA_CRYPTO_KEY_VERSION', { infer: true }),
          defaultKeyName: EncryptionKey.PII,
        }),
    },
  ],
  exports: [SecureCrypto],
})
export class CryptoModule {}
```

Import it in any module that needs encryption:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { CryptoModule } from './crypto.module';
import { UserService } from './user.service';

@Module({
  imports: [CryptoModule],
  providers: [UserService],
})
export class AppModule {}
```

Then inject `SecureCrypto` into any service:

```typescript
import { Injectable } from '@nestjs/common';
import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';

@Injectable()
export class UserService {
  constructor(private readonly crypto: SecureCrypto) {}

  async createUser(email: string) {
    const { encrypted, hash } = this.crypto.encryptAndHash(email, EncryptionKey.PII);
    // store `encrypted` and `hash` in database
  }
}
```

## Provider with ConfigService

For apps that prefer a provider object over a dedicated module, use the `useFactory` pattern directly:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SecureCrypto, EncryptionKey } from '@cobranza-apps/crypto';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [
    {
      provide: SecureCrypto,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new SecureCrypto({
          masterKey: config.get<string>('COBRANZA_CRYPTO_MASTER_KEY', { infer: true })!,
          hashSalt: config.get<string>('COBRANZA_CRYPTO_HASH_SALT', { infer: true })!,
          currentVersion: config.get<number>('COBRANZA_CRYPTO_KEY_VERSION', { infer: true }),
          defaultKeyName: EncryptionKey.PII,
        }),
    },
  ],
  exports: [SecureCrypto],
})
export class AppModule {}
```

> The [Reusable CryptoModule](#reusable-cryptomodule) approach is preferred for multi-module apps.

## Interceptor Pattern

Use an interceptor to encrypt sensitive inbound fields and decrypt outbound responses:

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SecureCrypto, EncryptionKey, EncryptedValue } from '@cobranza-apps/crypto';

@Injectable()
export class CryptoInterceptor implements NestInterceptor {
  private readonly sensitiveFields = ['email', 'phone', 'ssn'];

  constructor(private readonly crypto: SecureCrypto) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

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
import { EncryptedValue, IsEncryptedField } from '@cobranza-apps/entities';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsEncryptedField(EncryptionKey.PII)
  encryptedEmail!: EncryptedValue;
}
```

> The `EncryptionKey` enum and `@IsEncryptedField()` decorator live in `@cobranza-apps/entities`, not in this library.

## Key Versioning & Rotation

See the full [Key Rotation Procedure](../README.md#key-rotation-procedure) in the main README.

Key concepts for NestJS consumers:

- `currentVersion` in `CryptoConfig` determines which version new encryptions use.
- Each `EncryptedValue` payload carries its own `version` field, so decryption always knows which key material to use.
- Historical values remain decryptable as long as the corresponding key is available.
- Re-encryption of old records is an external background job — not handled by this library.

To trigger rotation in your NestJS app:

1. Update `COBRANZA_CRYPTO_KEY_VERSION` to the new version.
2. Add the new master key to your secrets store while keeping the old one.
3. Deploy; new encryptions use the new version, existing records stay decryptable.
4. Run a background job to re-encrypt records with the old `version` field.

## Testing in NestJS

Use the testing subpath to get a pre-configured `SecureCrypto` instance for tests:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getTestCrypto, SecureCryptoTestModule } from '@cobranza-apps/crypto/testing';
import { SecureCrypto } from '@cobranza-apps/crypto';

describe('UserService', () => {
  let crypto: SecureCrypto;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        ...SecureCryptoTestModule,  // provides SecureCrypto with test keys
      ],
    }).compile();

    crypto = module.get(SecureCrypto);
  });

  it('should encrypt and decrypt', () => {
    const encrypted = crypto.encrypt('test@example.com', 'pii');
    const decrypted = crypto.decrypt(encrypted);
    expect(decrypted).toBe('test@example.com');
  });
});
```

For plain Jest testing (without NestJS module), see [Testing Utilities](./testing-utilities.md).

## Deployment & Secret Management

- Load `masterKey` and `hashSalt` from a vault / KMS / secret store at boot — never bake them into container images.
- Keep `masterKey` and `hashSalt` as distinct secrets with independent rotation lifecycles.
- Restrict secret access to the service identity (e.g., IAM role, Kubernetes service account).
- Never log secrets, derived keys, IVs, or `EncryptedValue.encryptedData` payloads.
- Use separate secrets per environment (dev / staging / prod).
- Fail fast at startup if required secrets are missing — the library constructor validates key sizes.

## Common Pitfalls

- **Forgetting `ConfigModule` import**: `ConfigService` is only available in modules that import `ConfigModule` (or when it is registered with `isGlobal: true`).
- **Missing `{ infer: true }`**: When calling `config.get<number>('KEY_VERSION', { infer: true })`, the `infer` option ensures the value is cast to the correct type (important for numeric env vars).
- **Logging encrypted payloads**: `encryptedData` is binary-derived base64 but still reveals the field exists. Never log `EncryptedValue` objects.
- **Shared `hashSalt` across environments**: Each environment must use its own salt to prevent cross-environment hash matching.
- **Mixing `keyName` values**: Use the `EncryptionKey` enum consistently; string literals that misspell a key name will cause runtime key-not-found errors.

## Reference

- [README](../README.md) — Full library documentation
- [Testing Utilities](./testing-utilities.md) — Consumer test helpers
- [Architecture](../.agent/project-info/architecture.md) — Technical architecture
- [Brief](../.agent/project-info/brief.md) — Project scope and cryptographic strategy
