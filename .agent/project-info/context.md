# Context: `@cobranza-apps/crypto`

> Source of truth: [brief.md](brief.md). Resolve inconsistencies in favor of brief.md.

## Current Work Focus

Phase 1 project initialization. No cryptography logic implemented yet (deferred to Phase 2 per todo `20260707-todo-1.md`).

## Recent Changes

- Base template (`base-project-ai-agent-driven`) cloned as the starting point.
- `brief.md` authored defining the `@cobranza-apps/crypto` library spec.
- `.agent/project-info/.initialized` marker was present (partial initialization state).

## Current State

- `src/` contains only `.gitkeep`.
- No `package.json`, no `tsconfig.json`.
- `README.md` is still the base template content.
- `.agent/project-info/` now contains all 5 core files: `brief.md`, `product.md`, `context.md`, `architecture.md`, `tech.md`.
- `.agent/project-info/.initialized` has been removed.

## Immediate Next Steps

1. **Task 1** (done): Initialize project info files.
2. **Task 2**: Update README file.
3. **Task 3**: Define project structure.
4. **Task 4**: Set up & configure `package.json`, install dependencies.

## Open Questions / Decisions Pending

- AES-256-GCM + HKDF-SHA256 and HMAC-SHA256 are proposed algorithms (per brief §3). Confirm as final or select alternatives.
- Library layout: the brief's §8 shows a `packages/crypto/` monorepo structure, but the actual repo is a single package at the root. This root-level single-package layout is the chosen structure; the brief's diagram serves as conceptual reference only.
- Key rotation scheme details (`version` tracking strategy) to be finalized in Phase 2.

## Reference

- [brief.md](brief.md) — authoritative scope and requirements.
- `.agent/todos/20260707/20260707-todo-0.md` — task list for Phase 1.
