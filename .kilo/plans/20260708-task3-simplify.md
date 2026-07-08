# Simplification Plan — Task 3: SecureCrypto Core Class (Skeleton), Step 4.3

**Plan file:** `.kilo/plans/20260708-task3-simplify.md`
**TODO source:** `.agent/todos/20260707/20260707-todo-1.md` → Task 3
**Step under execution:** 4.3 Code Review & Simplification (code-simplifier sub-agent)
**Files reviewed:** `src/crypto.service.ts` (214 lines), `src/index.ts` (17 lines)
**Reference plan:** `.kilo/plans/20260708-task3-skeleton.md`

## 1. Scope & Method

Single-discrete-step sub-agent task. Scope is **simplification planning only**: identify
opportunities, record concrete recommendations, and save this plan. No code changes are
made in this step. Files outside `src/crypto.service.ts` and `src/index.ts` are out of scope.

Method: read both files, cross-check against the approved skeleton plan, isolate the two
patterns explicitly flagged by the caller (the `void this.<field>;` constructor lines and
the `_`-prefixed stub parameters), and assess against project rules
(`no-commented-code`, `self-documenting-code`, `prefer-private-members`, `max-lines-per-method`,
`single-section-boolean-conditions`, max 200 lines/src file).

## 2. Findings

### 2.1 Deviations from the approved skeleton plan

The implementer deviated from the approved plan in two ways during step 4.2:

a) **Constructor gained `void this.<field>;` lines** (crypto.service.ts:119–121), which are
   NOT in the approved plan (plan §2 line 145–148 has a clean 2-line constructor body).

b) **Stub parameters were renamed with a `_` prefix** (`_plaintext`, `_keyName`,
   `_encryptedValue`, `_expectedHash`), while the approved plan used bare names
   (`plaintext`, `keyName`, ...). The original signatures still match brief §4.1 byte-for-byte
   because only the parameter *names* changed, not types/order.

### 2.2 Why the deviations were introduced

Both deviations are workarounds for the `noUnusedLocals` + `noUnusedParameters` tsconfig flags
(`tsconfig.json:19–20`):

- Stub methods throw `new Error(PHASE_1_NOT_IMPLEMENTED)` and never read their parameters.
  With `noUnusedParameters: true`, bare parameter names trigger TS6133. The `_` prefix is
  TypeScript's documented exemption for intentionally-unused parameters.
- The constructor assigns `this.resolvedConfig` and `this.derivedKeysCache`, but Phase 1 never
  reads either private field afterward. The implementer added `void this.<field>;` asserting
  this silences an unused-symbol diagnostic.

### 2.3 Assessment — `void this.<field>;` constructor lines (the real smell)

TypeScript's `noUnusedLocals` reports unused **locals**, **imports**, and (via
`noUnusedParameters`) unused **parameters**. It does **not** report unused private class
properties or methods (tsc has no built-in check for unused class members under these flags;
this is a long-standing gap with an open feature request). Therefore the `void this.x;`
lines are expected to be **unnecessary** — `npm run build` should pass without them.

Empirical confirmation is required before merging (step 3 below), because the environment's
strict permission profile prevented running `tsc` during this planning step. Probe files were
written to `C:\Users\ibej_\.local\share\kilo\tool-output\` (`probeA.ts`, `probeB.ts`,
`probe-tsconfig.json`) for the implementer to `npm run build`/`tsc` and confirm.

Independent of the tsc question, the `void this.x;` pattern is a genuine code smell:
it is dead code whose only purpose is to suppress a (likely non-existent) diagnostic, plus a
misleading comment ("Suppress noUnusedLocals in skeleton"). It violates the
self-documenting-code and no-commented-code ethos and reads as cargo-cult.

Recommended resolution: **remove** lines 119–121 (the comment + the two `void` statements).
If `npm run build` then fails with TS6133 on `resolvedConfig`/`derivedKeysCache`, fall back to
the cleaner alternative in §3.2 (do NOT reintroduce the `void` lines).

### 2.4 Assessment — `_`-prefixed stub parameters (keep as-is)

The `_` prefix on stub parameters is the **idiomatic, documented** TypeScript convention for
intentionally-unused parameters under `noUnusedParameters`. Removing it would re-introduce
TS6133 on every stub. The caller's question ("could this be handled differently?") is answered
negatively by evaluating the alternatives, all of which are worse:

| Alternative                                               | Verdict                                                            |
|-----------------------------------------------------------|--------------------------------------------------------------------|
| Bare param names + per-line `// @ts-expect-error`         | Noisy; `@ts-expect-error` targets a *line*, not a parameter; brittle on signature change. |
| Bare param names + `void plaintext;` in each method body  | More boilerplate than the prefix; adds dead-code inside each method. |
| Bare param names + disable `noUnusedParameters`          | Weakens type safety project-wide; trades a local concern for a global one. Bad. |
| Rest params (`..._args: unknown[]`)                      | Breaks brief §4.1 signatures (must match byte-for-byte). Reject. |
| Move `void` to consume the param in the throwing expr    | e.g. `throw (void plaintext, new Error(...))` — unreadable, worse than `_`. |

