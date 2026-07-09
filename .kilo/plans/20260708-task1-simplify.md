# Simplification Plan — Task 1: Complete SecureCrypto Implementation (4.3)

- **Task**: Task 1 — 4.3 Code Simplification
- **Scope**: `src/crypto.service.ts`, `src/crypto.service.encryption.ts`, `src/crypto.service.hashing.ts`, `src/crypto.service.validation.ts`
- **Date**: 2026-07-08
- **Goal**: Remove duplication, reduce unnecessary variables, and improve readability while preserving security and correctness.

## Review Findings

### 1. `src/crypto.service.ts` — Redundant `resolvedKeyName` alias

The `encrypt` method declares `const resolvedKeyName: string = keyName;` only to pass the same value into `deriveKeyForCategory` and `encryptWithAesGcm`. Because `EncryptionKey` is a string enum, the parameter type `EncryptionKey | string` already collapses to `string`, so the alias adds no value.

**Action**: Remove `resolvedKeyName` and use `keyName` directly.

**Before**:
```ts
encrypt(plaintext: string, keyName: EncryptionKey | string): EncryptedValue {
  const resolvedKeyName: string = keyName;
  const key = this.deriveKeyForCategory(resolvedKeyName, this.resolvedConfig.currentVersion);
  return encryptWithAesGcm({
    plaintext,
    key,
    keyName: resolvedKeyName,
    version: this.resolvedConfig.currentVersion,
  });
}
```

**After**:
```ts
encrypt(plaintext: string, keyName: EncryptionKey | string): EncryptedValue {
  const key = this.deriveKeyForCategory(keyName, this.resolvedConfig.currentVersion);
  return encryptWithAesGcm({
    plaintext,
    key,
    keyName,
    version: this.resolvedConfig.currentVersion,
  });
}
```

### 2. `src/crypto.service.ts` — Duplicate field-presence checks in `assertValidEncryptedValue`

Three consecutive `if (!value)` blocks follow the same pattern. Extracting a tiny `assertPresent` helper removes duplication and keeps error messages consistent.

**Action**: Add a private `assertPresent` helper and call it from `assertValidEncryptedValue`.

**Before**:
```ts
private assertValidEncryptedValue(encryptedValue: EncryptedValue): void {
  if (!encryptedValue) {
    throw new Error('Invalid encryptedValue: expected an EncryptedValue object.');
  }
  if (!encryptedValue.encryptedData) {
    throw new Error('Invalid encryptedValue: encryptedData is required.');
  }
  if (!encryptedValue.keyName) {
    throw new Error('Invalid encryptedValue: keyName is required.');
  }
}
```

**After**:
```ts
private assertValidEncryptedValue(encryptedValue: EncryptedValue): void {
  if (!encryptedValue) {
    throw new Error('Invalid encryptedValue: expected an EncryptedValue object.');
  }
  this.assertPresent(encryptedValue.encryptedData, 'encryptedData');
  this.assertPresent(encryptedValue.keyName, 'keyName');
}

private assertPresent(value: unknown, fieldName: string): void {
  if (!value) {
    throw new Error(`Invalid encryptedValue: ${fieldName} is required.`);
  }
}
```

### 3. `src/crypto.service.ts` — Repeated `Object.values(EncryptionKey)` calls

`hasKey` and `getAvailableKeys` both compute the enum values on every invocation. `EncryptionKey` is static, so the result can be cached once.

**Action**: Cache the available keys in a `private readonly` field; `getAvailableKeys` returns a defensive copy.

**Before**:
```ts
hasKey(keyName: string): boolean {
  return this.getAvailableKeys().includes(keyName);
}

getAvailableKeys(): string[] {
  return Object.values(EncryptionKey);
}
```

**After**:
```ts
private readonly availableKeys: string[] = Object.values(EncryptionKey);

hasKey(keyName: string): boolean {
  return this.availableKeys.includes(keyName);
}

getAvailableKeys(): string[] {
  return [...this.availableKeys];
}
```

### 4. `src/crypto.service.ts` & `src/crypto.service.validation.ts` — Split type-only imports

Both files import type-only symbols from `./config.js` on separate lines. Combining them reduces visual noise.

**Action**: Merge type imports into a single statement.

**Before (`crypto.service.ts`)**:
```ts
import type { CryptoConfig } from './config.js';
import { EncryptionKey } from './config.js';
```

**After (`crypto.service.ts`)**:
```ts
import { EncryptionKey, type CryptoConfig } from './config.js';
```

**Before (`crypto.service.validation.ts`)**:
```ts
import type { CryptoConfig } from './config.js';
import type { EncryptionKey } from './config.js';
```

**After (`crypto.service.validation.ts`)**:
```ts
import type { CryptoConfig, EncryptionKey } from './config.js';
```

## Verified Non-Issues (No Action)

- **Max lines per file**: All four files are well under the 200-line limit.
- **Max lines per method**: All method bodies are under 50 lines.
- **Max depth**: No method exceeds 2 levels of nesting.
- **Max arguments**: No method exceeds 2 parameters; param objects are used where needed.
- **Single-section boolean conditions**: All `if` conditions are single-section (e.g., `!config`, `payload.length < MIN_PAYLOAD_BYTES`).
- **Security primitives**: AES-256-GCM IV/authTag handling, HMAC-SHA256 constant-time comparison, and HKDF key derivation are preserved.
- **Magic numbers**: Already replaced by named constants.
- **No commented-out code**: None found.

## Optional / Low-Value Simplifications

These are safe but offer limited readability gain; apply only if desired.

### A. Inline `deriveKeyForCategory` cache lookup
The current cache check uses an intermediate `cachedKey` variable. A single mutable local variable avoids the early-return variable:

```ts
let key = this.derivedKeysCache.get(cacheKey);
if (!key) {
  key = deriveKey({
    masterKey: this.resolvedConfig.masterKey,
    keyName,
    version,
  });
  this.derivedKeysCache.set(cacheKey, key);
}
return key;
```

Trade-off: introduces `let` mutation; current early-return version is already readable. **Not recommended unless the team prefers a single exit point.**

### B. Trim verbose JSDoc
The module/class JSDoc blocks are long. The docs-specialist step can condense them without affecting functionality. Out of scope for code simplification.

## Recommended Changes (Apply in 4.3-fix)

Apply the four "Action" items above to:
- `src/crypto.service.ts`
- `src/crypto.service.validation.ts`

No changes are recommended for `src/crypto.service.encryption.ts` or `src/crypto.service.hashing.ts`.

## Verification Steps (for 4.3-fix implementer)

1. Apply the four changes.
2. Run `npm run build` — must compile cleanly.
3. Run `npm test` — all existing tests must pass.
4. Run `npm run lint` — no new lint errors.
5. Confirm error messages for `assertValidEncryptedValue` still match test expectations (or update tests accordingly).

## Risk Assessment

- **Removing `resolvedKeyName`**: LOW — type remains `string`; no runtime change.
- **`assertPresent` helper**: LOW — error message text changes for `encryptedData`/`keyName`; update tests if assertions compare exact strings.
- **Caching `availableKeys`**: LOW — returns a copy; preserves existing behavior.
- **Merging imports**: LOW — pure style change.

## Out of Scope

- No changes to encryption/HMAC primitives (`crypto.service.encryption.ts`, `crypto.service.hashing.ts`) beyond import cleanup.
- No changes to README, tests, package config, or other TODO tasks.
- No new files created other than this plan file.
