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
- [11. Bulk Multi-Field Encryption (encryptObject / decryptObject)](#11-bulk-multi-field-encryption-encryptobject--decryptobject)
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

Add these methods inside `CustomerService` (or any injectable service with `CryptoService` and a repository):

```typescript
// Inside CustomerService — lookup by deterministic hash without exposing plaintext
async findByEmail(searchEmail: string): Promise<CustomerEntity | null> {
  const emailHash = this.crypto.hash(searchEmail);
  return this.customerRepo.findOne({ where: { emailHash } });
}
```

This is the key advantage of the dual-column pattern — indexed lookups on sensitive fields without exposing plaintext in the query.

## 9. Decrypt on Read

Add this method inside `CustomerService`:

```typescript
// Inside CustomerService — decrypt only the rows and columns you render
async getCustomersWithDecryptedEmail(): Promise<Array<{ id: string; email: string; createdAt: Date }>> {
  const rows = await this.customerRepo.find({ take: 20 });
  return rows.map((r) => ({
    id: r.id,
    email: this.crypto.decrypt(r.encryptedEmail),
    createdAt: r.createdAt,
  }));
}
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

## 11. Bulk Multi-Field Encryption (encryptObject / decryptObject)

When an entity has several sensitive columns, calling `encryptAndHash` once per
field inside a subscriber becomes repetitive. `encryptObject` and `decryptObject`
accept a `BulkFieldMap` that maps each field name to its `EncryptionKey`, letting
you encrypt or decrypt all mapped fields in a single call.

### Entity with multiple encrypted columns

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import type { EncryptedValue } from '@cobranza-apps/entities';

@Entity('customers')
export class CustomerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Encrypted columns — typed as EncryptedValue
  @Column({ type: 'jsonb' })
  encryptedEmail!: EncryptedValue;

  @Column({ type: 'jsonb' })
  encryptedFullName!: EncryptedValue;

  @Column({ type: 'jsonb' })
  encryptedPhone!: EncryptedValue;

  // Deterministic hash columns for indexed lookups
  @Column()
  emailHash!: string;

  @Column()
  fullNameHash!: string;

  // Plaintext scratch fields — never persisted as sensitive data
  @Column({ nullable: true })
  notes!: string;

  @Column({ nullable: true })
  internalStatus!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
```

> `notes` and `internalStatus` are plaintext scratch fields. They pass through
> `encryptObject` / `decryptObject` untouched because they are not present in
> the `BulkFieldMap`.

### BulkFieldMap definition

```typescript
import { EncryptionKey } from '@cobranza-apps/crypto';
import type { BulkFieldMap } from '@cobranza-apps/crypto';
import { CustomerEntity } from './customer.entity';

export const CUSTOMER_ENCRYPTED_FIELDS: BulkFieldMap<CustomerEntity> = {
  encryptedEmail:    EncryptionKey.PII,
  encryptedFullName: EncryptionKey.PII,
  encryptedPhone:    EncryptionKey.PII,
};
```

### Write side — `@EventSubscriber()` with `encryptObject`

```typescript
import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { CryptoService } from '@cobranza-apps/crypto/nestjs';
import { EncryptionKey } from '@cobranza-apps/crypto';
import { CustomerEntity } from './customer.entity';
import { CUSTOMER_ENCRYPTED_FIELDS } from './customer.field-map';

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
    const encrypted = this.crypto.encryptObject(customer, CUSTOMER_ENCRYPTED_FIELDS);
    customer.encryptedEmail    = encrypted.encryptedEmail;
    customer.encryptedFullName = encrypted.encryptedFullName;
    customer.encryptedPhone    = encrypted.encryptedPhone;

    // Hash columns for indexed lookups (only when plaintext is available)
    if (customer.notes) {
      customer.emailHash = this.crypto.hash(customer.notes);
    }
  }
}
```

> `encryptObject` returns a shallow clone — the original `customer` is never
> mutated. Assign the cloned fields back to the entity so TypeORM persists them.

### Read side — service calling `decryptObject`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CryptoService } from '@cobranza-apps/crypto/nestjs';
import { CustomerEntity } from './customer.entity';
import { CUSTOMER_ENCRYPTED_FIELDS } from './customer.field-map';

@Injectable()
export class CustomerReadService {
  constructor(
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
    private readonly crypto: CryptoService,
  ) {}

  async getDecryptedCustomers(): Promise<Array<{
    id: string;
    email: string;
    fullName: string;
    phone: string;
    notes: string;
    createdAt: Date;
  }>> {
    const rows = await this.customerRepo.find({ take: 50 });

    return rows.map((row) => {
      const decrypted = this.crypto.decryptObject(row, CUSTOMER_ENCRYPTED_FIELDS);
      return {
        id: row.id,
        email: decrypted.encryptedEmail as unknown as string,
        fullName: decrypted.encryptedFullName as unknown as string,
        phone: decrypted.encryptedPhone as unknown as string,
        notes: row.notes,
        createdAt: row.createdAt,
      };
    });
  }
}
```

> Decrypt only the rows and columns you render. Avoid bulk-decrypting entire
> tables in a single pass. For hot-path reads, wrap the `CryptoService` with
> [`withCache`](./how-to-configure-in-nestjs.md#cached-decryptor) to skip
> repeated AES-256-GCM calls on the same ciphertext.

### Cross-references

- [`encryptObject` / `decryptObject` API](../README.md#bulk-operations) — type
  signature and usage in the main README.
- [DTO / Decorator Integration](./dto-decorator-integration.md) — pipe vs
  interceptor vs subscriber trade-offs for single-field encryption.
- [`BulkFieldMap` type](../.agent/project-info/architecture.md) — full type
  contract and per-field key mapping rules.
- [Testing Utilities](./testing-utilities.md) — use `getTestCrypto()` to unit
  test bulk encrypt/decrypt without real keys.

## Reference

- [README](../README.md) — Full library documentation.
- [How to Configure in NestJS](./how-to-configure-in-nestjs.md) — Full module/provider/interceptor reference.
- [DTO / Decorator Integration](./dto-decorator-integration.md) — Pipe vs interceptor vs subscriber trade-offs.
- [Testing Utilities](./testing-utilities.md) — `getTestCrypto`, `TEST_VECTORS`, shape predicates.
- [Real-World Scenarios](./real-world-scenarios.md) — taxId / bank description patterns.
- [`brief.md`](../.agent/project-info/brief.md) — Project scope and cryptographic strategy.
- [`architecture.md`](../.agent/project-info/architecture.md) — Technical architecture and API surface.
