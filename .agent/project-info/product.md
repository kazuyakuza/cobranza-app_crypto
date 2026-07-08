# Product: `@cobranza-apps/crypto`

<!-- AI AGENT: This file defines the product vision, target users, and success criteria.
     For technical design see architecture.md. For stack and constraints see tech.md.
     Always resolve inconsistencies in favor of brief.md. -->

> Source of truth: [brief.md](brief.md). Resolve inconsistencies in favor of brief.md.

## Overview / Vision

Provide a single source of truth for encryption, decryption, and deterministic hashing across all Cobranza App microservices. The library enforces consistency, security best practices, and key-rotation readiness while remaining lightweight and framework-agnostic.

## Problem Statement

Each microservice in the Cobranza App platform currently risks implementing cryptographic operations differently. Without a shared, audited path, teams may use inconsistent algorithms, handle keys manually, and make rotation hard. PII, financial, bank, and notification fields need a centralized solution that eliminates these risks.

## Target Users

Backend engineers building NestJS microservices within the Cobranza App platform. The library is framework-agnostic but designed with NestJS conventions in mind, making integration straightforward for teams already using the NestJS ecosystem.

## User (Developer) Experience Goals

- **Simple API**: A single `SecureCrypto` class exposes all operations (encrypt, decrypt, hash, verify, combined `encryptAndHash`). See [Public API Surface →](architecture.md#public-api-surface).
- **Framework-agnostic but NestJS-friendly**: Works in any Node.js app; NestJS projects can inject via `ConfigService` and optional test module.
- **Explicit configuration**: All config is passed in (`CryptoConfig`). No `process.env` reads inside the library. See [Technical Constraints →](tech.md#technical-constraints).
- **Combined operation**: `encryptAndHash` convenience method for PII fields that need both encrypted storage and indexed hash columns.
- **Testing support**: `getTestCrypto()` factory and `test-vectors.ts` for deterministic, reliable unit tests.

## Product Goals / Success Criteria

- Consistent cryptographic behavior across all consuming microservices.
- Security best practices enforced (AES-256-GCM, HKDF-SHA256, HMAC-SHA256, constant-time comparison).
- Key rotation readiness (version-aware decryption; historical keys supported).
- Lightweight: zero runtime dependencies beyond Node.js built-in `crypto`.
- High test coverage with deterministic test vectors.

## Non-Goals

- Password hashing (out of scope; belongs in Auth Microservice).
- Business logic or database interaction.
- Browser / non-Node environment support. See [Technical Constraints →](tech.md#technical-constraints).
- Direct NestJS module integration (except optional testing module).
- Automatic `.env` loading inside the library.

## Reference

Full authoritative scope: [brief.md](brief.md).
