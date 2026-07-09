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

1. `CryptoModule` registered in the root module (sync `forRoot` or async
   `forRootAsync`). See
   [Reusable CryptoModule (built-in)](./how-to-configure-in-nestjs.md#reusable-cryptomodule-built-in).
2. `@cobranza-apps/entities` installed — provides `EncryptedValue` type and
   `@IsEncryptedField()` decorator.
3. `class-validator` + NestJS `ValidationPipe` configured globally or per-controller.

## DTO shape with `@IsEncryptedField()`

Define a DTO where the inbound field is a plain string and the encrypted column
is typed as `EncryptedValue`:

```typescript
import { IsString, IsEmail } from 'class-validator';
import { EncryptionKey } from '@cobranza-apps/crypto';
import { EncryptedValue, IsEncryptedField } from '@cobranza-apps/entities';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsEncryptedField(EncryptionKey.PII)
  encryptedEmail!: EncryptedValue;

  @IsString()
  emailHash!: string;
}
```

- `email` — the inbound plain string (what the client sends).
- `encryptedEmail` — the encrypted `EncryptedValue` stored in the database.
- `emailHash` — the deterministic hash stored in a separate `*Hash` index column.

> **Note:** In the **Interceptor** variant (Option B), `@IsEncryptedField()` is
> omitted from the inbound DTO because validation runs before encryption.

## Option A — Transformation Pipe

A dedicated pipe transforms the inbound plain string into the encrypted form
before validation runs. This keeps your controller clean and the transformation
logic reusable.

### Pipe implementation

```typescript
import { PipeTransform, Injectable, Inject } from '@nestjs/common';
import { CryptoService } from '@cobranza-apps/crypto/nestjs';
import { EncryptionKey } from '@cobranza-apps/crypto';

@Injectable()
export class EncryptPiiPipe implements PipeTransform {
  constructor(private readonly crypto: CryptoService) {}

  transform(value: Record<string, unknown>): Record<string, unknown> {
    if (!value || typeof value !== 'object') {
      return value;
    }

    const result = { ...value };

    if (typeof result.email === 'string') {
      const { encrypted, hash } = this.crypto.encryptAndHash(
        result.email as string,
        EncryptionKey.PII,
      );
      result.encryptedEmail = encrypted;
      result.emailHash = hash;
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

### Pitfall — pipe ordering

NestJS applies **global** pipes before controller-level pipes. If a global
`ValidationPipe` runs before `EncryptPiiPipe`, validation will fail because
`encryptedEmail` and `emailHash` are missing at that point. Either:

- Apply `ValidationPipe` only at the controller/method level (as shown above),
  or
- Make `email`, `encryptedEmail`, and `emailHash` all optional with
  `@IsOptional()` and use a custom validator to ensure at least one is present.

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

    if (request.body && typeof request.body.email === 'string') {
      const { encrypted, hash } = this.crypto.encryptAndHash(
        request.body.email,
        EncryptionKey.PII,
      );
      request.body.encryptedEmail = encrypted;
      request.body.emailHash = hash;
    }

    return next.handle();
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

Interceptors run **after** validation. Therefore the inbound DTO should **not**
decorate `encryptedEmail` with `@IsEncryptedField()` — validation sees only the
original plain fields. The DTO should use a simpler shape:

```typescript
export class CreateUserDto {
  @IsEmail()
  email!: string;
}
```

After the interceptor adds `encryptedEmail` and `emailHash`, the controller
receives the full payload. For response decryption, see the existing
[CryptoInterceptor](./how-to-configure-in-nestjs.md#interceptor-pattern) in the
main NestJS guide.

## Option C — TypeORM entity listeners + subscriber

Database-layer encryption ensures every write path — REST API, event consumer,
batch job — goes through encryption before hitting the database.

### Entity listener with static-holder workaround

Because TypeORM entity listeners are instantiated by TypeORM (not NestJS), they
cannot use constructor injection. A static holder bridges the gap:

```typescript
import { BeforeInsert, BeforeUpdate, Entity, Column } from 'typeorm';
import { CryptoService } from '@cobranza-apps/crypto/nestjs';
import { EncryptionKey } from '@cobranza-apps/crypto';
import { EncryptedValue } from '@cobranza-apps/entities';

@Entity('users')
export class UserEntity {
  static crypto: CryptoService;

  @Column()
  email!: string;

  @Column('json')
  encryptedEmail!: EncryptedValue;

  @Column()
  emailHash!: string;

  @BeforeInsert()
  @BeforeUpdate()
  encryptEmail(): void {
    const { encrypted, hash } = UserEntity.crypto.encryptAndHash(
      this.email,
      EncryptionKey.PII,
    );
    this.encryptedEmail = encrypted;
    this.emailHash = hash;
  }
}
```

Bind the service in a module's `OnModuleInit`:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { CryptoService } from '@cobranza-apps/crypto/nestjs';

@Injectable()
export class CryptoBinder implements OnModuleInit {
  constructor(private readonly crypto: CryptoService) {}

  onModuleInit(): void {
    UserEntity.crypto = this.crypto;
  }
}
```

Register both `CryptoBinder` and the entity:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoModule } from '@cobranza-apps/crypto/nestjs';
import { UserEntity } from './user.entity';
import { CryptoBinder } from './crypto-binder.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    CryptoModule.forRootAsync({ /* ... */ }),
  ],
  providers: [CryptoBinder],
})
export class UserModule {}
```

### DI-friendly alternative — `@EventSubscriber()`

A subscriber is a proper NestJS provider that receives DI support:

```typescript
import { DataSource, EntitySubscriberInterface, EventSubscriber,
         InsertEvent, UpdateEvent } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { CryptoService } from '@cobranza-apps/crypto/nestjs';
