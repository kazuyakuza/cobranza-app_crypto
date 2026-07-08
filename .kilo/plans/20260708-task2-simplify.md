# Simplification Plan — Task 2: Core Types & Configuration (Step 4.3)

- TODO: `.agent/todos/20260707/20260707-todo-1.md` → Task 2
- Implementation plan: `.kilo/plans/20260708-task2-types.md`
- Critical Workflow step: 4.3 Code Review & Simplification (code-simplifier)
- Plan file: `.kilo/plans/20260708-task2-simplify.md`

## Scope (files reviewed)

| File | Lines | Status |
|------|-------|--------|
| `src/config.ts` | 61 | Clean — no changes recommended |
| `src/hkdf.types.ts` | 16 | Clean — no changes recommended |
| `src/hkdf.ts` | 76 | 2 trivial cosmetic opportunities |
| `src/utils.ts` | 58 | 1 trivial cosmetic opportunity |

All files are well under the 200-line limit; all methods are well under the 50-line limit;
max nesting depth ≤ 2 everywhere; no method exceeds the 2-argument limit (`deriveKey` uses a single
params object). The implementation already removes the buggy `=== EQUAL_LENGTH_MATCH` check that
existed in the plan (`timingSafeEqual` returns `boolean`, so `=== 0` would have always returned
`false`); the implementer correctly simplified `constantTimeCompare` to return the boolean directly.

## Rule Compliance Audit (per .kilo/rules/*.md)

| Rule | Status |
|------|--------|
| max-arguments-per-method (≤2) | Compliant — `deriveKey(params: DeriveKeyParams)` single param; helpers ≤2 params |
| max-depth (≤2 levels) | Compliant — deepest nesting is the single `if` guards (1 level) |
| max-lines-per-file (≤200) | Compliant — largest file is 76 lines |
| max-lines-per-method (≤50) | Compliant — longest method body ≈ 12 lines |
| prefer-private-members | Compliant — `buildHkdfInfo`, `decodeMasterKey` are module-private (not exported); only `deriveKey` exported |
| single-section-boolean-conditions | Compliant — `if (!keyName)` and `if (masterKeyBuffer.length !== ...)` are single-section |
| no-commented-code | Compliant — no commented-out code present |
| self-documenting-code | Compliant — names (`decodeMasterKey`, `buildHkdfInfo`, `DERIVED_KEY_LENGTH_BYTES`) are descriptive |
| newline-prevention | Compliant — real newlines, no `\n` literals |
| avoid-magic-numbers | Compliant — `12`, `32`, `"sha256"` are all extracted to named constants |

## Simplification Opportunities Found

### Overall verdict

The Task 2 implementation is already minimal and clean. No structural, behavioral, or significant
readability simplifications are required. Only three trivial cosmetic improvements are identified
below; none alter behavior. The Plan Agent may choose to apply them, skip them, or escalate only if
the codebase has a stricter style preference. **None are blockers for proceeding to 4.4 (Documentation).**

### Opportunity S1 — `hkdf.ts`: collapse multi-line error string concatenation (LOW priority)

**Location:** `src/hkdf.ts` lines 39–42 (`decodeMasterKey`).

**Current:**
```ts
throw new Error(
  `Invalid masterKey: expected ${MASTER_KEY_LENGTH_BYTES} bytes after base64 decode, ` +
    `got ${masterKeyBuffer.length} bytes.`,
);
```

**Proposed:**
```ts
throw new Error(
  `Invalid masterKey: expected ${MASTER_KEY_LENGTH_BYTES} bytes after base64 decode, got ${masterKeyBuffer.length} bytes.`,
);
```

**Rationale:** The two concatenated template literals are already one logical message; a single
template literal is easier to read and grep. No behavior change. Trade-off: the line becomes longer
(~115 chars) which may exceed the project's `printWidth` if one is enforced — verify against
`.prettierrc`/eslint config before applying. If a `printWidth` rule forbids it, keep current form.

