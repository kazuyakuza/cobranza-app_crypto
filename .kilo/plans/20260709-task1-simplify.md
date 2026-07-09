# Task 1 Code Simplification Plan

## Scope

Files reviewed from Task 1 implementation:

- `src/crypto.service.bulk.ts`
- `src/utils/decryption-cache.ts`
- `src/crypto.service.ts`
- `tests/crypto.bulk.spec.ts`
- `tests/crypto.cache-wrapper.spec.ts`

Goal: reduce complexity, remove duplication, and clarify names **without changing runtime behavior**.

---

## 1. `src/crypto.service.bulk.ts` — share bulk iteration logic

### Current issue

`encryptObjectFields` and `decryptObjectFields` duplicate the same orchestration:

1. Shallow-clone the object.
2. Convert `fieldMap` to typed entries.
3. Skip fields absent from the source object.
4. Validate the present field.
5. Transform and assign to the clone.

Only steps 4 and 5 differ between the two functions.

### Proposed change

Extract a small generator that owns the shared iteration/skip logic:

```ts
function* iterateMappedFields<T>(
  obj: T,
  fieldMap: BulkFieldMap<T>,
): Generator<{ field: keyof T; value: unknown; keyName: EncryptionKey | string }> {
  const entries = Object.entries(fieldMap) as Array<[keyof T, EncryptionKey | string]>;
  for (const [field, keyName] of entries) {
    if (field in (obj as object)) {
      yield { field, value: (obj as Record<string, unknown>)[field as string], keyName };
    }
  }
}
```

Then rewrite both public functions to consume it:

```ts
export function encryptObjectFields<T>(params: BulkOperationParams<T>): T {
  const { crypto, obj, fieldMap } = params;
  const clone = { ...(obj as Record<string, unknown>) } as T;
  for (const { field, value, keyName } of iterateMappedFields(obj, fieldMap)) {
    assertStringValue(value, field);
    clone[field] = crypto.encrypt(value, keyName) as T[keyof T];
  }
  return clone;
}

export function decryptObjectFields<T>(params: BulkOperationParams<T>): T {
  const { crypto, obj, fieldMap } = params;
  const clone = { ...(obj as Record<string, unknown>) } as T;
  for (const { field, value } of iterateMappedFields(obj, fieldMap)) {
    assertEncryptedValue(value, field);
    clone[field] = crypto.decrypt(value) as T[keyof T];
  }
  return clone;
}
```

Also replace the current `assertStringFieldValue` and `assertEncryptedFieldValue` helpers with assertion functions that operate on the already-extracted value:

```ts
function assertStringValue<T>(value: unknown, field: keyof T): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid field "${String(field)}": expected a string to encrypt.`);
  }
}

function assertEncryptedValue<T>(value: unknown, field: keyof T): asserts value is EncryptedValue {
  if (!isEncryptedValue(value)) {
    throw new Error(`Invalid field "${String(field)}": expected an EncryptedValue to decrypt.`);
  }
}
```

### Expected benefit

- Eliminates ~25 lines of duplicated iteration/clone code.
- The two public functions now express only their unique concern (encryption vs decryption).
- Type casts stay in one place (`iterateMappedFields`).

---

## 2. `src/crypto.service.bulk.ts` — fix single-section boolean condition violation

### Current issue

`isEncryptedValue` violates `.kilo/rules/single-section-boolean-conditions.md`:

```ts
function isEncryptedValue(value: unknown): value is EncryptedValue {
  return typeof value === 'object'
    && value !== null
    && typeof (value as EncryptedValue).encryptedData === 'string';
}
```

### Proposed change

Split into single-section predicates:

```ts
function isNonNullObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function hasStringEncryptedData(value: object): value is EncryptedValue {
  return typeof (value as EncryptedValue).encryptedData === 'string';
}

