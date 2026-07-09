# Security Checklist

## Overview

This checklist covers critical security practices for consuming `@cobranza-apps/crypto` in production. Each item is a yes/no question — review before deploying.

## Key Management

- [ ] Load `masterKey` and `hashSalt` from a secrets manager / vault / KMS at boot via `ConfigService`; never hardcode or commit.
- [ ] Keep `masterKey` and `hashSalt` as distinct secrets with independent rotation lifecycles.
- [ ] Use separate secrets per environment (dev / staging / prod).
- [ ] Restrict secret access to the service identity (IAM role / Kubernetes service account).
- [ ] Never expose keys via logs, traces, error responses, or client payloads.
- [ ] Never use the `@cobranza-apps/crypto/testing` keys in production (fixed zero-value keys).

## Logging & Telemetry

- [ ] Never log plaintext, decrypted values, master key, derived keys, hash salt, IVs, or full `encryptedData`.
- [ ] Log only non-sensitive error messages (the library throws closed errors without secret material).
- [ ] Redact or omit `EncryptedValue` fields when logging request / response bodies.
- [ ] `keyName` and `version` are acceptable in internal telemetry only, not user-facing logs.

## Encryption & Hashing Usage

- [ ] Use `encryptAndHash` (not `hash` alone) when the field also needs confidentiality.
- [ ] Use the `EncryptionKey` enum consistently; avoid misspelled string literals.
- [ ] Rely on constant-time `verifyHash` for hash comparisons (never `===` on hashes in security-sensitive paths).
- [ ] Fail closed: handle thrown errors; never return partial results.
- [ ] Each environment uses its own `hashSalt` to prevent cross-environment hash matching.

## Caching

- [ ] Decryption cache is opt-in; isolate per request or process — never shared across users/tenants.
- [ ] Size TTL to the memory budget (cache is TTL-bounded, no hard size cap). See [Performance Considerations](./performance-considerations.md#decryption-cache-opt-in).
- [ ] Invalidate / clear the decryption cache on key rotation. See [Key Rotation Guide](./key-rotation-guide.md#cache-invalidation).

## Key Rotation

- [ ] Increment `currentVersion` to rotate derived keys (single `masterKey`; version is part of HKDF info). See [Key Rotation Guide](./key-rotation-guide.md).
- [ ] Run an external background `reEncrypt` job to migrate historical records.
- [ ] Verify all records migrated before retiring an old version.
- [ ] Do NOT change `masterKey` material and `currentVersion` simultaneously without a full decrypt-all / re-encrypt-all migration (the library retains a single master key).

## Testing & Deployment

- [ ] Fail fast at startup — the `SecureCrypto` constructor validates key sizes.
- [ ] Use `getTestCrypto()` / `TEST_CRYPTO_CONFIG` only in tests.
- [ ] Run the library's own suite (`npm test`) when modifying integration points.

## Reference

- [README Security Best Practices](../README.md#security-best-practices) — Prose guidance.
- [`architecture.md`](../.agent/project-info/architecture.md) — Security boundaries.
- [`brief.md`](../.agent/project-info/brief.md) — Project scope §7.
