# Task 2: DTO / Decorator Support Examples — Implementation Plan

## Objective

Create documentation and examples showing how to integrate `@IsEncryptedField()` with `@cobranza-apps/crypto` for automatic plain-string → `EncryptedValue` + hash conversion in NestJS applications.

## Context

- `SecureCrypto` / `CryptoService` provide `encryptAndHash(plaintext, keyName) → { encrypted: EncryptedValue; hash: string }`.
- `@cobranza-apps/entities` provides `EncryptedValue` and `@IsEncryptedField()`.
- Existing `docs/how-to-configure-in-nestjs.md` has basic interceptor and DTO snippets.

## Constraints

- No new source code in `src/` — documentation/examples only.
- Example code must be copy-pasteable and correct.
- Cross-reference related docs.

## Implementation Steps

### Step 1 — Create `docs/dto-decorator-integration.md`

Structure (with TOC since > 100 lines):

1. **Overview** — purpose; when to use each option; link to `how-to-configure-in-nestjs.md` for `CryptoModule` setup.
2. **Prerequisites** — `CryptoModule` registered; `@cobranza-apps/entities` installed; `class-validator` + NestJS `ValidationPipe`.
3. **DTO shape with `@IsEncryptedField()`**
   - Show `CreateUserDto` with `email` (plain), `encryptedEmail` (`EncryptedValue`), `emailHash` (string).
   - Note that `@IsEncryptedField()` is from `@cobranza-apps/entities`.
4. **Option A — Transformation Pipe**
   - `EncryptPiiPipe` implementing `PipeTransform`.
   - Controller usage with `@UsePipes(EncryptPiiPipe, ValidationPipe)`.
   - Pitfall box: pipe ordering (global `ValidationPipe` runs before controller-level pipes).
5. **Option B — Interceptor**
   - `EncryptPiiInterceptor` implementing `NestInterceptor`.
   - Note: validation already ran on plain `email`; do not decorate `encryptedEmail` with `@IsEncryptedField()` on inbound DTO in this variant.
   - Cross-link to existing `CryptoInterceptor` in `how-to-configure-in-nestjs.md`.
6. **Option C — TypeORM entity listeners + subscriber**
   - Entity listener with static-holder DI workaround (`static crypto: CryptoService`).
   - `CryptoBinder` `OnModuleInit` to bind the service.
   - DI-friendly alternative: `@EventSubscriber()` + `EntitySubscriberInterface`.
   - Register in module providers alongside `TypeOrmModule.forFeature([UserEntity])`.
7. **Recommended patterns for `ms-db-gateway`**
   - Comparison table: encryption coverage, auditability, DI support, response decryption, event-driven/batch writes.
   - Recommendation: subscriber as authoritative encryption for ALL write paths; interceptor/pipe for inbound shaping + outbound decryption in API-facing services.
8. **Common pitfalls** — pipe ordering; logging encrypted payloads; entity-listener DI limitation; hash column must share the service's `hashSalt`.
9. **Reference** — links to `../README.md`, `./how-to-configure-in-nestjs.md`, `../.agent/project-info/architecture.md`, `../.agent/project-info/brief.md`.

### Step 2 — Cross-reference `README.md`

Add to Guides list (~line 299):
```
- [DTO / Decorator Integration](./docs/dto-decorator-integration.md) — Pipes, interceptors, and TypeORM subscribers for automatic plain-string → EncryptedValue + hash conversion.
```

### Step 3 — Cross-reference `docs/README.md`

Add to consumer guides (~line 17):
```
- [DTO / Decorator Integration](./dto-decorator-integration.md) — Automatic encryption via pipes/interceptors and TypeORM subscribers; recommended patterns for ms-db-gateway.
```

### Step 4 — Cross-reference `docs/how-to-configure-in-nestjs.md`

Add one line after the decorator note (~line 260):
```
> For full transformation examples (pipes, interceptors, TypeORM subscribers) and ms-db-gateway recommendations, see [DTO / Decorator Integration](./dto-decorator-integration.md).
```

### Step 5 — Verification

- Confirm no `src/` changes.
- Confirm snippet imports match public API.
- Confirm TOC present (doc > 100 lines).
- Confirm all cross-links resolve to existing files.

### Step 6 — Git

- Commit message: `docs: add DTO/decorator integration examples (pipes, interceptors, TypeORM subscribers)`.

## Acceptance Criteria

- `docs/dto-decorator-integration.md` exists with TOC, three pattern options, and ms-db-gateway recommendations.
- README.md, docs/README.md, and how-to-configure-in-nestjs.md link to the new doc.
- No `src/` files modified.