function isEncryptedValue(value: unknown): value is EncryptedValue {
  return isNonNullObject(value) && hasStringEncryptedData(value);
}
```

### Expected benefit

- Complies with the single-section boolean condition rule.
- Each predicate has a single, self-documenting responsibility.

---

## 3. `src/utils/decryption-cache.ts` — trim unnecessary wrapper layers

### Current issue

- `resolveTtlMs` is a one-line function only used once.
- The module JSDoc and interface JSDoc are verbose for a thin wrapper.
- The wrapper itself is reasonable (it binds a decryptor), but it can be expressed more compactly.

### Proposed change

1. Inline `resolveTtlMs` into `createDecryptionCacheWrapper`:

```ts
const ttlMs = options?.ttlMs ?? DEFAULT_DECRYPTION_TTL_MS;
const cache = new TtlCache<string, string>({ defaultTtlMs: ttlMs });
```

2. Remove or condense redundant JSDoc blocks; keep only the public function/interface docs that add value for AI agents and consumers.

3. Keep `CachedDecryptor` and `SecureCryptoDecryptor` interfaces — they decouple `SecureCrypto.withCache` from the generic cache internals, which is the right abstraction.

### Expected benefit

- Removes ~10 lines and an extra hop without losing clarity.
- Behavior remains identical.

---

## 4. `src/crypto.service.ts` — keep facade compact

### Current issue

The file is currently within the 200-line limit (~155 lines), but several new one-line facade methods (`encryptObject`, `decryptObject`, `withCache`) are formatted over multiple lines, and some JSDoc blocks are longer than necessary.

### Proposed change

1. Collapse trivial forwarding methods to single lines where it improves readability:

```ts
encryptObject<T>(obj: T, fieldMap: BulkFieldMap<T>): T {
  return encryptObjectFields({ crypto: this, obj, fieldMap });
}

decryptObject<T>(obj: T, fieldMap: BulkFieldMap<T>): T {
  return decryptObjectFields({ crypto: this, obj, fieldMap });
}

withCache(options?: { ttlMs?: number }): CachedDecryptor {
  return createDecryptionCacheWrapper(this, options);
}
```

2. Trim JSDoc on the new methods to one or two lines; the linked module documentation already explains behavior.

### Expected benefit

- Keeps the facade well under the 200-line source limit.
- Reduces visual noise around simple delegations.

---

## 5. `tests/crypto.bulk.spec.ts` — reduce assertion duplication

### Current issue

- `typeof asEncryptedRecord(encrypted).name!.encryptedData` is repeated in multiple tests.
- Several casts, e.g. `(encrypted as unknown as Person).email`, are redundant because `encrypted` is already typed as `Person`.

### Proposed change

Add a focused test helper and remove redundant casts:

```ts
function expectEncrypted(
  obj: unknown,
  field: string,
): void {
  const record = obj as Record<string, EncryptedValue>;
  expect(typeof record[field]!.encryptedData).toBe('string');
}
```

Then replace repeated assertions:

```ts
// before
expect(typeof asEncryptedRecord(encrypted).name!.encryptedData).toBe('string');

// after
expectEncrypted(encrypted, 'name');
```

Also remove casts like `(encrypted as unknown as Person).email` in favor of `expect(encrypted.email).toBe(...)` where TypeScript already infers `Person`.

### Expected benefit

- Removes ~5–6 lines of duplicated assertion boilerplate.
- Tests read at a higher level of intent.

---

## 6. `tests/crypto.cache-wrapper.spec.ts` — deduplicate fake decryptor setup

### Current issue

- Two TTL-validation tests create identical fake decryptors inline.
- The "cache hit" test only verifies call count; it does not assert the cached return value.

### Proposed change

1. Extract a small helper for the throw-on-invalid-TTL tests:

```ts
function createThrowingDecryptor(): { decrypt: () => string } {
  return { decrypt: () => 'x' };
}
```

2. Optionally merge the two invalid-TTL cases into one parameterized test or keep them separate with the helper.

3. Strengthen the cache-hit test to assert the returned plaintext:

```ts
expect(cached.decrypt(encrypted)).toBe('plain-AAAA');
expect(cached.decrypt(encrypted)).toBe('plain-AAAA');
expect(calls).toHaveLength(1);
```

### Expected benefit

- Removes duplicated fake-object setup.
- Makes the cache-hit test verify both behavior and return value.

---

## Top 3 Simplification Opportunities

1. **Share bulk iteration between `encryptObjectFields` and `decryptObjectFields`**  
   The two functions are nearly identical except for validation and transformation. Extracting `iterateMappedFields` removes ~25 duplicated lines and makes each function express only its unique concern.

2. **Fix the multi-section boolean condition in `isEncryptedValue`**  
   Splitting the condition into `isNonNullObject` and `hasStringEncryptedData` directly addresses `.kilo/rules/single-section-boolean-conditions.md` and improves readability.

3. **Add test helpers to cut assertion duplication**  
   `expectEncrypted` in `tests/crypto.bulk.spec.ts` and a shared fake-decryptor helper in `tests/crypto.cache-wrapper.spec.ts` remove repeated casts and object setup, making tests shorter and clearer.

---

## Non-Goals

- Do not change public API signatures (`BulkFieldMap`, `CachedDecryptor`, `SecureCrypto.withCache`, etc.).
- Do not alter encryption/decryption behavior, error messages, or cache semantics.
- Do not remove the `decryption-cache.ts` wrapper entirely; it is a justified abstraction over the generic `TtlCache`.