### Opportunity S2 — `utils.ts`: rely on type inference for `generateIv` default param (LOW priority)

**Location:** `src/utils.ts` line 34.

**Current:**
```ts
export function generateIv(byteLength: number = IV_LENGTH_BYTES): Buffer {
```

**Proposed:**
```ts
export function generateIv(byteLength = IV_LENGTH_BYTES): Buffer {
```

**Rationale:** `IV_LENGTH_BYTES` is typed as `number` (inferred from literal `12`), so the explicit
`: number` annotation is redundant when a default is present. Minor noise reduction; TypeScript still
infers the parameter type as `number`. No behavior change. Skip if the project's eslint config
requires explicit parameter annotations.

### Opportunity S3 — `utils.ts` / `hkdf.ts`: review trivial one-line wrappers (INFORMATIONAL — keep as-is)

**Location:**
- `bufferToBase64(buffer)` → `return buffer.toString('base64');`
- `concatBuffers(...buffers)` → `return Buffer.concat(buffers);`

**Analysis:** Both are one-line wrappers over Node.js built-ins. They could be inlined at call sites
to reduce the public surface. **Recommendation: KEEP.** Reasons:
1. They are explicitly requested by the Task 2 TODO ("Add helper functions (e.g., `base64ToBuffer`,
   `constantTimeCompare`, etc.)").
2. They form a consistent named pair (`base64ToBuffer` / `bufferToBase64`) and a semantically named
   operation (`concatBuffers` documents intent: `IV + ciphertext + authTag`) that Phase 2
   `crypto.service.ts` will consume.
3. Removing them now would force re-introduction in Phase 2; zero net simplification.

No change required; documented here so a future reviewer does not re-flag them.

## Items Explicitly Verified — No Action Needed

- **Named constants coverage:** `12` (IV), `32` (master key len), `32` (derived key len),
  `"sha256"`, `"cobranza-encryption-v1"` are all extracted. The duplicate `32` value is intentional
  (`MASTER_KEY_LENGTH_BYTES` vs `DERIVED_KEY_LENGTH_BYTES` represent different domain concepts and
  must remain separate to preserve self-documentation — not a redundancy to collapse).
- **`EMPTY_SALT = Buffer.alloc(0)`:** named for clarity over an inline `Buffer.alloc(0)`; keep.
- **`buildHkdfInfo` / `decodeMasterKey` extraction:** both are small, cohesive, single-purpose, and
  testable. Inlining would worsen `deriveKey` readability. Keep as private helpers (complies with
  prefer-private-members).
- **`base64ToBuffer` empty-guard:** prevents silently returning a 0-length buffer for `''`; clear
  non-sensitive error. Keep.
- **`decodeMasterKey` length-assertion:** `Buffer.from('', 'base64')` returns a 0-length buffer
  (does not throw), so the explicit `length !== 32` check is the only defense — NOT redundant with
  any empty-string check. Keep.
- **`constantTimeCompare` early length return:** required because `crypto.timingSafeEqual` throws
  `RangeError` on length mismatch; NOT redundant. Keep.
- **JSDoc `@example` blocks:** accurate and compile-safe. Keep.

## Recommended Action

Apply **S1** and **S2** only if the project's formatter/linter permits the resulting single-line
form and inferred annotation respectively. If either conflicts with `.prettierrc`/eslint, skip —
the current code is already acceptable. **S3** requires no action.

If the Plan Agent judges the cosmetic gain too small to warrant an implementer round-trip, it is
acceptable to close 4.3 with "no simplification required" and proceed to 4.4 (Documentation).

## Out of Scope

- No signature changes to any exported symbol (preserves Task 3 consumer contracts).
- No behavioral changes (all simplifications are pure refactors / cosmetic).
- No new files; no `src/index.ts`, `crypto.service.ts`, or `testing/*` edits (owned by Task 3/4).
- No test changes (Task 4 owns tests).