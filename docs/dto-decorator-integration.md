# DTO / Decorator Integration

Automatic plain-string to `EncryptedValue` + hash conversion using `@IsEncryptedField()` in NestJS applications.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [DTO shape with `@IsEncryptedField()`](#dto-shape-with-isencryptedfield)
- [Option A — Transformation Pipe](#option-a--transformation-pipe)
- [Option B — Interceptor](#option-b--interceptor)
- [Option C — TypeORM entity listeners + subscriber](#option-c--typeorm-entity-listeners--subscriber)
- [Recommended patterns for `ms-db-gateway`](#recommended-patterns-for-ms-db-gateway)
- [Testing](#testing)
- [Common pitfalls](#common-pitfalls)
- [Reference](#reference)

## Overview

Sensitive fields (email, tax ID, phone, bank description) must be encrypted before
they reach the database. `@cobranza-apps/crypto` provides `encryptAndHash` which
returns both an `EncryptedValue` and a deterministic HMAC-SHA256 hash. The
`@cobranza-apps/entities` package provides the `@IsEncryptedField()` decorator
for DTO validation and the `EncryptedValue` type.

This document covers three patterns for automatically converting plain strings
into `{ encrypted: EncryptedValue, hash: string }` at different layers of a
NestJS application:

- **Pipe** — controller-level transformation, best for API-facing services.
- **Interceptor** — AOP-style wrapping, best for cross-cutting concerns.
- **TypeORM subscriber / entity listener** — database-layer encryption, best for
  event-driven or batch-write scenarios where the controller never sees plaintext.

For the initial `CryptoModule` setup see
[How to Configure in NestJS](./how-to-configure-in-nestjs.md).

## Prerequisites

Before you begin, ensure `CryptoModule` is registered in the root module (see
[Reusable CryptoModule](./how-to-configure-in-nestjs.md#reusable-cryptomodule-built-in)),
`@cobranza-apps/entities` is installed (provides `EncryptedValue` and `@IsEncryptedField()`),
and `class-validator` + NestJS `ValidationPipe` is configured globally or per-controller.

## DTO shape with `@IsEncryptedField()`

Define a DTO where the inbound field is a plain string and the encrypted column
is typed as `EncryptedValue`:

```typescript
import { IsString, IsEmail } from 'class-validator';
import { EncryptionKey } from '@cobranza-apps/crypto';
import { EncryptedValue, IsEncryptedField } from '@cobranza-apps/entities';

export class CreateUserDto {
  @IsEmail()
  email!: string;                        // inbound plain string from the client

  @IsEncryptedField(EncryptionKey.PII)
  encryptedEmail!: EncryptedValue;       // encrypted payload stored in the database

  @IsString()
  emailHash!: string;                    // deterministic hash for indexed lookups
}
```

- `email` — the inbound plain string (what the client sends).
- `encryptedEmail` — the encrypted `EncryptedValue` stored in the database.
- `emailHash` — the deterministic hash stored in a separate `*Hash` index column.

## Option A — Transformation Pipe

A dedicated pipe transforms the inbound plain string into the encrypted form
before validation runs. This keeps your controller clean and the transformation
logic reusable.

### Pipe implementation

```typescript
import { PipeTransform, Injectable } from '@nestjs/common';
import { CryptoService } from '@cobranza-apps/crypto/nestjs';
import { EncryptionKey } from '@cobranza-apps/crypto';

@Injectable()
export class EncryptPiiPipe implements PipeTransform {
  constructor(private readonly crypto: CryptoService) {}

  transform(value: Record<string, unknown>): Record<string, unknown> {
    if (!value || typeof value !== 'object') {
      return value; // pass through non-object bodies unchanged
    }

    // Shallow-copy to avoid mutating the original request payload
    const result = { ...value };

    if (typeof result.email === 'string') {
      // encryptAndHash returns both the EncryptedValue and the deterministic hash
      const { encrypted, hash } = this.crypto.encryptAndHash(
        result.email as string,
        EncryptionKey.PII,
      );
      result.encryptedEmail = encrypted; // EncryptedValue stored in the encrypted column
      result.emailHash = hash;           // deterministic hash stored in the *Hash index column
    }

    return result;
  }
}
```

### Controller usage

```typescript
import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { EncryptPiiPipe } from './encrypt-pii.pipe';
import { CreateUserDto } from './create-user.dto';

@Controller('users')
export class UserController {
  @Post()
  @UsePipes(new EncryptPiiPipe(), ValidationPipe)
  async create(@Body() dto: CreateUserDto) {
    // dto.encryptedEmail is now EncryptedValue
    // dto.emailHash is the deterministic hash
    // dto.email is still the original plain string
    return this.userService.create(dto);
  }
}
```

## Option B — Interceptor

An interceptor provides AOP-style encryption. This is useful when the same
encryption logic must apply across many controllers without modifying each one.

### Interceptor implementation

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CryptoService } from '@cobranza-apps/crypto/nestjs';
import { EncryptionKey } from '@cobranza-apps/crypto';

@Injectable()
export class EncryptPiiInterceptor implements NestInterceptor {
  constructor(private readonly crypto: CryptoService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();

    // Encrypt inbound plaintext before the route handler and ValidationPipe run
    if (request.body && typeof request.body.email === 'string') {
      const { encrypted, hash } = this.crypto.encryptAndHash(
        request.body.email,
        EncryptionKey.PII,
      );
      request.body.encryptedEmail = encrypted; // populated for ValidationPipe / handler
      request.body.emailHash = hash;           // populated for ValidationPipe / handler
    }

    return next.handle(); // downstream pipes/handlers see the mutated body
  }
}
```

### Controller usage

```typescript
import { Controller, Post, Body, UseInterceptors } from '@nestjs/common';
import { EncryptPiiInterceptor } from './encrypt-pii.interceptor';
import { CreateUserDto } from './create-user.dto';

@Controller('users')
@UseInterceptors(EncryptPiiInterceptor)
export class UserController {
  @Post()
  async create(@Body() dto: CreateUserDto) {
    // dto.encryptedEmail and dto.emailHash are populated by the interceptor
    return this.userService.create(dto);
  }
}
```

### Validation-timing nuance

Interceptors run **before** validation/pipes. The mutated `request.body` is what
the `ValidationPipe` validates and transforms. Therefore the DTO should declare
the encrypted fields as optional so class-transformer populates them:

```typescript
import { IsString, IsEmail, IsOptional } from 'class-validator';
import { EncryptionKey } from '@cobranza-apps/crypto';
import { EncryptedValue, IsEncryptedField } from '@cobranza-apps/entities';

export class CreateUserDto {
  @IsEmail()
  email!: string; // inbound plaintext from the client

  @IsOptional()  // optional because the interceptor populates it before ValidationPipe runs
  @IsEncryptedField(EncryptionKey.PII)
  encryptedEmail?: EncryptedValue;

  @IsOptional()  // optional because the interceptor populates it before ValidationPipe runs
  @IsString()
  emailHash?: string;
}
```

For response decryption, see the existing
[CryptoInterceptor](./how-to-configure-in-nestjs.md#interceptor-pattern) in the
main NestJS guide.

## Option C — TypeORM entity listeners + subscriber

Database-layer encryption ensures every write path — REST API, event consumer,
batch job — goes through encryption before hitting the database.

> **Note on entity listeners:** TypeORM entity listeners (`@BeforeInsert`, etc.)
> are instantiated by TypeORM directly and cannot use NestJS constructor injection.
> A workaround involves a static-holder pattern (binding `CryptoService` via
> `OnModuleInit`), but this is brittle and harder to test. Prefer the
> `@EventSubscriber()` approach below for full DI support.

### Recommended — `@EventSubscriber()`

A subscriber is a proper NestJS provider with full DI support:

```typescript
import { EntitySubscriberInterface, EventSubscriber,
         InsertEvent, UpdateEvent } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { CryptoService } from '@cobranza-apps/crypto/nestjs';
import { EncryptionKey } from '@cobranza-apps/crypto';
import { UserEntity } from './user.entity';

@Injectable()
@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<UserEntity> {
  constructor(private readonly crypto: CryptoService) {}

  // Scope this subscriber to UserEntity events only
  listenTo(): typeof UserEntity {
    return UserEntity;
  }

  // Encrypt before every INSERT — entity is always defined
  async beforeInsert(event: InsertEvent<UserEntity>): Promise<void> {
    this.encryptUser(event.entity);
  }

  // Encrypt before every UPDATE — entity may be undefined for query-builder updates
  async beforeUpdate(event: UpdateEvent<UserEntity>): Promise<void> {
    if (event.entity) {
      this.encryptUser(event.entity as UserEntity);
    }
  }

  // Shared helper: encrypts plaintext email → EncryptedValue + hash on the entity
  private encryptUser(user: UserEntity): void {
    if (!user.email) return; // skip if no plaintext email to encrypt
    const { encrypted, hash } = this.crypto.encryptAndHash(
      user.email,
      EncryptionKey.PII,
    );
    user.encryptedEmail = encrypted; // encrypted column on the entity
    user.emailHash = hash;           // deterministic hash column for indexed lookups
  }
}
```

Register the subscriber in the module:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoModule } from '@cobranza-apps/crypto/nestjs';
import { UserEntity } from './user.entity';
import { UserSubscriber } from './user.subscriber';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    CryptoModule.forRootAsync({ /* inject ConfigService, see how-to-configure-in-nestjs.md */ }),
  ],
  providers: [UserSubscriber], // register as a provider so CryptoService is injected
})
export class UserModule {}
```

## Recommended patterns for `ms-db-gateway`

The `ms-db-gateway` service is the primary consumer of this library. It processes
incoming events and persists data to the database. The choice of encryption
pattern depends on the deployment context.

### Comparison

| Criteria | Pipe | Interceptor | Subscriber |
|---|---|---|---|
| Coverage | Controller only | Controller only | All write paths (REST, events, batch) |
| DI support | Full | Full | Full |
| Best for | Explicit endpoint transformation | Cross-cutting route logic | Authoritative persistence layer |
| Complexity | Low | Low | Medium |

### Recommendation

Use the `@EventSubscriber()` as the authoritative encryption layer for all TypeORM
writes. Add an interceptor or pipe in API-facing services only for inbound shaping
and outbound decryption. For services without HTTP endpoints, the subscriber alone
is sufficient.

## Testing

Use the `@cobranza-apps/crypto/testing` subpath to get a pre-configured `SecureCrypto`
instance with deterministic keys. Inject it into your pipe, interceptor, or subscriber
under test:

```typescript
import { getTestCrypto } from '@cobranza-apps/crypto/testing';
import { EncryptionKey } from '@cobranza-apps/crypto';

const crypto = getTestCrypto();
const { encrypted, hash } = crypto.encryptAndHash('test@example.com', EncryptionKey.PII);
// Use `crypto` as a mock for CryptoService in pipe/interceptor/subscriber unit tests
```

For NestJS module-level testing, see
[Testing in NestJS](./how-to-configure-in-nestjs.md#testing-in-nestjs) and
[Testing Utilities](./testing-utilities.md).

## Common pitfalls

- **Pipe ordering with global `ValidationPipe`**: Global pipes execute before
  controller-level pipes. If your DTO requires `encryptedEmail`, validation
  fails. Apply `ValidationPipe` at the controller level or make encrypted fields
  optional.

- **Logging encrypted payloads**: Never log `EncryptedValue.encryptedData`. Log
  only anonymized identifiers or the `keyName`/`version` for operational
  telemetry.

- **Entity-listener DI limitation**: TypeORM instantiates listeners directly;
  they cannot use NestJS constructor injection. Prefer `@EventSubscriber()`
  for full DI support.

- **Hash column must share the service's `hashSalt`**: The hash is deterministic
  based on `hashSalt`. If the consuming service configures a different salt,
  hash lookups break. Ensure every instance uses the same salt for the same key
  category.

- **Interceptor does not cover non-HTTP triggers**: Interceptors and pipes only
  apply to HTTP request lifecycles. For message-driven microservices (RabbitMQ,
  Kafka), use the subscriber approach instead.

- **Mutating `request.body` directly is fragile**: The interceptor example
  mutates `request.body`. For production, prefer a custom pipe or decorator
  that returns a new object to preserve immutability.

## Reference

- [README](../README.md) — Full library documentation.
- [How to Configure in NestJS](./how-to-configure-in-nestjs.md) — `CryptoModule`
  registration, interceptor pattern, and deployment guidance.
- [Architecture](../.agent/project-info/architecture.md) — Technical architecture
  and security boundaries.
- [Brief](../.agent/project-info/brief.md) — Project scope and cryptographic
  strategy.
- [Bulk Multi-Field Encryption](./nestjs-integration-example.md#11-bulk-multi-field-encryption-encryptobject--decryptobject) —
  `encryptObject` / `decryptObject` with `BulkFieldMap` for entities with
  multiple encrypted columns (full NestJS example).
