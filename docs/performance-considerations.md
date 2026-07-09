# Performance Considerations

## Table of Contents

- [Overview](#overview)
- [Key Derivation (HKDF) and the Internal Cache](#key-derivation-hkdf-and-the-internal-cache)
- [Synchronous Crypto Cost](#synchronous-crypto-cost)
- [Ciphertext Size Overhead](#ciphertext-size-overhead)
- [Decryption Cache (opt-in)](#decryption-cache-opt-in)
- [Hashing](#hashing)
- [Bulk Re-encryption](#bulk-re-encryption)
- [AES-256-GCM Limits](#aes-256-gcm-limits)
- [Concurrency & Sharing](#concurrency--sharing)
- [Reference](#reference)

## Overview

This guide covers the performance characteristics of `@cobranza-apps/crypto` — what to expect, where caching helps, and how to plan for scale.

## Key Derivation (HKDF) and the Internal Cache

- `hkdfSync` runs **once per `${keyName}:v${version}`** combination. Results are cached in an in-memory `Map` keyed by `${keyName}:v${version}`.
- The first `encrypt` or `decrypt` call for each `(keyName, version)` pair pays the HKDF cost (microseconds on modern CPUs). Subsequent calls are an O(1) map lookup.
- No configuration needed — the cache is internal and automatic.

## Synchronous Crypto Cost

- `createCipheriv` / `update` / `final` are synchronous and CPU-bound; they block the Node.js event loop.
- For typical PII fields (< 1 KB) each encrypt/decrypt is sub-millisecond and negligible in request paths.
- For large payloads (e.g. long notification bodies), offload to a worker thread or batch outside the hot path if latency-sensitive.
- Input guards cap plaintext at 1,000,000 UTF-8 bytes and `encryptedData` at 2,000,000 characters to mitigate oversized-input DoS.

## Ciphertext Size Overhead

- Every encrypted value adds `IV(12) + authTag(16) = 28 bytes` of overhead before Base64.
- Base64 inflates by ~33%. Plan column/storage sizes accordingly:
  - A 20-byte plaintext → ~48 bytes raw → ~64 base64 characters.
  - A 100-byte plaintext → ~128 bytes raw → ~172 base64 characters.

## Decryption Cache (opt-in)

- `createDecryptionCache(defaultTtlMs)` returns a `TtlCache<string, string>` keyed by the encrypted-payload string.
- TTL-bounded with lazy eviction + `purgeExpired()`. **No hard size cap** — size TTL to your memory budget.
- Isolate per request or process; never share across users or tenants.
- Clear on key rotation (see [Key Rotation Guide](./key-rotation-guide.md#cache-invalidation)).

## Hashing

- `hash` / `verifyHash` are deterministic and idempotent — safe to call repeatedly with no caching benefit.
- `verifyHash` uses constant-time comparison (`crypto.timingSafeEqual`); the cost is negligible.

## Bulk Re-encryption

- Run as an external background job with batching and rate-limiting.
- Process in pages; re-encrypt via `reEncrypt` (one call = decrypt + re-encrypt).
- Guard against double-processing — records produce new ciphertext each run due to random IV.

## AES-256-GCM Limits

- 96-bit (12-byte) IV with random generation gives a negligible IV-collision probability until ~2^48 encryptions per key.
- Each `(keyName, version)` combination has its own IV space and derived key.
- Version rotation occurs well before any practical limit; in practice this limit is never approached.

## Concurrency & Sharing

- A single `SecureCrypto` (or injected `CryptoService`) instance is safe to share across requests in Node's single-threaded model.
- The only mutable internal state is the derived-keys `Map`, which is append-only after first derivation; concurrent sync access is safe.

## Reference

- [README Performance Considerations](../README.md#performance-considerations) — Condensed notes.
- [Key Rotation Guide](./key-rotation-guide.md#cache-invalidation) — Cache invalidation on rotation.
- [`architecture.md`](../.agent/project-info/architecture.md) — Critical paths.
- [`brief.md`](../.agent/project-info/brief.md) — Project scope §7.