import { EncryptionKey } from '@cobranza-apps/crypto';
import { UserEntity } from './user.entity';

@Injectable()
@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<UserEntity> {
  constructor(private readonly crypto: CryptoService) {}

  listenTo(): typeof UserEntity {
    return UserEntity;
  }

  async beforeInsert(event: InsertEvent<UserEntity>): Promise<void> {
    this.encryptUser(event.entity);
  }

  async beforeUpdate(event: UpdateEvent<UserEntity>): Promise<void> {
    if (event.entity) {
      this.encryptUser(event.entity as UserEntity);
    }
  }

  private encryptUser(user: UserEntity): void {
    if (!user.email) return;
    const { encrypted, hash } = this.crypto.encryptAndHash(
      user.email,
      EncryptionKey.PII,
    );
    user.encryptedEmail = encrypted;
    user.emailHash = hash;
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
    CryptoModule.forRootAsync({ /* ... */ }),
  ],
  providers: [UserSubscriber],
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
| Encryption coverage | Controller only | Controller only | All write paths (REST, events, batch) |
| Auditability | Explicit per endpoint | Implicit per route | Transparent at entity layer |
| DI support | Full | Full | Full (subscriber variant) |
| Response decryption | Separate pipe needed | Same interceptor | Not needed (entity is source of truth) |
| Event-driven / batch writes | Not covered | Not covered | Covered |
| Complexity | Low | Low | Medium |

### Recommendation

Use the **subscriber** (`@EventSubscriber()`) as the authoritative encryption
layer for ALL write paths. This guarantees that every record persisted through
TypeORM — whether from a REST API, an event consumer, or a batch job — is
encrypted before storage.

Add an **interceptor** (or pipe) in API-facing services for inbound shaping
(e.g., stripping plaintext after encryption) and outbound decryption when
responding to HTTP requests. This keeps the REST layer clean without duplicating
encryption logic.

For purely event-driven services that never expose HTTP endpoints, the
subscriber alone is sufficient.

## Common pitfalls

- **Pipe ordering with global `ValidationPipe`**: Global pipes execute before
  controller-level pipes. If your DTO requires `encryptedEmail`, validation
  fails. Apply `ValidationPipe` at the controller level or make encrypted fields
  optional.

- **Logging encrypted payloads**: Never log `EncryptedValue.encryptedData`. Log
  only anonymized identifiers or the `keyName`/`version` for operational
  telemetry.

- **Entity-listener DI limitation**: TypeORM instantiates listeners directly;
  they cannot use NestJS constructor injection. Use the static-holder pattern or
  prefer `@EventSubscriber()` for full DI support.

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