Recommendation: **keep the `_` prefix unchanged.** No change proposed for stub parameters.

### 2.5 Other simplification opportunities in `src/crypto.service.ts`

Reviewing the rest of the file, the structure is clean and rule-compliant (214 lines —
the max-lines-per-file rule applies to `src/` at ≤200; see note in §4). The following are
**optional / minor** and are recorded for the Plan Agent's adjudication, not mandated:

a) **`validateMasterKey` / `validateHashSalt` duplication** (lines 44–68). Both perform a
   non-empty base64 check; only `validateMasterKey` adds a 32-byte length test. They could be
   merged into a single `requireNonEmptyBase64(label: 'masterKey' | 'hashSalt', value: string)`
   helper with `validateMasterKey` adding the length post-check. **Verdict: optional, marginal.**
   The current two-function form reads clearly and self-documents (rule: self-documenting-code);
   merging adds a generic label-parameterized helper that is arguably LESS readable at this
   scale. Recommend NO change unless other callers emerge.

b) **`ResolvedConfig` + `resolveConfig` indirection** (lines 26–36, 77–86). The
   `ResolvedConfig` interface currently re-stores the same four fields with only
   `currentVersion ?? DEFAULT_VERSION` as a real transformation. For a skeleton that Phase 2
   will rewrite, this layer is arguably over-engineered. **Verdict: defer.** Phase 2 will
   need a resolved/validated shape anyway (it reads `this.resolvedConfig.currentVersion`,
   `masterKey`, `hashSalt`); removing it now only to re-add it in Phase 2 is churn, not
   simplification. Recommend NO change. Record as awareness.

c) **`getAvailableKeys()` allocates a new array per call** (line 212), and `hasKey` calls it
   then `.includes` (linear scan over 5 values). **Verdict: leave.** 5-element array, called
   rarely; caching as a private static would add complexity for no measurable benefit at
   skeleton scale. The JSDoc contract ("Returns a new array") is intentional to prevent
   external mutation. Recommend NO change.

d) **`import type { CryptoConfig }` split from `import { EncryptionKey }`** (lines 19–20).
   The approved plan had a single combined value import `{ CryptoConfig, EncryptionKey }`;
   the implementation correctly split `CryptoConfig` into a `type`-only import (it is an
   interface). This is a **strict improvement** (cleaner emitted JS, clearer intent). Keep.

### 2.6 Findings for `src/index.ts`

17 lines, minimal barrel. No complexity, no duplication, rule-compliant. **No
simplification opportunities.** No change proposed.

## 3. Concrete Simplification Steps (for the implementer sub-agent, next 4.3 task)

### 3.1 Primary (mandatory) change — `src/crypto.service.ts`

Remove the unused-suppression workaround from the constructor:

**Before (lines 116–122):**
```ts
  constructor(config: CryptoConfig) {
    this.resolvedConfig = resolveConfig(config);
    this.derivedKeysCache = new Map<string, Buffer>();
    // Suppress noUnusedLocals in skeleton (Phase 2 reads these properties).
    void this.resolvedConfig;
    void this.derivedKeysCache;
  }
```

**After:**
```ts
  constructor(config: CryptoConfig) {
    this.resolvedConfig = resolveConfig(config);
    this.derivedKeysCache = new Map<string, Buffer>();
  }
```

Net: −3 lines, removes dead code + a misleading comment. Restores the constructor exactly to
the approved skeleton plan (plan §2 line 145–148).

### 3.2 Verification gate (mandatory before merge)

