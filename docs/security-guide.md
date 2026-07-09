# Security Guide

## Table of Contents

- [Overview](#overview)
- [Key Storage Practices](#key-storage-practices)
- [Rotation Procedure](#rotation-procedure)
- [Common Pitfalls to Avoid](#common-pitfalls-to-avoid)
- [Buffer & Memory Hygiene](#buffer--memory-hygiene)
- [Runtime Input Validation](#runtime-input-validation)
- [Reference](#reference)

## Overview

This guide consolidates security guidance for consumers of `@cobranza-apps/crypto`.
It covers key storage, rotation, common pitfalls, buffer hygiene, and runtime
input validation. It cross-references — but does not duplicate — the detailed
[Security Checklist](./security-checklist.md) and [Key Rotation Guide](./key-rotation-guide.md).

**Audience:** service developers and operators integrating this library into
NestJS microservices or other Node.js runtimes.

**Scope:** the library's API surface, configuration, and runtime behavior.
Infrastructure-level concerns (network policies, OS-level secret storage, incident
response) are outside scope.

## Key Storage Practices

- Load `masterKey` and `hashSalt` from a secrets manager / vault / KMS at boot;
  never hardcode or commit them.
- Keep `masterKey` and `hashSalt` as distinct secrets with independent rotation
  lifecycles.
- Use separate secrets per environment (dev / staging / prod).
- Restrict secret access to the service identity (IAM role / Kubernetes service
  account).
- Never expose keys via logs, traces, error responses, or client payloads.
- Never use the `@cobranza-apps/crypto/testing` keys in production (fixed
  zero-value keys).

## Rotation Procedure

1. **Increment** `currentVersion` (no new master key).
2. **Deploy** — new encryptions carry the new version.
3. **Run an external background `reEncrypt` job** to migrate historical records.
4. **Verify** all records migrated; clear the decryption cache.
5. **Master-key material rotation** is out of library scope — see the
   [Key Rotation Guide](./key-rotation-guide.md) for details.

## Common Pitfalls to Avoid

- **Logging plaintext / decrypted values** — never log the output of `decrypt`.
  Log only non-sensitive error messages.
- **Using `===` to compare hashes** — always use `verifyHash` (constant-time).
- **Sharing a decryption cache across users or tenants** — isolate per request
  or process.
- **Changing `masterKey` material and `currentVersion` simultaneously** — this
  renders all existing ciphertext undecryptable without a full re-encryption
  migration.
- **Using `@cobranza-apps/crypto/testing` keys in production** — the testing
  subpath uses fixed, zero-valued keys that provide no security.
- **Assuming buffer zeroing guarantees secure memory** — zeroing is best-effort,
  defense-in-depth only (see [Buffer & Memory Hygiene](#buffer--memory-hygiene)).
- **Trusting unvalidated `EncryptedValue` payloads from JSON sources** — the
  library now validates `version` and `algorithm` shape, but DTO-level validation
  is the consumer's responsibility.

## Buffer & Memory Hygiene

- `decryptWithAesGcm` zeros the decoded payload buffer and the assembled
  plaintext buffer on both success and failure paths. This is best-effort,
  defense-in-depth against memory dumps and shared-buffer reuse.
- `SecureCrypto.destroy()` zeros cached derived keys and the decoded hash salt
  buffer.
- Zeroing via `buffer.fill(0)` is **not** a guarantee against GC copies,
  V8 heap snapshots, or core dumps. Do not rely on it for classified-level
  threat models.

## Runtime Input Validation

The library now enforces the following at its public API boundary:

- `encrypt`, `hash`, `verifyHash`, `encryptAndHash`, `reEncrypt` — reject
  non-string `plaintext` and `keyName` inputs with a descriptive error.
- `assertValidEncryptedValue` validates `version` (positive integer or
  undefined) and `algorithm` (`'aes-256-gcm'` or undefined) before checking
  value-level constraints (non-empty, base64, length).
- Bulk operations (`encryptObjectFields` / `decryptObjectFields`) reject
  non-object `fieldMap` and `obj` arguments.

Consumers must still validate request DTO shapes — reject non-string /
non-`EncryptedValue` fields before they reach the library.

## Reference

- [Security Checklist](./security-checklist.md) — Production readiness checklist.
- [Key Rotation Guide](./key-rotation-guide.md) — Full rotation workflow and
  re-encryption migration.
- [README — Security Best Practices](../README.md#security-best-practices) —
  Prose guidance on key storage, logging, and general rules.
- [`brief.md`](../.agent/project-info/brief.md) §7 — Project scope and
  security boundaries.
