# Task 4 — Documentation Simplification Plan

## Scope

Reviewed docs:

- `docs/getting-started.md`
- `docs/nestjs-integration-example.md`
- `docs/security-checklist.md`
- `docs/key-rotation-guide.md`
- `docs/performance-considerations.md`
- `docs/real-world-scenarios.md`

## Summary

Result: **Simplifications proposed**.

Overall the documentation is clear and well-structured. The main opportunities are:

1. Remove duplicate install/key-generation blocks in `nestjs-integration-example.md` (already covered in `getting-started.md`).
2. Remove redundant `Reference` section at the end of `getting-started.md` (links already appear in `Next Steps`).
3. Merge very short deployment/verification/retirement steps in `key-rotation-guide.md`.
4. Move inline comments inside code blocks in `real-world-scenarios.md` to short prose above the block.
5. Trim a few repetitive comments in `nestjs-integration-example.md` controller and lookup sections.

No changes proposed for `security-checklist.md` or `performance-considerations.md` (already concise).

## Per-File Changes

### docs/getting-started.md

- **Remove `Reference` section**. The same README, brief, and architecture links already appear in `Next Steps`. Removing the duplicated section shortens the file without losing value.

### docs/nestjs-integration-example.md

- **Section 1 — Install**: replace the full `npm install` block with a one-line reference to `getting-started.md`:
  > "Install `@cobranza-apps/crypto` and `@cobranza-apps/entities` as shown in [Getting Started](./getting-started.md#1-install)."
- **Section 2 — Environment & Key Generation**: replace the `openssl` commands with a one-line reference:
  > "Generate `COBRANZA_CRYPTO_MASTER_KEY` and `COBRANZA_CRYPTO_HASH_SALT` as shown in [Getting Started](./getting-started.md#2-generate-your-keys). Store them in `.env` (never commit)."
- **Section 7 — Controller Wiring**: remove the inline comment inside `create()`; the subscriber behavior is already explained in Section 6.
- **Section 8 — Lookup by Hash**: remove the duplicate explanation sentence. Keep only the code snippet and the note about indexed lookups.
- **Where to Go Deeper / Reference**: merge into a single `Reference` section to avoid listing the same links twice.
- **TOC**: keep entries, no changes required unless sections are merged.

### docs/key-rotation-guide.md

- **Merge Step 2, Step 4, and Step 5** into a single section titled `Deploy, Verify, and Retire`:
  - Step 2 content: deploy new config, new writes use new version.
  - Step 4 content: run migration until `version != currentVersion` count is zero.
  - Step 5 content: disable migration job once no v1 records remain.
- **Rationale**: each of these sections is 1–2 sentences. Merging keeps the workflow visible without a fragmented TOC.
- **TOC**: replace the three separate entries with one `Deploy, Verify, and Retire` entry.

### docs/real-world-scenarios.md

- **Scenario 1 — Email**: move the two inline comments (`// On write...`, `// On search...`, `// On read...`) out of the code block into short bullet prose above/below the block. This makes the code snippet shorter and easier to scan.
- **Scenario 2 — Tax ID**: same treatment for inline comments.
- **Scenario 3 — Bank Description**: same treatment for inline comments.
- **Cross-cutting: Decrypt on Read**: shorten the prose. The code snippet already shows the pattern; keep only one sentence of guidance.

### docs/security-checklist.md

- No changes. Already minimal and checklist-oriented.

### docs/performance-considerations.md

- No changes. Sections are already concise bullet points.

## Cross-Doc Redundancy Notes

The following redundancy is acceptable because each doc targets a different reader path:

- `getting-started.md` and `nestjs-integration-example.md` both explain install/keys. After the proposed change, the NestJS doc cross-references the Getting Started doc.
- `real-world-scenarios.md` and `nestjs-integration-example.md` both show hash lookup and decrypt-on-read. This is acceptable because one is scenario-focused and the other is integration-focused.

## Verification Steps

1. Re-read each modified file to confirm no information was lost.
2. Check that all internal anchor links still match the updated headings/TOCs.
3. Run a markdown link checker if available, or manually verify references to `getting-started.md` and `key-rotation-guide.md`.

## Out of Scope

- No source code changes.
- No README changes (unless implementing the plan decides to also update README links).
- No new documentation files.