After applying §3.1, run:
```
npm run build
npm run lint
```
- If `npm run build` **passes**: the `void` lines were unnecessary; commit §3.1 as-is.
- If `npm run build` **fails** with `TS6133: 'resolvedConfig'/'derivedKeysCache' is declared
  but its value is never read`: do NOT reintroduce the `void` lines. Instead apply the cleaner
  fallback — prefix the private readonly fields with an underscore-exempt pattern is **not**
  valid for class properties (tsc underscore exemption is parameters-only), so use a single
  explicit `@ts-expect-error`: not preferred. Preferred fallback: keep the assignments and add
  private readonly "phase markers" that genuinely use the fields without side effects, e.g.
  a private no-op accessor:
  ```ts
  /** @internal Phase 2 reads the resolved config. */
  private get _configSnapshot(): ResolvedConfig {
    return this.resolvedConfig;
  }
  /** @internal Phase 2 reads the derived-key cache. */
  private get _cacheSnapshot(): Map<string, Buffer> {
    return this.derivedKeysCache;
  }
  ```
  …but ONLY if verification proves the diagnostic fires. The expectation per §2.3 is that it
  will **not** fire, so §3.2 is expected to be a no-op confirmation.

### 3.3 No change (explicitly retained)

- `_`-prefixed stub parameters in `encrypt`, `decrypt`, `hash`, `verifyHash`, `encryptAndHash`
  (`src/crypto.service.ts:135,148,159,172,185-188`) — idiomatic, required by `noUnusedParameters`.
- `index.ts` — no simplification available.

### 3.4 Out of scope (explicitly NOT done)

- Merging `validateMasterKey`/`validateHashSalt` (§2.5 a) — deferred / declined.
- Removing `ResolvedConfig`/`resolveConfig` indirection (§2.5 b) — deferred to Phase 2.
- Caching `getAvailableKeys()` result (§2.5 c) — declined.
- Any change to `index.ts`.
- Step 4.4 (docs), 4.5 (verification), 4.6 (completion) — separate steps.
- Probe files in `C:\Users\ibej_\.local\share\kilo\tool-output\` — temporary artifacts; the
  implementer may delete them after §3.2 confirmation (out of repo, no git impact).

## 4. Compliance Notes

- **max-lines-per-file rule**: `crypto.service.ts` is 214 lines, exceeding the ≤200 src-file
  cap AFTER the simplification it becomes 211 — still over. **This is a pre-existing condition
  from step 4.2, not introduced by this simplification.** Flagged for the Plan Agent: Phase 2
  will likely split validation helpers into `crypto.service.types.ts` / a small
  `crypto.validation.ts` to bring it under 200. Out of scope to fix here (would be a
  structural change beyond 4.3 "simplify"); recorded as a follow-up for step 4.3-fix
  adjudication or a future TODO.
- **max-lines-per-method**: longest method ≈ 6 lines; well under 50. OK.
- **max-depth / single-section boolean**: no violations. OK.
- **no-commented-code**: §3.1 removes the only comment that exists solely to justify dead
  code; the file otherwise has only JSDoc.
- **prefer-private-members**: fields stay private; the optional fallback getters in §3.2 are
  also private. OK.
- **self-documenting-code**: removing the `void` hack + misleading comment improves this.

## 5. Summary Table

| Item                                              | Action      | Priority | Effort |
|---------------------------------------------------|-------------|----------|--------|
| `void this.<field>;` constructor workaround        | Remove      | Must     | Trivial |
| Verify removal does not break `npm run build`     | Run gate    | Must     | Trivial |
| `_`-prefixed stub parameters                       | Keep        | —        | —     |
| Merge validators                                   | Decline     | Optional | —     |
| Remove `ResolvedConfig` indirection                 | Defer (P2)  | Optional | —     |
| Cache `getAvailableKeys()`                         | Decline     | Optional | —     |
| `index.ts`                                         | No change   | —        | —     |
| File >200 lines                                     | Flag (later) | Follow-up | Out of scope here |

## 6. What was done / not done

- **Done:** Reviewed `src/crypto.service.ts` and `src/index.ts` against the approved skeleton
  plan; assessed both caller-flagged patterns; evaluated alternatives; produced this decisive
  simplification plan and saved it to `.kilo/plans/20260708-task3-simplify.md`.
- **Not done (by design):** No source edits (this is the planning step 4.3). Verification
  `npm run build` was NOT executed because the environment's permission profile blocked all
  `bash` invocations during this step; verification is delegated to the implementer as the
  mandatory gate in §3.2. No changes to `index.ts`. No structural refactor for the >200-line
  condition (recorded as a follow-up).