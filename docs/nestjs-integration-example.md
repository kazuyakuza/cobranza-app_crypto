# Full NestJS Integration Example

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [1. Install Dependencies](#1-install-dependencies)
- [2. Environment & Key Generation](#2-environment--key-generation)
- [3. Register CryptoModule (forRootAsync + ConfigService)](#3-register-cryptomodule-forrootasync--configservice)
- [4. Define a DTO with @IsEncryptedField()](#4-define-a-dto-with-isecryptedfield)
- [5. Encrypt in a Service via CryptoService](#5-encrypt-in-a-service-via-cryptoservice)
- [6. Persist with a TypeORM @EventSubscriber()](#6-persist-with-a-typeorm-eventsubscriber)
- [7. Controller Wiring](#7-controller-wiring)
- [8. Lookup by Hash](#8-lookup-by-hash)
- [9. Decrypt on Read](#9-decrypt-on-read)
- [10. Test the Integration](#10-test-the-integration)
- [Reference](#reference)

## Overview

This example ties every layer together — module registration, DTO, service, TypeORM subscriber, controller, search, and testing. It is a copy-pasteable starting point for any NestJS microservice consuming `@cobranza-apps/crypto`.

## Prerequisites

- NestJS 10+ application
- `@nestjs/config` installed for environment configuration
- `TypeORM` installed with an entity repository

## 1. Install Dependencies

Install `@cobranza-apps/crypto` and `@cobranza-apps/entities` as shown in [Getting Started](./getting-started.md#1-install).

## 2. Environment & Key Generation

Create a `.env` file (never commit it — see [Security Checklist](./security-checklist.md)):

```bash
COBRANZA_CRYPTO_MASTER_KEY=<base64-32-bytes>
COBRANZA_CRYPTO_HASH_SALT=<base64-48-bytes>
COBRANZA_CRYPTO_KEY_VERSION=1
```

Generate `COBRANZA_CRYPTO_MASTER_KEY` and `COBRANZA_CRYPTO_HASH_SALT` as shown in [Getting Started](./getting-started.md#2-generate-your-keys). Store them in `.env` (never commit).

## 3. Register CryptoModule (forRootAsync + ConfigService)

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

> Use `forRoot` instead of `forRootAsync` when you have the config object synchronously: `CryptoModule.forRoot({ masterKey, hashSalt, currentVersion: 1, defaultKeyName: EncryptionKey.PII })`.

## 4. Define a DTO with @IsEncryptedField()

```typescript
import { IsEmail } from 'class-validator';
import { EncryptionKey } from '@cobranza-apps/crypto';
import { EncryptedValue, IsEncryptedField } from '@cobranza-apps/entities';

export class CreateCustomerDto {
  @IsEmail()
  email!: string;                        // inbound plaintext

  @IsEncryptedField(EncryptionKey.PII)
  encryptedEmail!: EncryptedValue;       // stored encrypted column

  emailHash!: string;                    // deterministic hash index column
}
```

## 5. Encrypt in a Service via CryptoService

```typescript
import { Injectable } from '@nestjs/common';
import { CryptoService } from '@cobranza-apps/crypto/nestjs';
import { EncryptionKey } from '@cobranza-apps/crypto';
import type { EncryptedValue } from '@cobranza-apps/entities';
import type { CreateCustomerDto } from './create-customer.dto';

@Injectable()
export class CustomerService {
  constructor(private readonly crypto: CryptoService) {}

  encryptEmail(plaintext: string) {
    return this.crypto.encryptAndHash(plaintext, EncryptionKey.PII);
  }

  decryptEmail(encrypted: EncryptedValue): string {
    return this.crypto.decrypt(encrypted);
  }

  create(dto: CreateCustomerDto) {
    const { encrypted, hash } = this.encryptEmail(dto.email);
    return { ...dto, encryptedEmail: encrypted, emailHash: hash };
  }
}
```

## 6. Persist with a TypeORM @EventSubscriber()

This subscriber automatically encrypts the email before every insert or update:

```typescript
import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { CryptoService } from '@cobranza-apps/crypto/nestjs';
import { EncryptionKey } from '@cobranza-apps/crypto';
import { CustomerEntity } from './customer.entity';

@Injectable()
@EventSubscriber()
export class CustomerSubscriber implements EntitySubscriberInterface<CustomerEntity> {
  constructor(private readonly crypto: CryptoService) {}

  listenTo(): typeof CustomerEntity {
    return CustomerEntity;
  }

  async beforeInsert(event: InsertEvent<CustomerEntity>): Promise<void> {
    this.encryptCustomer(event.entity);
  }

  async beforeUpdate(event: UpdateEvent<CustomerEntity>): Promise<void> {
    if (event.entity) {
      this.encryptCustomer(event.entity as CustomerEntity);
    }
  }

  private encryptCustomer(customer: CustomerEntity): void {
    if (!customer.email) return;
    const { encrypted, hash } = this.crypto.encryptAndHash(customer.email, EncryptionKey.PII);
    customer.encryptedEmail = encrypted;
    customer.emailHash = hash;
  }
}
```

## 7. Controller Wiring

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { CreateCustomerDto } from './create-customer.dto';
import { CustomerService } from './customer.service';

@Controller('customers')
export class CustomerController {
  constructor(private readonly customers: CustomerService) {}

  @Post()
  async create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }
}
```

## 8. Lookup by Hash

```typescript
const emailHash = this.crypto.hash(searchEmail);
const customer = await this.customerRepo.findOne({ where: { emailHash } });
```

This is the key advantage of the dual-column pattern — indexed lookups on sensitive fields without exposing plaintext in the query.

## 9. Decrypt on Read

```typescript
const rows = await this.customerRepo.find({ take: 20 });
const result = rows.map((r) => ({
  id: r.id,
  email: this.crypto.decrypt(r.encryptedEmail),
  createdAt: r.createdAt,
}));
```

> Decrypt only the rows and columns you render. Avoid bulk-decrypting entire tables in a single pass.

## 10. Test the Integration

Use the testing subpath for unit tests:

```typescript
import { Test } from '@nestjs/testing';
import { CryptoModule, CryptoService } from '@cobranza-apps/crypto/nestjs';
import { TEST_CRYPTO_CONFIG } from '@cobranza-apps/crypto/testing';
import { EncryptionKey } from '@cobranza-apps/crypto';

describe('CustomerService', () => {
  let crypto: CryptoService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CryptoModule.forRoot(TEST_CRYPTO_CONFIG)],
      providers: [CustomerService],
    }).compile();

    crypto = moduleRef.get(CryptoService);
  });

  it('roundtrips email', () => {
    const { encrypted } = crypto.encryptAndHash('test@example.com', EncryptionKey.PII);
    expect(crypto.decrypt(encrypted)).toBe('test@example.com');
  });
});
```

## Reference

- [README](../README.md) — Full library documentation.
- [How to Configure in NestJS](./how-to-configure-in-nestjs.md) — Full module/provider/interceptor reference.
- [DTO / Decorator Integration](./dto-decorator-integration.md) — Pipe vs interceptor vs subscriber trade-offs.
- [Testing Utilities](./testing-utilities.md) — `getTestCrypto`, `TEST_VECTORS`, shape predicates.
- [Real-World Scenarios](./real-world-scenarios.md) — taxId / bank description patterns.
- [`brief.md`](../.agent/project-info/brief.md) — Project scope and cryptographic strategy.
- [`architecture.md`](../.agent/project-info/architecture.md) — Technical architecture and API surface.
