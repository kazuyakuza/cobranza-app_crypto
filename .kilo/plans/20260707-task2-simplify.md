# Plan: Task 2 — Update README File (Step 4.3 Code Simplification)

- **TODO file**: `.agent/todos/20260707/20260707-todo-2.md`
- **Source plan**: `.kilo/plans/20260707-task2-readme.md`
- **Critical Workflow step**: 4.3 Code Simplification (code-simplifier agent)
- **Date**: 2026-07-07
- **Scope**: `README.md` only — no source code, no `package.json`, no `src/` changes.

## 1. Files Reviewed

| File | Lines | Sections | Status |
|------|-------|----------|--------|
| `README.md` | 272 | 14 (incl. TOC) | Functional, well-structured; several redundancies and one verbose paragraph |

## 2. Simplification Analysis

### 2.1 True redundancies (safe to remove without information loss)

1. **Status badge vs. "Status / Stability" section** — badge text `WIP (API stabilizing)` (line 7) and the section heading + opening sentence "Phase 1 — the library API is stabilizing" (line 29) express the same fact twice. The short section still adds the "algorithms may evolve before 1.0" note, so keep the section, drop the badge (or vice-versa). Dropping the badge preserves the badge row (Node, License) cleanly and keeps the prose explanation.
2. **`process.env` restatement** — non-goals already state "No `process.env` reads; all configuration is passed explicitly via `CryptoConfig`." (line 23). Line 60 ("It never reads `process.env` internally.") repeats it. Drop the restatement; the Configuration code example already shows values arriving via the caller.
3. **NestJS module restatement** — non-goals already state "No ... direct NestJS module (except an optional testing module)." (line 24). Line 123 ("No `CryptoModule` is shipped in the library.") repeats it. Replace the sentence with a shorter framing that introduces the consuming-side example without re-asserting a non-goal.
4. **Key Rotation closing paragraph** — step 4 ("Run an external background job ... outside this library") already conveys that re-encryption is external. Line 210 ("The library decrypts any `version` for which a key is available; re-encryption itself is not performed by this library.") repeats both halves. Remove the trailing paragraph; step 4 + the version-wise decrypt behavior already documented in the API table cover it.
5. **License bare URL** — line 266 links `[LICENSE](./LICENSE)`; line 268 repeats `[http://unlicense.org/](http://unlicense.org/)`. Drop the bare URL line; the LICENSE file is the authoritative source.
6. **Installation peer-dep paragraph** — line 56 restates that `@cobranza-apps/entities` is a peer dependency, which is already visible from the `npm install @cobranza-apps/crypto @cobranza-apps/entities` command on line 53. Condense to a one-line note or remove.

### 2.2 Verbosity tightening (preserve all facts)

7. **Overview first paragraph** (line 13) — 60-word single sentence. Split into two: (a) what the library is; (b) its guarantees. Improves scannability without dropping facts.
8. **Overview "What it does NOT do" bullets** (lines 22–25) — already terse; keep as-is.
9. **Security Best Practices** (lines 193–200) — eight distinct bullets, each a distinct rule. No merge possible. Keep.

### 2.3 Structural — keep

- **Table of Contents** (lines 31–43) — required because the file exceeds the 100-line markdown-generation guidance. Keep, but update only if section names change (none proposed here).
- **API Summary table** (lines 108–119) — minimal and complete. Keep.
- **NestJS Integration Guide code blocks** — each block demonstrates a distinct integration surface (ConfigModule provider, Interceptor, DTO decorator). No redundancy. Keep.
- **Testing subpath section** (lines 214–237) — distinct from the library-own-test section. Keep.

### 2.4 Items intentionally NOT simplified

- The `process.env` usage inside the Configuration code example (lines 66–67) is illustrative consumer code, not library behavior; keep.
- The interceptor `decryptOutbound` stub (lines 171–174) is intentionally a no-op skeleton to show the pattern; keep.
- AGENTS.md footer (lines 270–272) — out of scope for simplification; belongs to step 4.4.

## 3. Recommended Changes

**Verdict: minor simplifications recommended.** Six true-redundancy removals + one sentence split. All facts preserved. Estimated reduction: ~8–12 lines, improved scannability, no risk to technical accuracy.

### 3.1 Concrete edits

| # | Location | Action | Replacement |
|---|----------|--------|-------------|
| 1 | Line 7 | Remove the `status-WIP` badge | Keep Node + License badges only |
| 2 | Line 13 | Split long sentence | Two sentences: (a) "framework-agnostic TypeScript library for Node.js (22.14.0+) providing authenticated encryption and deterministic hashing"; (b) "It uses the built-in `crypto` module with zero runtime dependencies and enforces consistent security, best practices, and key-rotation readiness across all Cobranza App microservices." |
| 3 | Line 56 | Remove the peer-dep paragraph | (Delete; the install command communicates it.) |
| 4 | Line 60 | Remove "It never reads `process.env` internally." | (Delete; already a non-goal.) |
| 5 | Line 123 | Replace "No `CryptoModule` is shipped in the library." | "This section shows how a consuming NestJS service wires it up." |
| 6 | Line 210 | Remove the closing paragraph of Key Rotation Procedure | (Delete; step 4 + API table cover it.) |
| 7 | Lines 266–268 | Drop the bare unlicense.org URL line | Keep only the `LICENSE` file link |

### 3.2 Edits NOT made (deliberate)

- No section merges (Overview, API Summary, NestJS Integration, Security Best Practices, Key Rotation, Testing, Development are each distinct concerns).
- No removal of any code block.
- No change to the TOC (no section renaming proposed).

## 4. Out of Scope

- Editing `AGENTS.md` cross-links (belongs to step 4.4 docs).
- Any `package.json`, `tsconfig.json`, `src/*`, `.agent/project-structure.md` changes.
- Re-running step 4.2 implementation.
- Source-code simplification (none in this file).

## 5. Next-Step Handoff

- Step 4.3 code-simplifier: **minor fix plan produced.** Plan Agent reviews and, if approved, assigns the 7 edits above to the implementer sub-agent as a single sub-task.
- Max 3 review cycles per Critical Workflow; escalate to user if implementer rejects any edit.

## 6. Summary

- Files reviewed: 1 / 1 (`README.md`).
- Required edits proposed: **7** (6 redundancy removals + 1 sentence split).
- Estimated line reduction: ~8–12 lines; no information loss.
- All proposed edits preserve every documented fact; only duplication and one verbose sentence are targeted.